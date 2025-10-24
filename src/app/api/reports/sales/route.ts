import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

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
        items: true, // Can't include product/productVariation as they don't have relations
      },
      orderBy: { saleDate: 'desc' },
      skip,
      take: limit,
    })

    // Get unique product and variation IDs from sale items
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        productIds.add(item.productId)
        variationIds.add(item.productVariationId)
      })
    })

    // Fetch product and variation data separately
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true, sku: true }
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, name: true, sku: true }
    })

    // Create lookup maps
    const productMap = new Map(products.map((p) => [p.id, p]))
    const variationMap = new Map(variations.map((v) => [v.id, v]))

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

    // Field-Level Security: Check permissions
    const user = session.user as any
    const canViewCost = user.permissions?.includes(PERMISSIONS.SELL_VIEW_COST)
    const canViewProfit = user.permissions?.includes(PERMISSIONS.SELL_VIEW_PROFIT)

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
      items: sale.items.map((item) => {
        const product = productMap.get(item.productId)
        const variation = variationMap.get(item.productVariationId)
        return {
          productName: product?.name || `Product #${item.productId}`,
          variationName: variation?.name || `Variation #${item.productVariationId}`,
          sku: variation?.sku || product?.sku || 'N/A',
          quantity: parseFloat(item.quantity.toString()),
          unitPrice: parseFloat(item.unitPrice.toString()),
          // Only include unitCost if user has permission
          ...(canViewCost && { unitCost: parseFloat(item.unitCost.toString()) }),
          total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
        }
      }),
      notes: sale.notes,
    }))

    // Sanitize summary data based on permissions
    const sanitizedSummary = {
      totalSales: summaryData.totalSales,
      totalRevenue: summaryData.totalRevenue,
      totalSubtotal: summaryData.totalSubtotal,
      totalTax: summaryData.totalTax,
      totalDiscount: summaryData.totalDiscount,
      totalShipping: summaryData.totalShipping,
      // Only include COGS if user has permission
      ...(canViewCost && { totalCOGS: summaryData.totalCOGS }),
      // Only include grossProfit if user has permission
      ...(canViewProfit && { grossProfit: summaryData.grossProfit }),
    }

    return NextResponse.json({
      sales: formattedSales,
      summary: sanitizedSummary,
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
