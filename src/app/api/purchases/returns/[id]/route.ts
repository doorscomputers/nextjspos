import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/purchases/returns/[id]
 * Fetch a single purchase return by ID
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
    const businessId = parseInt(String(user.businessId))
    const { id: returnId } = await params

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Fetch purchase return
    const purchaseReturn = await prisma.purchaseReturn.findFirst({
      where: {
        id: parseInt(returnId),
        businessId: parseInt(businessId),
      },
      include: {
        supplier: true,
        purchaseReceipt: {
          include: {
            purchase: true,
          },
        },
        items: {
          include: {
            purchaseReceiptItem: true,
            product: true,
            productVariation: true,
          },
        },
        debitNotes: true,
      },
    })

    if (!purchaseReturn) {
      return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 })
    }

    // Check location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: parseInt(user.id),
            locationId: purchaseReturn.locationId,
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

    // Serialize Decimal fields
    const serializedReturn = {
      ...purchaseReturn,
      subtotal: Number(purchaseReturn.subtotal),
      taxAmount: Number(purchaseReturn.taxAmount),
      discountAmount: Number(purchaseReturn.discountAmount),
      totalAmount: Number(purchaseReturn.totalAmount),
      items: purchaseReturn.items.map((item) => ({
        ...item,
        quantityReturned: Number(item.quantityReturned),
        unitCost: Number(item.unitCost),
      })),
      debitNotes: purchaseReturn.debitNotes.map((dn) => ({
        ...dn,
        amount: Number(dn.amount),
      })),
    }

    return NextResponse.json({ purchaseReturn: serializedReturn })
  } catch (error: any) {
    console.error('Error fetching purchase return:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase return', details: error.message },
      { status: 500 }
    )
  }
}
