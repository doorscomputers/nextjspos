import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * GET /api/sales/[id]
 * Get a single sale by ID with all related data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user } = session
    const businessId = user.businessId
    const userId = user.id

    // Check permissions
    const canViewOwn = user.permissions?.includes(PERMISSIONS.SELL_VIEW_OWN)
    const canViewAll = user.permissions?.includes(PERMISSIONS.SELL_VIEW)

    if (!canViewOwn && !canViewAll) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const saleId = parseInt(id)

    // Build query with permission-based filtering
    const whereClause: any = {
      id: saleId,
      businessId: parseInt(businessId),
    }

    // If user can only view own sales, add createdBy filter
    if (canViewOwn && !canViewAll) {
      whereClause.createdBy = parseInt(userId)
    }

    const sale = await prisma.sale.findFirst({
      where: whereClause,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        items: true,
        payments: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    return NextResponse.json(sale)
  } catch (error: any) {
    console.error('Error fetching sale:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sale', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/sales/[id]
 * Void a sale and restore stock
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { user } = session
    const businessId = user.businessId
    const userId = user.id

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.SELL_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const saleId = parseInt(id)

    // Fetch the sale with all its details
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId: parseInt(businessId),
      },
      include: {
        items: true,
        payments: true,
      },
    })

    if (!sale) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 })
    }

    if (sale.status === 'voided') {
      return NextResponse.json(
        { error: 'Sale is already voided' },
        { status: 400 }
      )
    }

    // Void sale and restore stock in transaction
    await prisma.$transaction(async (tx) => {
      // Update sale status to voided
      await tx.sale.update({
        where: { id: saleId },
        data: {
          status: 'voided',
        },
      })

      // Restore stock for each item
      for (const item of sale.items) {
        // Get current stock
        const currentStock = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: item.productVariationId,
              locationId: sale.locationId,
            },
          },
        })

        if (!currentStock) {
          throw new Error(`Stock record not found for variation ${item.productVariationId}`)
        }

        const newQty = parseFloat(currentStock.qtyAvailable.toString()) + parseFloat(item.quantity.toString())

        // Update stock
        await tx.variationLocationDetails.update({
          where: {
            productVariationId_locationId: {
              productVariationId: item.productVariationId,
              locationId: sale.locationId,
            },
          },
          data: {
            qtyAvailable: newQty,
          },
        })

        // Create stock transaction for restoration
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: sale.locationId,
            type: 'sale_void',
            quantity: parseFloat(item.quantity.toString()), // Positive for restoration
            unitCost: 0,
            balanceQty: newQty,
            referenceType: 'sale',
            referenceId: sale.id,
            createdBy: parseInt(userId),
            notes: `Voided Sale ${sale.invoiceNumber}`,
          },
        })

        // Restore serial numbers if item has them
        if (item.serialNumbers) {
          const serialNumbersData = item.serialNumbers as any
          if (Array.isArray(serialNumbersData)) {
            for (const snData of serialNumbersData) {
              // Update serial number status back to in_stock
              const serialNumber = await tx.productSerialNumber.update({
                where: { id: snData.id },
                data: {
                  status: 'in_stock',
                  saleId: null,
                  soldAt: null,
                  soldTo: null,
                },
              })

              // Create movement record for restoration
              await tx.serialNumberMovement.create({
                data: {
                  serialNumberId: serialNumber.id,
                  movementType: 'sale_void',
                  toLocationId: sale.locationId,
                  referenceType: 'sale',
                  referenceId: sale.id,
                  movedBy: parseInt(userId),
                  notes: `Restored from voided Sale ${sale.invoiceNumber}`,
                },
              })
            }
          }
        }
      }
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'sale_delete' as AuditAction,
      entityType: EntityType.SALE,
      entityIds: [sale.id],
      description: `Voided Sale ${sale.invoiceNumber}`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
    })

    return NextResponse.json({
      message: 'Sale voided successfully and stock restored',
      sale: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        status: 'voided',
      },
    })
  } catch (error: any) {
    console.error('Error voiding sale:', error)
    return NextResponse.json(
      { error: 'Failed to void sale', details: error.message },
      { status: 500 }
    )
  }
}
