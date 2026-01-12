import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { withIdempotency } from '@/lib/idempotency'

/**
 * GET /api/inventory-corrections
 * List inventory corrections with filtering and pagination
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const status = searchParams.get('status')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null
    }

    // Filter by location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null) {
      where.locationId = { in: accessibleLocationIds }
    }

    // Additional filters
    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (status) {
      where.status = status
    }

    const [corrections, total] = await Promise.all([
      prisma.inventoryCorrection.findMany({
        where,
        include: {
          business: {
            select: { id: true, name: true }
          },
          location: {
            select: { id: true, name: true }
          },
          product: {
            select: { id: true, name: true, sku: true }
          },
          productVariation: {
            select: { id: true, name: true, sku: true }
          },
          createdByUser: {
            select: { id: true, username: true, firstName: true, lastName: true }
          },
          approvedByUser: {
            select: { id: true, username: true, firstName: true, lastName: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.inventoryCorrection.count({ where })
    ])

    return NextResponse.json({
      corrections,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Error fetching inventory corrections:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory corrections' }, { status: 500 })
  }
}

/**
 * POST /api/inventory-corrections
 * Create a new inventory correction
 */
export async function POST(request: NextRequest) {
  return withIdempotency(request, '/api/inventory-corrections', async () => {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { locationId, productId, productVariationId, physicalCount, reason, remarks } = body

    // Validate required fields
    if (!locationId || !productId || !productVariationId || physicalCount === undefined || !reason) {
      return NextResponse.json({
        error: 'Missing required fields: locationId, productId, productVariationId, physicalCount, reason'
      }, { status: 400 })
    }

    const locId = parseInt(locationId.toString())
    const prodId = parseInt(productId.toString())
    const varId = parseInt(productVariationId.toString())
    const physCount = parseFloat(physicalCount.toString())

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(locId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Verify location exists
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

    // Verify product exists
    const product = await prisma.product.findFirst({
      where: {
        id: prodId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      select: { id: true, name: true, sku: true }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Verify variation exists
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: varId,
        productId: prodId,
        deletedAt: null
      },
      select: { id: true, name: true, sku: true }
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
    }

    // Get current system count from inventory
    const inventory = await prisma.variationLocationDetails.findFirst({
      where: {
        productVariationId: varId,
        locationId: locId
      }
    })

    // For beginning inventory, allow creating new inventory records
    // For other reasons, require existing inventory
    let systemCount = 0
    if (inventory) {
      systemCount = parseFloat(inventory.qtyAvailable.toString())
    } else if (reason !== 'beginning_inventory') {
      return NextResponse.json({
        error: 'Product variation does not exist at this location. Use "Beginning Inventory" reason to initialize stock.'
      }, { status: 404 })
    }

    const difference = physCount - systemCount

    // ============================================================================
    // DUPLICATE DETECTION (Prevents network retry duplicates)
    // ============================================================================
    const DUPLICATE_WINDOW_MS = 300 * 1000 // 300 seconds (5 minutes)
    const duplicateCheckTime = new Date(Date.now() - DUPLICATE_WINDOW_MS)

    // Look for recent identical inventory corrections from same user
    const recentSimilarCorrections = await prisma.inventoryCorrection.findMany({
      where: {
        businessId: parseInt(businessId),
        locationId: locId,
        productVariationId: varId,
        createdBy: parseInt(user.id.toString()),
        createdAt: {
          gte: duplicateCheckTime,
        },
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Only check last 5 similar corrections
    })

    if (recentSimilarCorrections.length > 0) {
      const latestCorrection = recentSimilarCorrections[0]
      const secondsAgo = Math.round((Date.now() - latestCorrection.createdAt.getTime()) / 1000)

      console.warn(`[INVENTORY CORRECTION] DUPLICATE BLOCKED: Correction identical to ID ${latestCorrection.id} (${secondsAgo}s ago)`)
      console.warn(`[INVENTORY CORRECTION] User: ${user.id}, Product: ${varId}, Location: ${locId}`)

      return NextResponse.json(
        {
          error: 'Duplicate transaction detected',
          message: `An identical inventory correction for ${product.name} (${variation.name}) at ${location.name} was created ${secondsAgo} seconds ago. If this was intentional, please wait 5 minutes before creating another identical correction.`,
          existingCorrectionId: latestCorrection.id,
          duplicateWindowSeconds: 300,
        },
        { status: 409 } // HTTP 409 Conflict
      )
    }
    // ============================================================================

    // Create inventory correction record
    const correction = await prisma.inventoryCorrection.create({
      data: {
        businessId: parseInt(businessId),
        locationId: locId,
        productId: prodId,
        productVariationId: varId,
        systemCount,
        physicalCount: physCount,
        difference,
        reason,
        remarks: remarks || null,
        createdBy: parseInt(user.id.toString()),
        createdByName: user.username,
        status: 'pending'
      },
      include: {
        product: {
          select: { id: true, name: true, sku: true }
        },
        productVariation: {
          select: { id: true, name: true, sku: true }
        },
        location: {
          select: { id: true, name: true }
        }
      }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'inventory_correction_create' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [prodId],
        description: `Created inventory correction for ${product.name} (${variation.name}) at ${location.name}. System: ${systemCount}, Physical: ${physCount}, Difference: ${difference}`,
        metadata: {
          correctionId: correction.id,
          locationId: locId,
          locationName: location.name,
          productId: prodId,
          productName: product.name,
          productSku: product.sku,
          variationId: varId,
          variationName: variation.name,
          variationSku: variation.sku,
          systemCount,
          physicalCount: physCount,
          difference,
          reason,
          remarks: remarks || null,
          status: 'pending'
        },
        requiresPassword: false,
        passwordVerified: false,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    return NextResponse.json({
      message: 'Inventory correction created successfully',
      correction
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating inventory correction:', error)
    return NextResponse.json({ error: 'Failed to create inventory correction' }, { status: 500 })
  }
  })
}
