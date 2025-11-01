import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { processPurchaseReceipt } from '@/lib/stockOperations'
import { bulkCreateSerialNumbers, SerialNumberCondition } from '@/lib/serialNumber'

// POST - Create GRN (Goods Received Note) for a purchase order
export async function POST(
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
    const userId = user.id
    const { id: purchaseId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to create GRN' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      receiptDate,
      items, // Array of { purchaseItemId, quantityReceived, serialNumbers: [{serialNumber, imei, condition}] }
      notes,
    } = body

    // Validation
    if (!receiptDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: receiptDate, items' },
        { status: 400 }
      )
    }

    // Verify purchase order exists and belongs to business
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: parseInt(purchaseId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
        supplier: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found' },
        { status: 404 }
      )
    }

    if (purchase.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot receive items for cancelled purchase order' },
        { status: 400 }
      )
    }

    // Verify location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocationIds = user.locationIds || []

      if (!userLocationIds.includes(purchase.locationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // Check if there's already a pending GRN for this purchase order
    // to prevent duplicate submissions
    const existingPendingGRN = await prisma.purchaseReceipt.findFirst({
      where: {
        purchaseId: parseInt(purchaseId),
        status: 'pending',
      },
      select: {
        id: { select: { id: true, name: true } },
        receiptNumber: { select: { id: true, name: true } },
      },
    })

    if (existingPendingGRN) {
      return NextResponse.json(
        {
          error: `A pending GRN (${existingPendingGRN.receiptNumber}) already exists for this purchase order. Please approve or delete it first.`,
          existingGRNId: existingPendingGRN.id,
        },
        { status: 400 }
      )
    }

    // Validate items and quantities
    for (const item of items) {
      const purchaseItem = purchase.items.find(
        (pi) => pi.id === parseInt(item.purchaseItemId)
      )

      if (!purchaseItem) {
        return NextResponse.json(
          { error: `Purchase item ${item.purchaseItemId} not found in this PO` },
          { status: 400 }
        )
      }

      const quantityReceived = parseFloat(item.quantityReceived)
      if (isNaN(quantityReceived) || quantityReceived <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity received for item ${item.purchaseItemId}` },
          { status: 400 }
        )
      }

      const totalReceived =
        parseFloat(purchaseItem.quantityReceived.toString()) + quantityReceived

      if (totalReceived > parseFloat(purchaseItem.quantity.toString())) {
        return NextResponse.json(
          {
            error: `Cannot receive more than ordered quantity for item ${item.purchaseItemId}. ` +
                   `Ordered: ${purchaseItem.quantity}, Already received: ${purchaseItem.quantityReceived}, ` +
                   `Trying to receive: ${quantityReceived}`,
          },
          { status: 400 }
        )
      }

      // Validate serial numbers if required
      if (purchaseItem.requiresSerial) {
        if (!item.serialNumbers || item.serialNumbers.length === 0) {
          return NextResponse.json(
            { error: `Serial numbers required for item ${item.purchaseItemId}` },
            { status: 400 }
          )
        }

        if (item.serialNumbers.length !== quantityReceived) {
          return NextResponse.json(
            {
              error: `Serial number count mismatch for item ${item.purchaseItemId}. ` +
                     `Expected: ${quantityReceived}, Received: ${item.serialNumbers.length}`,
            },
            { status: 400 }
          )
        }

        // Check for duplicate serial numbers in this receipt
        const serialNumbersInReceipt = item.serialNumbers.map((sn: any) => sn.serialNumber)
        const uniqueSerials = new Set(serialNumbersInReceipt)
        if (uniqueSerials.size !== serialNumbersInReceipt.length) {
          return NextResponse.json(
            { error: `Duplicate serial numbers found in receipt for item ${item.purchaseItemId}` },
            { status: 400 }
          )
        }

        // Check if serial numbers already exist
        for (const sn of item.serialNumbers) {
          const existing = await prisma.productSerialNumber.findUnique({
            where: {
              businessId_serialNumber: {
                businessId: parseInt(businessId),
                serialNumber: sn.serialNumber,
              },
            },
          })

          if (existing) {
            return NextResponse.json(
              { error: `Serial number ${sn.serialNumber} already exists in the system` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Generate GRN number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastReceipt = await prisma.purchaseReceipt.findFirst({
      where: {
        businessId: parseInt(businessId),
        receiptNumber: {
          startsWith: `GRN-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let grnNumber
    if (lastReceipt) {
      const lastNumber = parseInt(lastReceipt.receiptNumber.split('-').pop() || '0')
      grnNumber = `GRN-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      grnNumber = `GRN-${currentYear}${currentMonth}-0001`
    }

    // Create GRN and update stock in transaction
    console.log('=== Creating GRN ===')
    console.log('GRN Number:', grnNumber)
    console.log('Purchase ID:', purchaseId, 'Supplier ID:', purchase.supplierId)
    console.log('Location ID:', purchase.locationId)
    console.log('Business ID:', businessId, 'User ID:', userId)
    console.log('Receipt Date:', receiptDate)
    console.log('Items count:', items.length)

    const receipt = await prisma.$transaction(async (tx) => {
      // Create purchase receipt
      const receiptData = {
        businessId: parseInt(businessId),
        purchaseId: parseInt(purchaseId),
        supplierId: purchase.supplierId,
        locationId: purchase.locationId,
        receiptNumber: grnNumber,
        receiptDate: new Date(receiptDate),
        status: 'pending', // Requires approval
        notes,
        receivedBy: parseInt(userId),
        receivedAt: new Date(),
      }

      console.log('Receipt data to create:', JSON.stringify(receiptData, null, 2))

      const newReceipt = await tx.purchaseReceipt.create({
        data: receiptData,
      })

      // Create receipt items and update stock
      for (const item of items) {
        const purchaseItem = purchase.items.find(
          (pi) => pi.id === parseInt(item.purchaseItemId)
        )!

        // Create receipt item
        await tx.purchaseReceiptItem.create({
          data: {
            purchaseReceiptId: newReceipt.id,
            purchaseItemId: purchaseItem.id,
            productId: purchaseItem.productId,
            productVariationId: purchaseItem.productVariationId,
            quantityReceived: parseFloat(item.quantityReceived),
            serialNumbers: item.serialNumbers || null,
            notes: item.notes,
          },
        })

        // NOTE: Stock is NOT added here - it will be added when the receipt is approved
        // This implements a two-step approval workflow:
        // 1. Encoder creates the GRN and records what was received
        // 2. Approver reviews and approves, which then adds inventory
      }

      // Purchase status will be updated when the receipt is approved
      return newReceipt
    }, {
      timeout: 30000, // 30 seconds timeout for complex transaction
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_receipt_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [receipt.id],
      description: `Created GRN ${grnNumber} for PO ${purchase.purchaseOrderNumber}`,
      metadata: {
        receiptId: receipt.id,
        grnNumber,
        purchaseId: parseInt(purchaseId),
        poNumber: purchase.purchaseOrderNumber,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplier.name,
        locationId: purchase.locationId,
        itemCount: items.length,
        totalQuantityReceived: items.reduce(
          (sum: number, item: any) => sum + parseFloat(item.quantityReceived),
          0
        ),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete receipt with relations
    const completeReceipt = await prisma.purchaseReceipt.findUnique({
      where: { id: receipt.id },
      select: {
        purchase: {
          select: {
            supplier: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
          },
        },
        items: {
          select: {
            purchaseItem: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
          },
        },
      },
    })

    return NextResponse.json(completeReceipt, { status: 201 })
  } catch (error: any) {
    console.error('=== GRN Creation Error ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      {
        error: 'Failed to create purchase receipt',
        details: error.message,
        errorType: error.constructor.name,
      },
      { status: 500 }
    )
  }
}
