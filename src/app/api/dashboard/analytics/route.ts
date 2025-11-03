import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * OPTIMIZED Dashboard Analytics API - Server-Side Pagination & Performance
 * 
 * This endpoint provides comprehensive analytics data for Dashboard V2 PivotGrid
 * with server-side pagination and optimized queries
 * 
 * Multi-tenant: Filtered by businessId from session
 * RBAC: Requires DASHBOARD_VIEW permission
 */

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Permission check
        if (!hasPermission(session.user, PERMISSIONS.DASHBOARD_VIEW)) {
            return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
        }

        const requestBody = await request.json()

        const user = session.user as any
        const businessId = Number(user.businessId)
        if (!Number.isInteger(businessId)) {
            return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
        }

        // Pagination parameters
        const skip = requestBody.skip || 0
        const take = Math.min(requestBody.take || 1000, 5000) // Max 5000 records per request

        const startDate = requestBody.startDate
        const endDate = requestBody.endDate
        const locationIds = normalizeIdArray(requestBody.locationIds)
        const categoryIds = normalizeIdArray(requestBody.categoryIds)
        const brandIds = normalizeIdArray(requestBody.brandIds)

        const dateFilter: Prisma.DateTimeFilter | undefined =
            startDate || endDate
                ? {
                    ...(startDate ? { gte: new Date(startDate) } : {}),
                    ...(endDate ? { lte: new Date(endDate) } : {}),
                }
                : undefined

        const locationFilter: Prisma.IntFilter | undefined =
            locationIds.length > 0 ? { in: locationIds } : undefined

        const categoryFilter: Prisma.IntFilter | undefined =
            categoryIds.length > 0 ? { in: categoryIds } : undefined

        const brandFilter: Prisma.IntFilter | undefined =
            brandIds.length > 0 ? { in: brandIds } : undefined

        // Execute queries in parallel for metadata
        const [totalSalesCount, locations, categories, brands] = await Promise.all([
            // Get total count for pagination
            prisma.sale.count({
                where: {
                    businessId,
                    ...(dateFilter ? { createdAt: dateFilter } : {}),
                    ...(locationFilter ? { locationId: locationFilter } : {}),
                    status: {
                        notIn: ['voided', 'cancelled']
                    }
                }
            }),

            // Fetch locations for filter options
            prisma.businessLocation.findMany({
                where: {
                    businessId,
                    isActive: true,
                },
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    name: 'asc'
                }
            }),

            // Fetch categories for filter options
            prisma.category.findMany({
                where: {
                    businessId,
                    ...(categoryFilter ? { id: categoryFilter } : {}),
                },
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    name: 'asc'
                }
            }),

            // Fetch brands for filter options
            prisma.brand.findMany({
                where: {
                    businessId,
                    ...(brandFilter ? { id: brandFilter } : {}),
                },
                select: {
                    id: true,
                    name: true,
                },
                orderBy: {
                    name: 'asc'
                }
            })
        ])

        // Optimized sales query with minimal includes and pagination
        const salesData = await prisma.sale.findMany({
            where: {
                businessId,
                ...(dateFilter ? { createdAt: dateFilter } : {}),
                ...(locationFilter ? { locationId: locationFilter } : {}),
                status: {
                    notIn: ['voided', 'cancelled']
                }
            },
            select: {
                id: true,
                invoiceNumber: true,
                createdAt: true,
                saleDate: true,
                subtotal: true,
                discountAmount: true,
                totalAmount: true,
                locationId: true,
                createdBy: true,
                customerId: true,
                items: {
                    select: {
                        id: true,
                        quantity: true,
                        unitPrice: true,
                        unitCost: true,
                        productId: true,
                        productVariationId: true,
                        product: {
                            select: {
                                id: true,
                                name: true,
                                sku: true,
                                categoryId: true,
                                brandId: true,
                                unitId: true,
                                category: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                brand: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                },
                                unit: {
                                    select: {
                                        id: true,
                                        name: true
                                    }
                                }
                            }
                        }
                    }
                },
                location: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        username: true,
                        firstName: true,
                        lastName: true,
                    }
                },
                payments: {
                    select: {
                        paymentMethod: true,
                        amount: true
                    }
                },
            },
            orderBy: {
                createdAt: 'desc'
            },
            skip,
            take
        })

        // Transform data for PivotGrid (optimized)
        const analyticsData = salesData.flatMap(sale => {
            // Get primary payment method (most common or largest amount)
            const primaryPayment = sale.payments.length > 0
                ? sale.payments.reduce((max, p) => Number(p.amount) > Number(max.amount) ? p : max, sale.payments[0])
                : null

            return sale.items.map(item => {
                const product = item.product
                const category = product?.category
                const brand = product?.brand
                const unit = product?.unit

                // Calculate metrics
                const quantity = Number(item.quantity)
                const revenue = Number(item.unitPrice) * quantity
                const cost = Number(item.unitCost) * quantity
                const profit = revenue - cost

                // Calculate item's share of sale discount (proportional to item subtotal)
                const itemSubtotal = revenue
                const saleSubtotal = Number(sale.subtotal)
                const itemDiscountShare = saleSubtotal > 0
                    ? (itemSubtotal / saleSubtotal) * Number(sale.discountAmount)
                    : 0

                // Extract date dimensions
                const saleDate = new Date(sale.saleDate || sale.createdAt)
                const year = saleDate.getFullYear()
                const quarter = Math.ceil((saleDate.getMonth() + 1) / 3)
                const month = saleDate.getMonth() + 1
                const monthName = saleDate.toLocaleString('default', { month: 'long' })
                const day = saleDate.getDate()
                const dayOfWeek = saleDate.toLocaleString('default', { weekday: 'long' })
                const weekOfYear = getWeekNumber(saleDate)

                return {
                    // Sale information
                    saleId: sale.id,
                    saleDate: sale.saleDate || sale.createdAt,
                    invoiceNumber: sale.invoiceNumber,

                    // Time dimensions
                    year,
                    quarter: `Q${quarter} ${year}`,
                    month,
                    monthName,
                    monthYear: `${monthName} ${year}`,
                    day,
                    dayOfWeek,
                    weekOfYear,
                    date: saleDate.toISOString().split('T')[0],

                    // Location dimension
                    locationId: sale.locationId,
                    locationName: sale.location?.name || 'Unknown',

                    // Cashier dimension
                    cashierId: sale.createdBy,
                    cashierName: sale.creator
                        ? `${sale.creator.firstName || ''} ${sale.creator.lastName || ''}`.trim() || sale.creator.username
                        : 'Unknown',

                    // Product dimensions
                    productId: product?.id || 0,
                    productName: product?.name || 'Unknown Product',
                    productSku: product?.sku || '',
                    variationId: item.productVariationId,
                    variationName: 'Default', // Variation name not available in SaleItem
                    variationSku: '', // Variation SKU not available in SaleItem

                    // Category dimension
                    categoryId: category?.id || 0,
                    categoryName: category?.name || 'Uncategorized',

                    // Brand dimension
                    brandId: brand?.id || 0,
                    brandName: brand?.name || 'No Brand',

                    // Unit dimension
                    unitName: unit?.name || 'pcs',

                    // Metrics
                    quantity,
                    revenue,
                    cost,
                    profit,
                    profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
                    discount: itemDiscountShare,
                    unitPrice: Number(item.unitPrice),
                    avgSellingPrice: revenue / quantity,

                    // Payment information
                    paymentMethod: primaryPayment?.paymentMethod || 'cash',
                    paymentStatus: Number(sale.totalAmount) > 0 ? 'paid' : 'pending',

                    // Customer information (if available)
                    customerId: sale.customerId,
                }
            })
        })

        // Optimized inventory query - only fetch if needed
        const inventoryData = requestBody.includeInventory !== false
            ? await prisma.variationLocationDetails.findMany({
                where: {
                    productVariation: {
                        product: {
                            businessId: businessId,
                            ...(categoryFilter ? { categoryId: categoryFilter } : {}),
                            ...(brandFilter ? { brandId: brandFilter } : {}),
                        }
                    },
                    ...(locationFilter ? { locationId: locationFilter } : {}),
                },
                select: {
                    locationId: true,
                    qtyAvailable: true,
                    sellingPrice: true,
                    productVariation: {
                        select: {
                            id: true,
                            name: true,
                            sku: true,
                            purchasePrice: true,
                            sellingPrice: true,
                            product: {
                                select: {
                                    id: true,
                                    name: true,
                                    sku: true,
                                    categoryId: true,
                                    brandId: true,
                                    unitId: true,
                                    category: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    },
                                    brand: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    },
                                    unit: {
                                        select: {
                                            id: true,
                                            name: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                take: requestBody.inventoryLimit || 10000 // Limit inventory data
            })
            : []

        // Create location map for quick lookups
        const locationMap = new Map()
        locations.forEach(loc => locationMap.set(loc.id, loc.name))

        // Transform inventory data
        const inventoryMetrics = inventoryData.map(inv => {
            const product = inv.productVariation?.product
            const category = product?.category
            const brand = product?.brand
            const unit = product?.unit

            return {
                // Location dimension
                locationId: inv.locationId,
                locationName: locationMap.get(inv.locationId) || 'Unknown',

                // Product dimensions
                productId: product?.id || 0,
                productName: product?.name || 'Unknown Product',
                productSku: product?.sku || '',
                variationId: inv.productVariation?.id || 0,
                variationName: inv.productVariation?.name || 'Default',
                variationSku: inv.productVariation?.sku || '',

                // Category dimension
                categoryId: category?.id || 0,
                categoryName: category?.name || 'Uncategorized',

                // Brand dimension
                brandId: brand?.id || 0,
                brandName: brand?.name || 'No Brand',

                // Unit dimension
                unitName: unit?.name || 'pcs',

                // Inventory metrics
                currentStock: Number(inv.qtyAvailable),
                stockValue: Number(inv.qtyAvailable) * Number(inv.sellingPrice || inv.productVariation?.sellingPrice || 0),
                stockCostValue: Number(inv.qtyAvailable) * Number(inv.productVariation?.purchasePrice || 0),
            }
        })

        // Calculate comprehensive metrics
        const totalRevenue = analyticsData.reduce((sum, item) => sum + item.revenue, 0)
        const totalProfit = analyticsData.reduce((sum, item) => sum + item.profit, 0)
        const totalCost = analyticsData.reduce((sum, item) => sum + item.cost, 0)
        const totalQuantity = analyticsData.reduce((sum, item) => sum + item.quantity, 0)
        const uniqueTransactions = new Set(analyticsData.map(item => item.saleId)).size
        const uniqueProducts = new Set(analyticsData.map(item => item.productId)).size
        const uniqueCustomers = new Set(analyticsData.filter(item => item.customerId).map(item => item.customerId)).size

        // Calculate previous period for comparisons (only if date range provided)
        let previousPeriodMetrics = {
            revenue: 0,
            profit: 0,
            sales: 0,
            quantity: 0,
        }

        if (startDate && endDate) {
            const start = new Date(startDate)
            const end = new Date(endDate)
            const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

            const previousStart = new Date(start)
            previousStart.setDate(previousStart.getDate() - daysDiff)

            const previousEnd = new Date(start)
            previousEnd.setDate(previousEnd.getDate() - 1)

            const previousSales = await prisma.sale.findMany({
                where: {
                    businessId,
                    createdAt: {
                        gte: previousStart,
                        lte: previousEnd,
                    },
                    ...(locationFilter ? { locationId: locationFilter } : {}),
                    status: {
                        notIn: ['voided', 'cancelled']
                    }
                },
                select: {
                    items: {
                        select: {
                            quantity: true,
                            unitPrice: true,
                            unitCost: true
                        }
                    }
                },
                take: 10000 // Limit for performance
            })

            previousPeriodMetrics = {
                revenue: previousSales.reduce((sum, sale) => sum + sale.items.reduce((s, item) => s + (Number(item.unitPrice) * Number(item.quantity)), 0), 0),
                profit: previousSales.reduce((sum, sale) => sum + sale.items.reduce((s, item) => s + ((Number(item.unitPrice) - Number(item.unitCost)) * Number(item.quantity)), 0), 0),
                sales: previousSales.length,
                quantity: previousSales.reduce((sum, sale) => sum + sale.items.reduce((s, item) => s + Number(item.quantity), 0), 0),
            }
        }

        // Calculate growth rates
        const revenueGrowth = previousPeriodMetrics.revenue > 0
            ? ((totalRevenue - previousPeriodMetrics.revenue) / previousPeriodMetrics.revenue) * 100
            : 0
        const profitGrowth = previousPeriodMetrics.profit > 0
            ? ((totalProfit - previousPeriodMetrics.profit) / previousPeriodMetrics.profit) * 100
            : 0
        const salesGrowth = previousPeriodMetrics.sales > 0
            ? ((uniqueTransactions - previousPeriodMetrics.sales) / previousPeriodMetrics.sales) * 100
            : 0

        return NextResponse.json({
            success: true,
            salesData: analyticsData,
            inventoryData: inventoryMetrics,
            pagination: {
                skip,
                take,
                totalCount: totalSalesCount,
                hasMore: skip + take < totalSalesCount
            },
            metadata: {
                locations,
                categories,
                brands,
                totalSales: uniqueTransactions,
                totalRevenue,
                totalProfit,
                totalCost,
                totalQuantity,
                totalStockValue: inventoryMetrics.reduce((sum, item) => sum + item.stockValue, 0),
                totalStockItems: inventoryMetrics.reduce((sum, item) => sum + item.currentStock, 0),
                // Advanced metrics
                averageOrderValue: uniqueTransactions > 0 ? totalRevenue / uniqueTransactions : 0,
                averageItemsPerSale: uniqueTransactions > 0 ? totalQuantity / uniqueTransactions : 0,
                profitMargin: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
                uniqueProductsSold: uniqueProducts,
                uniqueCustomers,
                // Growth metrics
                revenueGrowth,
                profitGrowth,
                salesGrowth,
                previousPeriod: previousPeriodMetrics,
            }
        })

    } catch (error) {
        console.error('Dashboard analytics error:', error)
        console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
        return NextResponse.json(
            {
                error: 'Failed to fetch analytics data',
                details: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
        )
    }
}

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function normalizeIdArray(value: unknown): number[] {
    if (!Array.isArray(value)) {
        return []
    }

    return value
        .map(item => {
            if (typeof item === 'number') {
                return Number.isInteger(item) ? item : null
            }

            if (typeof item === 'string' && item.trim() !== '') {
                const parsed = Number(item)
                return Number.isInteger(parsed) ? parsed : null
            }

            return null
        })
        .filter((item): item is number => typeof item === 'number')
}