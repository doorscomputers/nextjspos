import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { processSupplierReturn } from '@/lib/stockOperations'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'

/**
 * POST /api/supplier-returns/[id]/approve
 * Approve supplier return
 *
 * CRITICAL: This deducts stock AND reduces accounts payable!
 *
 * INVENTORY PROCESSING:
 * - Removes quantity from stock
 * - Creates negative stock transaction
 * - Updates serial numbers to 'supplier_return' status
 *
 * ACCOUNTING PROCESSING:
 * - Reduces Accounts Payable balance for supplier
 * - Applies credit to oldest invoices first (FIFO)
 * - Creates Payment record for audit trail
 * - Ensures balance sheet stays balanced
 *
 * VALIDATION:
 * - Verifies totalAmount matches sum of items
 * - Prevents approval if amounts don't match
 * - Maintains accounting integrity
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
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_APPROVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires PURCHASE_RETURN_APPROVE permission' },
        { status: 403 }
      )
    }

    // Get return with all items
    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: {
        id: returnIdNumber,
        businessId: businessIdNumber,
      },
      include: {
        items: true,
        supplier: true,
      },
    })

    if (!supplierReturn) {
      return NextResponse.json({ error: 'Supplier return not found' }, { status: 404 })
    }

    // Validate status
    if (supplierReturn.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot approve return with status: ${supplierReturn.status}` },
        { status: 400 }
      )
    }

    // ========================================================================
    // VALIDATION: Ensure balance sheet will be balanced
    // ========================================================================
    // Verify totalAmount matches sum of items (inventory value = AP reduction)
    const calculatedTotal = supplierReturn.items.reduce((sum, item) => {
      const itemTotal = Number(item.quantity) * Number(item.unitCost || 0)
      return sum + itemTotal
    }, 0)

    const storedTotal = Number(supplierReturn.totalAmount)
    const tolerance = 0.01 // Allow 1 cent rounding difference

    if (Math.abs(calculatedTotal - storedTotal) > tolerance) {
      return NextResponse.json(
        {
          error: 'Balance sheet validation failed',
          details: `Total amount mismatch: stored ${storedTotal.toFixed(2)} vs calculated ${calculatedTotal.toFixed(2)}`,
          message: 'The supplier return total does not match the sum of items. This would cause accounting imbalance.',
        },
        { status: 400 }
      )
    }

    // CONFIGURABLE SOD VALIDATION
    // Check business rules for separation of duties
    const userRoles = await getUserRoles(userIdNumber)
    const sodValidation = await validateSOD({
      businessId: businessIdNumber,
      userId: userIdNumber,
      action: 'approve',
      entity: {
        id: supplierReturn.id,
        createdBy: supplierReturn.createdBy,
        approvedBy: supplierReturn.approvedBy
      },
      entityType: 'supplier_return',
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

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // For each item, deduct stock
      for (const item of supplierReturn.items) {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())
        const unitCost = item.unitCost ? parseFloat(item.unitCost.toString()) : 0

        if (quantity > 0) {
          await processSupplierReturn({
            businessId: businessIdNumber,
            productId,
            productVariationId: variationId,
            locationId: supplierReturn.locationId,
            quantity,
            unitCost,
            returnId: supplierReturn.id,
            returnNumber: supplierReturn.returnNumber,
            supplierName: supplierReturn.supplier.name,
            returnReason: supplierReturn.returnReason || undefined,
            userId: userIdNumber,
            userDisplayName,
            tx,
          })
        }

        // Handle serial numbers if present
        if (item.serialNumbers) {
          const serialIds = item.serialNumbers as any[]

          if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
            for (const serialData of serialIds) {
              const serialId = typeof serialData === 'object' ? serialData.id : serialData

              // Update serial number status
              await tx.productSerialNumber.updateMany({
                where: {
                  id: Number(serialId),
                  status: 'in_stock', // Should be in stock
                },
                data: {
                  status: 'supplier_return',
                  currentLocationId: null, // No longer at location
                  updatedAt: new Date(),
                },
              })

              // Create movement record
              await tx.serialNumberMovement.create({
                data: {
                  serialNumberId: Number(serialId),
                  movementType: 'supplier_return',
                  fromLocationId: supplierReturn.locationId,
                  referenceType: 'supplier_return',
                  referenceId: supplierReturn.id,
                  movedBy: userIdNumber,
                  notes: `Supplier return ${supplierReturn.returnNumber} - ${item.condition}`,
                },
              })
            }
          }
        }
      }

      // ========================================================================
      // ACCOUNTS PAYABLE REDUCTION
      // ========================================================================
      // When returning goods to supplier, reduce the amount we owe them

      const returnAmount = Number(supplierReturn.totalAmount)

      if (returnAmount > 0) {
        // Get all unpaid/partially paid AP entries for this supplier (oldest first - FIFO)
        const apEntries = await tx.accountsPayable.findMany({
          where: {
            supplierId: supplierReturn.supplierId,
            businessId: businessIdNumber,
            balanceAmount: {
              gt: 0, // Only entries with outstanding balance
            },
          },
          orderBy: {
            invoiceDate: 'asc', // Oldest first (FIFO)
          },
        })

        // Apply return amount to AP entries using FIFO
        let remainingCredit = returnAmount

        for (const ap of apEntries) {
          if (remainingCredit <= 0) break

          const currentBalance = Number(ap.balanceAmount)
          const creditToApply = Math.min(remainingCredit, currentBalance)
          const newPaidAmount = Number(ap.paidAmount) + creditToApply
          const newBalance = currentBalance - creditToApply
          const newStatus =
            newBalance === 0 ? 'paid' :
            newBalance < Number(ap.totalAmount) ? 'partial' :
            'unpaid'

          // Update AP entry
          await tx.accountsPayable.update({
            where: { id: ap.id },
            data: {
              paidAmount: newPaidAmount,
              balanceAmount: newBalance,
              paymentStatus: newStatus,
            },
          })

          remainingCredit -= creditToApply
        }

        // Create Payment record for audit trail
        // Generate payment number (format: PAY-YYYYMM-0001)
        const returnDate = new Date(supplierReturn.returnDate)
        const currentYear = returnDate.getFullYear()
        const currentMonth = String(returnDate.getMonth() + 1).padStart(2, '0')

        const lastPayment = await tx.payment.findFirst({
          where: {
            businessId: businessIdNumber,
            paymentNumber: {
              startsWith: `PAY-${currentYear}${currentMonth}`,
            },
          },
          orderBy: {
            paymentNumber: 'desc',
          },
        })

        let paymentNumber
        if (lastPayment) {
          const lastNumber = parseInt(lastPayment.paymentNumber.split('-').pop() || '0')
          paymentNumber = `PAY-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
        } else {
          paymentNumber = `PAY-${currentYear}${currentMonth}-0001`
        }

        // Create payment record
        await tx.payment.create({
          data: {
            businessId: businessIdNumber,
            supplierId: supplierReturn.supplierId,
            amount: returnAmount,
            paymentNumber,
            paymentDate: supplierReturn.returnDate,
            paymentMethod: 'supplier_return_credit',
            transactionReference: supplierReturn.returnNumber,
            status: 'completed',
            notes: `Credit from supplier return ${supplierReturn.returnNumber} - ${supplierReturn.returnReason}`,
            createdBy: userIdNumber,
          },
        })
      }

      // Update return status to approved
      const updatedReturn = await tx.supplierReturn.update({
        where: { id: supplierReturn.id },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          approvedBy: userIdNumber,
        },
      })

      return updatedReturn
    }, {
      timeout: 30000,
    })

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'supplier_return_approve' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [supplierReturn.id],
      description: `Approved Supplier Return ${supplierReturn.returnNumber} - Inventory deducted and AP reduced by ₱${Number(supplierReturn.totalAmount).toFixed(2)}`,
      metadata: {
        returnId: supplierReturn.id,
        returnNumber: supplierReturn.returnNumber,
        supplierId: supplierReturn.supplierId,
        supplierName: supplierReturn.supplier.name,
        itemCount: supplierReturn.items.length,
        totalAmount: supplierReturn.totalAmount.toString(),
        damagedItems: supplierReturn.items.filter((i: any) => i.condition === 'damaged').length,
        defectiveItems: supplierReturn.items.filter((i: any) => i.condition === 'defective').length,
        warrantyItems: supplierReturn.items.filter((i: any) => i.condition === 'warranty_claim').length,
        accountingProcessed: true,
        inventoryReduced: true,
        accountsPayableReduced: true,
        balanceSheetBalanced: true,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: 'Supplier return approved - inventory deducted and accounts payable reduced',
      return: result,
      accountingDetails: {
        inventoryReduced: true,
        accountsPayableReduced: true,
        amountCredited: Number(supplierReturn.totalAmount).toFixed(2),
      },
    })
  } catch (error: any) {
    console.error('Error approving supplier return:', error)
    return NextResponse.json(
      { error: 'Failed to approve supplier return', details: error.message },
      { status: 500 }
    )
  }
}
