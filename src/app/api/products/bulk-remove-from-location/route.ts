import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import bcrypt from 'bcryptjs'

/**
 * POST /api/products/bulk-remove-from-location
 * Remove selected products from a business location (deletes inventory records)
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
    const { productIds, locationId, password } = body

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json({ error: 'Product IDs array is required' }, { status: 400 })
    }

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    // Require password for this destructive operation
    if (!password) {
      return NextResponse.json({ error: 'Password is required for this destructive operation' }, { status: 400 })
    }

    // Verify password
    const userWithPassword = await prisma.user.findUnique({
      where: { id: parseInt(user.id.toString()) },
      select: { password: true }
    })

    if (!userWithPassword) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const passwordValid = await bcrypt.compare(password, userWithPassword.password)

    if (!passwordValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 })
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
        productId: true
      }
    })

    if (variations.length === 0) {
      return NextResponse.json({
        error: 'No variations found for selected products. Products must have variations before they can be added to or removed from locations.'
      }, { status: 400 })
    }

    const variationIds = variations.map(v => v.id)

    // Get all inventory records before deletion for audit trail
    const inventoryRecords = await prisma.variationLocationDetails.findMany({
      where: {
        productVariationId: { in: variationIds },
        locationId: locId
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true
          }
        },
        productVariation: {
          select: {
            id: true,
            name: true,
            sku: true,
            purchasePrice: true,
            sellingPrice: true
          }
        }
      }
    })

    const stockRecords = inventoryRecords.filter(r => parseFloat(r.qtyAvailable.toString()) > 0)

    // Check if products exist at this location
    if (inventoryRecords.length === 0) {
      return NextResponse.json({
        error: `Selected product(s) do not exist at location "${location.name}". Products must be added to a location before they can be removed.`
      }, { status: 400 })
    }

    console.log('=== REMOVE FROM LOCATION DEBUG ===')
    console.log('Variation IDs to delete:', variationIds)
    console.log('Location ID:', locId)
    console.log('Inventory records found:', inventoryRecords.length)

    // Delete inventory records for these variations at this location
    const result = await prisma.variationLocationDetails.deleteMany({
      where: {
        productVariationId: { in: variationIds },
        locationId: locId
      }
    })

    console.log('Delete result count:', result.count)
    console.log('=== END DEBUG ===')

    // Verify deletion worked
    const remainingRecords = await prisma.variationLocationDetails.count({
      where: {
        productVariationId: { in: variationIds },
        locationId: locId
      }
    })
    console.log('Remaining records after deletion:', remainingRecords)

    // TODO: Re-enable audit logging once Prisma client is regenerated
    // Create comprehensive audit log with all deleted data
    try {
      await createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: AuditAction.BULK_REMOVE_FROM_LOCATION,
        entityType: EntityType.PRODUCT,
        entityIds: ids,
        description: `Removed ${products.length} product(s) from location "${location.name}". Deleted ${result.count} inventory records. ${stockRecords.length > 0 ? `WARNING: ${stockRecords.length} products had stock.` : ''}`,
        metadata: {
          locationId: locId,
          locationName: location.name,
          productCount: products.length,
          deletedInventoryCount: result.count,
          productsWithStock: stockRecords.length,
          deletedInventoryDetails: inventoryRecords.map(r => ({
            productId: r.product.id,
            productName: r.product.name,
            productSku: r.product.sku,
            variationId: r.productVariation.id,
            variationName: r.productVariation.name,
            variationSku: r.productVariation.sku,
            qtyAvailable: parseFloat(r.qtyAvailable.toString()),
            purchasePrice: parseFloat(r.productVariation.purchasePrice.toString()),
            sellingPrice: r.sellingPrice ? parseFloat(r.sellingPrice.toString()) : parseFloat(r.productVariation.sellingPrice.toString())
          })),
          totalStockValue: inventoryRecords.reduce((sum, r) => {
            const qty = parseFloat(r.qtyAvailable.toString())
            const price = parseFloat(r.productVariation.purchasePrice.toString())
            return sum + (qty * price)
          }, 0)
        },
        requiresPassword: true,
        passwordVerified: true,
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      })
    } catch (auditError) {
      // Audit logging failed but don't break the operation
      console.error('Audit logging failed:', auditError)
    }

    const message = stockRecords.length > 0
      ? `Successfully removed ${products.length} product(s) from location. Warning: ${stockRecords.length} product(s) had stock that was cleared.`
      : `Successfully removed ${products.length} product(s) from location. Deleted ${result.count} inventory record(s)`

    return NextResponse.json({
      message,
      deletedCount: result.count,
      hadStock: stockRecords.length,
      locationName: location.name
    })
  } catch (error) {
    console.error('Error removing products from location:', error)
    return NextResponse.json({ error: 'Failed to remove products from location' }, { status: 500 })
  }
}
