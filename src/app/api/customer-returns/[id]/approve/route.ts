import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

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
    const { id: returnId } = await params

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
        id: parseInt(returnId),
        businessId: parseInt(businessId),
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

        // Only restore stock if item is resellable
        if (condition === 'resellable') {
          // Get current stock at return location
          const currentStock = await tx.variationLocationDetails.findFirst({
            where: {
              productId,
              productVariationId: variationId,
              locationId: customerReturn.locationId,
            },
          })

          if (!currentStock) {
            // Create stock record if it doesn't exist
            await tx.variationLocationDetails.create({
              data: {
                productId,
                productVariationId: variationId,
                locationId: customerReturn.locationId,
                qtyAvailable: quantity,
              },
            })
          } else {
            // Update existing stock (ADD quantity back)
            const currentQty = parseFloat(currentStock.qtyAvailable.toString())
            const newQty = currentQty + quantity

            await tx.variationLocationDetails.update({
              where: { id: currentStock.id },
              data: {
                qtyAvailable: newQty,
                updatedAt: new Date(),
              },
            })
          }

          // Create stock transaction (positive = addition)
          await tx.stockTransaction.create({
            data: {
              businessId: parseInt(businessId),
              productId,
              productVariationId: variationId,
              locationId: customerReturn.locationId,
              type: 'customer_return', // NEW TYPE for returns
              quantity: quantity, // POSITIVE for stock addition
              balanceQty: 0, // Will be calculated
              referenceType: 'customer_return',
              referenceId: customerReturn.id,
              createdBy: parseInt(userId),
              notes: `Customer return ${customerReturn.returnNumber} approved - resellable`,
            },
          })
        } else {
          // Damaged or defective - just log, don't restore stock
          await tx.stockTransaction.create({
            data: {
              businessId: parseInt(businessId),
              productId,
              productVariationId: variationId,
              locationId: customerReturn.locationId,
              type: 'customer_return',
              quantity: 0, // No stock change
              balanceQty: 0,
              referenceType: 'customer_return',
              referenceId: customerReturn.id,
              createdBy: parseInt(userId),
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
                  id: parseInt(serialId),
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
                  serialNumberId: parseInt(serialId),
                  movementType: 'customer_return',
                  toLocationId: condition === 'resellable' ? customerReturn.locationId : null,
                  referenceType: 'customer_return',
                  referenceId: customerReturn.id,
                  movedBy: parseInt(userId),
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
          approvedBy: parseInt(userId),
          approvedAt: new Date(),
        },
      })

      return updatedReturn
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
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
