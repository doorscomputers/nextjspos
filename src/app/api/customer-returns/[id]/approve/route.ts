import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
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
    const businessId = user.businessId
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
    console.error('Error approving customer return:', error)
    return NextResponse.json(
      { error: 'Failed to approve customer return', details: error.message },
      { status: 500 }
    )
  }
}
