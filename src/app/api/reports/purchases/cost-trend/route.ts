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
    const variationId = searchParams.get('variationId')
    const months = parseInt(searchParams.get('months') || '12')

    if (!variationId) {
      return NextResponse.json({ error: 'Product Variation ID is required' }, { status: 400 })
    }

    // Calculate date range (last N months)
    const endDate = new Date()
    const startDate = new Date()
    startDate.setMonth(startDate.getMonth() - months)

    // Get product variation info with product details
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: parseInt(variationId),
        product: {
          businessId: businessId,
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
    }

    // Get all purchase items for this variation
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: {
        productVariationId: parseInt(variationId),
        purchase: {
          businessId: businessId,
          purchaseDate: {
            gte: startDate,
            lte: endDate,
          },
          status: {
            in: ['approved', 'received', 'partial'],
          },
        },
      },
      include: {
        purchase: {
          select: {
            purchaseDate: true,
            supplier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        purchase: {
          purchaseDate: 'asc',
        },
      },
    })

    // Group by month
    const monthlyData = new Map()

    purchaseItems.forEach((item) => {
      const date = new Date(item.purchase.purchaseDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthlyData.has(monthKey)) {
        monthlyData.set(monthKey, {
          month: monthKey,
          label: date.toLocaleString('default', { month: 'short', year: 'numeric' }),
          totalQuantity: 0,
          totalAmount: 0,
          avgCost: 0,
          minCost: Infinity,
          maxCost: 0,
          numberOfPurchases: 0,
        })
      }

      const data = monthlyData.get(monthKey)
      const unitCost = Number(item.unitCost)
      const quantity = Number(item.quantity)

      data.totalQuantity += quantity
      data.totalAmount += unitCost * quantity
      data.numberOfPurchases++
      data.minCost = Math.min(data.minCost, unitCost)
      data.maxCost = Math.max(data.maxCost, unitCost)
    })

    // Calculate averages and convert to array
    const trends = Array.from(monthlyData.values()).map((data) => ({
      ...data,
      avgCost: data.totalQuantity > 0 ? data.totalAmount / data.totalQuantity : 0,
      minCost: data.minCost === Infinity ? 0 : data.minCost,
    }))

    // Calculate trend direction and percentage change
    trends.forEach((trend, index) => {
      if (index > 0) {
        const prevCost = trends[index - 1].avgCost
        const currentCost = trend.avgCost
        const change = prevCost > 0 ? ((currentCost - prevCost) / prevCost) * 100 : 0

        trend.changeFromPrev = change
        trend.direction = change > 0 ? 'increasing' : change < 0 ? 'decreasing' : 'stable'
      } else {
        trend.changeFromPrev = 0
        trend.direction = 'stable'
      }
    })

    // Calculate summary with safe fallbacks
    const minCosts = trends.length > 0 ? trends.map((t) => t.minCost).filter(c => c > 0) : []
    const maxCosts = trends.length > 0 ? trends.map((t) => t.maxCost).filter(c => c > 0) : []

    const summary = {
      productName: `${variation.product.name} - ${variation.name}`,
      productSku: variation.sku,
      variationName: variation.name,
      totalPurchases: purchaseItems.length,
      totalQuantity: trends.reduce((sum, t) => sum + t.totalQuantity, 0),
      overallAvgCost: trends.length > 0
        ? trends.reduce((sum, t) => sum + t.avgCost, 0) / trends.length
        : 0,
      lowestCost: minCosts.length > 0 ? Math.min(...minCosts) : 0,
      highestCost: maxCosts.length > 0 ? Math.max(...maxCosts) : 0,
      currentCost: trends.length > 0 ? trends[trends.length - 1].avgCost : 0,
      costVariance: trends.length > 0 && trends[0].avgCost > 0
        ? ((trends[trends.length - 1].avgCost - trends[0].avgCost) / trends[0].avgCost) * 100
        : 0,
    }

    return NextResponse.json({
      success: true,
      data: {
        product: variation.product,
        variation,
        summary,
        trends,
      },
    })
  } catch (error) {
    console.error('Cost trend report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate cost trend report' },
      { status: 500 }
    )
  }
}
