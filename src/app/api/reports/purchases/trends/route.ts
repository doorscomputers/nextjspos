import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, eachWeekOfInterval, eachMonthOfInterval } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const groupBy = searchParams.get('groupBy') || 'month' // week, month, quarter, year
    const productIdParam = searchParams.get('productId')
    const supplierIdParam = searchParams.get('supplierId')
    const locationIdParam = searchParams.get('locationId')

    const businessId = parseInt(session.user.businessId)

    const yearStart = startOfYear(new Date(year, 0, 1))
    const yearEnd = endOfYear(new Date(year, 0, 1))

    // Build where clause for purchases
    const purchaseWhere: any = {
      businessId,
      deletedAt: null,
      status: {
        in: ['received', 'completed']
      },
      purchaseDate: {
        gte: yearStart,
        lte: yearEnd
      }
    }

    // Add filters if provided
    if (supplierIdParam && supplierIdParam !== 'all') {
      purchaseWhere.supplierId = parseInt(supplierIdParam)
    }

    if (locationIdParam && locationIdParam !== 'all') {
      purchaseWhere.locationId = parseInt(locationIdParam)
    }

    // Get all received/completed purchases for the year
    const purchases = await prisma.purchase.findMany({
      where: purchaseWhere,
      include: {
        items: true
      },
      orderBy: {
        purchaseDate: 'asc'
      }
    })

    // Get unique product and variation IDs from purchases
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    purchases.forEach(purchase => {
      purchase.items.forEach(item => {
        productIds.add(item.productId)
        variationIds.add(item.productVariationId)
      })
    })

    // Fetch products and variations separately
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true, sku: true }
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, productId: true, name: true, sku: true }
    })

    // Create lookup maps
    const productMap = new Map(products.map(p => [p.id, p]))
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Build product purchase data
    const productPurchases = new Map<number, {
      productId: number
      productName: string
      productSku: string
      variations: Map<number, {
        variationId: number
        variationName: string
        variationSku: string
        totalQuantity: number
        totalCost: number
        purchaseCount: number
        byPeriod: Map<string, { quantity: number; cost: number }>
      }>
      totalQuantity: number
      totalCost: number
      purchaseCount: number
      byPeriod: Map<string, { quantity: number; cost: number }>
    }>()

    purchases.forEach(purchase => {
      if (!purchase.purchaseDate) return

      const purchaseDate = new Date(purchase.purchaseDate)
      let periodKey = ''

      // Generate period key based on groupBy
      switch (groupBy) {
        case 'week':
          const weekStart = startOfWeek(purchaseDate, { weekStartsOn: 1 })
          periodKey = format(weekStart, 'yyyy-MM-dd')
          break
        case 'month':
          periodKey = format(purchaseDate, 'yyyy-MM')
          break
        case 'quarter':
          const quarter = Math.floor(purchaseDate.getMonth() / 3) + 1
          periodKey = `${year}-Q${quarter}`
          break
        case 'year':
          periodKey = format(purchaseDate, 'yyyy')
          break
      }

      purchase.items.forEach(item => {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())
        const unitCost = parseFloat(item.unitCost.toString())
        const totalItemCost = quantity * unitCost
        const product = productMap.get(productId)
        const variation = variationMap.get(variationId)

        // Skip if product or variation not found
        if (!product || !variation) return

        // Filter by product if specified
        if (productIdParam && productIdParam !== 'all' && productId !== parseInt(productIdParam)) {
          return
        }

        // Initialize product if not exists
        if (!productPurchases.has(productId)) {
          productPurchases.set(productId, {
            productId,
            productName: product.name,
            productSku: product.sku || '',
            variations: new Map(),
            totalQuantity: 0,
            totalCost: 0,
            purchaseCount: 0,
            byPeriod: new Map()
          })
        }

        const productData = productPurchases.get(productId)!

        // Update product totals
        productData.totalQuantity += quantity
        productData.totalCost += totalItemCost
        productData.purchaseCount += 1

        // Update product period data
        const currentPeriodData = productData.byPeriod.get(periodKey) || { quantity: 0, cost: 0 }
        productData.byPeriod.set(periodKey, {
          quantity: currentPeriodData.quantity + quantity,
          cost: currentPeriodData.cost + totalItemCost
        })

        // Initialize variation if not exists
        if (!productData.variations.has(variationId)) {
          productData.variations.set(variationId, {
            variationId,
            variationName: variation.name || 'Default',
            variationSku: variation.sku || '',
            totalQuantity: 0,
            totalCost: 0,
            purchaseCount: 0,
            byPeriod: new Map()
          })
        }

        const variationData = productData.variations.get(variationId)!

        // Update variation totals
        variationData.totalQuantity += quantity
        variationData.totalCost += totalItemCost
        variationData.purchaseCount += 1

        // Update variation period data
        const currentVariationPeriodData = variationData.byPeriod.get(periodKey) || { quantity: 0, cost: 0 }
        variationData.byPeriod.set(periodKey, {
          quantity: currentVariationPeriodData.quantity + quantity,
          cost: currentVariationPeriodData.cost + totalItemCost
        })
      })
    })

    // Generate all periods for the year
    const allPeriods: string[] = []

    switch (groupBy) {
      case 'week':
        const weeks = eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 })
        weeks.forEach(week => {
          allPeriods.push(format(week, 'yyyy-MM-dd'))
        })
        break
      case 'month':
        const months = eachMonthOfInterval({ start: yearStart, end: yearEnd })
        months.forEach(month => {
          allPeriods.push(format(month, 'yyyy-MM'))
        })
        break
      case 'quarter':
        allPeriods.push(`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`)
        break
      case 'year':
        allPeriods.push(year.toString())
        break
    }

    // Convert to array and sort by total cost
    const productsArray = Array.from(productPurchases.values())
      .map(product => {
        // Convert variations map to array
        const variationsArray = Array.from(product.variations.values())
          .map(variation => ({
            variationId: variation.variationId,
            variationName: variation.variationName,
            variationSku: variation.variationSku,
            totalQuantity: variation.totalQuantity,
            totalCost: variation.totalCost,
            purchaseCount: variation.purchaseCount,
            avgCost: variation.purchaseCount > 0 ? variation.totalCost / variation.totalQuantity : 0,
            byPeriod: Object.fromEntries(
              Array.from(variation.byPeriod.entries()).map(([key, val]) => [key, val])
            )
          }))
          .sort((a, b) => b.totalCost - a.totalCost)

        return {
          productId: product.productId,
          productName: product.productName,
          productSku: product.productSku,
          totalQuantity: product.totalQuantity,
          totalCost: product.totalCost,
          purchaseCount: product.purchaseCount,
          avgCost: product.purchaseCount > 0 ? product.totalCost / product.totalQuantity : 0,
          variations: variationsArray,
          byPeriod: Object.fromEntries(
            Array.from(product.byPeriod.entries()).map(([key, val]) => [key, val])
          )
        }
      })
      .sort((a, b) => b.totalCost - a.totalCost)

    // Calculate summary stats
    const totalProducts = productsArray.length
    const totalQuantityPurchased = productsArray.reduce((sum, p) => sum + p.totalQuantity, 0)
    const totalCostPurchased = productsArray.reduce((sum, p) => sum + p.totalCost, 0)
    const totalPurchases = purchases.length

    // Prepare chart data (top 10 products by cost)
    const top10Products = productsArray.slice(0, 10)

    const chartData = {
      labels: allPeriods.map(period => {
        // Format period labels nicely
        if (groupBy === 'week') {
          return format(new Date(period), 'MMM dd')
        } else if (groupBy === 'month') {
          return format(new Date(period + '-01'), 'MMM yyyy')
        } else if (groupBy === 'quarter') {
          return period
        } else {
          return period
        }
      }),
      datasets: top10Products.map((product, index) => {
        // Generate distinct colors for each product
        const colors = [
          { bg: 'rgba(59, 130, 246, 0.5)', border: 'rgb(59, 130, 246)' },   // Blue
          { bg: 'rgba(16, 185, 129, 0.5)', border: 'rgb(16, 185, 129)' },   // Green
          { bg: 'rgba(249, 115, 22, 0.5)', border: 'rgb(249, 115, 22)' },   // Orange
          { bg: 'rgba(139, 92, 246, 0.5)', border: 'rgb(139, 92, 246)' },   // Purple
          { bg: 'rgba(236, 72, 153, 0.5)', border: 'rgb(236, 72, 153)' },   // Pink
          { bg: 'rgba(234, 179, 8, 0.5)', border: 'rgb(234, 179, 8)' },     // Yellow
          { bg: 'rgba(6, 182, 212, 0.5)', border: 'rgb(6, 182, 212)' },     // Cyan
          { bg: 'rgba(239, 68, 68, 0.5)', border: 'rgb(239, 68, 68)' },     // Red
          { bg: 'rgba(34, 197, 94, 0.5)', border: 'rgb(34, 197, 94)' },     // Emerald
          { bg: 'rgba(168, 85, 247, 0.5)', border: 'rgb(168, 85, 247)' }    // Violet
        ]

        const color = colors[index % colors.length]

        return {
          label: product.productName,
          data: allPeriods.map(period => {
            const periodData = product.byPeriod[period]
            return periodData ? periodData.cost : 0
          }),
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 2,
          tension: 0.3
        }
      })
    }

    // Period-over-period comparison
    const periodComparison = allPeriods.map(period => {
      const totals = productsArray.reduce((acc, product) => {
        const periodData = product.byPeriod[period]
        if (periodData) {
          acc.quantity += periodData.quantity
          acc.cost += periodData.cost
        }
        return acc
      }, { quantity: 0, cost: 0 })

      return {
        period,
        totalQuantity: totals.quantity,
        totalCost: totals.cost,
        productCount: productsArray.filter(p => {
          const periodData = p.byPeriod[period]
          return periodData && periodData.quantity > 0
        }).length
      }
    })

    return NextResponse.json({
      summary: {
        year,
        groupBy,
        totalProducts,
        totalQuantityPurchased,
        totalCostPurchased,
        totalPurchases,
        avgCostPerPurchase: totalPurchases > 0
          ? (totalCostPurchased / totalPurchases).toFixed(2)
          : 0,
        avgQuantityPerPurchase: totalPurchases > 0
          ? (totalQuantityPurchased / totalPurchases).toFixed(2)
          : 0
      },
      products: productsArray,
      top10Products,
      chartData,
      periodComparison,
      allPeriods
    })
  } catch (error) {
    console.error('Purchase trends report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate purchase trends report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
