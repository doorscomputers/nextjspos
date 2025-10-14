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
    const locationId = searchParams.get('locationId')
    const supplierId = searchParams.get('supplierId')
    const categoryId = searchParams.get('categoryId')
    const urgency = searchParams.get('urgency')
    const onlyEnabled = searchParams.get('onlyEnabled') === 'true'

    const businessId = parseInt(session.user.businessId)

    // Calculate date 30 days ago for sales velocity
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    // Get all products with auto-reorder enabled (or all products if not filtered)
    const products = await prisma.product.findMany({
      where: {
        businessId,
        ...(onlyEnabled ? { enableAutoReorder: true } : {}),
        ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
        type: 'single', // Only single products for now
        enableStock: true, // EXCLUDE non-inventory products (services, etc.)
        isActive: true, // EXCLUDE inactive products
      },
      include: {
        category: {
          select: { name: true },
        },
        variations: {
          include: {
            variationLocationDetails: {
              where: locationId && locationId !== 'all'
                ? { locationId: parseInt(locationId) }
                : {},
            },
            supplier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    const suggestions = []

    // Process each product
    for (const product of products) {
      for (const variation of product.variations) {
        // Filter by supplier if specified
        if (supplierId && variation.supplierId?.toString() !== supplierId) {
          continue
        }

        // ====================================================================
        // ENHANCED: Calculate current stock across ALL locations (company-wide)
        // This includes Main Warehouse and all branch locations
        // ====================================================================
        const allLocationStocks = await prisma.variationLocationDetails.findMany({
          where: {
            productVariationId: variation.id,
          },
        })

        // Fetch location data separately
        const locationIds = [...new Set(allLocationStocks.map(s => s.locationId))]
        const locations = await prisma.businessLocation.findMany({
          where: {
            id: { in: locationIds },
            businessId,
          },
          select: {
            id: true,
            name: true,
          },
        })

        // Create a map for quick location lookup
        const locationMap = new Map(locations.map(loc => [loc.id, loc]))

        const currentStock = allLocationStocks.reduce(
          (sum, detail) => sum + parseFloat(detail.qtyAvailable.toString()),
          0
        )

        // ====================================================================
        // ENHANCED: Get sales from ALL locations for the last 30 days
        // This aggregates sales velocity across the entire business
        // ====================================================================
        const salesData = await prisma.saleItem.findMany({
          where: {
            productVariationId: variation.id,
            sale: {
              businessId,
              createdAt: { gte: thirtyDaysAgo },
              status: { in: ['completed', 'final'] },
              // NO location filter - we want sales from ALL locations
            },
          },
          select: {
            quantity: true,
            sale: {
              select: {
                locationId: true,
              },
            },
          },
        })

        const totalSalesQty = salesData.reduce(
          (sum, sale) => sum + parseFloat(sale.quantity.toString()),
          0
        )

        // Calculate average daily sales (company-wide)
        const avgDailySales = totalSalesQty / 30

        // BUSINESS LOGIC: Skip products with no sales history
        // If a product has zero sales in 30 days AND zero stock,
        // it's likely obsolete/discontinued and shouldn't be reordered
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

        // Determine urgency level based on days until stockout
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

        // ====================================================================
        // ENHANCED: Location breakdown with sales data per location
        // ====================================================================
        const locationsWithSales = await Promise.all(
          allLocationStocks.map(async (detail) => {
            // Get sales for this specific location
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
        )

        // Calculate estimated order value
        const unitCost = parseFloat(variation.purchasePrice?.toString() || '0')
        const estimatedOrderValue = unitCost * suggestedOrderQty

        // ====================================================================
        // ENHANCED: Include products WITHOUT suppliers (with warning flag)
        // This allows warehouse managers to see ALL items needing reorder
        // and assign suppliers manually
        // ====================================================================
        suggestions.push({
          productId: product.id,
          productName: product.name,
          variationId: variation.id,
          variationName: variation.name,
          sku: product.sku,
          category: product.category?.name || 'Uncategorized',
          supplierId: variation.supplierId,
          supplierName: variation.supplier?.name || 'No Supplier',
          hasSupplier: !!variation.supplierId, // Flag for UI highlighting
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
