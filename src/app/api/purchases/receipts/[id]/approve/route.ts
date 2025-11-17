/**
 * ============================================================================
 * PURCHASE RECEIPT APPROVAL API (src/app/api/purchases/receipts/[id]/approve/route.ts)
 * ============================================================================
 *
 * PURPOSE: Approves a pending GRN (Goods Received Note) and ADDS inventory to stock
 *
 * CRITICAL: THIS IS WHERE INVENTORY IS ACTUALLY ADDED TO THE SYSTEM!
 *
 * TWO-STEP PURCHASE WORKFLOW:
 *
 * STEP 1 - CREATE GRN (Purchase Receipt):
 *   - Encoder records what goods were physically received
 *   - Creates GRN with status = "pending"
 *   - Inventory is NOT added yet
 *   - Allows reviewing before affecting stock
 *   - See: /api/purchases/[id]/receive/route.ts
 *
 * STEP 2 - APPROVE GRN (THIS FILE):
 *   - Approver reviews the GRN
 *   - If approved: Inventory is ADDED to stock
 *   - Updates VariationLocationDetails.qtyAvailable (INCREASES quantity)
 *   - Creates stock transaction records
 *   - Updates product costs (weighted average)
 *   - Records serial numbers (if applicable)
 *   - Creates accounts payable entry
 *   - Cannot be undone (use Purchase Returns instead)
 *
 * WHY TWO-STEP WORKFLOW?
 * - Separation of duties (encoder vs approver)
 * - Prevents inventory manipulation
 * - Allows for quality checks before adding stock
 * - Audit trail of who received vs who approved
 * - Matches accounting best practices
 *
 * WHAT HAPPENS WHEN GRN IS APPROVED:
 *
 * 1. INVENTORY ADDITION (CRITICAL):
 *    - Calls processPurchaseReceipt() for each item
 *    - Updates VariationLocationDetails.qtyAvailable
 *    - Formula: qtyAvailable = qtyAvailable + quantityReceived
 *    - Example: Current stock 10 + Received 5 = New stock 15
 *    - Creates StockTransaction record (type: 'purchase')
 *    - Creates ProductHistory record for audit trail
 *
 * 2. SERIAL NUMBER TRACKING (if applicable):
 *    - Creates ProductSerialNumber records
 *    - Links serial numbers to supplier
 *    - Sets warranty start/end dates
 *    - Tracks purchase cost per unit
 *    - Records initial location
 *    - Creates movement history
 *
 * 3. COST ACCOUNTING (Weighted Average):
 *    - Updates ProductVariation.purchasePrice
 *    - Formula: (oldQty × oldCost + newQty × newCost) / totalQty
 *    - Example:
 *      * Current stock: 10 units @ $50 = $500
 *      * New receipt: 5 units @ $60 = $300
 *      * New average: ($500 + $300) / 15 = $53.33
 *    - Ensures accurate profit margins
 *    - Affects COGS calculations in reports
 *
 * 4. ACCOUNTS PAYABLE (if fully received):
 *    - Creates AccountsPayable entry
 *    - Links to supplier and purchase order
 *    - Sets due date based on payment terms
 *    - Status: "unpaid"
 *    - Amount: Purchase total amount
 *    - Auto-created only on final receipt
 *
 * 5. PURCHASE ORDER STATUS UPDATE:
 *    - Checks if all items fully received
 *    - If yes: Status = "received"
 *    - If partially: Status = "partially_received"
 *    - If pending: Status = "pending" (no change)
 *
 * 6. MATERIALIZED VIEW REFRESH:
 *    - Refreshes stock_pivot_view
 *    - Ensures reports show updated inventory immediately
 *    - Runs asynchronously (doesn't block response)
 *
 * 7. INVENTORY IMPACT TRACKING:
 *    - Captures stock levels before and after
 *    - Generates detailed change report
 *    - Shows exact quantity changes per location
 *    - Used for audit and reconciliation
 *
 * EXAMPLE SCENARIO:
 *
 * Initial State:
 * - Product: "Laptop" (variation: "15-inch")
 * - Main Warehouse: 10 units @ $500 each
 * - Purchase Order: 5 units @ $480 each from Supplier A
 * - GRN created (status: pending)
 *
 * User Action:
 * - Manager approves GRN
 *
 * This API Executes:
 * 1. Validates GRN is pending (not already approved)
 * 2. Checks user has PURCHASE_RECEIPT_APPROVE permission
 * 3. Calls processPurchaseReceipt():
 *    - Main Warehouse: 10 → 15 units (+5)
 *    - Creates StockTransaction: type=purchase, qty=+5
 *    - Creates ProductHistory: PURCHASE_RECEIPT, qty=5
 * 4. Updates weighted average cost:
 *    - Old: 10 units @ $500 = $5,000
 *    - New: 5 units @ $480 = $2,400
 *    - Average: ($5,000 + $2,400) / 15 = $493.33
 *    - ProductVariation.purchasePrice = $493.33
 * 5. Creates AccountsPayable:
 *    - Supplier: Supplier A
 *    - Amount: 5 × $480 = $2,400
 *    - Due Date: Receipt date + 30 days (payment terms)
 *    - Status: unpaid
 * 6. Updates Purchase status to "received"
 * 7. Updates GRN status to "approved"
 *
 * Result:
 * - Inventory INCREASED from 10 to 15 units
 * - Average cost updated to $493.33
 * - AP entry created for $2,400
 * - Audit trail recorded
 *
 * DATA FLOW:
 *
 * User clicks "Approve" on GRN
 *   ↓
 * POST /api/purchases/receipts/[id]/approve
 *   ↓
 * Validate permissions and GRN status
 *   ↓
 * Start database transaction
 *   ↓
 * For each GRN item:
 *   → Call processPurchaseReceipt() → ADDS inventory
 *   → Create serial numbers (if applicable)
 *   → Update weighted average cost
 *   → Update purchase item received quantity
 *   ↓
 * Update purchase order status
 *   ↓
 * Create accounts payable entry (if fully received)
 *   ↓
 * Update GRN status to "approved"
 *   ↓
 * Commit transaction
 *   ↓
 * Refresh materialized view (async)
 *   ↓
 * Create audit log
 *   ↓
 * Return success with inventory impact report
 *
 * RELATED FUNCTIONS:
 *
 * processPurchaseReceipt() (src/lib/stockOperations.ts):
 * - Core function that ADDS inventory
 * - Updates VariationLocationDetails.qtyAvailable
 * - Creates StockTransaction record
 * - Creates ProductHistory record
 * - Handles multi-unit products (UOM conversions)
 *
 * PERMISSIONS REQUIRED:
 * - PURCHASE_RECEIPT_APPROVE (typically Manager or Admin only)
 * - ACCESS_ALL_LOCATIONS or assigned to specific location
 *
 * ERROR CASES:
 * - GRN not found → 404 Not Found
 * - Already approved → 400 Bad Request (cannot approve twice)
 * - Already rejected → 400 Bad Request (cannot approve rejected GRN)
 * - Duplicate serial numbers → 400 Bad Request (serial already exists)
 * - No permission → 403 Forbidden
 * - Transaction timeout → 500 Internal Server Error (retry)
 *
 * IDEMPOTENCY:
 * - Wrapped in withIdempotency() to prevent duplicate approvals
 * - If same request sent twice, returns existing result
 * - Prevents accidental double inventory addition
 *
 * RELATED FILES:
 * - src/app/api/purchases/[id]/receive/route.ts (Step 1: Create GRN)
 * - src/lib/stockOperations.ts (processPurchaseReceipt function)
 * - src/app/dashboard/purchases/receipts/[id]/page.tsx (GRN details page)
 * - src/app/api/purchases/returns/[id]/approve/route.ts (Reverse operation - REMOVES inventory)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { processPurchaseReceipt } from '@/lib/stockOperations' // CRITICAL: This function ADDS inventory
import { SerialNumberCondition } from '@/lib/serialNumber'
import { withIdempotency } from '@/lib/idempotency' // Prevents duplicate approvals
import { InventoryImpactTracker } from '@/lib/inventory-impact-tracker' // Tracks stock changes
import { isAccountingEnabled, recordPurchase } from '@/lib/accountingIntegration'
import { sendSemaphorePurchaseApprovalAlert } from '@/lib/semaphore' // SMS notifications

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
        supplier: true, // Direct supplier relation (for receipts without PO)
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
            supplierName: receipt.purchase?.supplier?.name || receipt.supplier?.name, // Display supplier name in stock history
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

    // AUTO-REFRESH: Update stock materialized view (NON-BLOCKING - Fire and forget)
    // This runs in background to avoid blocking the response
    prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`
      .then(() => {
        console.log('[Purchase Approval] Stock view refreshed successfully')
      })
      .catch((refreshError) => {
        console.error('[Purchase Approval] Failed to refresh stock view:', refreshError)
      })

    // SMS NOTIFICATION: Send Semaphore SMS alert (NON-BLOCKING - Fire and forget)
    // This runs in background to avoid blocking the response
    Promise.resolve().then(async () => {
      try {
        // Get location name
        const location = await prisma.businessLocation.findUnique({
          where: { id: receipt.locationId },
          select: { name: true },
        })

        // Calculate total quantity received
        const totalQuantityReceived = receipt.items.reduce(
          (sum, item) => sum + parseFloat(item.quantityReceived.toString()),
          0
        )

        // Send SMS notification
        await sendSemaphorePurchaseApprovalAlert({
          poNumber: receipt.purchase.purchaseOrderNumber,
          grnNumber: receipt.receiptNumber,
          supplierName: receipt.purchase.supplier.name,
          totalAmount: parseFloat(receipt.purchase.totalAmount.toString()),
          itemCount: receipt.items.length,
          quantityReceived: totalQuantityReceived,
          locationName: location?.name || 'Unknown',
          approvedBy: userDisplayName,
          timestamp: new Date(),
        })

        console.log('[Purchase Approval] SMS notification sent successfully')
      } catch (smsError) {
        console.error('[Purchase Approval] Failed to send SMS notification:', smsError)
      }
    })

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
