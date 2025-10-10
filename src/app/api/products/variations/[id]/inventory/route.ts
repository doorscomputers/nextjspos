import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUserAccessibleLocationIds } from '@/lib/rbac'

/**
 * GET /api/products/variations/[id]/inventory?locationId=X
 * Get inventory details for a specific variation at a specific location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const variationId = parseInt(params.id)
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    const locId = parseInt(locationId)

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(locId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Verify variation exists and belongs to user's business
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: variationId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      select: {
        id: true,
        productId: true,
        name: true,
        sku: true,
        purchasePrice: true,
        sellingPrice: true,
        product: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
    }

    // Get inventory details
    const inventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: variationId,
        locationId: locId
      },
      select: {
        id: true,
        productId: true,
        productVariationId: true,
        locationId: true,
        qtyAvailable: true,
        sellingPrice: true
      }
    })

    if (!inventory) {
      return NextResponse.json({
        error: 'Inventory not found for this variation at the specified location',
        variation
      }, { status: 404 })
    }

    return NextResponse.json({
      inventory: {
        ...inventory,
        qtyAvailable: parseFloat(inventory.qtyAvailable.toString())
      },
      variation
    })
  } catch (error: any) {
    console.error('Error fetching variation inventory:', error)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json({
      error: 'Failed to fetch variation inventory',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
