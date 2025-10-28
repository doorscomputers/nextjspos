import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'
import { transferStockOut } from '@/lib/stockOperations'
import { withIdempotency } from '@/lib/idempotency'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker'
import { sendTelegramStockTransferAlert } from '@/lib/telegram'

/**
 * POST /api/transfers/[id]/send
 * Send transfer - CRITICAL: Deducts stock from origin location
 * Status: checked → in_transit
 * CRITICAL: This is where stock is physically deducted
 * Stock movements are IMMUTABLE after this point unless cancelled
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  return withIdempotency(request, `/api/transfers/${id}/send`, async () => {
    try {
      const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id
    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      `User#${userIdNumber}`

    const transferId = parseInt(id)

    const body = await request.json()
    const { notes } = body

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_SEND)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_SEND permission' },
        { status: 403 }
      )
    }

    // Get transfer with all items
    const transfer = await prisma.stockTransfer.findFirst({
      where: {
        id: transferId,
        businessId: businessIdNumber,
        deletedAt: null,
      },
      include: {
        items: true,
      },
    })

    if (!transfer) {
      return NextResponse.json({ error: 'Transfer not found' }, { status: 404 })
    }

    // Validate status
    if (transfer.status !== 'checked') {
      return NextResponse.json(
        { error: `Cannot send transfer with status: ${transfer.status}. Must be checked first.` },
        { status: 400 }
      )
    }

    // Validate sender has access to origin location
    const hasAccessAllLocations = user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)
    if (!hasAccessAllLocations) {
      const userLocation = await prisma.userLocation.findFirst({
        where: {
          userId: userIdNumber,
          locationId: transfer.fromLocationId,
        },
      })
      if (!userLocation) {
        return NextResponse.json(
          { error: 'No access to origin location' },
          { status: 403 }
        )
      }
    }

    // CONFIGURABLE SOD VALIDATION
    // Check business rules for separation of duties
    const userRoles = await getUserRoles(userIdNumber)
    const sodValidation = await validateSOD({
      businessId: businessIdNumber,
      userId: userIdNumber,
      action: 'send',
      entity: {
        id: transfer.id,
        createdBy: transfer.createdBy,
        checkedBy: transfer.checkedBy,
        sentBy: transfer.sentBy,
        receivedBy: transfer.receivedBy
      },
      entityType: 'transfer',
      userRoles
    })

    if (!sodValidation.allowed) {
      return NextResponse.json(
        {
          error: sodValidation.reason,
          code: sodValidation.code,
          configurable: sodValidation.configurable,
          suggestion: sodValidation.suggestion,
          ruleField: sodValidation.ruleField
        },
        { status: 403 }
      )
    }

    // TRANSACTION IMPACT TRACKING: Step 1 - Capture inventory BEFORE transaction
    const impactTracker = new InventoryImpactTracker()
    const productVariationIds = transfer.items.map(item => item.productVariationId)
    const locationIds = [transfer.fromLocationId]
    await impactTracker.captureBefore(productVariationIds, locationIds)

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // For each item, deduct stock from origin location
      for (const item of transfer.items) {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())

        const stockNote =
          typeof notes === 'string' && notes.trim().length > 0
            ? `${notes.trim()} (Transfer ${transfer.transferNumber} sent)`
            : `Transfer ${transfer.transferNumber} sent`

        await transferStockOut({
          businessId: businessIdNumber,
          productId,
          productVariationId: variationId,
          fromLocationId: transfer.fromLocationId,
          quantity,
          transferId,
          userId: userIdNumber,
          notes: stockNote,
          userDisplayName,
          tx,
        })

        // Handle serial numbers if present
        if (item.serialNumbersSent) {
          const serialIds = item.serialNumbersSent as number[]

          if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
            // Update serial numbers to in_transit status
            await tx.productSerialNumber.updateMany({
              where: {
                id: { in: serialIds },
                status: 'in_stock',
                currentLocationId: transfer.fromLocationId,
              },
              data: {
                status: 'in_transit',
                currentLocationId: null, // Temporarily null during transit
                updatedAt: new Date(),
              },
            })
          }
        }
      }

      // Update transfer status to in_transit
      const updatedTransfer = await tx.stockTransfer.update({
        where: { id: transferId },
        data: {
          status: 'in_transit',
          stockDeducted: true, // CRITICAL FLAG
          sentBy: userIdNumber,
          sentAt: new Date(),
        },
      })

      return updatedTransfer
    })

    // TRANSACTION IMPACT TRACKING: Step 2 - Capture inventory AFTER and generate report
    const locationTypes = { [transfer.fromLocationId]: 'source' as const }
    const inventoryImpact = await impactTracker.captureAfterAndReport(
      productVariationIds,
      locationIds,
      'transfer',
      result.id,
      transfer.transferNumber,
      locationTypes,
      userDisplayName
    )

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'transfer_send' as AuditAction,
      entityType: EntityType.STOCK_TRANSFER,
      entityIds: [transferId],
      description: `Sent transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        itemCount: transfer.items.length,
        notes,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    // Send Telegram notification for transfer sent
    try {
      const locations = await prisma.businessLocation.findMany({
        where: {
          id: { in: [transfer.fromLocationId, transfer.toLocationId] },
          businessId: businessIdNumber
        },
        select: { id: true, name: true }
      })

      const fromLocation = locations.find(l => l.id === transfer.fromLocationId)
      const toLocation = locations.find(l => l.id === transfer.toLocationId)

      if (fromLocation && toLocation) {
        const totalQuantity = transfer.items.reduce((sum, item) => sum + parseFloat(item.quantity.toString()), 0)
        const itemsWithNames = await prisma.stockTransferItem.findMany({
          where: { stockTransferId: transferId },
          include: {
            product: { select: { name: true } },
            productVariation: { select: { name: true } }
          },
          take: 3
        })

        await sendTelegramStockTransferAlert({
          transferNumber: transfer.transferNumber,
          fromLocation: fromLocation.name,
          toLocation: toLocation.name,
          itemCount: transfer.items.length,
          totalQuantity,
          status: 'in_transit',
          createdBy: userDisplayName,
          timestamp: new Date(),
          items: itemsWithNames.map(item => ({
            productName: item.product.name,
            variationName: item.productVariation.name,
            quantity: parseFloat(item.quantity.toString())
          }))
        })
      }
    } catch (telegramError) {
      console.error('Telegram notification failed:', telegramError)
    }

    return NextResponse.json({
      message: 'Transfer sent - stock deducted from origin location',
      transfer: result,
      inventoryImpact,
    })
  } catch (error: any) {
    console.error('Error sending transfer:', error)
    return NextResponse.json(
      { error: 'Failed to send transfer', details: error.message },
      { status: 500 }
    )
  }
  }) // Close idempotency wrapper
}
