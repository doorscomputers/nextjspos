import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { getUserAccessibleLocationIds, PERMISSIONS, hasPermission } from '@/lib/rbac'
import { sendTelegramPriceChangeAlert } from '@/lib/telegram'

/**
 * GET /api/products/variations/[id]/inventory?locationId=X
 * Get inventory details for a specific variation at a specific location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const variationId = parseInt((await params).id)
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

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

    // Get inventory details with audit trail
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
        sellingPrice: true,
        lastPriceUpdate: true,
        lastPriceUpdatedBy: true,
        lastPriceUpdatedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
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

/**
 * PUT /api/products/variations/[id]/inventory
 * Update per-location selling price for a specific variation
 * Body: { locationId: number, sellingPrice: number }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    // Check permission
    if (!hasPermission(user, PERMISSIONS.PRODUCT_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to update product prices' }, { status: 403 })
    }

    const variationId = parseInt((await params).id)
    const body = await request.json()
    const { locationId, sellingPrice } = body

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    if (sellingPrice === undefined || sellingPrice === null) {
      return NextResponse.json({ error: 'Selling price is required' }, { status: 400 })
    }

    const price = parseFloat(sellingPrice)
    if (isNaN(price) || price < 0) {
      return NextResponse.json({ error: 'Invalid selling price' }, { status: 400 })
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
      include: {
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
      },
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
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

    // Get old price for Telegram notification
    const existingPrice = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: variationId,
          locationId: locId,
        },
      },
      select: {
        sellingPrice: true,
      },
    })

    const oldPrice = Number(existingPrice?.sellingPrice || 0)
    const newPrice = price

    // Update or create the variation location details with audit trail
    const now = new Date()
    const userId = user.id

    const inventory = await prisma.variationLocationDetails.upsert({
      where: {
        productVariationId_locationId: {
          productVariationId: variationId,
          locationId: locId
        }
      },
      update: {
        sellingPrice: price,
        lastPriceUpdate: now,
        lastPriceUpdatedBy: userId
      },
      create: {
        productId: variation.productId,
        productVariationId: variationId,
        locationId: locId,
        qtyAvailable: 0,
        sellingPrice: price,
        lastPriceUpdate: now,
        lastPriceUpdatedBy: userId
      },
      select: {
        id: true,
        productId: true,
        productVariationId: true,
        locationId: true,
        qtyAvailable: true,
        sellingPrice: true,
        lastPriceUpdate: true,
        lastPriceUpdatedBy: true,
        lastPriceUpdatedByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Send Telegram notification for price change (only if price actually changed)
    if (oldPrice !== newPrice) {
      try {
        const changedBy = user.name || user.username || 'Unknown User'

        await sendTelegramPriceChangeAlert({
          locationName: location.name,
          productName: variation.product.name || 'Unknown Product',
          productSku: variation.product.sku || variation.sku || 'N/A',
          oldPrice,
          newPrice,
          changedBy,
          changeType: 'Individual Price Edit',
          timestamp: now,
        })
      } catch (telegramError) {
        // Log but don't fail the request if Telegram fails
        console.error('Failed to send Telegram notification:', telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Location selling price updated successfully',
      inventory: {
        ...inventory,
        qtyAvailable: parseFloat(inventory.qtyAvailable.toString()),
        sellingPrice: inventory.sellingPrice ? parseFloat(inventory.sellingPrice.toString()) : null
      }
    })
  } catch (error: any) {
    console.error('Error updating location selling price:', error)
    return NextResponse.json({
      error: 'Failed to update location selling price',
      details: error.message
    }, { status: 500 })
  }
}
