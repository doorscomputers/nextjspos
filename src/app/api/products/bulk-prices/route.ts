import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/products/bulk-prices
 * Fetch all product prices across all locations for bulk editing
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Permission check
    const canView = hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT) ||
                    hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_EDIT_ALL) ||
                    hasPermission(session.user, PERMISSIONS.PRODUCT_PRICE_BULK_EDIT)

    if (!canView) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    // Get accessible location IDs for this user
    const accessibleLocationIds = getUserAccessibleLocationIds(session.user)

    console.log('🔍 User Access Debug:', {
      userId: session.user.id,
      username: session.user.username,
      roles: session.user.roles,
      locationIds: session.user.locationIds?.map(id => parseInt(String(id))),
      accessibleLocationIds,
      businessId: parseInt(session.user.businessId)
    })

    // Build location filter
    const locationFilter: any = {}
    if (accessibleLocationIds !== null) {
      locationFilter.id = { in: accessibleLocationIds }
      console.log('📍 Location filter applied:', locationFilter)
    } else {
      console.log('📍 No location filter - user has access to all locations')
    }

    // Fetch all active locations (exclude Main Warehouse - it's a supply location, not a selling location)
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        isActive: true,
        NOT: {
          name: {
            contains: 'Main Warehouse',
            mode: 'insensitive',
          },
        },
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

    console.log('📍 Found locations:', locations.length, locations.map(l => ({ id: l.id, name: l.name })))

    // Fetch all product variations with their location details
    const productVariations = await prisma.productVariation.findMany({
      where: {
        product: {
          businessId,
        },
      },
      include: {
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
            lastPriceUpdate: true,
            lastPriceUpdatedByUser: {
              select: {
                firstName: true,
                lastName: true,
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    })

    // Build result dataset: one row per product variation per location
    const priceData: any[] = []

    for (const variation of productVariations) {
      for (const location of locations) {
        // Find existing price data for this variation-location combination
        const existingPrice = variation.variationLocationDetails.find(
          (detail) => detail.locationId === location.id
        )

        priceData.push({
          productVariationId: variation.id,
          productId: variation.product.id,
          productName: variation.product.name,
          productSku: variation.product.sku || '',
          variationName: variation.name || 'Default',
          variationSku: variation.sku || '',
          categoryName: variation.product.category?.name || 'Uncategorized',
          brandName: variation.product.brand?.name || 'No Brand',
          locationId: location.id,
          locationName: location.name,
          basePrice: Number(variation.sellingPrice),
          costPrice: Number(variation.purchasePrice),
          sellingPrice: existingPrice ? Number(existingPrice.sellingPrice) : null,
          pricePercentage: existingPrice ? Number(existingPrice.pricePercentage) : null,
          lastPriceUpdate: existingPrice?.lastPriceUpdate || null,
          lastUpdatedBy: existingPrice?.lastPriceUpdatedByUser
            ? `${existingPrice.lastPriceUpdatedByUser.firstName || ''} ${existingPrice.lastPriceUpdatedByUser.lastName || ''}`.trim() ||
              existingPrice.lastPriceUpdatedByUser.username
            : null,
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: priceData,
      metadata: {
        totalProducts: productVariations.length,
        totalLocations: locations.length,
        totalPricePoints: priceData.length,
        pricesSet: priceData.filter((p) => p.sellingPrice !== null).length,
        pricesNotSet: priceData.filter((p) => p.sellingPrice === null).length,
      },
    })
  } catch (error) {
    console.error('Fetch bulk prices error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch bulk prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
