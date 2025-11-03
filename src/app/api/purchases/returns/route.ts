import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/purchases/returns
 * Fetch all purchase returns for user's business
 */
export async function GET(request: NextRequest) {
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
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // pending, approved, completed, rejected
    const supplierId = searchParams.get('supplierId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
    }

    if (status) {
      whereClause.status = status
    }

    if (supplierId) {
      whereClause.supplierId = parseInt(supplierId)
    }

    // Handle location filtering
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)

    if (hasAccessAllLocations) {
      // User has access to all locations - apply locationId filter only if provided
      if (locationId) {
        whereClause.locationId = parseInt(locationId)
      }
    } else {
      // User has limited location access - get their accessible locations
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: parseInt(user.id),
        },
        select: {
          locationId: true,
        },
      })

      const accessibleLocationIds = userLocations.map(ul => ul.locationId)

      if (accessibleLocationIds.length === 0) {
        // User has no location access - return empty
        return NextResponse.json({ returns: [], count: 0 })
      }

      // If specific locationId provided, verify user has access to it
      if (locationId) {
        const requestedLocationId = parseInt(locationId)
        if (!accessibleLocationIds.includes(requestedLocationId)) {
          return NextResponse.json({ error: 'You do not have access to this location' }, { status: 403 })
        }
        whereClause.locationId = requestedLocationId
      } else {
        // Filter by user's accessible locations
        whereClause.locationId = {
          in: accessibleLocationIds,
        }
      }
    }

    const returns = await prisma.purchaseReturn.findMany({
      where: whereClause,
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Serialize Decimal fields
    const serializedReturns = returns.map((ret) => ({
      ...ret,
      subtotal: Number(ret.subtotal),
      taxAmount: Number(ret.taxAmount),
      discountAmount: Number(ret.discountAmount),
      totalAmount: Number(ret.totalAmount),
      items: ret.items.map((item) => ({
        ...item,
        quantityReturned: Number(item.quantityReturned),
        unitCost: Number(item.unitCost),
      })),
    }))

    return NextResponse.json({ returns: serializedReturns })
  } catch (error: any) {
    console.error('Error fetching purchase returns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase returns', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/purchases/returns
 * Create a new purchase return
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const body = await request.json()
    const {
      purchaseReceiptId,
      returnDate,
      returnReason,
      expectedAction,
      notes,
      items, // Array of { purchaseReceiptItemId, productId, productVariationId, quantityReturned, unitCost, condition, serialNumbers, notes }
    } = body

    // Validation
    if (!purchaseReceiptId || !returnDate || !returnReason || !expectedAction || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: purchaseReceiptId, returnDate, returnReason, expectedAction, and items are required' },
        { status: 400 }
      )
    }

    // Fetch the original purchase receipt
    const purchaseReceipt = await prisma.purchaseReceipt.findFirst({
      where: {
        id: parseInt(purchaseReceiptId),
        businessId: parseInt(businessId),
      },
      include: {
        items: true,
        purchase: true,
        supplier: true,
      },
    })

    if (!purchaseReceipt) {
      return NextResponse.json({ error: 'Purchase receipt not found' }, { status: 404 })
    }

    // Validate that receipt is approved
    if (purchaseReceipt.status !== 'approved') {
      return NextResponse.json(
        { error: 'Can only create returns for approved purchase receipts' },
        { status: 400 }
      )
    }

    // Verify location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findUnique({
        where: {
          userId_locationId: {
            userId: parseInt(userId),
            locationId: purchaseReceipt.locationId,
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

    // Validate items and calculate totals
    let subtotal = 0
    for (const item of items) {
      // Validate receipt item exists
      const receiptItem = purchaseReceipt.items.find(
        (ri) => ri.id === parseInt(item.purchaseReceiptItemId)
      )

      if (!receiptItem) {
        return NextResponse.json(
          { error: `Receipt item ${item.purchaseReceiptItemId} not found in this GRN` },
          { status: 400 }
        )
      }

      // Validate quantity
      const quantityReturned = parseFloat(item.quantityReturned)
      if (quantityReturned <= 0 || quantityReturned > parseFloat(String(receiptItem.quantityReceived))) {
        return NextResponse.json(
          {
            error: `Invalid quantity for item ${item.purchaseReceiptItemId}. Must be between 1 and ${receiptItem.quantityReceived}`,
          },
          { status: 400 }
        )
      }

      // Calculate subtotal
      const unitCost = parseFloat(item.unitCost)
      subtotal += quantityReturned * unitCost
    }

    const taxAmount = 0 // Can be calculated based on business tax rules
    const discountAmount = 0 // Can be applied if needed
    const totalAmount = subtotal + taxAmount - discountAmount

    // Generate return number
    const returnCount = await prisma.purchaseReturn.count({
      where: { businessId: parseInt(businessId) },
    })
    const returnNumber = `RET-${String(returnCount + 1).padStart(6, '0')}`

    // Create purchase return in transaction
    const purchaseReturn = await prisma.$transaction(async (tx) => {
      // Create purchase return
      const newReturn = await tx.purchaseReturn.create({
        data: {
          businessId: parseInt(businessId),
          locationId: purchaseReceipt.locationId,
          purchaseReceiptId: parseInt(purchaseReceiptId),
          supplierId: purchaseReceipt.supplierId,
          returnNumber,
          returnDate: new Date(returnDate),
          status: 'pending',
          returnReason,
          expectedAction,
          subtotal,
          taxAmount,
          discountAmount,
          totalAmount,
          notes,
          createdBy: parseInt(userId),
        },
      })

      // Create return items
      for (const item of items) {
        await tx.purchaseReturnItem.create({
          data: {
            purchaseReturnId: newReturn.id,
            purchaseReceiptItemId: parseInt(item.purchaseReceiptItemId),
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantityReturned: parseFloat(item.quantityReturned),
            unitCost: parseFloat(item.unitCost),
            condition: item.condition,
            serialNumbers: item.serialNumbers || null,
            notes: item.notes || null,
          },
        })
      }

      return newReturn
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_return_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [purchaseReturn.id],
      description: `Created Purchase Return ${returnNumber} for GRN ${purchaseReceipt.receiptNumber}`,
      metadata: {
        returnId: purchaseReturn.id,
        returnNumber,
        receiptId: purchaseReceipt.id,
        grnNumber: purchaseReceipt.receiptNumber,
        supplierId: purchaseReceipt.supplierId,
        supplierName: purchaseReceipt.supplier.name,
        locationId: purchaseReceipt.locationId,
        itemCount: items.length,
        totalAmount,
        returnReason,
        expectedAction,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete return with relations
    const completeReturn = await prisma.purchaseReturn.findUnique({
      where: { id: purchaseReturn.id },
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
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Purchase return created successfully',
        data: completeReturn,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating purchase return:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase return', details: error.message },
      { status: 500 }
    )
  }
}
