import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PERMISSIONS } from '@/lib/rbac'
import {
  getInventoryValuation,
  getLocationInventoryValuation,
  getTotalInventoryValue,
  ValuationMethod
} from '@/lib/inventoryValuation'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/reports/inventory-valuation
 * Generate inventory valuation report using FIFO, LIFO, or Weighted Average
 */
export async function GET(request: NextRequest) {
  try {
    // Authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Permission check
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : undefined
    const methodParam = searchParams.get('method') as string | null
    const includeLayers = searchParams.get('includeLayers') === 'true'
    const groupByCategory = searchParams.get('groupByCategory') === 'true'

    // Validate valuation method
    let method: ValuationMethod | undefined
    if (methodParam) {
      if (!Object.values(ValuationMethod).includes(methodParam as ValuationMethod)) {
        return NextResponse.json({ error: 'Invalid valuation method' }, { status: 400 })
      }
      method = methodParam as ValuationMethod
    }

    // Get valuations based on location filter
    let valuations: any[]

    if (locationId) {
      // Single location valuation
      const locationValuations = await getLocationInventoryValuation(
        locationId,
        parseInt(businessId),
        method
      )

      // Enrich with product details
      valuations = await enrichValuations(locationValuations, includeLayers)
    } else {
      // All locations valuation
      const locations = await prisma.businessLocation.findMany({
        where: {
          businessId: parseInt(businessId),
          deletedAt: null
        },
        select: { id: true, name: true }
      })

      valuations = []
      for (const location of locations) {
        const locationValuations = await getLocationInventoryValuation(
          location.id,
          parseInt(businessId),
          method
        )

        const enriched = await enrichValuations(locationValuations, includeLayers)

        // Add location name to each valuation
        enriched.forEach(v => {
          v.locationName = location.name
        })

        valuations.push(...enriched)
      }
    }

    // Calculate summary statistics
    const summary = calculateSummary(valuations, method)

    // Group by category if requested
    let categoryBreakdown
    if (groupByCategory) {
      categoryBreakdown = groupByCategories(valuations)
    }

    return NextResponse.json({
      success: true,
      valuations,
      summary,
      categoryBreakdown,
      reportDate: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error generating inventory valuation report:', error)
    return NextResponse.json({
      error: 'Failed to generate inventory valuation report',
      details: error.message
    }, { status: 500 })
  }
}

/**
 * Enrich valuations with product details
 */
async function enrichValuations(valuations: any[], includeLayers: boolean) {
  const enriched = []

  for (const valuation of valuations) {
    // Get product and variation details
    const variation = await prisma.productVariation.findUnique({
      where: { id: valuation.productVariationId },
      select: {
        id: true,
        name: true,
        sku: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    })

    if (!variation) continue

    enriched.push({
      productId: variation.product.id,
      productName: variation.product.name,
      productSku: variation.product.sku,
      variationId: variation.id,
      variationName: variation.name,
      variationSku: variation.sku,
      categoryId: variation.product.categoryId,
      categoryName: variation.product.category?.name,
      locationId: valuation.locationId,
      method: valuation.method,
      currentQty: valuation.currentQty,
      unitCost: valuation.unitCost,
      totalValue: valuation.totalValue,
      valuationDate: valuation.valuationDate,
      ...(includeLayers && valuation.costLayers?.length > 0 ? { costLayers: valuation.costLayers } : {})
    })
  }

  return enriched
}

/**
 * Calculate summary statistics
 */
function calculateSummary(valuations: any[], method?: ValuationMethod) {
  const totalValue = valuations.reduce((sum, v) => sum + v.totalValue, 0)
  const totalQuantity = valuations.reduce((sum, v) => sum + v.currentQty, 0)
  const itemCount = valuations.length
  const avgUnitCost = totalQuantity > 0 ? totalValue / totalQuantity : 0

  return {
    totalInventoryValue: totalValue,
    totalQuantity,
    itemCount,
    averageUnitCost: avgUnitCost,
    valuationMethod: method || ValuationMethod.WEIGHTED_AVG,
    valuationDate: new Date().toISOString()
  }
}

/**
 * Group valuations by product category
 */
function groupByCategories(valuations: any[]) {
  const categories = new Map<string, {
    categoryId: number | null
    categoryName: string
    itemCount: number
    totalQuantity: number
    totalValue: number
  }>()

  for (const valuation of valuations) {
    const categoryKey = valuation.categoryName || 'Uncategorized'
    const existing = categories.get(categoryKey)

    if (existing) {
      existing.itemCount += 1
      existing.totalQuantity += valuation.currentQty
      existing.totalValue += valuation.totalValue
    } else {
      categories.set(categoryKey, {
        categoryId: valuation.categoryId,
        categoryName: categoryKey,
        itemCount: 1,
        totalQuantity: valuation.currentQty,
        totalValue: valuation.totalValue
      })
    }
  }

  return Array.from(categories.values())
    .sort((a, b) => b.totalValue - a.totalValue)  // Sort by value descending
}
