import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/products/bulk-add-to-location
 * Add selected products to a business location (creates zero-inventory records)
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

    // Check permission - user needs product update or opening stock permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE) &&
        !user.permissions?.includes(PERMISSIONS.PRODUCT_OPENING_STOCK)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
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

    // Verify all products belong to user's business
    const products = await prisma.product.findMany({
      where: {
        id: { in: ids },
        businessId: parseInt(businessId),
        deletedAt: null
      },
      select: { id: true }
    })

    if (products.length !== ids.length) {
      return NextResponse.json(
        { error: 'Some products not found or do not belong to your business' },
        { status: 404 }
      )
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
        sellingPrice: true
      }
    })

    if (variations.length === 0) {
      return NextResponse.json({ error: 'No variations found for selected products' }, { status: 400 })
    }

    // Create inventory records for each variation at the selected location
    const inventoryRecords = variations.map(variation => ({
      productId: variation.productId,
      productVariationId: variation.id,
      locationId: locId,
      qtyAvailable: 0, // Start with zero inventory
      sellingPrice: variation.sellingPrice
    }))

    // Use upsert in a transaction to handle existing records
    const result = await prisma.$transaction(async (tx) => {
      let createdCount = 0
      let skippedCount = 0

      for (const record of inventoryRecords) {
        // Check if record already exists
        const existing = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: record.productVariationId,
              locationId: record.locationId
            }
          }
        })

        if (!existing) {
          await tx.variationLocationDetails.create({
            data: record
          })
          createdCount++
        } else {
          skippedCount++
        }
      }

      return { createdCount, skippedCount }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: AuditAction.BULK_ADD_TO_LOCATION,
        entityType: EntityType.PRODUCT,
        entityIds: ids,
        description: `Added ${products.length} product(s) to location "${location.name}". Created ${result.createdCount} new inventory records, skipped ${result.skippedCount} existing.`,
        metadata: {
          locationId: locId,
          locationName: location.name,
          productCount: products.length,
          createdCount: result.createdCount,
          skippedCount: result.skippedCount,
          productIds: ids
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    return NextResponse.json({
      message: `Successfully added ${products.length} product(s) to location. Created ${result.createdCount} inventory record(s), skipped ${result.skippedCount} existing record(s)`,
      createdCount: result.createdCount,
      skippedCount: result.skippedCount,
      locationName: location.name
    })
  } catch (error) {
    console.error('Error adding products to location:', error)
    return NextResponse.json({ error: 'Failed to add products to location' }, { status: 500 })
  }
}
