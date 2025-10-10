import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { Prisma } from '@prisma/client'

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
    const locationId = searchParams.get('locationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
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
      const userLocations = await prisma.userLocation.findMany({
        where: {
          userId: parseInt(user.id),
        },
        select: {
          locationId: true,
        },
      })

      const accessibleLocationIds = userLocations.map((ul) => ul.locationId)
      where.locationId = { in: accessibleLocationIds }
    }

    console.log('=== GRN API Debug ===')
    console.log('User:', user.username, 'ID:', user.id)
    console.log('Where clause:', JSON.stringify(where, null, 2))

    // Fetch receipts
    const [receipts, totalCount] = await Promise.all([
      prisma.purchaseReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          createdAt: 'desc',
        },
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
      receiptDate,
      items,           // Array of { productId, productVariationId, quantityReceived, serialNumbers?, notes? }
      notes,
    } = body

    // Validation
    if (!locationId || !receiptDate || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: locationId, receiptDate, items' },
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
          receiptDate: new Date(receiptDate),
          status: 'pending',
          notes: notes || null,
          receivedBy: userId,
          receivedAt: new Date(),
        },
      })

      // 2. Create Receipt Items & Update Inventory
      for (const item of items) {
        const {
          productId,
          productVariationId,
          quantityReceived,
          purchaseItemId,  // Optional: Only for PO-based GRN
          unitCost,        // Required for direct entry
          serialNumbers,
          notes: itemNotes,
        } = item

        if (!productId || !productVariationId || !quantityReceived) {
          throw new Error('Missing required item fields: productId, productVariationId, quantityReceived')
        }

        // For direct entry, unitCost is required
        let finalUnitCost: number
        let finalPurchaseItemId: number | null = null

        if (purchaseId && purchaseItemId) {
          // Get cost from purchase item
          const purchaseItem = await tx.purchaseItem.findUnique({
            where: { id: parseInt(purchaseItemId) },
          })

          if (!purchaseItem) {
            throw new Error(`Purchase item ${purchaseItemId} not found`)
          }

          finalUnitCost = parseFloat(purchaseItem.unitCost.toString())
          finalPurchaseItemId = parseInt(purchaseItemId)
        } else {
          // Direct entry: unitCost must be provided
          if (!unitCost && unitCost !== 0) {
            throw new Error('unitCost is required for direct entry items')
          }
          finalUnitCost = parseFloat(unitCost)
        }

        // Create receipt item
        const receiptItem = await tx.purchaseReceiptItem.create({
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

        // 3. Update Inventory (CRITICAL for accuracy)
        const existingStock = await tx.inventoryMovement.findFirst({
          where: {
            businessId,
            locationId: parseInt(locationId),
            productId: parseInt(productId),
            productVariationId: parseInt(productVariationId),
          },
          orderBy: { createdAt: 'desc' },
        })

        const currentBalance = existingStock
          ? parseFloat(existingStock.balanceQuantity.toString())
          : 0
        const newBalance = currentBalance + parseFloat(quantityReceived.toString())

        await tx.inventoryMovement.create({
          data: {
            businessId,
            locationId: parseInt(locationId),
            productId: parseInt(productId),
            productVariationId: parseInt(productVariationId),
            movementType: 'purchase_receipt',
            referenceType: 'purchase_receipt',
            referenceId: receipt.id.toString(),
            quantityIn: new Prisma.Decimal(quantityReceived),
            quantityOut: new Prisma.Decimal(0),
            balanceQuantity: new Prisma.Decimal(newBalance),
            unitCost: new Prisma.Decimal(finalUnitCost),
            totalCost: new Prisma.Decimal(finalUnitCost * parseFloat(quantityReceived.toString())),
            notes: `GRN ${receiptNumber}${purchaseId ? ` from PO` : ' (Direct Entry)'}`,
            createdBy: userId,
          },
        })

        // 4. Update product variation current stock
        await tx.productVariation.update({
          where: { id: parseInt(productVariationId) },
          data: {
            currentStock: {
              increment: new Prisma.Decimal(quantityReceived),
            },
          },
        })
      }

      // 5. Create Audit Log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'CREATE_PURCHASE_RECEIPT',
          entityType: 'purchase_receipt',
          entityId: receipt.id.toString(),
          details: {
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
