import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/purchases/returns/[id]/approve
 * Approve a purchase return
 * - Reduces inventory at the location
 * - Creates a debit note against the supplier
 * - Reduces accounts payable balance
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
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_APPROVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires PURCHASE_RETURN_APPROVE permission' },
        { status: 403 }
      )
    }

    // Fetch purchase return with all details
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
          },
        },
      },
    })

    if (!purchaseReturn) {
      return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 })
    }

    // Validate status
    if (purchaseReturn.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve return with status: ${purchaseReturn.status}` },
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

    // Perform approval in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update purchase return status
      const approvedReturn = await tx.purchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: 'approved',
          approvedBy: parseInt(userId),
          approvedAt: new Date(),
        },
      })

      // 2. Reduce inventory for each item
      for (const item of purchaseReturn.items) {
        // Get current inventory
        const inventoryRecord = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: item.productVariationId,
              locationId: purchaseReturn.locationId,
            },
          },
        })

        if (!inventoryRecord) {
          throw new Error(
            `Inventory record not found for product variation ${item.productVariationId} at location ${purchaseReturn.locationId}`
          )
        }

        // Check if sufficient stock available
        const currentQty = parseFloat(String(inventoryRecord.qtyAvailable))
        const returnQty = parseFloat(String(item.quantityReturned))

        if (currentQty < returnQty) {
          throw new Error(
            `Insufficient stock to return. Available: ${currentQty}, Requested: ${returnQty} for product variation ${item.productVariationId}`
          )
        }

        // Update inventory - REDUCE stock
        const newQty = currentQty - returnQty
        await tx.variationLocationDetails.update({
          where: {
            productVariationId_locationId: {
              productVariationId: item.productVariationId,
              locationId: purchaseReturn.locationId,
            },
          },
          data: {
            qtyAvailable: newQty,
          },
        })

        // Create stock transaction record
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: purchaseReturn.locationId,
            type: 'purchase_return',
            quantity: -returnQty, // Negative because it's a reduction
            unitCost: item.unitCost,
            balanceQty: newQty,
            referenceType: 'purchase_return',
            referenceId: purchaseReturn.id,
            createdBy: parseInt(userId),
            notes: `Return to supplier: ${purchaseReturn.supplier.name} - ${purchaseReturn.returnReason}`,
          },
        })

        // Update serial numbers status if applicable
        if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
          for (const serialInfo of item.serialNumbers as any[]) {
            await tx.productSerialNumber.updateMany({
              where: {
                businessId: parseInt(businessId),
                serialNumber: serialInfo.serialNumber,
                productVariationId: item.productVariationId,
              },
              data: {
                status: 'returned_to_supplier',
                currentLocationId: null,
              },
            })
          }
        }
      }

      // 3. Generate debit note number
      const debitNoteCount = await tx.debitNote.count({
        where: { businessId: parseInt(businessId) },
      })
      const debitNoteNumber = `DN-${String(debitNoteCount + 1).padStart(6, '0')}`

      // 4. Create debit note
      const debitNote = await tx.debitNote.create({
        data: {
          businessId: parseInt(businessId),
          supplierId: purchaseReturn.supplierId,
          purchaseReturnId: purchaseReturn.id,
          debitNoteNumber,
          debitNoteDate: new Date(),
          amount: purchaseReturn.totalAmount,
          status: 'pending',
          notes: `Debit note for return ${purchaseReturn.returnNumber} - ${purchaseReturn.returnReason}`,
          createdBy: parseInt(userId),
        },
      })

      // 5. Update accounts payable if exists
      if (purchaseReturn.purchaseReceipt.purchaseId) {
        const accountsPayable = await tx.accountsPayable.findFirst({
          where: {
            businessId: parseInt(businessId),
            purchaseId: purchaseReturn.purchaseReceipt.purchaseId,
          },
        })

        if (accountsPayable) {
          // Reduce the balance by the return amount
          const currentBalance = parseFloat(String(accountsPayable.balanceAmount))
          const returnAmount = parseFloat(String(purchaseReturn.totalAmount))
          const newBalance = Math.max(0, currentBalance - returnAmount)

          // Update paid amount
          const totalAmount = parseFloat(String(accountsPayable.totalAmount))
          const newPaidAmount = totalAmount - newBalance

          await tx.accountsPayable.update({
            where: { id: accountsPayable.id },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: newBalance,
              paymentStatus: newBalance <= 0 ? 'paid' : 'partial',
            },
          })
        }
      }

      return { approvedReturn, debitNote }
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_return_approve' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [purchaseReturn.id],
      description: `Approved Purchase Return ${purchaseReturn.returnNumber} for GRN ${purchaseReturn.purchaseReceipt.receiptNumber}`,
      metadata: {
        returnId: purchaseReturn.id,
        returnNumber: purchaseReturn.returnNumber,
        receiptId: purchaseReturn.purchaseReceiptId,
        grnNumber: purchaseReturn.purchaseReceipt.receiptNumber,
        supplierId: purchaseReturn.supplierId,
        supplierName: purchaseReturn.supplier.name,
        locationId: purchaseReturn.locationId,
        itemCount: purchaseReturn.items.length,
        totalAmount: Number(purchaseReturn.totalAmount),
        debitNoteNumber: result.debitNote.debitNoteNumber,
        returnReason: purchaseReturn.returnReason,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete return with updated relations
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
        debitNotes: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase return approved successfully',
      data: completeReturn,
      debitNote: result.debitNote,
    })
  } catch (error: any) {
    console.error('Error approving purchase return:', error)
    return NextResponse.json(
      { error: 'Failed to approve purchase return', details: error.message },
      { status: 500 }
    )
  }
}
