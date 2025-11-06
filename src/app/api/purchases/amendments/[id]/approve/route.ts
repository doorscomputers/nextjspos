import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { validateSOD, getUserRoles } from '@/lib/sodValidation'

/**
 * POST /api/purchases/amendments/[id]/approve
 * Approve a purchase amendment and apply changes to the purchase order
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_AMENDMENT_APPROVE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const amendmentId = parseInt(id)

    // Fetch amendment with full details
    const amendment = await prisma.purchaseAmendment.findFirst({
      where: {
        id: amendmentId,
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          include: {
            supplier: true,
            items: true,
          },
        },
      },
    })

    if (!amendment) {
      return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
    }

    // Check if already approved or rejected
    if (amendment.status === 'approved') {
      return NextResponse.json({ error: 'Amendment already approved' }, { status: 400 })
    }

    if (amendment.status === 'rejected') {
      return NextResponse.json({ error: 'Cannot approve a rejected amendment' }, { status: 400 })
    }

    // CONFIGURABLE SOD VALIDATION
    // Check business rules for separation of duties
    const userRoles = await getUserRoles(userIdNumber)
    const sodValidation = await validateSOD({
      businessId: businessIdNumber,
      userId: userIdNumber,
      action: 'approve',
      entity: {
        id: amendment.id,
        requestedBy: amendment.requestedBy,
        approvedBy: amendment.approvedBy
      },
      entityType: 'amendment',
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

    // Apply amendment changes in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update amendment status
      const approvedAmendment = await tx.purchaseAmendment.update({
        where: { id: amendment.id },
        data: {
          status: 'approved',
          approvedBy: parseInt(userId),
          approvedAt: new Date(),
        },
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // 2. Apply changes to the purchase order
      const changedFields = amendment.changedFields as any
      const updateData: any = {}

      // Update financial fields if changed
      if (amendment.newSubtotal !== null) {
        updateData.subtotal = amendment.newSubtotal
      }
      if (amendment.newTaxAmount !== null) {
        updateData.taxAmount = amendment.newTaxAmount
      }
      if (amendment.newTotalAmount !== null) {
        updateData.totalAmount = amendment.newTotalAmount
      }

      // Update other fields from changedFields
      if (changedFields.deliveryDate) {
        updateData.deliveryDate = new Date(changedFields.deliveryDate)
      }
      if (changedFields.paymentTerms) {
        updateData.paymentTerms = changedFields.paymentTerms
      }
      if (changedFields.shippingCharges !== undefined) {
        updateData.shippingCharges = parseFloat(changedFields.shippingCharges)
      }
      if (changedFields.discountAmount !== undefined) {
        updateData.discountAmount = parseFloat(changedFields.discountAmount)
      }
      if (changedFields.notes !== undefined) {
        updateData.notes = changedFields.notes
      }

      // Mark purchase as amended
      updateData.isAmended = true

      const updatedPurchase = await tx.purchase.update({
        where: { id: amendment.purchaseId },
        data: updateData,
      })

      // 3. If items were changed, update purchase items
      if (changedFields.items && Array.isArray(changedFields.items)) {
        for (const itemChange of changedFields.items) {
          if (itemChange.action === 'update' && itemChange.itemId) {
            await tx.purchaseItem.update({
              where: { id: itemChange.itemId },
              data: {
                quantity: itemChange.quantity !== undefined ? parseFloat(itemChange.quantity) : undefined,
                unitCost: itemChange.unitCost !== undefined ? parseFloat(itemChange.unitCost) : undefined,
                taxRate: itemChange.taxRate !== undefined ? parseFloat(itemChange.taxRate) : undefined,
                discountRate: itemChange.discountRate !== undefined ? parseFloat(itemChange.discountRate) : undefined,
                total: itemChange.total !== undefined ? parseFloat(itemChange.total) : undefined,
              },
            })
          } else if (itemChange.action === 'add') {
            await tx.purchaseItem.create({
              data: {
                purchaseId: amendment.purchaseId,
                productId: parseInt(itemChange.productId),
                productVariationId: parseInt(itemChange.productVariationId),
                quantity: parseFloat(itemChange.quantity),
                unitCost: parseFloat(itemChange.unitCost),
                taxRate: parseFloat(itemChange.taxRate || 0),
                discountRate: parseFloat(itemChange.discountRate || 0),
                total: parseFloat(itemChange.total),
              },
            })
          } else if (itemChange.action === 'remove' && itemChange.itemId) {
            await tx.purchaseItem.delete({
              where: { id: itemChange.itemId },
            })
          }
        }
      }

      // 4. Update Accounts Payable if total amount changed
      if (amendment.newTotalAmount !== null) {
        const accountsPayable = await tx.accountsPayable.findFirst({
          where: {
            businessId: parseInt(businessId),
            purchaseId: amendment.purchaseId,
          },
        })

        if (accountsPayable) {
          const oldTotal = parseFloat(String(amendment.previousData['totalAmount']))
          const newTotal = parseFloat(String(amendment.newTotalAmount))
          const difference = newTotal - oldTotal

          const currentBalance = parseFloat(String(accountsPayable.balanceAmount))
          const newBalance = currentBalance + difference

          await tx.accountsPayable.update({
            where: { id: accountsPayable.id },
            data: {
              totalAmount: newTotal,
              balanceAmount: Math.max(0, newBalance),
              paymentStatus: newBalance <= 0 ? 'paid' : newBalance < newTotal ? 'partial' : 'pending',
            },
          })
        }
      }

      return { approvedAmendment, updatedPurchase }
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_amendment_approve' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [amendment.id, amendment.purchaseId],
      description: `Approved Amendment #${amendment.amendmentNumber} for PO ${amendment.purchase.referenceNo}`,
      metadata: {
        amendmentId: amendment.id,
        amendmentNumber: amendment.amendmentNumber,
        purchaseId: amendment.purchaseId,
        referenceNo: amendment.purchase.referenceNo,
        supplierId: amendment.purchase.supplierId,
        supplierName: amendment.purchase.supplier.name,
        amendmentReason: amendment.amendmentReason,
        oldTotal: amendment.previousData['totalAmount'],
        newTotal: amendment.newTotalAmount,
        changedFields: Object.keys(amendment.changedFields as any),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete updated data
    const completeAmendment = await prisma.purchaseAmendment.findUnique({
      where: { id: amendment.id },
      include: {
        purchase: {
          include: {
            supplier: true,
            items: {
              include: {
                product: true,
                productVariation: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Amendment approved and changes applied successfully',
      data: completeAmendment,
    })
  } catch (error: any) {
    console.error('Error approving amendment:', error)
    return NextResponse.json(
      { error: 'Failed to approve amendment', details: error.message },
      { status: 500 }
    )
  }
}
