import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { startOfYear, endOfYear, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, eachWeekOfInterval, eachMonthOfInterval, eachQuarterOfInterval } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString())
    const groupBy = searchParams.get('groupBy') || 'month' // week, month, quarter, year
    const productIdParam = searchParams.get('productId') // Optional: filter by product
    const fromLocationIdParam = searchParams.get('fromLocationId') // Optional: filter by from location
    const toLocationIdParam = searchParams.get('toLocationId') // Optional: filter by to location

    const businessId = parseInt(session.user.businessId)

    const yearStart = startOfYear(new Date(year, 0, 1))
    const yearEnd = endOfYear(new Date(year, 0, 1))

    // Build where clause for transfers
    const transferWhere: any = {
      businessId,
      deletedAt: null,
      status: {
        in: ['verified', 'completed']
      },
      OR: [
        {
          completedAt: {
            gte: yearStart,
            lte: yearEnd
          }
        },
        {
          verifiedAt: {
            gte: yearStart,
            lte: yearEnd
          }
        }
      ]
    }

    // Add location filters if provided
    if (fromLocationIdParam && fromLocationIdParam !== 'all') {
      transferWhere.fromLocationId = parseInt(fromLocationIdParam)
    }

    if (toLocationIdParam && toLocationIdParam !== 'all') {
      transferWhere.toLocationId = parseInt(toLocationIdParam)
    }

    // Get all verified and completed transfers for the year
    const transfers = await prisma.stockTransfer.findMany({
      where: transferWhere,
      include: {
        items: true
      },
      orderBy: [
        { completedAt: 'asc' },
        { verifiedAt: 'asc' }
      ]
    })

    // Get unique product and variation IDs from transfers
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    transfers.forEach(transfer => {
      transfer.items.forEach(item => {
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

    // Build product transfer data
    const productTransfers = new Map<number, {
      productId: number
      productName: string
      productSku: string
      variations: Map<number, {
        variationId: number
        variationName: string
        variationSku: string
        totalQuantity: number
        transferCount: number
        byPeriod: Map<string, number> // period key -> quantity
      }>
      totalQuantity: number
      transferCount: number
      byPeriod: Map<string, number>
    }>()

    transfers.forEach(transfer => {
      // Use completedAt if available, otherwise use verifiedAt
      const effectiveDate = transfer.completedAt || transfer.verifiedAt
      if (!effectiveDate) return

      const transferDate = new Date(effectiveDate)
      let periodKey = ''

      // Generate period key based on groupBy
      switch (groupBy) {
        case 'week':
          const weekStart = startOfWeek(transferDate, { weekStartsOn: 1 })
          periodKey = format(weekStart, 'yyyy-MM-dd')
          break
        case 'month':
          periodKey = format(transferDate, 'yyyy-MM')
          break
        case 'quarter':
          const quarter = Math.floor(transferDate.getMonth() / 3) + 1
          periodKey = `${year}-Q${quarter}`
          break
        case 'year':
          periodKey = format(transferDate, 'yyyy')
          break
      }

      transfer.items.forEach(item => {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())
        const product = productMap.get(productId)
        const variation = variationMap.get(variationId)

        // Skip if product or variation not found
        if (!product || !variation) return

        // Filter by product if specified
        if (productIdParam && productIdParam !== 'all' && productId !== parseInt(productIdParam)) {
          return
        }

        // Initialize product if not exists
        if (!productTransfers.has(productId)) {
          productTransfers.set(productId, {
            productId,
            productName: product.name,
            productSku: product.sku || '',
            variations: new Map(),
            totalQuantity: 0,
            transferCount: 0,
            byPeriod: new Map()
          })
        }

        const productData = productTransfers.get(productId)!

        // Update product totals
        productData.totalQuantity += quantity
        productData.transferCount += 1

        // Update product period data
        const currentPeriodQty = productData.byPeriod.get(periodKey) || 0
        productData.byPeriod.set(periodKey, currentPeriodQty + quantity)

        // Initialize variation if not exists
        if (!productData.variations.has(variationId)) {
          productData.variations.set(variationId, {
            variationId,
            variationName: variation.name || 'Default',
            variationSku: variation.sku || '',
            totalQuantity: 0,
            transferCount: 0,
            byPeriod: new Map()
          })
        }

        const variationData = productData.variations.get(variationId)!

        // Update variation totals
        variationData.totalQuantity += quantity
        variationData.transferCount += 1

        // Update variation period data
        const currentVariationPeriodQty = variationData.byPeriod.get(periodKey) || 0
        variationData.byPeriod.set(periodKey, currentVariationPeriodQty + quantity)
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

    // Convert to array and sort by total quantity
    const productsArray = Array.from(productTransfers.values())
      .map(product => {
        // Convert variations map to array
        const variationsArray = Array.from(product.variations.values())
          .map(variation => ({
            variationId: variation.variationId,
            variationName: variation.variationName,
            variationSku: variation.variationSku,
            totalQuantity: variation.totalQuantity,
            transferCount: variation.transferCount,
            byPeriod: Object.fromEntries(variation.byPeriod)
          }))
          .sort((a, b) => b.totalQuantity - a.totalQuantity)

        return {
          productId: product.productId,
          productName: product.productName,
          productSku: product.productSku,
          totalQuantity: product.totalQuantity,
          transferCount: product.transferCount,
          variations: variationsArray,
          byPeriod: Object.fromEntries(product.byPeriod)
        }
      })
      .sort((a, b) => b.totalQuantity - a.totalQuantity)

    // Calculate summary stats
    const totalProducts = productsArray.length
    const totalQuantityTransferred = productsArray.reduce((sum, p) => sum + p.totalQuantity, 0)
    const totalTransfers = transfers.length

    // Prepare chart data (top 10 products)
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
          data: allPeriods.map(period => product.byPeriod[period] || 0),
          backgroundColor: color.bg,
          borderColor: color.border,
          borderWidth: 2,
          tension: 0.3
        }
      })
    }

    // Period-over-period comparison
    const periodComparison = allPeriods.map(period => {
      const totalForPeriod = productsArray.reduce((sum, product) => {
        return sum + (product.byPeriod[period] || 0)
      }, 0)

      return {
        period,
        totalQuantity: totalForPeriod,
        productCount: productsArray.filter(p => (p.byPeriod[period] || 0) > 0).length
      }
    })

    return NextResponse.json({
      summary: {
        year,
        groupBy,
        totalProducts,
        totalQuantityTransferred,
        totalTransfers,
        avgQuantityPerTransfer: totalTransfers > 0
          ? (totalQuantityTransferred / totalTransfers).toFixed(2)
          : 0
      },
      products: productsArray,
      top10Products,
      chartData,
      periodComparison,
      allPeriods
    })
  } catch (error) {
    console.error('Transfer trends report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate transfer trends report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
