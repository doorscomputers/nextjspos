import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/purchases/receipts/[id]
 * Get a single purchase receipt with full details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('=== RECEIPT DETAIL API START ===')
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const { id: receiptId } = await params
    console.log('Fetching receipt ID:', receiptId, 'for business:', businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch receipt
    console.log('Step 1: Fetching receipt from database...')
    const receipt = await prisma.purchaseReceipt.findFirst({
      where: {
        id: parseInt(receiptId),
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          select: {
            id: true,
            purchaseOrderNumber: true,
            subtotal: true,
            taxAmount: true,
            discountAmount: true,
            shippingCost: true,
            totalAmount: true,
            supplier: {
              select: {
                id: true,
                name: true,
                contactPerson: true,
                email: true,
                mobile: true,
              },
            },
          },
        },
        supplier: true,
        items: {
          include: {
            purchaseItem: true,
          },
        },
      },
    })
    console.log('Step 1 DONE: Receipt fetched:', receipt ? 'Found' : 'Not found')

    if (!receipt) {
      return NextResponse.json(
        { error: 'Purchase receipt not found' },
        { status: 404 }
      )
    }

    console.log('Receipt has', receipt.items.length, 'items')
    console.log('Receipt purchaseId:', receipt.purchaseId)

    // Check location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: parseInt(user.id),
            locationId: receipt.locationId,
          },
        },
      })

      if (!userLocation) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // Fetch location name
    console.log('Step 2: Fetching location...')
    const location = await prisma.businessLocation.findUnique({
      where: { id: receipt.locationId },
      select: {
        id: true,
        name: true,
      },
    })

    // Fetch user names
    const userIds = [receipt.receivedBy]
    if (receipt.approvedBy) {
      userIds.push(receipt.approvedBy)
    }

    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        surname: true,
        username: true,
      },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))
    console.log('Step 3 DONE: Fetched', users.length, 'users')

    // Fetch product and variation data for ALL items (PurchaseItem doesn't have product relations)
    console.log('Step 4: Fetching product data for all items...')
    const allProductIds = [...new Set([
      ...receipt.items.map(item => item.productId),
      ...receipt.items.filter(i => i.purchaseItem).map(i => i.purchaseItem!.productId)
    ])]
    const allVariationIds = [...new Set([
      ...receipt.items.map(item => item.productVariationId),
      ...receipt.items.filter(i => i.purchaseItem).map(i => i.purchaseItem!.productVariationId)
    ])]
    console.log('Need to fetch:', allProductIds.length, 'products and', allVariationIds.length, 'variations')
    const productIds = allProductIds
    const variationIds = allVariationIds

    const [products, variations] = await Promise.all([
      productIds.length > 0
        ? prisma.product.findMany({
            where: { id: { in: productIds } },
          })
        : [],
      variationIds.length > 0
        ? prisma.productVariation.findMany({
            where: { id: { in: variationIds } },
          })
        : [],
    ])

    const productMap = new Map(products.map(p => [p.id, p]))
    const variationMap = new Map(variations.map(v => [v.id, v]))
    console.log('Step 4 DONE: Fetched', products.length, 'products and', variations.length, 'variations')

    // Format receipt with enriched item data
    console.log('Step 5: Formatting response...')
    const formattedReceipt = {
      ...receipt,
      location,
      receivedByUser: userMap.get(receipt.receivedBy),
      approvedByUser: receipt.approvedBy ? userMap.get(receipt.approvedBy) : null,
      items: receipt.items.map(item => {
        // Get product data - either from the item directly or from purchaseItem
        const productId = item.purchaseItem?.productId || item.productId
        const variationId = item.purchaseItem?.productVariationId || item.productVariationId

        return {
          ...item,
          product: productMap.get(productId),
          productVariation: variationMap.get(variationId),
          purchaseItem: item.purchaseItem ? {
            ...item.purchaseItem,
            product: productMap.get(item.purchaseItem.productId),
            productVariation: variationMap.get(item.purchaseItem.productVariationId),
          } : null,
        }
      }),
    }

    console.log('Step 5 DONE: Response formatted successfully')
    console.log('=== RECEIPT DETAIL API SUCCESS ===')
    return NextResponse.json(formattedReceipt)
  } catch (error: any) {
    console.error('=== RECEIPT DETAIL API ERROR ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to fetch purchase receipt', details: error.message, stack: error.stack },
      { status: 500 }
    )
  }
}
