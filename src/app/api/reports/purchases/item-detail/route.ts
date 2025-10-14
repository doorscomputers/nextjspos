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
    const period = searchParams.get('period') || 'month'
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const quarter = searchParams.get('quarter')
    const month = searchParams.get('month')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const supplierId = searchParams.get('supplierId')
    const categoryId = searchParams.get('categoryId')
    const productId = searchParams.get('productId')
    const locationId = searchParams.get('locationId')

    const businessId = parseInt(session.user.businessId)

    // Build date range
    let dateFrom: Date
    let dateTo: Date

    if (period === 'custom' && startDate && endDate) {
      dateFrom = new Date(startDate)
      dateTo = new Date(endDate)
    } else if (period === 'year') {
      dateFrom = new Date(`${year}-01-01`)
      dateTo = new Date(`${year}-12-31`)
    } else if (period === 'quarter' && quarter) {
      const quarterMap: Record<string, { start: string; end: string }> = {
        Q1: { start: '01-01', end: '03-31' },
        Q2: { start: '04-01', end: '06-30' },
        Q3: { start: '07-01', end: '09-30' },
        Q4: { start: '10-01', end: '12-31' },
      }
      const q = quarterMap[quarter]
      dateFrom = new Date(`${year}-${q.start}`)
      dateTo = new Date(`${year}-${q.end}`)
    } else if (period === 'month') {
      const monthNum = month || new Date().getMonth() + 1
      const yearNum = parseInt(year)
      dateFrom = new Date(yearNum, parseInt(monthNum.toString()) - 1, 1)
      dateTo = new Date(yearNum, parseInt(monthNum.toString()), 0)
    } else {
      const now = new Date()
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    dateFrom.setHours(0, 0, 0, 0)
    dateTo.setHours(23, 59, 59, 999)

    // Build where clause
    const whereClause: any = {
      businessId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: { in: ['approved', 'received'] },
    }

    if (supplierId) whereClause.supplierId = parseInt(supplierId)
    if (locationId) whereClause.locationId = parseInt(locationId)

    // Get all purchases
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        items: true,
        supplier: { select: { id: true, name: true } },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get product IDs
    const productIds = Array.from(
      new Set(purchases.flatMap((p) => p.items.map((i) => i.productId)))
    )

    // Fetch products
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: { select: { id: true, name: true } },
      },
    })

    const productMap = new Map(products.map((p) => [p.id, p]))

    // Flatten to line items
    let lineItems = purchases.flatMap((purchase) =>
      purchase.items.map((item) => {
        const product = productMap.get(item.productId)
        const quantity = parseFloat(item.quantity.toString())
        const unitCost = parseFloat(item.unitCost.toString())
        const lineTotal = quantity * unitCost

        return {
          purchaseId: purchase.id,
          purchaseOrderNumber: purchase.purchaseOrderNumber,
          purchaseDate: purchase.createdAt.toISOString().split('T')[0],
          supplierName: purchase.supplier?.name || 'Unknown',
          supplierId: purchase.supplierId,
          productId: item.productId,
          productName: product?.name || 'Unknown Product',
          sku: product?.sku || '',
          categoryId: product?.category?.id || null,
          categoryName: product?.category?.name || 'Uncategorized',
          quantity: Math.round(quantity * 100) / 100,
          unitCost: Math.round(unitCost * 100) / 100,
          lineTotal: Math.round(lineTotal * 100) / 100,
          product,
        }
      })
    )

    // Apply filters
    if (productId) {
      lineItems = lineItems.filter((item) => item.productId === parseInt(productId))
    }

    if (categoryId) {
      lineItems = lineItems.filter((item) => item.categoryId === parseInt(categoryId))
    }

    // Calculate summary
    const summary = {
      totalLines: lineItems.length,
      totalQuantity: lineItems.reduce((sum, item) => sum + item.quantity, 0),
      totalAmount: lineItems.reduce((sum, item) => sum + item.lineTotal, 0),
      uniquePOs: new Set(lineItems.map((item) => item.purchaseId)).size,
      uniqueProducts: new Set(lineItems.map((item) => item.productId)).size,
      uniqueSuppliers: new Set(lineItems.map((item) => item.supplierId)).size,
    }

    // Round summary
    summary.totalQuantity = Math.round(summary.totalQuantity * 100) / 100
    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100

    // Remove product object from response (too large)
    const responseItems = lineItems.map(({ product, ...rest }) => rest)

    return NextResponse.json({
      success: true,
      data: {
        period: {
          type: period,
          year,
          quarter,
          month,
          startDate: dateFrom.toISOString().split('T')[0],
          endDate: dateTo.toISOString().split('T')[0],
        },
        summary,
        items: responseItems,
      },
    })
  } catch (error) {
    console.error('Item Purchase Detail Report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate item purchase detail report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
