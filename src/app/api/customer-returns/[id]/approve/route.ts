import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { processCustomerReturn, getCurrentStock } from '@/lib/stockOperations'

/**
 * POST /api/customer-returns/[id]/approve
 * Approve customer return
 *
 * CRITICAL: This is where stock restoration happens!
 * - Resellable items: Add back to stock
 * - Damaged/Defective items: DO NOT add to stock
 * - Serial numbers: Mark as returned or damaged
 * - Create stock transactions
 * - Process refund (accounting integration point)
 */
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
    const businessId = parseInt(String(user.businessId))
    const userId = user.id
    const businessIdNumber = Number(businessId)
    const userIdNumber = Number(userId)
    const userDisplayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ') ||
      user.username ||
      `User#${userIdNumber}`
    const { id: returnId } = await params
    const returnIdNumber = Number(returnId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.CUSTOMER_RETURN_APPROVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires CUSTOMER_RETURN_APPROVE permission' },
        { status: 403 }
      )
    }

    // Get return with all items
    const customerReturn = await prisma.customerReturn.findFirst({
      where: {
        id: returnIdNumber,
        businessId: businessIdNumber,
      },
      include: {
        items: true,
        sale: true,
      },
    })

    if (!customerReturn) {
      return NextResponse.json({ error: 'Customer return not found' }, { status: 404 })
    }

    // Validate status
    if (customerReturn.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve return with status: ${customerReturn.status}` },
        { status: 400 }
      )
    }

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Lock the original sale (same lock void/exchange/return-create take) and
      // re-check it: a voided sale already had ALL its stock restored, and the
      // total returned on this sale must never exceed what was sold - otherwise
      // the same units are added back to stock twice.
      if (customerReturn.saleId) {
        const lockedSale = await tx.$queryRaw<{ status: string }[]>`
          SELECT status FROM sales WHERE id = ${customerReturn.saleId} FOR UPDATE
        `
        if (!lockedSale.length || lockedSale[0].status === 'voided' || lockedSale[0].status === 'cancelled') {
          throw new Error('RETURN_SALE_VOIDED')
        }
        const saleItems = await tx.saleItem.findMany({
          where: { saleId: customerReturn.saleId },
          select: { productVariationId: true, quantity: true },
        })
        const soldByVariation = new Map<number, number>()
        for (const si of saleItems) {
          soldByVariation.set(si.productVariationId, (soldByVariation.get(si.productVariationId) || 0) + parseFloat(si.quantity.toString()))
        }
        // Every return on this sale that is not rejected/cancelled/voided,
        // including this one (still pending here, so it is in the list once).
        const returnItems = await tx.customerReturnItem.findMany({
          where: { customerReturn: { saleId: customerReturn.saleId, status: { notIn: ['rejected', 'cancelled', 'voided'] } } },
          select: { productVariationId: true, quantity: true },
        })
        const returnedByVariation = new Map<number, number>()
        for (const ri of returnItems) {
          returnedByVariation.set(ri.productVariationId, (returnedByVariation.get(ri.productVariationId) || 0) + parseFloat(ri.quantity.toString()))
        }
        for (const item of customerReturn.items) {
          const returnedQty = returnedByVariation.get(item.productVariationId) || 0
          if (returnedQty > (soldByVariation.get(item.productVariationId) || 0) + 0.0001) {
            throw new Error('RETURN_EXCEEDS_SOLD')
          }
        }
      }

      // Atomically claim the return. The status check earlier in this handler
      // runs OUTSIDE the transaction, so a retried request (network timeout on
      // a committed approval) could pass it concurrently and restore stock
      // twice. This guarded update lets exactly one request proceed.
      const claimed = await tx.customerReturn.updateMany({
        where: { id: customerReturn.id, status: 'pending' },
        data: { status: 'approved' },
      })
      if (claimed.count === 0) {
        throw new Error('RETURN_ALREADY_APPROVED')
      }

      // For each item, restore stock if condition is resellable
      for (const item of customerReturn.items) {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())
        const condition = item.condition

        const unitCost = item.unitPrice ? parseFloat(item.unitPrice.toString()) : 0

        if (condition === 'resellable' && quantity > 0) {
          await processCustomerReturn({
            businessId: businessIdNumber,
            productId,
            productVariationId: variationId,
            locationId: customerReturn.locationId,
            quantity,
            unitCost,
            returnId: customerReturn.id,
            userId: userIdNumber,
            userDisplayName,
            tx,
          })
        } else {
          // Damaged or defective - just log, don't restore stock
          const currentBalance = await getCurrentStock({
            productVariationId: variationId,
            locationId: customerReturn.locationId,
            tx,
          })

          await tx.stockTransaction.create({
            data: {
              businessId: businessIdNumber,
              productId,
              productVariationId: variationId,
              locationId: customerReturn.locationId,
              type: 'customer_return',
              quantity: 0, // No stock change
              balanceQty: currentBalance,
              referenceType: 'customer_return',
              referenceId: customerReturn.id,
              createdBy: userIdNumber,
              notes: `Customer return ${customerReturn.returnNumber} approved - ${condition} (no stock restoration)`,
            },
          })
        }

        // Handle serial numbers if present
        if (item.serialNumbers) {
          const serialIds = item.serialNumbers as any[]

          if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
            for (const serialData of serialIds) {
              const serialId = typeof serialData === 'object' ? serialData.id : serialData

              // Update serial number status based on condition
              let newStatus: string
              if (condition === 'resellable') {
                newStatus = 'returned' // Available for resale
              } else if (condition === 'damaged') {
                newStatus = 'damaged'
              } else {
                newStatus = 'defective'
              }

              await tx.productSerialNumber.updateMany({
                where: {
                  id: Number(serialId),
                  status: 'sold', // Should be sold status
                },
                data: {
                  status: newStatus,
                  currentLocationId: condition === 'resellable' ? customerReturn.locationId : null,
                  updatedAt: new Date(),
                },
              })

              // Create movement record
              await tx.serialNumberMovement.create({
                data: {
                  serialNumberId: Number(serialId),
                  movementType: 'customer_return',
                  toLocationId: condition === 'resellable' ? customerReturn.locationId : null,
                  referenceType: 'customer_return',
                  referenceId: customerReturn.id,
                  movedBy: userIdNumber,
                  notes: `Customer return ${customerReturn.returnNumber} - ${condition}`,
                },
              })
            }
          }
        }
      }

      // Update return status to approved
      const updatedReturn = await tx.customerReturn.update({
        where: { id: customerReturn.id },
        data: {
          status: 'approved',
          approvedBy: userIdNumber,
          approvedAt: new Date(),
        },
      })

      return updatedReturn
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'customer_return_approve' as AuditAction,
      entityType: EntityType.SALE,
      entityIds: [customerReturn.id],
      description: `Approved Customer Return ${customerReturn.returnNumber}`,
      metadata: {
        returnId: customerReturn.id,
        returnNumber: customerReturn.returnNumber,
        saleId: customerReturn.saleId,
        invoiceNumber: customerReturn.sale.invoiceNumber,
        itemCount: customerReturn.items.length,
        totalRefundAmount: customerReturn.totalRefundAmount.toString(),
        resellableItems: customerReturn.items.filter((i: any) => i.condition === 'resellable').length,
        damagedItems: customerReturn.items.filter((i: any) => i.condition === 'damaged').length,
        defectiveItems: customerReturn.items.filter((i: any) => i.condition === 'defective').length,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: 'Customer return approved - stock restored for resellable items',
      return: result,
    })
  } catch (error: any) {
    if (error?.message === 'RETURN_ALREADY_APPROVED') {
      return NextResponse.json(
        { error: 'This return has already been approved. Stock was restored only once.' },
        { status: 409 }
      )
    }
    if (error?.message === 'RETURN_SALE_VOIDED') {
      return NextResponse.json(
        { error: 'Cannot approve: the original sale was voided, so its stock was already restored. Please reject this return.' },
        { status: 400 }
      )
    }
    if (error?.message === 'RETURN_EXCEEDS_SOLD') {
      return NextResponse.json(
        { error: 'Cannot approve: together with earlier returns/exchanges, this returns more than was sold on the invoice. Please reject the duplicate return.' },
        { status: 400 }
      )
    }
    console.error('Error approving customer return:', error)
    return NextResponse.json(
      { error: 'Failed to approve customer return', details: error.message },
      { status: 500 }
    )
  }
}
