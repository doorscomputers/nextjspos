import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAccessibleLocationIds, PERMISSIONS } from '@/lib/rbac'

// OPTIMIZED Dashboard Stats API - Parallel queries, reduced N+1 patterns
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions)

        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const locationId = searchParams.get('locationId')
        const startDate = searchParams.get('startDate')
        const endDate = searchParams.get('endDate')

        const user = session.user as any
        const businessId = parseInt(user.businessId)
        const userId = parseInt(user.id)
        const userPermissions = user.permissions || []

        // Helper function to check permissions
        const hasPermission = (permission: string) => userPermissions.includes(permission)

        // Get user's accessible locations (parallel with other queries)
        const [accessibleLocationIds, businessLocations] = await Promise.all([
            Promise.resolve(getUserAccessibleLocationIds({
                id: user.id,
                permissions: user.permissions || [],
                roles: user.roles || [],
                businessId: user.businessId,
                locationIds: user.locationIds || []
            })),
            prisma.businessLocation.findMany({
                where: { businessId, deletedAt: null },
                select: { id: { select: { id: true, name: true } } }
            })
        ])

        const businessLocationIds = businessLocations.map(loc => loc.id)

        // Build where clause for filtering
        const whereClause: any = { businessId }

        // Apply automatic location filtering
        if (accessibleLocationIds !== null) {
            const normalizedLocationIds = accessibleLocationIds
                .map((id) => Number(id))
                .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
                .filter((id) => businessLocationIds.includes(id))

            if (normalizedLocationIds.length === 0) {
                if (businessLocationIds.length > 0) {
                    whereClause.locationId = businessLocationIds[0]
                }
            } else if (normalizedLocationIds.length === 1) {
                whereClause.locationId = normalizedLocationIds[0]
            } else {
                if (!locationId || locationId === 'all') {
                    whereClause.locationId = normalizedLocationIds[0]
                } else {
                    const requestedLocationId = parseInt(locationId)
                    if (normalizedLocationIds.includes(requestedLocationId)) {
                        whereClause.locationId = requestedLocationId
                    } else {
                        whereClause.locationId = normalizedLocationIds[0]
                    }
                }
            }
        } else {
            if (locationId && locationId !== 'all') {
                const requestedLocationId = parseInt(locationId)
                if (businessLocationIds.includes(requestedLocationId)) {
                    whereClause.locationId = requestedLocationId
                }
            } else if (businessLocationIds.length > 0) {
                whereClause.locationId = businessLocationIds[0]
            }
        }

        const dateFilter: any = {}
        if (startDate) {
            dateFilter.gte = new Date(startDate)
        }
        if (endDate) {
            dateFilter.lte = new Date(endDate)
        }

        // Execute all queries in parallel for maximum performance
        const [
            salesData,
            purchaseData,
            customerReturnData,
            supplierReturnData,
            invoiceDue,
            purchaseDue,
            stockAlerts,
            pendingShipments,
            salesPaymentDueRaw,
            purchasePaymentDue,
            supplierPayments
        ] = await Promise.all([
            // Sales data (only if user has permission)
            hasPermission(PERMISSIONS.SELL_VIEW) ? prisma.sale.aggregate({
                where: {
                    ...whereClause,
                    ...(Object.keys(dateFilter).length > 0 ? { saleDate: dateFilter } : {}),
                },
                _sum: {
                    totalAmount: { select: { id: true, name: true } },
                    subtotal: { select: { id: true, name: true } },
                },
                _count: { select: { id: true, name: true } },
            }) : Promise.resolve({ _sum: { totalAmount: null, subtotal: null }, _count: 0 }),

            // Purchase data
            prisma.accountsPayable.aggregate({
                where: {
                    businessId,
                    ...(locationId && locationId !== 'all' ? {
                        purchase: { locationId: parseInt(locationId) }
                    } : {}),
                    ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
                },
                _sum: {
                    totalAmount: { select: { id: true, name: true } },
                },
                _count: { select: { id: true, name: true } },
            }),

            // Customer returns (only if user has permission)
            hasPermission(PERMISSIONS.CUSTOMER_RETURN_VIEW) ? prisma.customerReturn.aggregate({
                where: {
                    businessId,
                    ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
                },
                _sum: {
                    totalRefundAmount: { select: { id: true, name: true } },
                },
                _count: { select: { id: true, name: true } },
            }) : Promise.resolve({ _sum: { totalRefundAmount: null }, _count: 0 }),

            // Supplier returns
            prisma.supplierReturn.aggregate({
                where: {
                    businessId,
                    ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
                },
                _sum: {
                    totalAmount: { select: { id: true, name: true } },
                },
                _count: { select: { id: true, name: true } },
            }),

            // Invoice due (only if user has permission)
            hasPermission(PERMISSIONS.SELL_VIEW) ? prisma.sale.aggregate({
                where: {
                    ...whereClause,
                    status: { not: 'cancelled' },
                },
                _sum: {
                    totalAmount: { select: { id: true, name: true } },
                },
            }) : Promise.resolve({ _sum: { totalAmount: null } }),

            // Purchase due
            prisma.accountsPayable.aggregate({
                where: {
                    businessId,
                    ...(locationId && locationId !== 'all' ? {
                        purchase: { locationId: parseInt(locationId) }
                    } : {}),
                    paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
                },
                _sum: {
                    balanceAmount: { select: { id: true, name: true } },
                },
            }),

            // Stock alerts - get all products with alerts, then filter
            prisma.variationLocationDetails.findMany({
                where: {
                    ...(locationId && locationId !== 'all' ? { locationId: parseInt(locationId) } : {}),
                    product: {
                        businessId,
                        alertQuantity: { not: null },
                        enableStock: { select: { id: true, name: true } },
                    },
                },
                select: {
                    id: { select: { id: true, name: true } },
                    qtyAvailable: { select: { id: true, name: true } },
                    product: {
                        select: {
                            id: { select: { id: true, name: true } },
                            name: { select: { id: true, name: true } },
                            sku: { select: { id: true, name: true } },
                            alertQuantity: { select: { id: true, name: true } },
                        }
                    },
                    productVariation: {
                        select: {
                            name: { select: { id: true, name: true } },
                        }
                    },
                },
                take: 50, // Get more to filter client-side
            }),

            // Pending shipments - optimized query
            prisma.stockTransfer.findMany({
                where: {
                    businessId,
                    status: {
                        notIn: ['completed', 'cancelled']
                    },
                    receivedAt: null,
                    completedAt: null,
                    ...(accessibleLocationIds !== null ? {
                        OR: [
                            { fromLocationId: { in: accessibleLocationIds } },
                            { toLocationId: { in: accessibleLocationIds } },
                        ]
                    } : {})
                },
                select: {
                    id: { select: { id: true, name: true } },
                    transferNumber: { select: { id: true, name: true } },
                    status: { select: { id: true, name: true } },
                    createdAt: { select: { id: true, name: true } },
                    fromLocation: { select: { name: { select: { id: true, name: true } } } },
                    toLocation: { select: { name: { select: { id: true, name: true } } } },
                },
                orderBy: { createdAt: 'desc' },
                take: 10,
            }),

            // Sales payment due - optimized with single query
            hasPermission(PERMISSIONS.SELL_VIEW) ? prisma.sale.findMany({
                where: {
                    businessId,
                    status: {
                        notIn: ['voided', 'cancelled']
                    },
                    ...(accessibleLocationIds !== null ? {
                        locationId: { in: accessibleLocationIds }
                    } : {})
                },
                select: {
                    id: { select: { id: true, name: true } },
                    invoiceNumber: { select: { id: true, name: true } },
                    totalAmount: { select: { id: true, name: true } },
                    saleDate: { select: { id: true, name: true } },
                    customer: { select: { name: { select: { id: true, name: true } } } },
                    location: { select: { name: { select: { id: true, name: true } } } },
                    payments: {
                        select: { amount: { select: { id: true, name: true } } }
                    },
                },
                orderBy: { saleDate: 'desc' },
                take: 100,
            }) : Promise.resolve([]),

            // Purchase payment due
            prisma.accountsPayable.findMany({
                where: {
                    businessId,
                    ...(locationId && locationId !== 'all' ? {
                        purchase: { locationId: parseInt(locationId) }
                    } : {}),
                    paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
                },
                select: {
                    id: { select: { id: true, name: true } },
                    balanceAmount: { select: { id: true, name: true } },
                    dueDate: { select: { id: true, name: true } },
                    supplier: { select: { name: { select: { id: true, name: true } } } },
                    purchase: { select: { purchaseOrderNumber: { select: { id: true, name: true } } } },
                },
                orderBy: { dueDate: 'asc' },
                take: 10,
            }),

            // Supplier payments
            prisma.payment.findMany({
                where: {
                    businessId,
                    status: 'completed',
                    ...(Object.keys(dateFilter).length > 0 ? { paymentDate: dateFilter } : {}),
                },
                select: {
                    id: { select: { id: true, name: true } },
                    paymentNumber: { select: { id: true, name: true } },
                    amount: { select: { id: true, name: true } },
                    paymentDate: { select: { id: true, name: true } },
                    paymentMethod: { select: { id: true, name: true } },
                    supplier: { select: { name: { select: { id: true, name: true } } } },
                    accountsPayable: {
                        select: {
                            purchase: { select: { purchaseOrderNumber: { select: { id: true, name: true } } } }
                        }
                    }
                },
                orderBy: { paymentDate: 'desc' },
                take: 20,
            })
        ])

        // Process stock alerts (filter client-side for alert condition)
        const stockAlertsFiltered = stockAlerts
            .filter((item) => {
                const alertQty = item.product.alertQuantity
                    ? parseFloat(item.product.alertQuantity.toString())
                    : 0
                const currentQty = parseFloat(item.qtyAvailable.toString())
                return alertQty > 0 && currentQty <= alertQty
            })
            .slice(0, 10)

        // Process sales payment due data (calculate balances)
        const salesPaymentDue = salesPaymentDueRaw
            .map((sale) => {
                const totalAmount = parseFloat(sale.totalAmount.toString())
                const paidAmount = sale.payments.reduce((sum, payment) => {
                    return sum + parseFloat(payment.amount.toString())
                }, 0)
                const balance = Math.max(0, parseFloat((totalAmount - paidAmount).toFixed(2)))

                return {
                    id: sale.id,
                    invoiceNumber: sale.invoiceNumber,
                    customer: sale.customer?.name || 'Walk-in Customer',
                    location: sale.location?.name || 'Unknown',
                    date: sale.saleDate.toISOString().split('T')[0],
                    amount: balance,
                    totalAmount: totalAmount,
                    paidAmount: paidAmount,
                }
            })
            .filter((sale) => sale.amount > 0)
            .slice(0, 10)

        // Get sales trends data (parallel with other queries)
        const [salesLast30Days, salesCurrentYear] = await Promise.all([
            // Sales Last 30 Days (only if user has permission)
            hasPermission(PERMISSIONS.SELL_VIEW) ? prisma.sale.groupBy({
                by: ['saleDate'],
                where: {
                    ...whereClause,
                    saleDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                },
                _sum: {
                    totalAmount: { select: { id: true, name: true } },
                },
                orderBy: {
                    saleDate: 'asc',
                },
            }) : Promise.resolve([]),

            // Sales Current Financial Year (only if user has permission)
            hasPermission(PERMISSIONS.SELL_VIEW) ? prisma.sale.groupBy({
                by: ['saleDate'],
                where: {
                    ...whereClause,
                    saleDate: { gte: new Date(new Date().getFullYear(), 0, 1) },
                },
                _sum: {
                    totalAmount: { select: { id: true, name: true } },
                },
                orderBy: {
                    saleDate: 'asc',
                },
            }) : Promise.resolve([])
        ])

        return NextResponse.json({
            metrics: {
                totalSales: parseFloat(salesData._sum.totalAmount?.toString() || '0'),
                netAmount: parseFloat(salesData._sum.subtotal?.toString() || '0'),
                invoiceDue: parseFloat(invoiceDue._sum.totalAmount?.toString() || '0'),
                totalSellReturn: parseFloat(customerReturnData._sum.totalRefundAmount?.toString() || '0'),
                totalPurchase: parseFloat(purchaseData._sum.totalAmount?.toString() || '0'),
                purchaseDue: parseFloat(purchaseDue._sum.balanceAmount?.toString() || '0'),
                totalSupplierReturn: parseFloat(supplierReturnData._sum.totalAmount?.toString() || '0'),
                expense: 0, // Placeholder until Expense model is created
                salesCount: salesData._count,
                purchaseCount: purchaseData._count,
            },
            charts: {
                salesLast30Days: salesLast30Days.map((item) => ({
                    date: item.saleDate.toISOString().split('T')[0],
                    amount: parseFloat(item._sum.totalAmount?.toString() || '0'),
                })),
                salesCurrentYear: salesCurrentYear.map((item) => ({
                    date: item.saleDate.toISOString().split('T')[0],
                    amount: parseFloat(item._sum.totalAmount?.toString() || '0'),
                })),
            },
            tables: {
                stockAlerts: stockAlertsFiltered.map((item) => ({
                    id: item.id,
                    productName: item.product.name,
                    variationName: item.productVariation.name,
                    sku: item.product.sku,
                    currentQty: parseFloat(item.qtyAvailable.toString()),
                    alertQty: parseFloat(item.product.alertQuantity?.toString() || '0'),
                })),
                pendingShipments: pendingShipments.map((item) => ({
                    id: item.id,
                    transferNumber: item.transferNumber,
                    from: item.fromLocation.name,
                    to: item.toLocation.name,
                    status: item.status,
                    date: item.createdAt.toISOString().split('T')[0],
                })),
                salesPaymentDue,
                purchasePaymentDue: purchasePaymentDue.map((item) => ({
                    id: item.id,
                    purchaseOrderNumber: item.purchase.purchaseOrderNumber,
                    supplier: item.supplier.name,
                    date: item.dueDate.toISOString().split('T')[0],
                    amount: parseFloat(item.balanceAmount.toString()),
                })),
                supplierPayments: supplierPayments.map((item) => ({
                    id: item.id,
                    paymentNumber: item.paymentNumber,
                    supplier: item.supplier.name,
                    date: item.paymentDate.toISOString().split('T')[0],
                    amount: parseFloat(item.amount.toString()),
                    paymentMethod: item.paymentMethod,
                    purchaseOrderNumber: item.accountsPayable?.purchase?.purchaseOrderNumber || 'N/A',
                })),
            },
        })
    } catch (error) {
        console.error('Dashboard stats error:', error)
        return NextResponse.json(
            {
                error: 'Failed to fetch dashboard statistics',
                details: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        )
    }
}
