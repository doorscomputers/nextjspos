import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/purchases/[id]/close
 * Manually close a Purchase Order when full delivery cannot be completed
 * This will:
 * - Mark PO as 'received' (closed)
 * - Create Accounts Payable entry for actual amount received
 * - Allow payment processing for partial deliveries
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
    const { id } = await params
    const purchaseId = parseInt(id)

    // Check permission - requires PURCHASE_UPDATE permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to close purchase orders' },
        { status: 403 }
      )
    }

    if (isNaN(purchaseId)) {
      return NextResponse.json(
        { error: 'Invalid purchase ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { reason } = body // Optional reason for closing

    // Fetch purchase with items
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        items: true,
        supplier: {
          select: {
            id: true,
            name: true,
            paymentTerms: true,
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json(
        { error: 'Purchase order not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // Validate that PO is in a closeable state
    if (purchase.status === 'received') {
      return NextResponse.json(
        { error: 'Purchase order is already fully received/closed' },
        { status: 400 }
      )
    }

    if (purchase.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot close a cancelled purchase order' },
        { status: 400 }
      )
    }

    if (purchase.status === 'pending') {
      return NextResponse.json(
        { error: 'Cannot close a pending purchase order. Create at least one GRN first.' },
        { status: 400 }
      )
    }

    // Check if any items have been received
    const hasReceivedItems = purchase.items.some(
      (item) => parseFloat(item.quantityReceived.toString()) > 0
    )

    if (!hasReceivedItems) {
      return NextResponse.json(
        { error: 'Cannot close purchase order with no items received. Create a GRN first or cancel the PO.' },
        { status: 400 }
      )
    }

    // Calculate actual amount based on received quantities
    let actualAmount = 0
    const itemDetails: any[] = []

    for (const item of purchase.items) {
      const orderedQty = parseFloat(item.quantity.toString())
      const receivedQty = parseFloat(item.quantityReceived.toString())
      const unitCost = parseFloat(item.unitCost.toString())
      const itemTotal = receivedQty * unitCost

      actualAmount += itemTotal

      itemDetails.push({
        productId: item.productId,
        variationId: item.productVariationId,
        ordered: orderedQty,
        received: receivedQty,
        unitCost: unitCost,
        lineTotal: itemTotal,
      })
    }

    // Apply proportional tax, discount, and shipping based on received vs ordered ratio
    const originalTotal = parseFloat(purchase.totalAmount.toString())
    const originalSubtotal = parseFloat(purchase.subtotal.toString())
    const proportionReceived = originalSubtotal > 0 ? actualAmount / originalSubtotal : 0

    const proportionalTax = parseFloat(purchase.taxAmount.toString()) * proportionReceived
    const proportionalDiscount = parseFloat(purchase.discountAmount.toString()) * proportionReceived
    const proportionalShipping = parseFloat(purchase.shippingCost.toString()) * proportionReceived

    const finalAmount = actualAmount + proportionalTax - proportionalDiscount + proportionalShipping

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update purchase status to 'received' (closed)
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          status: 'received', // Mark as closed/complete
          // Update totals to reflect actual received amounts
          subtotal: actualAmount,
          taxAmount: proportionalTax,
          discountAmount: proportionalDiscount,
          shippingCost: proportionalShipping,
          totalAmount: finalAmount,
          notes: purchase.notes
            ? `${purchase.notes}\n\n[CLOSED] ${reason || 'Manually closed - partial delivery accepted'}`
            : `[CLOSED] ${reason || 'Manually closed - partial delivery accepted'}`,
        },
      })

      // 2. Check if AP entry already exists
      const existingAP = await tx.accountsPayable.findFirst({
        where: {
          purchaseId: purchaseId,
          deletedAt: null,
        },
      })

      let accountsPayable = existingAP

      if (!existingAP) {
        // 3. Create Accounts Payable entry for actual received amount
        const paymentTermsDays = purchase.supplier.paymentTerms || 30
        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + paymentTermsDays)

        accountsPayable = await tx.accountsPayable.create({
          data: {
            businessId: parseInt(businessId),
            purchaseId: purchaseId,
            supplierId: purchase.supplierId,
            invoiceNumber: purchase.purchaseOrderNumber,
            invoiceDate: new Date(),
            dueDate: dueDate,
            totalAmount: finalAmount,
            paidAmount: 0,
            balanceAmount: finalAmount,
            paymentStatus: 'unpaid',
            notes: `Created via manual PO closure - Partial delivery (${Math.round(proportionReceived * 100)}% received)`,
          },
        })
      } else {
        // Update existing AP entry with adjusted amount
        accountsPayable = await tx.accountsPayable.update({
          where: { id: existingAP.id },
          data: {
            totalAmount: finalAmount,
            balanceAmount: finalAmount - parseFloat(existingAP.paidAmount.toString()),
            notes: existingAP.notes
              ? `${existingAP.notes}\n\n[ADJUSTED] PO manually closed - amount adjusted to received quantities`
              : `[ADJUSTED] PO manually closed - amount adjusted to received quantities`,
          },
        })
      }

      return { purchase: updatedPurchase, accountsPayable }
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: AuditAction.UPDATE,
      entityType: EntityType.PURCHASE,
      entityId: purchaseId,
      description: `Manually closed Purchase Order ${purchase.purchaseOrderNumber} with partial delivery`,
      metadata: {
        purchaseOrderNumber: purchase.purchaseOrderNumber,
        originalAmount: originalTotal,
        finalAmount: finalAmount,
        proportionReceived: Math.round(proportionReceived * 100),
        reason: reason || 'Manual closure',
        itemDetails,
        apCreated: !existingAP,
        apInvoiceNumber: result.accountsPayable.invoiceNumber,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: true,
      message: 'Purchase order closed successfully',
      data: {
        purchaseOrderNumber: purchase.purchaseOrderNumber,
        status: 'received',
        originalAmount: originalTotal,
        finalAmount: finalAmount,
        proportionReceived: `${Math.round(proportionReceived * 100)}%`,
        accountsPayableCreated: !existingAP,
        accountsPayableId: result.accountsPayable.id,
        invoiceNumber: result.accountsPayable.invoiceNumber,
      },
    })
  } catch (error) {
    console.error('Error closing purchase order:', error)
    return NextResponse.json(
      {
        error: 'Failed to close purchase order',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
