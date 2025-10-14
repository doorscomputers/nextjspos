import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * GET /api/purchases/[id]/amendments
 * List all amendments for a specific purchase order
 */
export async function GET(
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_AMENDMENT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const purchaseId = parseInt(id)

    // Verify purchase exists and belongs to user's business
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: parseInt(businessId),
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Fetch all amendments for this purchase
    const amendments = await prisma.purchaseAmendment.findMany({
      where: {
        purchaseId,
        businessId: parseInt(businessId),
      },
      orderBy: {
        amendmentNumber: 'desc',
      },
      include: {
        purchase: {
          select: {
            referenceNo: true,
            supplier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: amendments,
    })
  } catch (error: any) {
    console.error('Error fetching purchase amendments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch amendments', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/purchases/[id]/amendments
 * Create a new amendment request for a purchase order
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

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_AMENDMENT_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const purchaseId = parseInt(id)
    const body = await request.json()
    const {
      amendmentReason,
      description,
      notes,
      changedFields,
      newSubtotal,
      newTaxAmount,
      newTotalAmount,
    } = body

    // Validation
    if (!amendmentReason || !changedFields || Object.keys(changedFields).length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: amendmentReason and changedFields are required' },
        { status: 400 }
      )
    }

    // Fetch the original purchase with full details
    const purchase = await prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        businessId: parseInt(businessId),
      },
      include: {
        supplier: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
            productVariation: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    if (!purchase) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 })
    }

    // Can only amend approved purchases
    if (purchase.status !== 'approved') {
      return NextResponse.json(
        { error: 'Can only create amendments for approved purchase orders' },
        { status: 400 }
      )
    }

    // Create snapshot of current purchase data
    const previousData = {
      referenceNo: purchase.referenceNo,
      purchaseDate: purchase.purchaseDate,
      supplierId: purchase.supplierId,
      locationId: purchase.locationId,
      subtotal: purchase.subtotal,
      taxAmount: purchase.taxAmount,
      discountAmount: purchase.discountAmount,
      shippingCharges: purchase.shippingCharges,
      totalAmount: purchase.totalAmount,
      paymentTerms: purchase.paymentTerms,
      deliveryDate: purchase.deliveryDate,
      notes: purchase.notes,
      items: purchase.items.map(item => ({
        productId: item.productId,
        productVariationId: item.productVariationId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        taxRate: item.taxRate,
        discountRate: item.discountRate,
        total: item.total,
      })),
    }

    // Generate amendment number
    const nextAmendmentNumber = purchase.amendmentCount + 1

    // Create amendment in transaction
    const amendment = await prisma.$transaction(async (tx) => {
      const newAmendment = await tx.purchaseAmendment.create({
        data: {
          purchaseId,
          businessId: parseInt(businessId),
          amendmentNumber: nextAmendmentNumber,
          amendmentDate: new Date(),
          status: 'pending',
          amendmentReason,
          previousData,
          changedFields,
          newSubtotal: newSubtotal ? parseFloat(newSubtotal) : null,
          newTaxAmount: newTaxAmount ? parseFloat(newTaxAmount) : null,
          newTotalAmount: newTotalAmount ? parseFloat(newTotalAmount) : null,
          description,
          notes,
          requestedBy: parseInt(userId),
        },
      })

      // Update purchase amendment counter
      await tx.purchase.update({
        where: { id: purchaseId },
        data: {
          amendmentCount: nextAmendmentNumber,
        },
      })

      return newAmendment
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_amendment_create' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [amendment.id],
      description: `Created Amendment #${nextAmendmentNumber} for PO ${purchase.referenceNo}`,
      metadata: {
        amendmentId: amendment.id,
        amendmentNumber: nextAmendmentNumber,
        purchaseId: purchase.id,
        referenceNo: purchase.referenceNo,
        supplierId: purchase.supplierId,
        supplierName: purchase.supplier.name,
        amendmentReason,
        changedFieldsCount: Object.keys(changedFields).length,
        changedFieldNames: Object.keys(changedFields),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // Fetch complete amendment with relations
    const completeAmendment = await prisma.purchaseAmendment.findUnique({
      where: { id: amendment.id },
      include: {
        purchase: {
          include: {
            supplier: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        success: true,
        message: 'Purchase amendment created successfully',
        data: completeAmendment,
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Error creating purchase amendment:', error)
    return NextResponse.json(
      { error: 'Failed to create purchase amendment', details: error.message },
      { status: 500 }
    )
  }
}
