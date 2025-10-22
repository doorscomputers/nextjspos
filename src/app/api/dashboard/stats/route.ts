import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
    const locationId = searchParams.get('locationId')
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
      businessId: session.user.businessId,
      locationIds: session.user.locationIds || []
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
        // Use the first accessible location if no specific location is provided
        if (!locationId || locationId === 'all') {
          whereClause.locationId = normalizedLocationIds[0]
        } else {
          const requestedLocationId = parseInt(locationId)
          if (normalizedLocationIds.includes(requestedLocationId)) {
            whereClause.locationId = requestedLocationId
          } else {
            // User requested a location they don't have access to - use first accessible
            whereClause.locationId = normalizedLocationIds[0]
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
      } else if (businessLocationIds.length > 0) {
        // Default to first business location for "Sales Today"
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

    // Total Sales - only query if user has permission
    const salesData = hasPermission(PERMISSIONS.SELL_VIEW) ? await prisma.sale.aggregate({
      where: {
        ...whereClause,
        ...(Object.keys(dateFilter).length > 0 ? { saleDate: dateFilter } : {}),
      },
      _sum: {
        totalAmount: true,
        subtotal: true,
      },
      _count: true,
    }) : { _sum: { totalAmount: null, subtotal: null }, _count: 0 }

    // Total Purchases - sum of all purchase amounts
    const purchaseData = await prisma.accountsPayable.aggregate({
      where: {
        businessId,
        ...(locationId && locationId !== 'all' ? {
          purchase: { locationId: parseInt(locationId) }
        } : {}),
        ...(Object.keys(dateFilter).length > 0 ? { invoiceDate: dateFilter } : {}),
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    })

    // Total Expenses - TODO: Implement Expense model
    const expenseData = { _sum: { amount: null } } // Placeholder until Expense model is created
    // const expenseData = await prisma.expense.aggregate({
    //   where: {
    //     ...whereClause,
    //     ...(Object.keys(dateFilter).length > 0 ? { expenseDate: dateFilter } : {}),
    //   },
    //   _sum: {
    //     amount: true,
    //   },
    // })

    // Customer Returns - only query if user has permission
    const customerReturnData = hasPermission(PERMISSIONS.CUSTOMER_RETURN_VIEW) ? await prisma.customerReturn.aggregate({
      where: {
        businessId,
        ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
      },
      _sum: {
        totalRefundAmount: true,
      },
      _count: true,
    }) : { _sum: { totalRefundAmount: null }, _count: 0 }

    // Supplier Returns
    const supplierReturnData = await prisma.supplierReturn.aggregate({
      where: {
        businessId,
        ...(Object.keys(dateFilter).length > 0 ? { returnDate: dateFilter } : {}),
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    })

    // Invoice Due (Sales with unpaid amounts) - only query if user has permission
    const invoiceDue = hasPermission(PERMISSIONS.SELL_VIEW) ? await prisma.sale.aggregate({
      where: {
        ...whereClause,
        status: { not: 'cancelled' },
      },
      _sum: {
        totalAmount: true,
      },
    }) : { _sum: { totalAmount: null } }

    // Purchase Due (Outstanding balance from Accounts Payable)
    const purchaseDue = await prisma.accountsPayable.aggregate({
      where: {
        businessId,
        ...(locationId && locationId !== 'all' ? {
          purchase: { locationId: parseInt(locationId) }
        } : {}),
        paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
      },
      _sum: {
        balanceAmount: true,
      },
    })

    // Sales Last 30 Days - only query if user has permission
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const salesLast30Days = hasPermission(PERMISSIONS.SELL_VIEW) ? await prisma.sale.groupBy({
      by: ['saleDate'],
      where: {
        ...whereClause,
        saleDate: { gte: thirtyDaysAgo },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        saleDate: 'asc',
      },
    }) : []

    // Sales Current Financial Year - only query if user has permission
    const currentYear = new Date().getFullYear()
    const financialYearStart = new Date(currentYear, 0, 1)

    const salesCurrentYear = hasPermission(PERMISSIONS.SELL_VIEW) ? await prisma.sale.groupBy({
      by: ['saleDate'],
      where: {
        ...whereClause,
        saleDate: { gte: financialYearStart },
      },
      _sum: {
        totalAmount: true,
      },
      orderBy: {
        saleDate: 'asc',
      },
    }) : []

    // Product Stock Alert (products below alert quantity)
    // Get ALL products with alert quantity set, then filter
    const allProductsWithAlerts = await prisma.variationLocationDetails.findMany({
      where: {
        ...(locationId && locationId !== 'all' ? { locationId: parseInt(locationId) } : {}),
        product: {
          businessId,
          alertQuantity: { not: null },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            alertQuantity: true,
          },
        },
        productVariation: {
          select: {
            name: true,
          },
        },
      },
    })

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

    // Pending Shipments (Stock Transfers in transit or pending)
    // Show transfers that are not yet completed, cancelled, or received
    // Filter by user's accessible locations (either fromLocation or toLocation)
    const transferWhereClause: any = {
      businessId,
      status: {
        notIn: ['completed', 'cancelled']
      },
      // Exclude transfers that have been received (receivedAt is set)
      receivedAt: null,
      // Exclude transfers that have been completed (completedAt is set)
      completedAt: null,
    }

    // Apply location filtering for transfers
    // Show transfers where user has access to either source or destination location
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

    const pendingShipments = await prisma.stockTransfer.findMany({
      where: transferWhereClause,
      include: {
        fromLocation: { select: { name: true } },
        toLocation: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Sales Payment Due
    const salesPaymentDue = await prisma.sale.findMany({
      where: {
        ...whereClause,
        status: 'completed',
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { saleDate: 'desc' },
      take: 10,
    })

    // Purchase Payment Due - Get unpaid/partially paid accounts payable
    const purchasePaymentDue = await prisma.accountsPayable.findMany({
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
    })

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
        salesPaymentDue: salesPaymentDue.map((item) => ({
          id: item.id,
          invoiceNumber: item.invoiceNumber,
          customer: item.customer?.name || 'Walk-in Customer',
          date: item.saleDate.toISOString().split('T')[0],
          amount: parseFloat(item.totalAmount.toString()),
        })),
        purchasePaymentDue: purchasePaymentDue.map((item) => ({
          id: item.id,
          purchaseOrderNumber: item.purchase.purchaseOrderNumber,
          supplier: item.supplier.name,
          date: item.dueDate.toISOString().split('T')[0],
          amount: parseFloat(item.balanceAmount.toString()),
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
