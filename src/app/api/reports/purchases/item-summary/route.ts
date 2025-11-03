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
    const period = searchParams.get('period') || 'month' // year|quarter|month|custom
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const quarter = searchParams.get('quarter') // Q1|Q2|Q3|Q4
    const month = searchParams.get('month') // 1-12
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const supplierId = searchParams.get('supplierId')
    const categoryId = searchParams.get('categoryId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    const businessId = parseInt(session.user.businessId)

    // Build date range based on period
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
      // Default to current month
      const now = new Date()
      dateFrom = new Date(now.getFullYear(), now.getMonth(), 1)
      dateTo = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    }

    // Set time to cover full days
    dateFrom.setHours(0, 0, 0, 0)
    dateTo.setHours(23, 59, 59, 999)

    // Build where clause
    const whereClause: any = {
      businessId,
      createdAt: {
        gte: dateFrom,
        lte: dateTo,
      },
      status: { in: ['approved', 'received'] }, // Only approved/received purchases
    }

    if (supplierId) whereClause.supplierId = parseInt(supplierId)
    if (locationId) whereClause.locationId = parseInt(locationId)

    // Get all purchases for the period with their items
    const purchases = await prisma.purchase.findMany({
      where: whereClause,
      include: {
        items: true,
        supplier: { select: { name: true } },
      },
    })

    // Get all unique product IDs
    const productIds = Array.from(new Set(purchases.flatMap(p => p.items.map(i => i.productId))))

    // Fetch all products
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        category: { select: { id: true, name: true } },
      },
    })

    const productMap = new Map(products.map(p => [p.id, p]))

    // Flatten purchase items with product data
    const purchaseItems = purchases.flatMap(purchase =>
      purchase.items.map(item => ({
        ...item,
        purchase: {
          id: purchase.id,
          purchaseOrderNumber: purchase.purchaseOrderNumber,
          createdAt: purchase.createdAt,
          supplier: purchase.supplier,
        },
        product: productMap.get(item.productId),
      }))
    )

    // Filter by category if specified
    let filteredItems = purchaseItems.filter(item => item.product) // Only items with valid products
    if (categoryId) {
      filteredItems = filteredItems.filter(
        (item) => item.product?.category?.id === parseInt(categoryId)
      )
    }

    // Group by product
    const productSummaryMap = new Map<number, any>()

    for (const item of filteredItems) {
      if (!item.product) continue // Skip if product not found

      const productId = item.product.id
      const quantity = parseFloat(item.quantity.toString())
      const unitCost = parseFloat(item.unitCost.toString())
      const lineTotal = quantity * unitCost

      if (!productSummaryMap.has(productId)) {
        productSummaryMap.set(productId, {
          productId,
          productName: item.product.name,
          sku: item.product.sku,
          category: item.product.category?.name || 'Uncategorized',
          totalQuantity: 0,
          totalAmount: 0,
          numberOfPOs: new Set<number>(),
          costs: [],
          minCost: Infinity,
          maxCost: 0,
        })
      }

      const productData = productSummaryMap.get(productId)!
      productData.totalQuantity += quantity
      productData.totalAmount += lineTotal
      productData.numberOfPOs.add(item.purchase.id)
      productData.costs.push(unitCost)
      productData.minCost = Math.min(productData.minCost, unitCost)
      productData.maxCost = Math.max(productData.maxCost, unitCost)
    }

    // Calculate summary and format results
    const items = Array.from(productSummaryMap.values()).map((item) => {
      const avgCost = item.costs.length > 0
        ? item.costs.reduce((sum: number, cost: number) => sum + cost, 0) / item.costs.length
        : 0

      const costVariance = item.minCost > 0 && item.minCost !== Infinity
        ? ((item.maxCost - item.minCost) / item.minCost) * 100
        : 0

      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        category: item.category,
        totalQuantity: Math.round(item.totalQuantity * 100) / 100,
        totalAmount: Math.round(item.totalAmount * 100) / 100,
        numberOfPOs: item.numberOfPOs.size,
        avgCost: Math.round(avgCost * 100) / 100,
        minCost: item.minCost !== Infinity ? Math.round(item.minCost * 100) / 100 : 0,
        maxCost: Math.round(item.maxCost * 100) / 100,
        costVariance: Math.round(costVariance * 100) / 100,
      }
    })

    // Sort by total amount descending
    items.sort((a, b) => b.totalAmount - a.totalAmount)

    // Calculate totals
    const summary = {
      totalItems: items.length,
      totalQuantity: items.reduce((sum, item) => sum + item.totalQuantity, 0),
      totalAmount: items.reduce((sum, item) => sum + item.totalAmount, 0),
      totalPOs: new Set(filteredItems.map((i) => i.purchase.id)).size,
      avgPOValue: 0,
    }

    if (summary.totalPOs > 0) {
      summary.avgPOValue = summary.totalAmount / summary.totalPOs
    }

    // Round summary values
    summary.totalQuantity = Math.round(summary.totalQuantity * 100) / 100
    summary.totalAmount = Math.round(summary.totalAmount * 100) / 100
    summary.avgPOValue = Math.round(summary.avgPOValue * 100) / 100

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
        items,
      },
    })
  } catch (error) {
    console.error('Item Purchase Summary Report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate item purchase summary report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
