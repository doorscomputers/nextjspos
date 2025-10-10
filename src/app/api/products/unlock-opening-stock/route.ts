import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

/**
 * POST /api/products/unlock-opening-stock
 * Unlock opening stock for editing (requires password and PRODUCT_UNLOCK_OPENING_STOCK permission)
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

    // Check permission - only users with PRODUCT_UNLOCK_OPENING_STOCK can unlock
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UNLOCK_OPENING_STOCK)) {
      return NextResponse.json({
        error: 'Forbidden - Only administrators can unlock opening stock'
      }, { status: 403 })
    }

    const body = await request.json()
    const { productVariationId, locationId, password, reason } = body

    if (!productVariationId || !locationId || !password) {
      return NextResponse.json({
        error: 'Product variation ID, location ID, and password are required'
      }, { status: 400 })
    }

    // Verify password
    const userWithPassword = await prisma.user.findUnique({
      where: { id: parseInt(user.id.toString()) },
      select: { password: true, username: true }
    })

    if (!userWithPassword) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const passwordValid = await bcrypt.compare(password, userWithPassword.password)

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
    }

    const varId = parseInt(productVariationId.toString())
    const locId = parseInt(locationId.toString())

    // Get the stock record
    const stock = await prisma.variationLocationDetails.findUnique({
      where: {
        productVariationId_locationId: {
          productVariationId: varId,
          locationId: locId
        }
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

    if (!stock) {
      return NextResponse.json({
        error: 'Stock record not found'
      }, { status: 404 })
    }

    if (!stock.openingStockLocked) {
      return NextResponse.json({
        error: 'Opening stock is not locked'
      }, { status: 400 })
    }

    // Unlock the stock
    await prisma.variationLocationDetails.update({
      where: {
        productVariationId_locationId: {
          productVariationId: varId,
          locationId: locId
        }
      },
      data: {
        openingStockLocked: false
      }
    })

    // Create comprehensive audit log
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'opening_stock_unlock' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [stock.product.id],
        description: `Unlocked opening stock for ${stock.product.name} (${stock.productVariation.name}) at ${stock.location.name}. ${reason ? `Reason: ${reason}` : ''}`,
        metadata: {
          productId: stock.product.id,
          productName: stock.product.name,
          productSku: stock.product.sku,
          variationId: stock.productVariation.id,
          variationName: stock.productVariation.name,
          variationSku: stock.productVariation.sku,
          locationId: stock.location.id,
          locationName: stock.location.name,
          currentQty: parseFloat(stock.qtyAvailable.toString()),
          reason: reason || null,
          previouslyLockedAt: stock.openingStockSetAt,
          previouslyLockedBy: stock.openingStockSetBy
        },
        requiresPassword: true,
        passwordVerified: true,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      console.error('Audit logging failed:', auditError)
    }

    return NextResponse.json({
      message: 'Opening stock unlocked successfully. Stock can now be edited.',
      warning: 'Remember to use Inventory Corrections for stock adjustments instead of direct edits.'
    })
  } catch (error) {
    console.error('Error unlocking opening stock:', error)
    return NextResponse.json({
      error: 'Failed to unlock opening stock'
    }, { status: 500 })
  }
}
