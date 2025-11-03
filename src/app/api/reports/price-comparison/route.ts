import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/reports/price-comparison
 * Price comparison report showing variance across locations
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    if (!hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_COMPARISON_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Get accessible location IDs for this user
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user)

    // Build location filter
    const locationFilter: any = {}
    if (accessibleLocationIds !== null) {
      locationFilter.id = { in: accessibleLocationIds }
    }

    // Fetch all active locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        isActive: true,
        ...locationFilter,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Fetch product variations with location prices (only active products)
    const productVariations = await prisma.productVariation.findMany({
      where: {
        product: {
          businessId,
          isActive: true, // Only active products
          deletedAt: null,
        },
        deletedAt: null, // Only non-deleted variations
      },
      select: {
        id: true,
        name: true,
        sku: true,
        sellingPrice: true,
        purchasePrice: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            category: {
              select: {
                name: true,
              },
            },
            brand: {
              select: {
                name: true,
              },
            },
          },
        },
        variationLocationDetails: {
          where: accessibleLocationIds !== null
            ? { locationId: { in: accessibleLocationIds } }
            : {},
          select: {
            locationId: true,
            sellingPrice: true,
            pricePercentage: true,
          },
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    })

    // Build comparison data
    const comparisonData: any[] = []

    for (const variation of productVariations) {
      const basePrice = Number(variation.sellingPrice)
      const costPrice = Number(variation.purchasePrice)

      // Get prices for all locations
      const locationPrices = new Map<number, number>()
      for (const detail of variation.variationLocationDetails) {
        const price = detail.sellingPrice
          ? Number(detail.sellingPrice)
          : basePrice
        locationPrices.set(detail.locationId, price)
      }

      // Calculate variance
      const prices = Array.from(locationPrices.values())
      const minPrice = prices.length > 0 ? Math.min(...prices) : basePrice
      const maxPrice = prices.length > 0 ? Math.max(...prices) : basePrice
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : basePrice
      const priceVariance = maxPrice - minPrice
      const priceVariancePercent = basePrice > 0 ? (priceVariance / basePrice) * 100 : 0

      // Build location-specific prices object
      const locationPricesObj: any = {}
      for (const location of locations) {
        locationPricesObj[`location_${location.id}`] = locationPrices.get(location.id) || null
      }

      comparisonData.push({
        productVariationId: variation.id,
        productId: variation.product.id,
        productName: variation.product.name,
        productSku: variation.product.sku || '',
        variationName: variation.name || 'Default',
        variationSku: variation.sku || '',
        categoryName: variation.product.category?.name || 'Uncategorized',
        brandName: variation.product.brand?.name || 'No Brand',
        basePrice,
        costPrice,
        minPrice,
        maxPrice,
        avgPrice,
        priceVariance,
        priceVariancePercent,
        hasVariance: priceVariance > 0,
        ...locationPricesObj,
      })
    }

    return NextResponse.json({
      success: true,
      data: comparisonData,
      metadata: {
        locations: locations.map((l) => ({ id: l.id, name: l.name })),
        totalProducts: productVariations.length,
        productsWithVariance: comparisonData.filter((p) => p.hasVariance).length,
        productsWithoutVariance: comparisonData.filter((p) => !p.hasVariance).length,
      },
    })
  } catch (error) {
    console.error('Price comparison report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate price comparison report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
