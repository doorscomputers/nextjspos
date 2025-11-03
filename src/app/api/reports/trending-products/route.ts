import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/trending-products
 * Trending Products Report - Shows top-selling products by quantity and revenue
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user as any, PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Missing report.view permission' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const businessId = parseInt((session.user as any).businessId)

    // Date filters
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const timePeriod = searchParams.get('timePeriod') || 'last_30_days'

    // Location filter
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user as any)

    // Category and Brand filters
    const categoryId = searchParams.get('categoryId')
    const brandId = searchParams.get('brandId')

    // Top N filter
    const topN = parseInt(searchParams.get('topN') || '10')

    // Calculate date range based on time period
    let dateStart: Date
    let dateEnd: Date = new Date()

    if (startDate && endDate) {
      dateStart = new Date(startDate)
      dateEnd = new Date(endDate)
      dateEnd.setHours(23, 59, 59, 999)
    } else {
      // Calculate based on time period
      const today = new Date()
      dateEnd = new Date(today)
      dateEnd.setHours(23, 59, 59, 999)

      switch (timePeriod) {
        case 'today':
          dateStart = new Date(today)
          dateStart.setHours(0, 0, 0, 0)
          break
        case 'this_week':
          dateStart = new Date(today)
          dateStart.setDate(today.getDate() - today.getDay())
          dateStart.setHours(0, 0, 0, 0)
          break
        case 'this_month':
          dateStart = new Date(today.getFullYear(), today.getMonth(), 1)
          break
        case 'this_quarter':
          const quarter = Math.floor(today.getMonth() / 3)
          dateStart = new Date(today.getFullYear(), quarter * 3, 1)
          break
        case 'this_year':
          dateStart = new Date(today.getFullYear(), 0, 1)
          break
        case 'last_7_days':
          dateStart = new Date(today)
          dateStart.setDate(today.getDate() - 7)
          break
        case 'last_30_days':
        default:
          dateStart = new Date(today)
          dateStart.setDate(today.getDate() - 30)
          break
        case 'last_90_days':
          dateStart = new Date(today)
          dateStart.setDate(today.getDate() - 90)
          break
      }
      dateStart.setHours(0, 0, 0, 0)
    }

    // Build where clause for sales
    const saleWhere: any = {
      businessId,
      status: 'completed',
      createdAt: {
        gte: dateStart,
        lte: dateEnd,
      },
    }

    // Location filter (with RBAC support)
    if (locationId) {
      saleWhere.locationId = parseInt(locationId)
    } else if (accessibleLocationIds && accessibleLocationIds.length > 0) {
      saleWhere.locationId = { in: accessibleLocationIds }
    }

    // Get all sale items for the period
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: saleWhere,
      },
      include: {
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
          },
        },
      },
    })

    // Get product details for aggregation
    const productVariationIds = [...new Set(saleItems.map(item => item.productVariationId))]
    const productVariations = await prisma.productVariation.findMany({
      where: {
        id: { in: productVariationIds },
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
          },
        },
      },
    })

    // Create a map for quick lookup
    const variationMap = new Map(
      productVariations.map(v => [v.id, v])
    )

    // Apply category and brand filters
    let filteredSaleItems = saleItems
    if (categoryId) {
      filteredSaleItems = filteredSaleItems.filter(item => {
        const variation = variationMap.get(item.productVariationId)
        return variation?.product?.categoryId === parseInt(categoryId)
      })
    }
    if (brandId) {
      filteredSaleItems = filteredSaleItems.filter(item => {
        const variation = variationMap.get(item.productVariationId)
        return variation?.product?.brandId === parseInt(brandId)
      })
    }

    // Aggregate data by product variation
    const aggregatedData = new Map<number, {
      productId: number
      productName: string
      variationName: string
      sku: string
      categoryName: string
      brandName: string
      totalQuantity: number
      totalRevenue: number
      totalCost: number
      totalProfit: number
      salesCount: number
    }>()

    filteredSaleItems.forEach(item => {
      const variation = variationMap.get(item.productVariationId)
      if (!variation) return

      const quantity = parseFloat(item.quantity.toString())
      const revenue = parseFloat(item.unitPrice.toString()) * quantity
      const cost = parseFloat(item.unitCost.toString()) * quantity
      const profit = revenue - cost

      const existing = aggregatedData.get(item.productVariationId)
      if (existing) {
        existing.totalQuantity += quantity
        existing.totalRevenue += revenue
        existing.totalCost += cost
        existing.totalProfit += profit
        existing.salesCount += 1
      } else {
        aggregatedData.set(item.productVariationId, {
          productId: variation.productId,
          productName: variation.product.name,
          variationName: variation.name,
          sku: variation.sku,
          categoryName: variation.product.category?.name || 'Uncategorized',
          brandName: variation.product.brand?.name || 'No Brand',
          totalQuantity: quantity,
          totalRevenue: revenue,
          totalCost: cost,
          totalProfit: profit,
          salesCount: 1,
        })
      }
    })

    // Convert to array and sort by totalQuantity DESC
    let trendingProducts = Array.from(aggregatedData.values())
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, topN)

    // Calculate metadata
    const metadata = {
      totalProducts: trendingProducts.length,
      dateRange: {
        start: dateStart.toISOString(),
        end: dateEnd.toISOString(),
      },
      timePeriod,
      location: locationId
        ? (await prisma.businessLocation.findUnique({
            where: { id: parseInt(locationId) },
            select: { name: true },
          }))?.name || 'Unknown Location'
        : 'All Locations',
      category: categoryId
        ? (await prisma.category.findUnique({
            where: { id: parseInt(categoryId) },
            select: { name: true },
          }))?.name || 'Unknown Category'
        : 'All Categories',
      brand: brandId
        ? (await prisma.brand.findUnique({
            where: { id: parseInt(brandId) },
            select: { name: true },
          }))?.name || 'Unknown Brand'
        : 'All Brands',
      topN,
    }

    return NextResponse.json({
      trendingProducts,
      metadata,
      reportGenerated: new Date(),
    })
  } catch (error: any) {
    console.error('Error generating trending products report:', error)
    return NextResponse.json(
      { error: 'Failed to generate trending products report', details: error.message },
      { status: 500 }
    )
  }
}
