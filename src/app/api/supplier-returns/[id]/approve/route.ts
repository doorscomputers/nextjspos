import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/supplier-returns/[id]/approve
 * Approve supplier return
 *
 * CRITICAL: This deducts stock when returning goods to supplier!
 * - Removes quantity from stock
 * - Creates negative stock transaction
 * - Updates serial numbers to 'supplier_return' status
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

    // Get return with all items
    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: {
        id: parseInt(returnId),
        businessId: parseInt(businessId),
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

    // CRITICAL: Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // For each item, deduct stock
      for (const item of supplierReturn.items) {
        const productId = item.productId
        const variationId = item.productVariationId
        const quantity = parseFloat(item.quantity.toString())

        // Get current stock at return location
        const currentStock = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: variationId,
              locationId: supplierReturn.locationId,
            },
          },
        })

        if (!currentStock) {
          throw new Error(`No stock found for product variation ${variationId} at this location`)
        }

        const currentQty = parseFloat(currentStock.qtyAvailable.toString())

        if (currentQty < quantity) {
          throw new Error(
            `Insufficient stock for product ${productId}. Available: ${currentQty}, Trying to return: ${quantity}`
          )
        }

        const newQty = currentQty - quantity

        // Update existing stock (SUBTRACT quantity)
        await tx.variationLocationDetails.update({
          where: { id: currentStock.id },
          data: {
            qtyAvailable: newQty,
            updatedAt: new Date(),
          },
        })

        // Create stock transaction (negative = deduction)
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId,
            productVariationId: variationId,
            locationId: supplierReturn.locationId,
            type: 'supplier_return',
            quantity: -quantity, // NEGATIVE for stock deduction
            balanceQty: 0,
            referenceType: 'supplier_return',
            referenceId: supplierReturn.id,
            createdBy: parseInt(userId),
            notes: `Supplier return ${supplierReturn.returnNumber} approved - ${item.condition}`,
          },
        })

        // Handle serial numbers if present
        if (item.serialNumbers) {
          const serialIds = item.serialNumbers as any[]

          if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
            for (const serialData of serialIds) {
              const serialId = typeof serialData === 'object' ? serialData.id : serialData

              // Update serial number status
              await tx.productSerialNumber.updateMany({
                where: {
                  id: parseInt(serialId),
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
                  serialNumberId: parseInt(serialId),
                  movementType: 'supplier_return',
                  fromLocationId: supplierReturn.locationId,
                  referenceType: 'supplier_return',
                  referenceId: supplierReturn.id,
                  movedBy: parseInt(userId),
                  notes: `Supplier return ${supplierReturn.returnNumber} - ${item.condition}`,
                },
              })
            }
          }
        }
      }

      // Update return status to approved
      const updatedReturn = await tx.supplierReturn.update({
        where: { id: supplierReturn.id },
        data: {
          status: 'approved',
        },
      })

      return updatedReturn
    }, {
      timeout: 30000,
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'supplier_return_approve' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [supplierReturn.id],
      description: `Approved Supplier Return ${supplierReturn.returnNumber}`,
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
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: 'Supplier return approved - stock deducted',
      return: result,
    })
  } catch (error: any) {
    console.error('Error approving supplier return:', error)
    return NextResponse.json(
      { error: 'Failed to approve supplier return', details: error.message },
      { status: 500 }
    )
  }
}
