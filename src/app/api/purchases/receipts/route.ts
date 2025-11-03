import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { Prisma } from '@prisma/client'
import { getManilaDate } from '@/lib/timezone'

/**
 * GET /api/purchases/receipts
 * List all purchase receipts with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy') || 'receiptDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId),
    }

    if (status) {
      where.status = status
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Date range filtering - using date string comparison
    if (startDate || endDate) {
      where.receiptDate = {}

      if (startDate) {
        // Parse as local date and get start of day
        const parts = startDate.split('-')
        const localStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
        where.receiptDate.gte = localStart
      }

      if (endDate) {
        // Parse as local date and get end of day
        const parts = endDate.split('-')
        const localEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
        where.receiptDate.lte = localEnd
      }
    }

    console.log('=== GRN Date Filter Debug ===')
    console.log('Input startDate:', startDate)
    console.log('Input endDate:', endDate)
    if (startDate) {
      const parts = startDate.split('-')
      const localStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
      console.log('Computed start date:', localStart)
      console.log('Start date ISO:', localStart.toISOString())
    }
    if (endDate) {
      const parts = endDate.split('-')
      const localEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
      console.log('Computed end date:', localEnd)
      console.log('End date ISO:', localEnd.toISOString())
    }

    // Check location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocationIds = user.locationIds || []

      if (userLocationIds.length > 0) {
        where.locationId = { in: userLocationIds }
      } else {
        // If user has no location access, return empty results
        where.locationId = -1
      }
    }

    console.log('=== GRN API Debug ===')
    console.log('User:', user.username, 'ID:', user.id)
    console.log('Where clause:', JSON.stringify(where, null, 2))

    // Build orderBy clause based on sortBy parameter
    let orderBy: any = { createdAt: 'desc' }

    switch (sortBy) {
      case 'receiptNumber':
        orderBy = { receiptNumber: sortOrder }
        break
      case 'receiptDate':
        orderBy = { receiptDate: sortOrder }
        break
      case 'status':
        orderBy = { status: sortOrder }
        break
      // Note: 'supplier' and 'totalQuantity' cannot be sorted at database level
      // due to relations and aggregations - they will be sorted client-side
      default:
        orderBy = { receiptDate: sortOrder }
    }

    // Fetch receipts
    const [receipts, totalCount] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          purchase: {
            select: {
              id: true,
              purchaseOrderNumber: true,
              supplier: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          supplier: {
            select: {
              id: true,
              name: true,
            },
          },
          items: {
            select: {
              quantityReceived: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
              productVariation: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      }),
      prisma.purchaseReceipt.count({ where }),
    ])

    // Fetch user names for received and approved by
    const userIds = [
      ...receipts.map((r) => r.receivedBy),
      ...receipts.filter((r) => r.approvedBy).map((r) => r.approvedBy!),
    ]

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

    // Format receipts with user names
    const formattedReceipts = receipts.map((receipt) => ({
      ...receipt,
      receivedByUser: userMap.get(receipt.receivedBy),
      approvedByUser: receipt.approvedBy ? userMap.get(receipt.approvedBy) : null,
      totalQuantity: receipt.items.reduce(
        (sum, item) => sum + parseFloat(item.quantityReceived.toString()),
        0
      ),
    }))

    return NextResponse.json({
      data: formattedReceipts,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error: any) {
    console.error('=== GRN API Error ===')
    console.error('Error type:', error.constructor.name)
    console.error('Error message:', error.message)
    console.error('Full error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to fetch purchase receipts', details: error.message, errorType: error.constructor.name },
      { status: 500 }
    )
  }
}

/**
 * POST /api/purchases/receipts
 * Create a new purchase receipt (GRN)
 * Supports two workflows:
 * 1. From Purchase Order (purchaseId provided)
 * 2. Direct Entry (supplierId provided, no purchaseId)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const userId = parseInt(user.id)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to create purchase receipts' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      purchaseId,      // Optional: Null for direct entry
      supplierId,      // Required for direct entry
      locationId,
      items,           // Array of { productId, productVariationId, quantityReceived, serialNumbers?, notes? }
      notes,
    } = body

    // Validation
    if (!locationId || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId, items' },
        { status: 400 }
      )
    }

    // Determine supplier based on workflow
    let finalSupplierId: number
    let purchase: any = null

    if (purchaseId) {
      // Workflow 1: From Purchase Order
      purchase = await prisma.purchase.findUnique({
        where: { id: parseInt(purchaseId) },
        include: {
          items: true,
        },
      })

      if (!purchase) {
        return NextResponse.json(
          { error: 'Purchase Order not found' },
          { status: 404 }
        )
      }

      if (purchase.businessId !== businessId) {
        return NextResponse.json(
          { error: 'Purchase Order does not belong to your business' },
          { status: 403 }
        )
      }

      finalSupplierId = purchase.supplierId
    } else {
      // Workflow 2: Direct Entry (no PO)
      if (!supplierId) {
        return NextResponse.json(
          { error: 'supplierId is required for direct entry (no Purchase Order)' },
          { status: 400 }
        )
      }

      // Verify supplier exists and belongs to business
      const supplier = await prisma.supplier.findUnique({
        where: { id: parseInt(supplierId) },
      })

      if (!supplier || supplier.businessId !== businessId) {
        return NextResponse.json(
          { error: 'Supplier not found or does not belong to your business' },
          { status: 404 }
        )
      }

      finalSupplierId = parseInt(supplierId)
    }

    // Verify location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId,
        deletedAt: null,
      },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Check location access
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocationIds = user.locationIds || []

      if (!userLocationIds.includes(parseInt(locationId))) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // Generate unique receipt number
    const lastReceipt = await prisma.purchaseReceipt.findFirst({
      where: { businessId },
      orderBy: { id: 'desc' },
      select: { receiptNumber: true },
    })

    const lastNumber = lastReceipt
      ? parseInt(lastReceipt.receiptNumber.split('-')[1] || '0')
      : 0
    const receiptNumber = `GRN-${String(lastNumber + 1).padStart(6, '0')}`

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Purchase Receipt
      const receipt = await tx.purchaseReceipt.create({
        data: {
          businessId,
          purchaseId: purchaseId ? parseInt(purchaseId) : null,
          supplierId: finalSupplierId,
          locationId: parseInt(locationId),
          receiptNumber,
          receiptDate: getManilaDate(), // MANILA TIMEZONE (UTC+8) - prevents backdating fraud
          status: 'pending',
          notes: notes || null,
          receivedBy: userId,
          receivedAt: getManilaDate(),
        },
      })

      // 2. Create Receipt Items (NO inventory updates - that happens on approval)
      for (const item of items) {
        const {
          productId,
          productVariationId,
          quantityReceived,
          purchaseItemId,  // Optional: Only for PO-based GRN
          serialNumbers,
          notes: itemNotes,
        } = item

        if (!productId || !productVariationId || !quantityReceived) {
          throw new Error('Missing required item fields: productId, productVariationId, quantityReceived')
        }

        let finalPurchaseItemId: number | null = null

        if (purchaseId && purchaseItemId) {
          // Verify purchase item exists
          const purchaseItem = await tx.purchaseItem.findUnique({
            where: { id: parseInt(purchaseItemId) },
          })

          if (!purchaseItem) {
            throw new Error(`Purchase item ${purchaseItemId} not found`)
          }

          finalPurchaseItemId = parseInt(purchaseItemId)
        }

        // Create receipt item with status 'pending'
        // Serial numbers are stored as JSON and will be processed when approved
        await tx.purchaseReceiptItem.create({
          data: {
            purchaseReceiptId: receipt.id,
            purchaseItemId: finalPurchaseItemId,
            productId: parseInt(productId),
            productVariationId: parseInt(productVariationId),
            quantityReceived: new Prisma.Decimal(quantityReceived),
            serialNumbers: serialNumbers || null,
            notes: itemNotes || null,
          },
        })

        // NOTE: Inventory is NOT updated here - it will be updated when the receipt is approved
        // This implements the two-step approval workflow:
        // Step 1 (Create): Receipt created with status 'pending', serial numbers stored as JSON
        // Step 2 (Approve): Inventory updated, serial numbers created in database, stock transactions recorded
      }

      // 3. Create Audit Log
      await tx.auditLog.create({
        data: {
          businessId,
          userId,
          username: user.username,
          action: 'CREATE_PURCHASE_RECEIPT',
          entityType: 'purchase_receipt',
          entityIds: JSON.stringify([receipt.id]),
          description: `Created purchase receipt ${receiptNumber} with ${items.length} items`,
          metadata: {
            receiptNumber,
            purchaseId,
            supplierId: finalSupplierId,
            locationId,
            itemCount: items.length,
            workflow: purchaseId ? 'from_purchase_order' : 'direct_entry',
          },
        },
      }).catch(() => {
        // Audit log failure should not block the transaction
        console.log('Failed to create audit log for purchase receipt')
      })

      return receipt
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase receipt created successfully',
      data: result,
    })
  } catch (error: any) {
    console.error('Error creating purchase receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to create purchase receipt',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
