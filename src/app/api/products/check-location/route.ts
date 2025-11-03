import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * POST /api/products/check-location
 * Check if products already exist at a location
 *
 * Request body: { productIds: number[], locationId: number }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    const body = await request.json()
    const { productIds, locationId } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs array is required' }, { status: 400 })
    }

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    const ids = productIds.map(id => parseInt(id.toString()))
    const locId = parseInt(locationId.toString())

    // Check if user has access to this location
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(locId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Verify location exists and belongs to user's business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: locId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Get all variations for the selected products
    const variations = await prisma.productVariation.findMany({
      where: {
        productId: { in: ids },
        deletedAt: null
      },
      select: {
        id: true,
        productId: true,
        name: true,
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (variations.length === 0) {
      return NextResponse.json({ error: 'No variations found for selected products' }, { status: 400 })
    }

    const variationIds = variations.map(v => v.id)

    // Check which variations already exist at this location
    const existingRecords = await prisma.variationLocationDetails.findMany({
      where: {
        productVariationId: { in: variationIds },
        locationId: locId
      },
      select: {
        productVariationId: true,
        productId: true,
        qtyAvailable: true,
        product: {
          select: {
            id: true,
            name: true
          }
        },
        productVariation: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    // Group existing records by product
    const existingProductIds = [...new Set(existingRecords.map(r => r.productId))]
    const newProductIds = ids.filter(id => !existingProductIds.includes(id))

    const existingProducts = existingRecords.map(r => ({
      id: r.product.id,
      name: r.product.name,
      variation: r.productVariation.name,
      currentStock: parseFloat(r.qtyAvailable.toString())
    }))

    return NextResponse.json({
      locationName: location.name,
      totalProducts: ids.length,
      existingCount: existingProductIds.length,
      newCount: newProductIds.length,
      existingProducts,
      canProceed: newProductIds.length > 0,
      message: existingProductIds.length > 0
        ? `${existingProductIds.length} product(s) already exist at this location. ${newProductIds.length} will be added.`
        : `All ${ids.length} product(s) will be added to this location.`
    })
  } catch (error) {
    console.error('Error checking products at location:', error)
    return NextResponse.json({ error: 'Failed to check products at location' }, { status: 500 })
  }
}
