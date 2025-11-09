import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { processPurchaseReceipt } from '@/lib/stockOperations'
import { SerialNumberCondition } from '@/lib/serialNumber'
import { withIdempotency } from '@/lib/idempotency'
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker'
import { isAccountingEnabled, recordPurchase } from '@/lib/accountingIntegration'

/**
 * POST /api/purchases/receipts/[id]/approve
 * Approve a pending purchase receipt and add inventory
 * This implements the second step of the two-step approval workflow
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: receiptId } = await params
  return withIdempotency(request, `/api/purchases/receipts/${receiptId}/approve`, async () => {
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
    const receiptIdNumber = Number(receiptId)

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
        id: receiptIdNumber,
        businessId: businessIdNumber,
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
      const userLocationIds = user.locationIds || []

      if (!userLocationIds.includes(receipt.locationId)) {
        return NextResponse.json(
          { error: 'You do not have access to this location' },
          { status: 403 }
        )
      }
    }

    // TRANSACTION IMPACT TRACKING: Step 1 - Capture inventory BEFORE transaction
    const impactTracker = new InventoryImpactTracker()
    const productVariationIds = receipt.items.map(item => item.productVariationId)
    const locationIds = [receipt.locationId]
    await impactTracker.captureBefore(productVariationIds, locationIds)

    // Approve receipt and add inventory in transaction
    const updatedReceipt = await prisma.$transaction(async (tx) => {
      // CRITICAL FIX: Check for duplicate serial numbers INSIDE transaction to prevent race conditions
      // Collect all serial numbers first
      const allSerialNumbers: string[] = []
      for (const item of receipt.items) {
        const purchaseItem = receipt.purchase.items.find((pi) => pi.id === item.purchaseItemId)
        if (purchaseItem?.requiresSerial && item.serialNumbers) {
          const serialsArray = (item.serialNumbers as any[]).map((sn: any) => sn.serialNumber)
          allSerialNumbers.push(...serialsArray)
        }
      }

      // Batch check for existing serials (single query instead of N queries)
      if (allSerialNumbers.length > 0) {
        const existingSerials = await tx.productSerialNumber.findMany({
          where: {
            businessId: businessIdNumber,
            serialNumber: { in: allSerialNumbers }
          },
          select: { serialNumber: true }
        })

        if (existingSerials.length > 0) {
          const duplicates = existingSerials.map(s => s.serialNumber).join(', ')
          throw new Error(`Serial number(s) already exist in the system: ${duplicates}`)
        }
      }

      // Process each receipt item - add stock, serial numbers, update costs
      for (const item of receipt.items) {
        const purchaseItem = receipt.purchase.items.find((pi) => pi.id === item.purchaseItemId)

        if (!purchaseItem) {
          throw new Error(`Purchase item ${item.purchaseItemId} not found`)
        }

        const quantity = parseFloat(item.quantityReceived.toString())

        const unitCost = parseFloat(purchaseItem.unitCost.toString())

        // Get product variation with warranty info FIRST (needed for serial numbers)
        const productVariation = await tx.productVariation.findUnique({
          where: { id: item.productVariationId },
          select: {
            purchasePrice: true,
            warrantyId: true,
            warranty: {
              select: {
                duration: true,
                durationType: true,
              },
            },
          },
        })

        // Calculate warranty dates based on product warranty configuration
        let warrantyStartDate: Date | null = null
        let warrantyEndDate: Date | null = null

        if (productVariation?.warranty) {
          warrantyStartDate = new Date(receipt.receiptDate)
          const endDate = new Date(receipt.receiptDate)

          // Calculate end date based on duration type
          if (productVariation.warranty.durationType === 'months') {
            endDate.setMonth(endDate.getMonth() + productVariation.warranty.duration)
          } else if (productVariation.warranty.durationType === 'years') {
            endDate.setFullYear(endDate.getFullYear() + productVariation.warranty.duration)
          } else if (productVariation.warranty.durationType === 'days') {
            endDate.setDate(endDate.getDate() + productVariation.warranty.duration)
          }

          warrantyEndDate = endDate
        }

        if (quantity > 0) {
          await processPurchaseReceipt({
            businessId: businessIdNumber,
            productId: item.productId,
            productVariationId: item.productVariationId,
            locationId: receipt.locationId,
            quantity,
            unitCost,
            purchaseId: receipt.purchaseId,
            receiptId: receipt.id,
            userId: userIdNumber,
            userDisplayName,
            subUnitId: purchaseItem.subUnitId || undefined, // UOM support
            tx,
          })
        }

        // Create serial number records if required
        if (purchaseItem.requiresSerial && item.serialNumbers) {
          const serialNumbersArray = item.serialNumbers as any[]

          for (const sn of serialNumbersArray) {
            // Create or update serial number record with supplier tracking
            const serialNumberRecord = await tx.productSerialNumber.upsert({
              where: {
                businessId_serialNumber: {
                  businessId: businessIdNumber,
                  serialNumber: sn.serialNumber,
                },
              },
              update: {
                // Update if exists (in case of retry)
                status: 'in_stock',
                condition: (sn.condition as SerialNumberCondition) || SerialNumberCondition.NEW,
                currentLocationId: receipt.locationId,
                supplierId: receipt.supplierId,
                purchaseId: receipt.purchaseId,
                purchaseReceiptId: receipt.id,
                purchasedAt: receipt.receiptDate,
                purchaseCost: parseFloat(purchaseItem.unitCost.toString()),
                // Auto-set warranty dates based on product warranty configuration
                warrantyStartDate: warrantyStartDate,
                warrantyEndDate: warrantyEndDate,
              },
              create: {
                businessId: businessIdNumber,
                productId: item.productId,
                productVariationId: item.productVariationId,
                serialNumber: sn.serialNumber,
                imei: sn.imei || null,
                status: 'in_stock',
                condition: (sn.condition as SerialNumberCondition) || SerialNumberCondition.NEW,
                currentLocationId: receipt.locationId,
                // CRITICAL: Link serial number to supplier for warranty tracking
                supplierId: receipt.supplierId,
                purchaseId: receipt.purchaseId,
                purchaseReceiptId: receipt.id,
                purchasedAt: receipt.receiptDate,
                purchaseCost: parseFloat(purchaseItem.unitCost.toString()),
                // Auto-set warranty dates based on product warranty configuration
                warrantyStartDate: warrantyStartDate,
                warrantyEndDate: warrantyEndDate,
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
                movedBy: userIdNumber,
                notes: `Approved via ${receipt.receiptNumber}`,
              },
            })
          }
        }

        // Update product variation purchase price (weighted average costing)
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

          // Update product variation purchase price and last purchase info
          await tx.productVariation.update({
            where: { id: item.productVariationId },
            data: {
              purchasePrice: weightedAverageCost,
              // Track last purchase information for supplier analysis
              supplierId: receipt.purchase.supplierId,
              lastPurchaseDate: receipt.receiptDate,
              lastPurchaseCost: newItemCost,
              lastPurchaseQuantity: newItemQty,
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
          approvedBy: userIdNumber,
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
              businessId: businessIdNumber,
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
      timeout: 120000, // 2 minutes timeout for slow internet connections
      maxWait: 10000,  // Wait up to 10 seconds to acquire transaction lock
    })

    // TRANSACTION IMPACT TRACKING: Step 2 - Capture inventory AFTER and generate report
    const inventoryImpact = await impactTracker.captureAfterAndReport(
      productVariationIds,
      locationIds,
      'purchase',
      updatedReceipt.id,
      receipt.receiptNumber,
      undefined, // No location types needed for single-location purchases
      userDisplayName
    )

    // ACCOUNTING INTEGRATION: Create journal entries if accounting is enabled
    if (await isAccountingEnabled(businessIdNumber)) {
      try {
        // Calculate total cost from purchase items
        const totalCost = receipt.purchase.items.reduce(
          (sum, item) => sum + (parseFloat(item.unitCost.toString()) * parseFloat(item.quantity.toString())),
          0
        )

        await recordPurchase({
          businessId: businessIdNumber,
          userId: userIdNumber,
          purchaseId: receipt.purchaseId,
          purchaseDate: receipt.receiptDate,
          totalCost,
          referenceNumber: receipt.purchase.purchaseOrderNumber,
          supplierId: receipt.purchase.supplierId
        })
      } catch (accountingError) {
        // Log accounting errors but don't fail the purchase receipt approval
        console.error('Accounting integration error:', accountingError)
      }
    }

    // Create audit log
    await createAuditLog({
      businessId: businessIdNumber,
      userId: userIdNumber,
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
        approvedBy: userIdNumber,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // AUTO-REFRESH: Update stock materialized view so inventory reports show changes immediately
    try {
      console.log('[Purchase Approval] Refreshing stock materialized view...')
      const refreshStart = Date.now()
      await prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`
      const refreshDuration = Date.now() - refreshStart
      console.log(`[Purchase Approval] Stock view refreshed in ${refreshDuration}ms`)
    } catch (refreshError) {
      // Log but don't fail the approval if refresh fails
      console.error('[Purchase Approval] Failed to refresh stock view:', refreshError)
    }

    // Return with inventory impact report
    return NextResponse.json({
      ...updatedReceipt,
      inventoryImpact
    })
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
  }) // Close idempotency wrapper
}
