import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { getUserAccessibleLocationIds, PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    // Debug: Log prisma object
    console.log('Prisma object:', typeof prisma, Object.keys(prisma || {}).slice(0, 10))

    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    const businessId = parseInt(session.user.businessId)
    const userId = parseInt(session.user.id)
    const userPermissions = session.user.permissions || []

    // Helper function to check permissions
    const hasPermission = (permission: string) => userPermissions.includes(permission)

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: session.user.id,
      permissions: session.user.permissions || [],
      roles: session.user.roles || [],
      businessId: parseInt(session.user.businessId),
      locationIds: session.user.locationIds?.map(id => parseInt(String(id))) || []
    })

    // Get all locations for this business
    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId, deletedAt: null },
      select: { id: true }
    })
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
        // User has no location access - use first business location or return empty
        if (businessLocationIds.length > 0) {
          whereClause.locationId = businessLocationIds[0]
        }
      } else if (normalizedLocationIds.length === 1) {
        // User has access to only one location - auto-filter to that location
        whereClause.locationId = normalizedLocationIds[0]
      } else {
        // User has access to multiple locations
        if (!locationId || locationId === 'all') {
          // Show data from ALL accessible locations
          whereClause.locationId = { in: normalizedLocationIds }
        } else {
          const requestedLocationId = parseInt(locationId)
          if (normalizedLocationIds.includes(requestedLocationId)) {
            whereClause.locationId = requestedLocationId
          } else {
            // User requested a location they don't have access to - show all their locations
            whereClause.locationId = { in: normalizedLocationIds }
          }
        }
      }
    } else {
      // User has access to all locations
      if (locationId && locationId !== 'all') {
        const requestedLocationId = parseInt(locationId)
        if (businessLocationIds.includes(requestedLocationId)) {
          whereClause.locationId = requestedLocationId
        }
      }
      // If no specific location selected, show data from ALL locations (don't restrict)
    }

    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate)
    }

    // OPTIMIZATION: Execute all independent queries in parallel using Promise.all()
    // This reduces total time from ~14x individual query time to ~1x (the slowest query)
    const startQueryTime = Date.now()

    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const currentYear = new Date().getFullYear()
    const financialYearStart = new Date(currentYear, 0, 1)

    const [
      salesData,
      purchaseData,
      customerReturnData,
      supplierReturnData,
      invoiceDue,
      purchaseDue,
      salesLast30Days,
      salesCurrentYear,
      allProductsWithAlerts,
    ] = await Promise.all([
      // Total Sales
      hasPermission(PERMISSIONS.SELL_VIEW)
        ? prisma.sale.aggregate({
            where: { ...whereClause },
            _sum: { totalAmount: true, subtotal: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { totalAmount: null, subtotal: null }, _count: 0 }),

      // Total Purchases
      prisma.accountsPayable.aggregate({
        where: {
          businessId,
          ...(locationId && locationId !== 'all' ? {
            purchase: { locationId: parseInt(locationId) }
          } : {}),
        },
        _sum: { totalAmount: true },
        _count: true,
      }),

      // Customer Returns
      hasPermission(PERMISSIONS.CUSTOMER_RETURN_VIEW)
        ? prisma.customerReturn.aggregate({
            where: { businessId },
            _sum: { totalRefundAmount: true },
            _count: true,
          })
        : Promise.resolve({ _sum: { totalRefundAmount: null }, _count: 0 }),

      // Supplier Returns
      prisma.supplierReturn.aggregate({
        where: { businessId },
        _sum: { totalAmount: true },
        _count: true,
      }),

      // Invoice Due
      hasPermission(PERMISSIONS.SELL_VIEW)
        ? prisma.sale.aggregate({
            where: { ...whereClause, status: { not: 'cancelled' } },
            _sum: { totalAmount: true },
          })
        : Promise.resolve({ _sum: { totalAmount: null } }),

      // Purchase Due
      prisma.accountsPayable.aggregate({
        where: {
          businessId,
          ...(locationId && locationId !== 'all' ? {
            purchase: { locationId: parseInt(locationId) }
          } : {}),
          paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
        },
        _sum: { balanceAmount: true },
      }),

      // Sales Last 30 Days
      hasPermission(PERMISSIONS.SELL_VIEW)
        ? prisma.sale.groupBy({
            by: ['saleDate'],
            where: { ...whereClause, saleDate: { gte: thirtyDaysAgo } },
            _sum: { totalAmount: true },
            orderBy: { saleDate: 'asc' },
          })
        : Promise.resolve([]),

      // Sales Current Year
      hasPermission(PERMISSIONS.SELL_VIEW)
        ? prisma.sale.groupBy({
            by: ['saleDate'],
            where: { ...whereClause, saleDate: { gte: financialYearStart } },
            _sum: { totalAmount: true },
            orderBy: { saleDate: 'asc' },
          })
        : Promise.resolve([]),

      // Product Stock Alerts
      prisma.variationLocationDetails.findMany({
        where: {
          ...(locationId && locationId !== 'all' ? { locationId: parseInt(locationId) } : {}),
          product: { businessId, alertQuantity: { not: null } },
        },
        include: {
          product: {
            select: { id: true, name: true, sku: true, alertQuantity: true },
          },
          productVariation: {
            select: { name: true },
          },
        },
      }),
    ])

    console.log(`[Dashboard Stats] Parallel queries completed in ${Date.now() - startQueryTime}ms`)

    // Total Expenses - TODO: Implement Expense model
    const expenseData = { _sum: { amount: null } }

    // Filter to find products where current quantity is below or equal to alert quantity
    const stockAlerts = allProductsWithAlerts
      .filter((item) => {
        const alertQty = item.product.alertQuantity
          ? parseFloat(item.product.alertQuantity.toString())
          : 0
        const currentQty = parseFloat(item.qtyAvailable.toString())
        // Alert when current stock is at or below the alert quantity
        return alertQty > 0 && currentQty <= alertQty
      })
      .slice(0, 10) // Take top 10 after filtering

    // Build where clauses for remaining queries
    const transferWhereClause: any = {
      businessId,
      status: { notIn: ['completed', 'cancelled'] },
      receivedAt: null,
      completedAt: null,
    }

    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id))

      if (normalizedLocationIds.length > 0) {
        transferWhereClause.OR = [
          { fromLocationId: { in: normalizedLocationIds } },
          { toLocationId: { in: normalizedLocationIds } },
        ]
      }
    }

    const salesPaymentDueWhereClause: any = {
      businessId,
      status: { notIn: ['voided', 'cancelled'] }
    }

    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id))

      if (normalizedLocationIds.length > 0) {
        salesPaymentDueWhereClause.locationId = { in: normalizedLocationIds }
      } else if (businessLocationIds.length > 0) {
        salesPaymentDueWhereClause.locationId = businessLocationIds[0]
      }
    }

    const supplierPaymentsWhere: any = {
      businessId,
      status: 'completed',
      ...(Object.keys(dateFilter).length > 0 ? { paymentDate: dateFilter } : {}),
    }

    // OPTIMIZATION: Execute remaining queries in parallel
    const startTableQueriesTime = Date.now()

    const [pendingShipments, salesPaymentDueRaw, purchasePaymentDue, supplierPayments] = await Promise.all([
      // Pending Shipments
      prisma.stockTransfer.findMany({
        where: transferWhereClause,
        include: {
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Sales Payment Due
      prisma.sale.findMany({
        where: salesPaymentDueWhereClause,
        include: {
          customer: { select: { name: true } },
          payments: { select: { amount: true } },
          location: { select: { name: true } },
        },
        orderBy: { saleDate: 'desc' },
        take: 100,
      }),

      // Purchase Payment Due
      prisma.accountsPayable.findMany({
        where: {
          businessId,
          ...(locationId && locationId !== 'all' ? {
            purchase: { locationId: parseInt(locationId) }
          } : {}),
          paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
        },
        include: {
          supplier: { select: { name: true } },
          purchase: { select: { purchaseOrderNumber: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),

      // Supplier Payments
      prisma.payment.findMany({
        where: supplierPaymentsWhere,
        include: {
          supplier: { select: { name: true } },
          accountsPayable: {
            select: {
              purchase: { select: { purchaseOrderNumber: true } }
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        take: 20,
      }),
    ])

    console.log(`[Dashboard Stats] Table queries completed in ${Date.now() - startTableQueriesTime}ms`)

    // Process sales payment due
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

    return NextResponse.json({
      metrics: {
        totalSales: parseFloat(salesData._sum.totalAmount?.toString() || '0'),
        netAmount: parseFloat(salesData._sum.subtotal?.toString() || '0'),
        invoiceDue: parseFloat(invoiceDue._sum.totalAmount?.toString() || '0'),
        totalSellReturn: parseFloat(customerReturnData._sum.totalRefundAmount?.toString() || '0'),
        totalPurchase: parseFloat(purchaseData._sum.totalAmount?.toString() || '0'),
        purchaseDue: parseFloat(purchaseDue._sum.balanceAmount?.toString() || '0'),
        totalSupplierReturn: parseFloat(supplierReturnData._sum.totalAmount?.toString() || '0'),
        expense: parseFloat(expenseData._sum.amount?.toString() || '0'),
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
        stockAlerts: stockAlerts.map((item) => ({
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
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error
    })
    return NextResponse.json(
      {
        error: 'Failed to fetch dashboard statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
