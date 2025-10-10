import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { SerialNumberCondition } from '@/lib/serialNumber'

/**
 * POST /api/purchases/receipts/[id]/approve
 * Approve a pending purchase receipt and add inventory
 * This implements the second step of the two-step approval workflow
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
    const { id: receiptId } = await params

    // Check permission - user must have approval permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RECEIPT_APPROVE)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires PURCHASE_RECEIPT_APPROVE permission' },
        { status: 403 }
      )
    }

    // Fetch receipt with all details
    const receipt = await prisma.purchaseReceipt.findFirst({
      where: {
        id: parseInt(receiptId),
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          include: {
            supplier: true,
            items: true,
          },
        },
        items: {
          include: {
            purchaseItem: true,
          },
        },
      },
    })

    if (!receipt) {
      return NextResponse.json(
        { error: 'Purchase receipt not found' },
        { status: 404 }
      )
    }

    // Check if already approved
    if (receipt.status === 'approved') {
      return NextResponse.json(
        { error: 'This receipt has already been approved and cannot be modified' },
        { status: 400 }
      )
    }

    // Check if rejected
    if (receipt.status === 'rejected') {
      return NextResponse.json(
        { error: 'This receipt has been rejected and cannot be approved' },
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
            locationId: receipt.locationId,
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

    // Check for duplicate serial numbers before approval
    for (const item of receipt.items) {
      const purchaseItem = receipt.purchase.items.find((pi) => pi.id === item.purchaseItemId)

      if (purchaseItem?.requiresSerial && item.serialNumbers) {
        const serialNumbersInReceipt = (item.serialNumbers as any[]).map((sn: any) => sn.serialNumber)

        for (const serialNumber of serialNumbersInReceipt) {
          const existing = await prisma.productSerialNumber.findUnique({
            where: {
              businessId_serialNumber: {
                businessId: parseInt(businessId),
                serialNumber: serialNumber,
              },
            },
          })

          if (existing) {
            return NextResponse.json(
              { error: `Serial number ${serialNumber} already exists in the system` },
              { status: 400 }
            )
          }
        }
      }
    }

    // Approve receipt and add inventory in transaction
    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // Process each receipt item - add stock, serial numbers, update costs
      for (const item of receipt.items) {
        const purchaseItem = receipt.purchase.items.find((pi) => pi.id === item.purchaseItemId)

        if (!purchaseItem) {
          throw new Error(`Purchase item ${item.purchaseItemId} not found`)
        }

        const quantity = parseFloat(item.quantityReceived.toString())

        // Get current stock before creating transaction
        const currentStock = await tx.variationLocationDetails.findUnique({
          where: {
            productVariationId_locationId: {
              productVariationId: item.productVariationId,
              locationId: receipt.locationId,
            },
          },
        })

        const newQty = currentStock
          ? parseFloat(currentStock.qtyAvailable.toString()) + quantity
          : quantity

        // Create stock transaction with correct balance
        await tx.stockTransaction.create({
          data: {
            businessId: parseInt(businessId),
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: receipt.locationId,
            type: 'purchase',
            quantity: quantity,
            unitCost: parseFloat(purchaseItem.unitCost.toString()),
            balanceQty: newQty, // Running balance after this transaction
            referenceType: 'purchase',
            referenceId: receipt.id,
            createdBy: parseInt(userId),
            notes: `Approved GRN ${receipt.receiptNumber} - PO ${receipt.purchase.purchaseOrderNumber}`,
          },
        })

        await tx.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: item.productVariationId,
              locationId: receipt.locationId,
            },
          },
          update: {
            qtyAvailable: newQty,
          },
          create: {
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: receipt.locationId,
            qtyAvailable: newQty,
          },
        })

        // Create serial number records if required
        if (purchaseItem.requiresSerial && item.serialNumbers) {
          const serialNumbersArray = item.serialNumbers as any[]

          for (const sn of serialNumbersArray) {
            // Create serial number record
            const serialNumberRecord = await tx.productSerialNumber.create({
              data: {
                businessId: parseInt(businessId),
                productId: item.productId,
                productVariationId: item.productVariationId,
                serialNumber: sn.serialNumber,
                imei: sn.imei || null,
                status: 'in_stock',
                condition: (sn.condition as SerialNumberCondition) || SerialNumberCondition.NEW,
                currentLocationId: receipt.locationId,
                purchaseId: receipt.purchaseId,
                purchaseReceiptId: receipt.id,
                purchasedAt: receipt.receiptDate,
                purchaseCost: parseFloat(purchaseItem.unitCost.toString()),
              },
            })

            // Create movement record
            await tx.serialNumberMovement.create({
              data: {
                serialNumberId: serialNumberRecord.id,
                movementType: 'purchase',
                toLocationId: receipt.locationId,
                referenceType: 'purchase',
                referenceId: receipt.id,
                movedBy: parseInt(userId),
                notes: `Approved via ${receipt.receiptNumber}`,
              },
            })
          }
        }

        // Update product variation purchase price (weighted average costing)
        const productVariation = await tx.productVariation.findUnique({
          where: { id: item.productVariationId },
          select: {
            purchasePrice: true,
          },
        })

        if (productVariation) {
          // Get current total stock across all locations
          const stockAcrossLocations = await tx.variationLocationDetails.findMany({
            where: {
              productVariationId: item.productVariationId,
            },
            select: {
              qtyAvailable: true,
            },
          })

          const currentTotalStock = stockAcrossLocations.reduce(
            (sum, stock) => sum + parseFloat(stock.qtyAvailable.toString()),
            0
          )

          const currentCost = parseFloat(productVariation.purchasePrice.toString())
          const newItemCost = parseFloat(purchaseItem.unitCost.toString())
          const newItemQty = quantity

          // Previous total stock (before adding new items)
          const previousTotalStock = currentTotalStock - newItemQty

          // Calculate weighted average cost
          let weightedAverageCost: number
          if (previousTotalStock <= 0) {
            // No previous stock, use new item cost
            weightedAverageCost = newItemCost
          } else {
            // Weighted average: (old qty * old cost + new qty * new cost) / total qty
            weightedAverageCost =
              (previousTotalStock * currentCost + newItemQty * newItemCost) / currentTotalStock
          }

          // Update product variation purchase price
          await tx.productVariation.update({
            where: { id: item.productVariationId },
            data: {
              purchasePrice: weightedAverageCost,
            },
          })
        }

        // Update purchase item quantity received
        await tx.purchaseItem.update({
          where: { id: item.purchaseItemId },
          data: {
            quantityReceived: {
              increment: quantity,
            },
          },
        })
      }

      // Update purchase status based on all items
      const allItemsReceived = await Promise.all(
        receipt.purchase.items.map(async (item) => {
          const updated = await tx.purchaseItem.findUnique({
            where: { id: item.id },
          })
          return (
            updated &&
            parseFloat(updated.quantityReceived.toString()) >= parseFloat(item.quantity.toString())
          )
        })
      )

      const newPurchaseStatus = allItemsReceived.every(Boolean) ? 'received' : 'partially_received'

      await tx.purchase.update({
        where: { id: receipt.purchaseId },
        data: { status: newPurchaseStatus },
      })

      // Update receipt status to approved
      const approved = await tx.purchaseReceipt.update({
        where: { id: receipt.id },
        data: {
          status: 'approved',
          approvedBy: parseInt(userId),
          approvedAt: new Date(),
        },
        include: {
          purchase: {
            include: {
              supplier: true,
            },
          },
          items: {
            include: {
              purchaseItem: true,
            },
          },
        },
      })

      // Auto-create Accounts Payable entry when purchase is fully received
      if (newPurchaseStatus === 'received') {
        // Check if AP already exists for this purchase
        const existingAP = await tx.accountsPayable.findFirst({
          where: {
            purchaseId: receipt.purchaseId,
            deletedAt: null,
          },
        })

        if (!existingAP) {
          // Get supplier payment terms for due date calculation
          const supplier = await tx.supplier.findUnique({
            where: { id: receipt.purchase.supplierId },
            select: { paymentTerms: true },
          })

          const paymentTermsDays = supplier?.paymentTerms || 30 // Default 30 days
          const dueDate = new Date(receipt.receiptDate)
          dueDate.setDate(dueDate.getDate() + paymentTermsDays)

          // Create accounts payable entry
          await tx.accountsPayable.create({
            data: {
              businessId: parseInt(businessId),
              purchaseId: receipt.purchaseId,
              supplierId: receipt.purchase.supplierId,
              invoiceNumber: receipt.purchase.purchaseOrderNumber, // Use PO number as default, can be updated later
              invoiceDate: receipt.receiptDate,
              dueDate: dueDate,
              totalAmount: receipt.purchase.totalAmount,
              paidAmount: 0,
              balanceAmount: receipt.purchase.totalAmount,
              discountAmount: 0,
              paymentStatus: 'unpaid',
              paymentTerms: paymentTermsDays,
              notes: `Auto-created for ${receipt.purchase.purchaseOrderNumber}`,
            },
          })
        }
      }

      return approved
    }, {
      timeout: 30000, // 30 seconds timeout
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'purchase_receipt_approve' as AuditAction,
      entityType: EntityType.PURCHASE,
      entityIds: [updatedReceipt.id],
      description: `Approved GRN ${receipt.receiptNumber} for PO ${receipt.purchase.purchaseOrderNumber}`,
      metadata: {
        receiptId: updatedReceipt.id,
        grnNumber: receipt.receiptNumber,
        purchaseId: receipt.purchaseId,
        poNumber: receipt.purchase.purchaseOrderNumber,
        supplierId: receipt.purchase.supplierId,
        supplierName: receipt.purchase.supplier.name,
        locationId: receipt.locationId,
        itemCount: receipt.items.length,
        totalQuantityReceived: receipt.items.reduce(
          (sum, item) => sum + parseFloat(item.quantityReceived.toString()),
          0
        ),
        receivedBy: receipt.receivedBy,
        approvedBy: parseInt(userId),
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json(updatedReceipt)
  } catch (error: any) {
    console.error('Error approving purchase receipt:', error)
    return NextResponse.json(
      {
        error: 'Failed to approve purchase receipt',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
