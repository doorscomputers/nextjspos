import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/products/bulk-toggle-active
 * Activate or deactivate multiple products
 *
 * Request body: { productIds: number[], isActive: boolean }
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { productIds, isActive } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs array is required' }, { status: 400 })
    }

    if (typeof isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be a boolean' }, { status: 400 })
    }

    // Convert to integers
    const ids = productIds.map(id => parseInt(id.toString()))

    // Verify all products belong to user's business (multi-tenant check) and get product details
    const products = await prisma.product.findMany({
      where: {
        id: { in: ids },
        businessId: parseInt(businessId),
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        sku: true,
        isActive: true
      }
    })

    if (products.length !== ids.length) {
      return NextResponse.json(
        { error: 'Some products not found or do not belong to your business' },
        { status: 404 }
      )
    }

    // Update product active status
    const result = await prisma.product.updateMany({
      where: {
        id: { in: ids },
        businessId: parseInt(businessId)
      },
      data: {
        isActive
      }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: isActive ? AuditAction.BULK_ACTIVATE : AuditAction.BULK_DEACTIVATE,
        entityType: EntityType.PRODUCT,
        entityIds: ids,
        description: `${isActive ? 'Activated' : 'Deactivated'} ${result.count} product(s)`,
        metadata: {
          productCount: result.count,
          isActive,
          affectedProducts: products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            previousStatus: p.isActive ? 'active' : 'inactive',
            newStatus: isActive ? 'active' : 'inactive'
          }))
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    return NextResponse.json({
      message: `Successfully ${isActive ? 'activated' : 'deactivated'} ${result.count} product(s)`,
      updatedCount: result.count,
      isActive
    })
  } catch (error) {
    console.error('Error toggling product status:', error)
    return NextResponse.json({ error: 'Failed to update product status' }, { status: 500 })
  }
}
