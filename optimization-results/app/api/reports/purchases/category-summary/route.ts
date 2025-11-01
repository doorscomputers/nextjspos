import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get('period') || 'year'
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    // Calculate date range
    let startDate: Date
    let endDate: Date

    if (period === 'year') {
      startDate = new Date(`${year}-01-01`)
      endDate = new Date(`${year}-12-31`)
    } else if (period === 'quarter') {
      const quarter = searchParams.get('quarter') || 'Q1'
      const quarterMap: Record<string, { start: string; end: string }> = {
        Q1: { start: '01-01', end: '03-31' },
        Q2: { start: '04-01', end: '06-30' },
        Q3: { start: '07-01', end: '09-30' },
        Q4: { start: '10-01', end: '12-31' },
      }
      startDate = new Date(`${year}-${quarterMap[quarter].start}`)
      endDate = new Date(`${year}-${quarterMap[quarter].end}`)
    } else {
      // month
      const month = searchParams.get('month') || '1'
      startDate = new Date(`${year}-${month.padStart(2, '0')}-01`)
      endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0)
    }

    // Get all purchases with items in the period
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId: businessId,
        purchaseDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: ['approved', 'received', 'partial'],
        },
      },
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      },
    })

    // Get product IDs
    const productIds = Array.from(
      new Set(purchases.flatMap((p) => p.items.map((i) => i.productId)))
    )

    // Fetch products with categories
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        businessId: businessId,
      },
      select: {
        id: { select: { id: true, name: true } },
        name: { select: { id: true, name: true } },
        sku: { select: { id: true, name: true } },
        categoryId: { select: { id: true, name: true } },
      },
    })

    // Fetch categories
    const categoryIds = Array.from(
      new Set(products.map((p) => p.categoryId).filter(Boolean))
    ) as number[]

    const categories = await prisma.category.findMany({
      where: {
        id: { in: categoryIds },
        businessId: businessId,
      },
    })

    const categoryMap = new Map(categories.map((c) => [c.id, c.name]))
    const productMap = new Map(products.map((p) => [p.id, p]))

    // Calculate category metrics
    const categoryMetrics = new Map()

    purchases.forEach((purchase) => {
      purchase.items.forEach((item) => {
        const product = productMap.get(item.productId)
        if (!product) return

        const categoryId = product.categoryId || 0
        const categoryName = categoryId ? categoryMap.get(categoryId) || 'Uncategorized' : 'Uncategorized'

        if (!categoryMetrics.has(categoryName)) {
          categoryMetrics.set(categoryName, {
            categoryName,
            totalAmount: 0,
            totalQuantity: 0,
            numberOfPOs: new Set(),
            numberOfProducts: new Set(),
            avgUnitCost: 0,
            totalCost: 0,
            itemCount: 0,
          })
        }

        const metric = categoryMetrics.get(categoryName)
        metric.totalAmount += Number(item.quantity) * Number(item.unitCost)
        metric.totalQuantity += Number(item.quantity)
        metric.numberOfPOs.add(purchase.id)
        metric.numberOfProducts.add(item.productId)
        metric.totalCost += Number(item.unitCost)
        metric.itemCount++
      })
    })

    // Calculate final metrics and convert to array
    const categorySummary = Array.from(categoryMetrics.values()).map((category) => {
      const avgUnitCost = category.itemCount > 0 ? category.totalCost / category.itemCount : 0

      return {
        categoryName: category.categoryName,
        totalAmount: category.totalAmount,
        totalQuantity: category.totalQuantity,
        numberOfPOs: category.numberOfPOs.size,
        numberOfProducts: category.numberOfProducts.size,
        avgUnitCost: Math.round(avgUnitCost * 100) / 100,
      }
    })

    // Sort by total amount descending
    categorySummary.sort((a, b) => b.totalAmount - a.totalAmount)

    // Calculate summary
    const summary = {
      totalCategories: categorySummary.length,
      totalAmount: categorySummary.reduce((sum, c) => sum + c.totalAmount, 0),
      totalQuantity: categorySummary.reduce((sum, c) => sum + c.totalQuantity, 0),
      totalPOs: purchases.length,
      avgAmountPerCategory: categorySummary.length > 0
        ? categorySummary.reduce((sum, c) => sum + c.totalAmount, 0) / categorySummary.length
        : 0,
    }

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      data: {
        period: {
          type: period,
          year,
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
        },
        summary,
        categories: categorySummary,
      },
    })
  } catch (error) {
    console.error('Category summary report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate category summary report' },
      { status: 500 }
    )
  }
}
