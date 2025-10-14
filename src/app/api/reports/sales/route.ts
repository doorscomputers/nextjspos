import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const locationId = searchParams.get('locationId')
    const customerId = searchParams.get('customerId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const invoiceNumber = searchParams.get('invoiceNumber')
    const minAmount = searchParams.get('minAmount')
    const maxAmount = searchParams.get('maxAmount')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const businessId = parseInt(session.user.businessId)

    // Build where clause
    const whereClause: any = { businessId }

    if (locationId && locationId !== 'all') {
      whereClause.locationId = parseInt(locationId)
    }

    if (customerId && customerId !== 'all') {
      whereClause.customerId = parseInt(customerId)
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (invoiceNumber) {
      whereClause.invoiceNumber = { contains: invoiceNumber }
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.saleDate = {}
      if (startDate) {
        // Start of day in local timezone
        const startDateTime = new Date(startDate + 'T00:00:00')
        whereClause.saleDate.gte = startDateTime
      }
      if (endDate) {
        // End of day in local timezone (23:59:59.999)
        const endDateTime = new Date(endDate + 'T23:59:59.999')
        whereClause.saleDate.lte = endDateTime
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
    const totalCount = await prisma.sale.count({ where: whereClause })

    // Get sales data
    const sales = await prisma.sale.findMany({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
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
      },
      orderBy: { saleDate: 'desc' },
      skip,
      take: limit,
    })

    // Calculate summary statistics
    const summary = await prisma.sale.aggregate({
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

    // Calculate COGS and Gross Profit
    let totalCOGS = 0
    for (const sale of sales) {
      for (const item of sale.items) {
        totalCOGS += parseFloat(item.unitCost.toString()) * parseFloat(item.quantity.toString())
      }
    }

    const summaryData = {
      totalSales: summary._count,
      totalRevenue: parseFloat(summary._sum.totalAmount?.toString() || '0'),
      totalSubtotal: parseFloat(summary._sum.subtotal?.toString() || '0'),
      totalTax: parseFloat(summary._sum.taxAmount?.toString() || '0'),
      totalDiscount: parseFloat(summary._sum.discountAmount?.toString() || '0'),
      totalShipping: parseFloat(summary._sum.shippingCost?.toString() || '0'),
      totalCOGS,
      grossProfit: parseFloat(summary._sum.totalAmount?.toString() || '0') - totalCOGS,
    }

    // Format sales data
    const formattedSales = sales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      saleDate: sale.saleDate.toISOString().split('T')[0],
      customer: sale.customer?.name || 'Walk-in Customer',
      customerId: sale.customerId,
      status: sale.status,
      subtotal: parseFloat(sale.subtotal.toString()),
      taxAmount: parseFloat(sale.taxAmount.toString()),
      discountAmount: parseFloat(sale.discountAmount.toString()),
      shippingCost: parseFloat(sale.shippingCost.toString()),
      totalAmount: parseFloat(sale.totalAmount.toString()),
      itemCount: sale.items.length,
      items: sale.items.map((item) => ({
        productName: item.product.name,
        variationName: item.productVariation.name,
        sku: item.productVariation.sku,
        quantity: parseFloat(item.quantity.toString()),
        unitPrice: parseFloat(item.unitPrice.toString()),
        unitCost: parseFloat(item.unitCost.toString()),
        total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
      })),
      notes: sale.notes,
    }))

    return NextResponse.json({
      sales: formattedSales,
      summary: summaryData,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Sales report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales report' },
      { status: 500 }
    )
  }
}
