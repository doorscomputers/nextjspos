import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { processSupplierReturn } from '@/lib/stockOperations'
import { withIdempotency } from '@/lib/idempotency'

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
  const { id: returnId } = await params
  return withIdempotency(request, `/api/purchases/returns/${returnId}/approve`, async () => {
  try {
    console.log('[APPROVE] Starting purchase return approval...')
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
    const returnIdNumber = Number(returnId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_APPROVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires PURCHASE_RETURN_APPROVE permission' },
        { status: 403 }
      )
    }

    // Fetch purchase return with all details
    console.log(`[APPROVE] Fetching return ID: ${returnIdNumber}`)
    const purchaseReturn = await prisma.purchaseReturn.findFirst({
      where: {
        id: returnIdNumber,
        businessId: businessIdNumber,
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
      console.log(`[APPROVE] ❌ Return not found: ${returnIdNumber}`)
      return NextResponse.json({ error: 'Purchase return not found' }, { status: 404 })
    }

    console.log(`[APPROVE] ✅ Found return: ${purchaseReturn.returnNumber}, Status: ${purchaseReturn.status}`)

    // Validate status
    if (purchaseReturn.status !== 'pending') {
      console.log(`[APPROVE] ❌ Invalid status: ${purchaseReturn.status}`)
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
            userId: userIdNumber,
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
    console.log(`[APPROVE] Starting transaction...`)
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update purchase return status
      console.log(`[APPROVE] 1. Updating return status...`)
      const approvedReturn = await tx.purchaseReturn.update({
        where: { id: purchaseReturn.id },
        data: {
          status: 'approved',
          approvedBy: userIdNumber,
          approvedAt: new Date(),
        },
      })
      console.log(`[APPROVE] ✅ Status updated to approved`)

      // 2. Reduce inventory for each item
      console.log(`[APPROVE] 2. Processing ${purchaseReturn.items.length} items...`)
      for (const item of purchaseReturn.items) {
        const returnQty = parseFloat(String(item.quantityReturned))
        const unitCost = item.unitCost ? parseFloat(String(item.unitCost)) : 0

        if (returnQty > 0) {
          console.log(`[APPROVE]    - Processing item ${item.id}: Product ${item.productId}, Qty: ${returnQty}`)
          await processSupplierReturn({
            businessId: businessIdNumber,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: purchaseReturn.locationId,
            quantity: returnQty,
            unitCost,
            returnId: purchaseReturn.id,
            userId: userIdNumber,
            userDisplayName,
            tx,
          })
          console.log(`[APPROVE]    ✅ Item processed successfully`)
        }

        // Update serial numbers status if applicable
        if (item.serialNumbers && Array.isArray(item.serialNumbers)) {
          for (const serialInfo of item.serialNumbers as any[]) {
            await tx.productSerialNumber.updateMany({
              where: {
                businessId: businessIdNumber,
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
      console.log(`[APPROVE] 3. Generating debit note...`)
      const debitNoteCount = await tx.debitNote.count({
        where: { businessId: businessIdNumber },
      })
      const debitNoteNumber = `DN-${String(debitNoteCount + 1).padStart(6, '0')}`

      // 4. Create debit note
      console.log(`[APPROVE] 4. Creating debit note: ${debitNoteNumber}`)
      const debitNote = await tx.debitNote.create({
        data: {
          businessId: businessIdNumber,
          supplierId: purchaseReturn.supplierId,
          purchaseReturnId: purchaseReturn.id,
          debitNoteNumber,
          debitNoteDate: new Date(),
          amount: purchaseReturn.totalAmount,
          status: 'pending',
          notes: `Debit note for return ${purchaseReturn.returnNumber} - ${purchaseReturn.returnReason}`,
          createdBy: userIdNumber,
        },
      })

      // 5. Update accounts payable if exists
      console.log(`[APPROVE] 5. Updating accounts payable...`)
      if (purchaseReturn.purchaseReceipt.purchaseId) {
        const accountsPayable = await tx.accountsPayable.findFirst({
          where: {
            businessId: businessIdNumber,
            purchaseId: purchaseReturn.purchaseReceipt.purchaseId,
          },
        })

        if (accountsPayable) {
          // Reduce the balance by the return amount
          const currentBalance = parseFloat(String(accountsPayable.balanceAmount))
          const returnAmount = parseFloat(String(purchaseReturn.totalAmount))
          const newBalance = Math.max(0, currentBalance - returnAmount)

          console.log(`[APPROVE]    Current balance: ₱${currentBalance}, Return: ₱${returnAmount}, New: ₱${newBalance}`)

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
          console.log(`[APPROVE]    ✅ AP updated`)
        } else {
          console.log(`[APPROVE]    ⚠️  No AP record found`)
        }
      } else {
        console.log(`[APPROVE]    ⚠️  No purchase ID linked`)
      }

      console.log(`[APPROVE] ✅ Transaction completed successfully!`)
      return { approvedReturn, debitNote }
    }, {
      timeout: 30000, // 30 second timeout for complex operations
    })

    console.log(`[APPROVE] Creating audit log...`)

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
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

    console.log(`[APPROVE] ✅ ALL DONE! Returning success response`)
    return NextResponse.json({
      success: true,
      message: 'Purchase return approved successfully',
      data: completeReturn,
      debitNote: result.debitNote,
    })
  } catch (error: any) {
    console.error('[APPROVE] ❌ ERROR:', error)
    console.error('[APPROVE] Error stack:', error.stack)
    return NextResponse.json(
      { error: 'Failed to approve purchase return', details: error.message },
      { status: 500 }
    )
  }
  }) // Close idempotency wrapper
}
