import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/products/bulk-delete
 * Delete multiple products by their IDs
 *
 * Request body: { productIds: number[] }
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
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const { productIds } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs array is required' }, { status: 400 })
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
        id: { select: { id: true, name: true } },
        name: { select: { id: true, name: true } },
        sku: { select: { id: true, name: true } },
        type: { select: { id: true, name: true } },
        category: { select: { name: { select: { id: true, name: true } } } },
        brand: { select: { name: { select: { id: true, name: true } } } }
      }
    })

    if (products.length !== ids.length) {
      return NextResponse.json(
        { error: 'Some products not found or do not belong to your business' },
        { status: 404 }
      )
    }

    // Soft delete products (set deletedAt)
    const result = await prisma.product.updateMany({
      where: {
        id: { in: ids },
        businessId: parseInt(businessId)
      },
      data: {
        deletedAt: new Date()
      }
    })

    // Create audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: AuditAction.BULK_DELETE,
        entityType: EntityType.PRODUCT,
        entityIds: ids,
        description: `Soft deleted ${result.count} product(s)`,
        metadata: {
          productCount: result.count,
          deletedProducts: products.map(p => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            type: p.type,
            category: p.category?.name || 'N/A',
            brand: p.brand?.name || 'N/A'
          }))
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    return NextResponse.json({
      message: `Successfully deleted ${result.count} product(s)`,
      deletedCount: result.count
    })
  } catch (error) {
    console.error('Error deleting products:', error)
    return NextResponse.json({ error: 'Failed to delete products' }, { status: 500 })
  }
}
