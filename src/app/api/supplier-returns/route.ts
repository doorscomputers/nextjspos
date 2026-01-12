import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { sendSupplierReturnAlert } from '@/lib/email'
import { sendTelegramSupplierReturnAlert } from '@/lib/telegram'
import { withIdempotency } from '@/lib/idempotency'

/**
 * GET /api/supplier-returns
 * List all supplier returns with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const supplierId = searchParams.get('supplierId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
    }

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId)
    }

    const [returns, total] = await Promise.all([
      prisma.supplierReturn.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          items: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.supplierReturn.count({ where }),
    ])

    return NextResponse.json({
      returns,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching supplier returns:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier returns' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/supplier-returns
 * Create new supplier return request
 */
export async function POST(request: NextRequest) {
  return withIdempotency(request, '/api/supplier-returns', async () => {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      supplierId,
      locationId,
      returnDate,
      returnReason, // warranty, defective, damaged
      items, // Array of { productId, productVariationId, quantity, unitCost, condition, serialNumberIds?, notes }
      notes,
    } = body

    // Validation
    if (!supplierId || !locationId || !returnDate || !returnReason || !items || items.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, locationId, returnDate, returnReason, items' },
        { status: 400 }
      )
    }

    // Verify supplier belongs to business
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(supplierId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Calculate total amount
    let totalAmount = 0
    for (const item of items) {
      const quantity = parseFloat(item.quantity)
      const unitCost = parseFloat(item.unitCost)

      if (isNaN(quantity) || quantity <= 0) {
        return NextResponse.json(
          { error: `Invalid quantity for item: ${item.productId}` },
          { status: 400 }
        )
      }

      if (isNaN(unitCost) || unitCost < 0) {
        return NextResponse.json(
          { error: `Invalid unit cost for item: ${item.productId}` },
          { status: 400 }
        )
      }

      // Validate condition
      if (!['damaged', 'defective', 'warranty_claim'].includes(item.condition)) {
        return NextResponse.json(
          { error: 'Invalid condition. Must be: damaged, defective, or warranty_claim' },
          { status: 400 }
        )
      }

      totalAmount += quantity * unitCost
    }

    // ============================================================================
    // DUPLICATE DETECTION (Prevents network retry duplicates AND duplicate notifications)
    // ============================================================================
    // CRITICAL: Must happen BEFORE transaction to prevent duplicate email/Telegram notifications
    const DUPLICATE_WINDOW_MS = 300 * 1000 // 300 seconds (5 minutes)
    const duplicateCheckTime = new Date(Date.now() - DUPLICATE_WINDOW_MS)

    // Look for recent identical supplier returns from same user
    const recentSimilarReturns = await prisma.supplierReturn.findMany({
      where: {
        businessId: parseInt(businessId),
        supplierId: parseInt(supplierId),
        totalAmount: {
          gte: totalAmount - 0.01,
          lte: totalAmount + 0.01,
        },
        createdBy: parseInt(userId),
        createdAt: {
          gte: duplicateCheckTime,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Only check last 5 similar returns
    })

    if (recentSimilarReturns.length > 0) {
      const latestReturn = recentSimilarReturns[0]
      const secondsAgo = Math.round((Date.now() - latestReturn.createdAt.getTime()) / 1000)

      console.warn(`[SUPPLIER RETURN] DUPLICATE BLOCKED: Return identical to ID ${latestReturn.id} (${secondsAgo}s ago)`)
      console.warn(`[SUPPLIER RETURN] User: ${userId}, Supplier: ${supplierId}, Amount: ${totalAmount}`)

      return NextResponse.json(
        {
          error: 'Duplicate transaction detected',
          message: `An identical supplier return was created ${secondsAgo} seconds ago. If this was intentional, please wait 5 minutes before creating another identical return.`,
          existingReturnId: latestReturn.id,
          existingReturnNumber: latestReturn.returnNumber,
          duplicateWindowSeconds: 300,
        },
        { status: 409 } // HTTP 409 Conflict
      )
    }
    // ============================================================================

    // Generate return number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastReturn = await prisma.supplierReturn.findFirst({
      where: {
        businessId: parseInt(businessId),
        returnNumber: {
          startsWith: `SR-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let returnNumber
    if (lastReturn) {
      const lastNumber = parseInt(lastReturn.returnNumber.split('-').pop() || '0')
      returnNumber = `SR-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      returnNumber = `SR-${currentYear}${currentMonth}-0001`
    }

    // Create return
    const supplierReturn = await prisma.$transaction(async (tx) => {
      // Create supplier return
      const newReturn = await tx.supplierReturn.create({
        data: {
          businessId: parseInt(businessId),
          locationId: parseInt(locationId),
          supplierId: parseInt(supplierId),
          returnNumber,
          returnDate: new Date(returnDate),
          status: 'pending',
          returnReason,
          totalAmount,
          notes,
          createdBy: parseInt(userId),
        },
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // Create return items
      for (const item of items) {
        // Prepare serial numbers data
        let serialNumbersData = null
        if (item.serialNumberIds && item.serialNumberIds.length > 0) {
          const serialNumberRecords = await tx.productSerialNumber.findMany({
            where: {
              id: { in: item.serialNumberIds.map((id: any) => parseInt(id)) },
            },
          })
          serialNumbersData = serialNumberRecords.map((sn: any) => ({
            id: sn.id,
            serialNumber: sn.serialNumber,
            imei: sn.imei,
          }))
        }

        await tx.supplierReturnItem.create({
          data: {
            supplierReturnId: newReturn.id,
            productId: parseInt(item.productId),
            productVariationId: parseInt(item.productVariationId),
            quantity: parseFloat(item.quantity),
            unitCost: parseFloat(item.unitCost),
            serialNumbers: serialNumbersData,
            condition: item.condition,
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
      action: 'supplier_return_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [supplierReturn.id],
      description: `Created Supplier Return ${returnNumber}`,
      metadata: {
        returnId: supplierReturn.id,
        returnNumber,
        supplierId: parseInt(supplierId),
        supplierName: supplier.name,
        returnReason,
        itemCount: items.length,
        totalAmount,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete return with relations
    const completeReturn = await prisma.supplierReturn.findUnique({
      where: { id: supplierReturn.id },
      include: {
        supplier: true,
        items: true,
        location: { select: { name: true } },
      },
    })

    // Fetch product names separately (SupplierReturnItem has no product relation)
    const productIds = completeReturn?.items?.map((item) => item.productId) || []
    let productMap: Record<number, string> = {}

    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true },
      })
      productMap = products.reduce((acc, p) => {
        acc[p.id] = p.name
        return acc
      }, {} as Record<number, string>)
    }

    // Get user display name for notifications
    const userDisplayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || `User#${userId}`

    // Send notifications (async, don't await - fire and forget)
    const notificationData = {
      returnNumber,
      supplierName: supplier.name,
      totalAmount,
      itemCount: items.length,
      reason: returnReason,
      status: 'pending',
      createdBy: userDisplayName,
      locationName: completeReturn?.location?.name || 'Unknown Location',
      timestamp: new Date(),
      items: completeReturn?.items?.map((item: any) => ({
        productName: productMap[item.productId] || 'Unknown Product',
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
      })),
    }

    // Send Email notification
    sendSupplierReturnAlert(notificationData).catch((err) => {
      console.error('Failed to send supplier return email alert:', err)
    })

    // Send Telegram notification
    sendTelegramSupplierReturnAlert(notificationData).catch((err) => {
      console.error('Failed to send supplier return Telegram alert:', err)
    })

    // Format response with product data in items (matching [id]/route.ts pattern)
    const formattedReturn = completeReturn ? {
      ...completeReturn,
      items: completeReturn.items.map((item) => ({
        ...item,
        product: { id: item.productId, name: productMap[item.productId] || 'Unknown Product' },
      })),
    } : null

    return NextResponse.json({ return: formattedReturn }, { status: 201 })
  } catch (error) {
    console.error('Error creating supplier return:', error)
    return NextResponse.json(
      {
        error: 'Failed to create supplier return',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
  })
}
