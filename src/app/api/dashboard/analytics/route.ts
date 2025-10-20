import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * Dashboard Analytics API - Multi-Dimensional Sales & Inventory Data
 *
 * This endpoint provides comprehensive analytics data for the Dashboard V2 PivotGrid
 * It joins sales data with products, locations, variations, and financial metrics
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

    const { startDate, endDate, locationIds, categoryIds, brandIds } = await request.json()

    // Build date filter
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    // Build location filter (if user specified specific locations)
    const locationFilter: any = {}
    if (locationIds && Array.isArray(locationIds) && locationIds.length > 0) {
      locationFilter.in = locationIds
    }

    // Build category filter
    const categoryFilter: any = {}
    if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
      categoryFilter.in = categoryIds
    }

    // Build brand filter
    const brandFilter: any = {}
    if (brandIds && Array.isArray(brandIds) && brandIds.length > 0) {
      brandFilter.in = brandIds
    }

    // Fetch sales data with all necessary joins
    const salesData = await prisma.sale.findMany({
      where: {
        businessId: parseInt(session.user.businessId),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
        ...(Object.keys(locationFilter).length > 0 && { locationId: locationFilter }),
        status: {
          notIn: ['VOIDED', 'CANCELLED']
        }
      },
      include: {
        items: {
          include: {
            variation: {
              include: {
                product: {
                  include: {
                    category: true,
                    brand: true,
                    unit: true,
                  }
                }
              }
            }
          }
        },
        location: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          }
        },
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Transform data for PivotGrid
    const analyticsData = salesData.flatMap(sale =>
      sale.items.map(item => {
        const product = item.variation?.product
        const category = product?.category
        const brand = product?.brand
        const unit = product?.unit

        // Calculate metrics
        const quantity = item.quantity
        const revenue = item.subtotal
        const cost = (item.variation?.cost || 0) * quantity
        const profit = revenue - cost
        const discount = item.discount || 0

        // Extract date dimensions
        const saleDate = new Date(sale.createdAt)
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
          saleDate: sale.createdAt,
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
          cashierId: sale.userId,
          cashierName: sale.user ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() || sale.user.username : 'Unknown',

          // Product dimensions
          productId: product?.id || 0,
          productName: product?.name || 'Unknown Product',
          productSku: product?.sku || '',
          variationId: item.variationId,
          variationName: item.variation?.name || 'Default',
          variationSku: item.variation?.sku || '',

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
          discount,
          unitPrice: item.unitPrice,
          avgSellingPrice: revenue / quantity,

          // Payment information
          paymentMethod: sale.paymentMethod,
          paymentStatus: sale.paymentStatus,

          // Customer information (if available)
          customerId: sale.customerId,
        }
      })
    )

    // Fetch inventory data for stock metrics
    const inventoryData = await prisma.inventory.findMany({
      where: {
        variation: {
          product: {
            businessId: session.user.businessId,
            ...(Object.keys(categoryFilter).length > 0 && { categoryId: categoryFilter }),
            ...(Object.keys(brandFilter).length > 0 && { brandId: brandFilter }),
          }
        },
        ...(Object.keys(locationFilter).length > 0 && { locationId: locationFilter }),
      },
      include: {
        location: true,
        variation: {
          include: {
            product: {
              include: {
                category: true,
                brand: true,
                unit: true,
              }
            }
          }
        }
      }
    })

    // Transform inventory data
    const inventoryMetrics = inventoryData.map(inv => {
      const product = inv.variation?.product
      const category = product?.category
      const brand = product?.brand
      const unit = product?.unit

      return {
        // Location dimension
        locationId: inv.locationId,
        locationName: inv.location?.name || 'Unknown',

        // Product dimensions
        productId: product?.id || 0,
        productName: product?.name || 'Unknown Product',
        productSku: product?.sku || '',
        variationId: inv.variationId,
        variationName: inv.variation?.name || 'Default',
        variationSku: inv.variation?.sku || '',

        // Category dimension
        categoryId: category?.id || 0,
        categoryName: category?.name || 'Uncategorized',

        // Brand dimension
        brandId: brand?.id || 0,
        brandName: brand?.name || 'No Brand',

        // Unit dimension
        unitName: unit?.name || 'pcs',

        // Inventory metrics
        currentStock: inv.quantity,
        stockValue: inv.quantity * (inv.variation?.price || 0),
        stockCostValue: inv.quantity * (inv.variation?.cost || 0),
      }
    })

    // Fetch locations for filter options
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: session.user.businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Fetch categories for filter options
    const categories = await prisma.productCategory.findMany({
      where: {
        businessId: session.user.businessId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Fetch brands for filter options
    const brands = await prisma.brand.findMany({
      where: {
        businessId: session.user.businessId,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      salesData: analyticsData,
      inventoryData: inventoryMetrics,
      metadata: {
        locations,
        categories,
        brands,
        totalSales: analyticsData.length,
        totalRevenue: analyticsData.reduce((sum, item) => sum + item.revenue, 0),
        totalProfit: analyticsData.reduce((sum, item) => sum + item.profit, 0),
        totalQuantity: analyticsData.reduce((sum, item) => sum + item.quantity, 0),
        totalStockValue: inventoryMetrics.reduce((sum, item) => sum + item.stockValue, 0),
        totalStockItems: inventoryMetrics.reduce((sum, item) => sum + item.currentStock, 0),
      }
    })

  } catch (error) {
    console.error('Dashboard analytics error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch analytics data',
        details: error instanceof Error ? error.message : 'Unknown error'
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
