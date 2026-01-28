import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const supplierId = searchParams.get('supplierId')
    const categoryId = searchParams.get('categoryId')
    const urgency = searchParams.get('urgency')
    const onlyEnabled = searchParams.get('onlyEnabled') === 'true'

    const businessId = parseInt(session.user.businessId)

    // Calculate date 30 days ago for sales velocity
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // ====================================================================
    // STEP 1: Fetch all eligible products (single query)
    // ====================================================================
    const products = await prisma.product.findMany({
      where: {
        businessId,
        ...(onlyEnabled ? { enableAutoReorder: true } : {}),
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
        type: 'single',
        enableStock: true,
        isActive: true,
      },
      include: {
        category: {
          select: { name: true },
        },
        variations: {
          select: {
            id: true,
            name: true,
            supplierId: true,
            purchasePrice: true,
            supplier: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    // Collect all variation IDs for batch queries
    const allVariationIds: number[] = []
    const variationToProduct = new Map<number, typeof products[0]>()

    for (const product of products) {
      for (const variation of product.variations) {
        allVariationIds.push(variation.id)
        variationToProduct.set(variation.id, product)
      }
    }

    // ====================================================================
    // STEP 2: Batch fetch ALL stock data (single query)
    // Only from active locations
    // ====================================================================
    const allStockData = await prisma.variationLocationDetails.findMany({
      where: {
        productVariationId: { in: allVariationIds },
      },
      select: {
        productVariationId: true,
        locationId: true,
        qtyAvailable: true,
      },
    })

    // Build stock map: variationId -> locationDetails[]
    const stockByVariation = new Map<number, typeof allStockData>()
    for (const stock of allStockData) {
      const existing = stockByVariation.get(stock.productVariationId) || []
      existing.push(stock)
      stockByVariation.set(stock.productVariationId, existing)
    }

    // ====================================================================
    // STEP 3: Batch fetch ALL active locations (single query)
    // ====================================================================
    const activeLocations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
      },
    })
    const locationMap = new Map(activeLocations.map(loc => [loc.id, loc]))
    const activeLocationIds = activeLocations.map(loc => loc.id)

    // ====================================================================
    // STEP 4: Batch fetch ALL sales data for last 30 days (single query)
    // ====================================================================
    const allSalesData = await prisma.saleItem.findMany({
      where: {
        productVariationId: { in: allVariationIds },
        sale: {
          businessId,
          createdAt: { gte: thirtyDaysAgo },
          status: { in: ['completed', 'final'] },
        },
      },
      select: {
        productVariationId: true,
        quantity: true,
        sale: {
          select: {
            locationId: true,
          },
        },
      },
    })

    // Build sales map: variationId -> saleItems[]
    const salesByVariation = new Map<number, typeof allSalesData>()
    for (const sale of allSalesData) {
      const existing = salesByVariation.get(sale.productVariationId) || []
      existing.push(sale)
      salesByVariation.set(sale.productVariationId, existing)
    }

    // ====================================================================
    // STEP 5: Process all data in-memory (no more DB queries)
    // ====================================================================
    const suggestions = []

    for (const product of products) {
      for (const variation of product.variations) {
        // Filter by supplier if specified
        if (supplierId && variation.supplierId?.toString() !== supplierId) {
          continue
        }

        // Get stock from pre-fetched data (only active locations)
        const variationStocks = (stockByVariation.get(variation.id) || [])
          .filter(s => activeLocationIds.includes(s.locationId))

        const currentStock = variationStocks.reduce(
          (sum, detail) => sum + parseFloat(detail.qtyAvailable.toString()),
          0
        )

        // Get sales from pre-fetched data
        const salesData = salesByVariation.get(variation.id) || []

        const totalSalesQty = salesData.reduce(
          (sum, sale) => sum + parseFloat(sale.quantity.toString()),
          0
        )

        // Calculate average daily sales (company-wide)
        const avgDailySales = totalSalesQty / 30

        // Skip products with no sales history
        if (avgDailySales === 0) continue

        // Get reorder settings (use product defaults or fallbacks)
        const leadTimeDays = product.leadTimeDays || 7
        const safetyStockDays = product.safetyStockDays || 3
        const reorderPoint = product.reorderPoint
          ? parseFloat(product.reorderPoint.toString())
          : avgDailySales * (leadTimeDays + safetyStockDays)

        const suggestedOrderQty = product.reorderQuantity
          ? parseFloat(product.reorderQuantity.toString())
          : Math.ceil(avgDailySales * (leadTimeDays + safetyStockDays) * 2)

        // Check if reorder is needed
        if (currentStock >= reorderPoint) continue

        // Calculate days until stockout
        const daysUntilStockout = currentStock / avgDailySales

        // Determine urgency level
        let urgencyLevel: 'critical' | 'high' | 'medium' | 'low'
        if (daysUntilStockout < 3) {
          urgencyLevel = 'critical'
        } else if (daysUntilStockout < 7) {
          urgencyLevel = 'high'
        } else if (daysUntilStockout < 14) {
          urgencyLevel = 'medium'
        } else {
          urgencyLevel = 'low'
        }

        // Filter by urgency if specified
        if (urgency && urgencyLevel !== urgency) continue

        // Location breakdown (in-memory, no DB queries)
        const locationsWithSales = variationStocks
          .filter(detail => locationMap.has(detail.locationId))
          .map(detail => {
            const locationSales = salesData
              .filter(s => s.sale.locationId === detail.locationId)
              .reduce((sum, s) => sum + parseFloat(s.quantity.toString()), 0)

            const locationAvgDailySales = locationSales / 30
            const location = locationMap.get(detail.locationId)

            return {
              locationId: detail.locationId,
              locationName: location?.name || 'Unknown Location',
              currentStock: parseFloat(detail.qtyAvailable.toString()),
              avgDailySales: Math.round(locationAvgDailySales * 100) / 100,
            }
          })

        // Calculate estimated order value
        const unitCost = parseFloat(variation.purchasePrice?.toString() || '0')
        const estimatedOrderValue = unitCost * suggestedOrderQty

        suggestions.push({
          productId: product.id,
          productName: product.name,
          variationId: variation.id,
          variationName: variation.name,
          sku: product.sku,
          category: product.category?.name || 'Uncategorized',
          supplierId: variation.supplierId,
          supplierName: variation.supplier?.name || 'No Supplier',
          hasSupplier: !!variation.supplierId,
          currentStock,
          reorderPoint,
          suggestedOrderQty,
          avgDailySales: Math.round(avgDailySales * 100) / 100,
          daysUntilStockout: Math.round(daysUntilStockout * 10) / 10,
          leadTimeDays,
          safetyStockDays,
          unitCost,
          estimatedOrderValue,
          urgency: urgencyLevel,
          locations: locationsWithSales,
        })
      }
    }

    // Calculate summary statistics
    const summary = {
      totalProductsAnalyzed: products.length,
      productsNeedingReorder: suggestions.length,
      totalSuggestedOrderValue: suggestions.reduce((sum, s) => sum + s.estimatedOrderValue, 0),
      criticalItems: suggestions.filter(s => s.urgency === 'critical').length,
      highPriorityItems: suggestions.filter(s => s.urgency === 'high').length,
      mediumPriorityItems: suggestions.filter(s => s.urgency === 'medium').length,
      lowPriorityItems: suggestions.filter(s => s.urgency === 'low').length,
    }

    // Sort by urgency and days until stockout
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    suggestions.sort((a, b) => {
      if (urgencyOrder[a.urgency] !== urgencyOrder[b.urgency]) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
      }
      return a.daysUntilStockout - b.daysUntilStockout
    })

    return NextResponse.json({
      success: true,
      data: {
        summary,
        suggestions,
      },
    })
  } catch (error) {
    console.error('Purchase suggestions error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate purchase suggestions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
