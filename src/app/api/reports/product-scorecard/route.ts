import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

interface ProductMetrics {
  productId: number
  variationId: number
  productName: string
  variationName: string
  sku: string
  category: string
  categoryId: number | null
  totalRevenue: number
  totalQuantity: number
  totalCost: number
  grossProfit: number
  marginPercent: number
  unitsSold: number
  transactionCount: number
  // For XYZ calculation
  dailySales: number[]
  avgDailySales: number
  stdDevSales: number
  coefficientOfVariation: number
  // Classifications
  abcClass: 'A' | 'B' | 'C'
  xyzClass: 'X' | 'Y' | 'Z'
  recommendation: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const categoryId = searchParams.get('categoryId')
    const periodDays = parseInt(searchParams.get('periodDays') || '60')

    const businessId = parseInt(session.user.businessId)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - periodDays)

    // Build location filter
    let locationFilter = {}
    if (locationId && locationId !== 'all') {
      locationFilter = { locationId: parseInt(locationId) }
    }

    // Fetch all sales within the period
    // Note: SaleItem doesn't have a direct relation to ProductVariation in schema,
    // so we filter via product relation instead
    const salesData = await prisma.saleItem.findMany({
      where: {
        sale: {
          businessId,
          status: { in: ['completed', 'final'] },
          saleDate: {
            gte: startDate,
            lte: endDate,
          },
          ...locationFilter,
        },
        product: {
          businessId,
          isActive: true,
          deletedAt: null,
          ...(categoryId && categoryId !== 'all' ? { categoryId: parseInt(categoryId) } : {}),
        },
      },
      include: {
        sale: {
          select: {
            saleDate: true,
            locationId: true,
          },
        },
        product: {
          include: {
            category: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Get all variations for the products that had sales
    const variationIds = [...new Set(salesData.map(s => s.productVariationId))]
    const variations = await prisma.productVariation.findMany({
      where: {
        id: { in: variationIds },
      },
      select: {
        id: true,
        name: true,
        sku: true,
        productId: true,
      },
    })
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Group sales by variation and calculate metrics
    const productMetricsMap = new Map<number, {
      productId: number
      variationId: number
      productName: string
      variationName: string
      sku: string
      category: string
      categoryId: number | null
      totalRevenue: number
      totalQuantity: number
      totalCost: number
      transactionCount: number
      salesByDate: Map<string, number>
    }>()

    for (const sale of salesData) {
      const variationId = sale.productVariationId
      const variation = variationMap.get(variationId)
      if (!variation) continue

      const quantity = parseFloat(sale.quantity.toString())
      const unitPrice = parseFloat(sale.unitPrice.toString())
      const unitCost = parseFloat(sale.unitCost.toString())
      const revenue = quantity * unitPrice
      const cost = quantity * unitCost
      const dateKey = sale.sale.saleDate.toISOString().split('T')[0]

      if (!productMetricsMap.has(variationId)) {
        productMetricsMap.set(variationId, {
          productId: sale.productId,
          variationId,
          productName: sale.product.name,
          variationName: variation.name,
          sku: variation.sku,
          category: sale.product.category?.name || 'Uncategorized',
          categoryId: sale.product.categoryId,
          totalRevenue: 0,
          totalQuantity: 0,
          totalCost: 0,
          transactionCount: 0,
          salesByDate: new Map(),
        })
      }

      const metrics = productMetricsMap.get(variationId)!
      metrics.totalRevenue += revenue
      metrics.totalQuantity += quantity
      metrics.totalCost += cost
      metrics.transactionCount += 1

      // Track daily sales for XYZ calculation
      const currentDailySales = metrics.salesByDate.get(dateKey) || 0
      metrics.salesByDate.set(dateKey, currentDailySales + quantity)
    }

    // Calculate derived metrics and classifications
    const products: ProductMetrics[] = []
    let totalRevenue = 0

    for (const [, metrics] of productMetricsMap) {
      totalRevenue += metrics.totalRevenue
    }

    // Sort by revenue for ABC classification
    const sortedByRevenue = [...productMetricsMap.values()].sort((a, b) => b.totalRevenue - a.totalRevenue)

    let cumulativeRevenue = 0
    const productResults: ProductMetrics[] = []

    for (const metrics of sortedByRevenue) {
      // Calculate gross profit and margin
      const grossProfit = metrics.totalRevenue - metrics.totalCost
      const marginPercent = metrics.totalRevenue > 0
        ? (grossProfit / metrics.totalRevenue) * 100
        : 0

      // ABC Classification based on cumulative revenue contribution
      cumulativeRevenue += metrics.totalRevenue
      const cumulativePercent = (cumulativeRevenue / totalRevenue) * 100
      let abcClass: 'A' | 'B' | 'C'
      if (cumulativePercent <= 80) {
        abcClass = 'A'
      } else if (cumulativePercent <= 95) {
        abcClass = 'B'
      } else {
        abcClass = 'C'
      }

      // XYZ Classification based on demand variability (Coefficient of Variation)
      // Convert salesByDate to daily sales array
      const dailySales: number[] = []
      const currentDate = new Date(startDate)
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0]
        dailySales.push(metrics.salesByDate.get(dateKey) || 0)
        currentDate.setDate(currentDate.getDate() + 1)
      }

      const avgDailySales = dailySales.reduce((a, b) => a + b, 0) / dailySales.length
      const variance = dailySales.reduce((sum, val) => sum + Math.pow(val - avgDailySales, 2), 0) / dailySales.length
      const stdDevSales = Math.sqrt(variance)
      const coefficientOfVariation = avgDailySales > 0 ? stdDevSales / avgDailySales : 1

      let xyzClass: 'X' | 'Y' | 'Z'
      if (coefficientOfVariation < 0.5) {
        xyzClass = 'X'
      } else if (coefficientOfVariation < 1.0) {
        xyzClass = 'Y'
      } else {
        xyzClass = 'Z'
      }

      // Generate recommendation based on ABC-XYZ combination
      const recommendation = getRecommendation(abcClass, xyzClass)

      productResults.push({
        productId: metrics.productId,
        variationId: metrics.variationId,
        productName: metrics.productName,
        variationName: metrics.variationName,
        sku: metrics.sku,
        category: metrics.category,
        categoryId: metrics.categoryId,
        totalRevenue: Math.round(metrics.totalRevenue * 100) / 100,
        totalQuantity: Math.round(metrics.totalQuantity * 100) / 100,
        totalCost: Math.round(metrics.totalCost * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        marginPercent: Math.round(marginPercent * 10) / 10,
        unitsSold: Math.round(metrics.totalQuantity),
        transactionCount: metrics.transactionCount,
        dailySales,
        avgDailySales: Math.round(avgDailySales * 100) / 100,
        stdDevSales: Math.round(stdDevSales * 100) / 100,
        coefficientOfVariation: Math.round(coefficientOfVariation * 100) / 100,
        abcClass,
        xyzClass,
        recommendation,
      })
    }

    // Calculate matrix counts
    const matrixCounts = {
      AX: 0, AY: 0, AZ: 0,
      BX: 0, BY: 0, BZ: 0,
      CX: 0, CY: 0, CZ: 0,
    }

    for (const product of productResults) {
      const key = `${product.abcClass}${product.xyzClass}` as keyof typeof matrixCounts
      matrixCounts[key]++
    }

    // Calculate summary statistics
    const totalProducts = productResults.length
    const avgMargin = totalProducts > 0
      ? productResults.reduce((sum, p) => sum + p.marginPercent, 0) / totalProducts
      : 0

    const summary = {
      totalProducts,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgMargin: Math.round(avgMargin * 10) / 10,
      periodDays,
      aClassCount: productResults.filter(p => p.abcClass === 'A').length,
      bClassCount: productResults.filter(p => p.abcClass === 'B').length,
      cClassCount: productResults.filter(p => p.abcClass === 'C').length,
      xClassCount: productResults.filter(p => p.xyzClass === 'X').length,
      yClassCount: productResults.filter(p => p.xyzClass === 'Y').length,
      zClassCount: productResults.filter(p => p.xyzClass === 'Z').length,
      matrixCounts,
      dataAccuracyNote: periodDays < 90
        ? 'XYZ classification accuracy improves with more historical data (90+ days recommended)'
        : null,
    }

    return NextResponse.json({
      success: true,
      data: {
        summary,
        products: productResults,
      },
    })
  } catch (error) {
    console.error('Product scorecard error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate product scorecard',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

function getRecommendation(abcClass: 'A' | 'B' | 'C', xyzClass: 'X' | 'Y' | 'Z'): string {
  const recommendations: Record<string, string> = {
    AX: 'Star Product - Never stock out, maintain safety stock',
    AY: 'Plan carefully - High value but variable demand',
    AZ: 'Keep safety buffer - Critical but unpredictable',
    BX: 'Standard management - Regular reorder process',
    BY: 'Watch closely - Monitor demand patterns',
    BZ: 'Review regularly - Consider reducing variety',
    CX: 'Automate ordering - Low touch management',
    CY: 'Automate or reduce - Limited focus needed',
    CZ: 'Consider eliminating - Low value, high risk',
  }
  return recommendations[`${abcClass}${xyzClass}`] || 'Review product'
}
