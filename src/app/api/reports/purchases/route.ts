import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { getPaginationParams } from '@/lib/pagination'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const purchaseOrderNumber = searchParams.get('purchaseOrderNumber')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')

    // 🚀 PERFORMANCE: Enforce pagination limits (max 1000)
    const { limit, skip } = getPaginationParams(searchParams)

    const businessId = parseInt(session.user.businessId)

    // Build where clause
    const whereClause: any = { businessId }

    if (locationId && locationId !== 'all') {
      whereClause.locationId = parseInt(locationId)
    }

    if (supplierId && supplierId !== 'all') {
      whereClause.supplierId = parseInt(supplierId)
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (purchaseOrderNumber) {
      whereClause.purchaseOrderNumber = { contains: purchaseOrderNumber }
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.purchaseDate = {}
      if (startDate) {
        // Start of day in local timezone
        const startDateTime = new Date(startDate + 'T00:00:00')
        whereClause.purchaseDate.gte = startDateTime
      }
      if (endDate) {
        // End of day in local timezone (23:59:59.999)
        const endDateTime = new Date(endDate + 'T23:59:59.999')
        whereClause.purchaseDate.lte = endDateTime
      }
    }

    // Amount range filter
    if (minAmount || maxAmount) {
      whereClause.totalAmount = {}
      if (minAmount) {
        whereClause.totalAmount.gte = parseFloat(minAmount)
      }
      if (maxAmount) {
        whereClause.totalAmount.lte = parseFloat(maxAmount)
      }
    }

    // Get total count
    const totalCount = await prisma.purchase.count({ where: whereClause })

    // Get purchases data
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            contactPerson: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            productVariation: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
        },
        receipts: {
          select: {
            id: true,
            receiptNumber: true,
            status: true,
            receivedAt: true,
            approvedAt: true,
          },
        },
      },
      orderBy: { purchaseDate: 'desc' },
      skip,
      take: limit,
    })

    // Calculate summary statistics
    const summary = await prisma.purchase.aggregate({
      where: whereClause,
      _sum: {
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        shippingCost: true,
        totalAmount: true,
      },
      _count: true,
    })

    // Calculate received quantities
    const summaryData = {
      totalPurchases: summary._count,
      totalAmount: parseFloat(summary._sum.totalAmount?.toString() || '0'),
      totalSubtotal: parseFloat(summary._sum.subtotal?.toString() || '0'),
      totalTax: parseFloat(summary._sum.taxAmount?.toString() || '0'),
      totalDiscount: parseFloat(summary._sum.discountAmount?.toString() || '0'),
      totalShipping: parseFloat(summary._sum.shippingCost?.toString() || '0'),
    }

    // Format purchases data
    const formattedPurchases = purchases.map((purchase) => {
      const totalOrdered = purchase.items.reduce(
        (sum, item) => sum + parseFloat(item.quantity.toString()),
        0
      )
      const totalReceived = purchase.items.reduce(
        (sum, item) => sum + parseFloat(item.quantityReceived.toString()),
        0
      )

      return {
        id: purchase.id,
        purchaseOrderNumber: purchase.purchaseOrderNumber,
        purchaseDate: purchase.purchaseDate.toISOString().split('T')[0],
        expectedDeliveryDate: purchase.expectedDeliveryDate
          ? purchase.expectedDeliveryDate.toISOString().split('T')[0]
          : null,
        supplier: purchase.supplier.name,
        supplierId: purchase.supplierId,
        contactPerson: purchase.supplier.contactPerson,
        status: purchase.status,
        subtotal: parseFloat(purchase.subtotal.toString()),
        taxAmount: parseFloat(purchase.taxAmount.toString()),
        discountAmount: parseFloat(purchase.discountAmount.toString()),
        shippingCost: parseFloat(purchase.shippingCost.toString()),
        totalAmount: parseFloat(purchase.totalAmount.toString()),
        itemCount: purchase.items.length,
        totalOrdered,
        totalReceived,
        receiptCount: purchase.receipts.length,
        receipts: purchase.receipts.map((receipt) => ({
          receiptNumber: receipt.receiptNumber,
          status: receipt.status,
          receivedAt: receipt.receivedAt.toISOString().split('T')[0],
          approvedAt: receipt.approvedAt
            ? receipt.approvedAt.toISOString().split('T')[0]
            : null,
        })),
        items: purchase.items.map((item) => ({
          productName: item.product.name,
          variationName: item.productVariation.name,
          sku: item.productVariation.sku,
          quantity: parseFloat(item.quantity.toString()),
          quantityReceived: parseFloat(item.quantityReceived.toString()),
          unitCost: parseFloat(item.unitCost.toString()),
          total:
            parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString()),
          requiresSerial: item.requiresSerial,
        })),
        notes: purchase.notes,
      }
    })

    return NextResponse.json({
      purchases: formattedPurchases,
      summary: summaryData,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Purchases report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate purchases report' },
      { status: 500 }
    )
  }
}
