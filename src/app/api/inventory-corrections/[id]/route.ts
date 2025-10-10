import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/inventory-corrections/[id]
 * Get a single inventory correction by ID
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const correctionId = parseInt(params.id)

    const correction = await prisma.inventoryCorrection.findFirst({
      where: {
        id: correctionId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
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
        },
        stockTransaction: true
      }
    })

    if (!correction) {
      return NextResponse.json({ error: 'Inventory correction not found' }, { status: 404 })
    }

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(correction.locationId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    return NextResponse.json({ correction })
  } catch (error) {
    console.error('Error fetching inventory correction:', error)
    return NextResponse.json({ error: 'Failed to fetch inventory correction' }, { status: 500 })
  }
}

/**
 * PUT /api/inventory-corrections/[id]
 * Update an inventory correction (only if status is pending)
 */
export async function PUT(
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const correctionId = parseInt(params.id)
    const body = await request.json()
    const { physicalCount, reason, remarks } = body

    // Get existing correction
    const existing = await prisma.inventoryCorrection.findFirst({
      where: {
        id: correctionId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        product: { select: { name: true, sku: true } },
        productVariation: { select: { name: true, sku: true } },
        location: { select: { name: true } }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Inventory correction not found' }, { status: 404 })
    }

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(existing.locationId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Cannot update if already approved
    if (existing.status === 'approved') {
      return NextResponse.json({
        error: 'Cannot update an approved inventory correction'
      }, { status: 400 })
    }

    // Build update data
    const updateData: any = {}

    if (physicalCount !== undefined) {
      const physCount = parseFloat(physicalCount.toString())
      const systemCount = parseFloat(existing.systemCount.toString())
      updateData.physicalCount = physCount
      updateData.difference = physCount - systemCount
    }

    if (reason) {
      updateData.reason = reason
    }

    if (remarks !== undefined) {
      updateData.remarks = remarks || null
    }

    updateData.updatedAt = new Date()

    // Update correction
    const correction = await prisma.inventoryCorrection.update({
      where: { id: correctionId },
      data: updateData,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        productVariation: { select: { id: true, name: true, sku: true } },
        location: { select: { id: true, name: true } }
      }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'inventory_correction_update' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [existing.productId],
        description: `Updated inventory correction #${correctionId} for ${existing.product.name} at ${existing.location.name}`,
        metadata: {
          correctionId,
          changes: updateData,
          before: {
            physicalCount: parseFloat(existing.physicalCount.toString()),
            difference: parseFloat(existing.difference.toString()),
            reason: existing.reason,
            remarks: existing.remarks
          },
          after: {
            physicalCount: parseFloat(correction.physicalCount.toString()),
            difference: parseFloat(correction.difference.toString()),
            reason: correction.reason,
            remarks: correction.remarks
          }
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
      message: 'Inventory correction updated successfully',
      correction
    })
  } catch (error) {
    console.error('Error updating inventory correction:', error)
    return NextResponse.json({ error: 'Failed to update inventory correction' }, { status: 500 })
  }
}

/**
 * DELETE /api/inventory-corrections/[id]
 * Soft delete an inventory correction (only if status is pending)
 */
export async function DELETE(
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.INVENTORY_CORRECTION_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const correctionId = parseInt(params.id)

    // Get existing correction
    const existing = await prisma.inventoryCorrection.findFirst({
      where: {
        id: correctionId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        product: { select: { name: true, sku: true } },
        productVariation: { select: { name: true, sku: true } },
        location: { select: { name: true } }
      }
    })

    if (!existing) {
      return NextResponse.json({ error: 'Inventory correction not found' }, { status: 404 })
    }

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(existing.locationId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Cannot delete if already approved
    if (existing.status === 'approved') {
      return NextResponse.json({
        error: 'Cannot delete an approved inventory correction. It has already affected stock levels.'
      }, { status: 400 })
    }

    // Soft delete
    await prisma.inventoryCorrection.update({
      where: { id: correctionId },
      data: { deletedAt: new Date() }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'inventory_correction_delete' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [existing.productId],
        description: `Deleted inventory correction #${correctionId} for ${existing.product.name} at ${existing.location.name}`,
        metadata: {
          correctionId,
          deleted: {
            systemCount: parseFloat(existing.systemCount.toString()),
            physicalCount: parseFloat(existing.physicalCount.toString()),
            difference: parseFloat(existing.difference.toString()),
            reason: existing.reason,
            remarks: existing.remarks,
            status: existing.status
          }
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
      message: 'Inventory correction deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting inventory correction:', error)
    return NextResponse.json({ error: 'Failed to delete inventory correction' }, { status: 500 })
  }
}
