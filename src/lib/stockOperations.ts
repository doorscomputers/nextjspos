import { prisma } from './prisma'
import { Prisma, type StockTransaction } from '@prisma/client'
import { validateStockConsistency } from './stockValidation'
import { convertToBaseUnit, type UnitWithConversion } from './uomConversion'
import { debouncedRefreshStockView } from './refreshStockView'

type TransactionClient = Prisma.TransactionClient

// Enable/disable post-operation validation (can be toggled via env var)
// PERFORMANCE: DISABLED - adds 10-20s overhead PER ITEM (sums entire stock_transactions history)
// NEVER enable in production - only for debugging stock inconsistencies
const ENABLE_STOCK_VALIDATION = false // HARDCODED to false - do not change without understanding performance impact

const toDecimal = (value: number | string | Prisma.Decimal) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)

async function resolveUserDisplayName(
  tx: TransactionClient,
  userId: number,
  providedName?: string
): Promise<string> {
  if (providedName && providedName.trim().length > 0) {
    return providedName.trim()
  }

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  })

  if (!user) {
    return `User#${userId}`
  }

  const nameParts = [user.firstName, user.lastName].filter(Boolean)
  if (nameParts.length > 0) {
    return nameParts.join(' ')
  }

  return user.username || `User#${userId}`
}

export type UpdateStockParams = {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  type: StockTransactionType
  unitCost?: number
  referenceType?: string
  referenceId?: number
  referenceNumber?: string
  userId: number
  userDisplayName?: string
  notes?: string
  allowNegative?: boolean
  subUnitId?: number // UOM: Track which unit was used in transaction
  createdByName?: string // Optional: For purchase (supplier name), sale (customer name), etc.
  tx?: TransactionClient
}

export type UpdateStockResult = {
  transaction: StockTransaction
  previousBalance: number
  newBalance: number
}

/**
 * Stock Transaction Types
 */
export enum StockTransactionType {
  OPENING_STOCK = 'opening_stock',
  PURCHASE = 'purchase',
  SALE = 'sale',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  ADJUSTMENT = 'adjustment',
  CUSTOMER_RETURN = 'customer_return',
  SUPPLIER_RETURN = 'supplier_return',
  CORRECTION = 'correction',
  REPLACEMENT_ISSUED = 'replacement_issued',
}

/**
 * Get current stock for a product variation at a location
 */
export async function getCurrentStock({
  productVariationId,
  locationId,
  tx,
}: {
  productVariationId: number
  locationId: number
  tx?: TransactionClient
}): Promise<number> {
  const client = tx ?? prisma

  const stock = await client.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId,
        locationId,
      },
    },
    select: {
      qtyAvailable: true,
    },
  })

  return stock ? parseFloat(stock.qtyAvailable.toString()) : 0
}

/**
 * Check if sufficient stock is available
 */
export async function checkStockAvailability({
  productVariationId,
  locationId,
  quantity,
  tx,
}: {
  productVariationId: number
  locationId: number
  quantity: number
  tx?: TransactionClient
}): Promise<{ available: boolean; currentStock: number; shortage: number }> {
  const currentStock = await getCurrentStock({
    productVariationId,
    locationId,
    tx,
  })
  const available = currentStock >= quantity
  const shortage = available ? 0 : quantity - currentStock

  return {
    available,
    currentStock,
    shortage,
  }
}

/**
 * Batch check stock availability for multiple items
 * PERFORMANCE: Fetches all stock levels in a single query instead of N sequential queries
 * Saves ~1-2 seconds for 10-item sales
 */
export async function batchCheckStockAvailability({
  items,
  locationId,
  tx,
}: {
  items: Array<{ productVariationId: number; quantity: number }>
  locationId: number
  tx?: TransactionClient
}): Promise<Map<number, { available: boolean; currentStock: number; shortage: number }>> {
  const client = tx ?? prisma
  const variationIds = items.map(item => item.productVariationId)

  // Fetch all stock levels in a single query
  const stockRecords = await client.variationLocationDetails.findMany({
    where: {
      productVariationId: { in: variationIds },
      locationId,
    },
    select: {
      productVariationId: true,
      qtyAvailable: true,
    },
  })

  // Create a map of stock levels
  const stockMap = new Map(
    stockRecords.map(record => [
      record.productVariationId,
      parseFloat(record.qtyAvailable.toString())
    ])
  )

  // Build result map
  const results = new Map<number, { available: boolean; currentStock: number; shortage: number }>()

  for (const item of items) {
    const currentStock = stockMap.get(item.productVariationId) ?? 0
    const available = currentStock >= item.quantity
    const shortage = available ? 0 : item.quantity - currentStock

    results.set(item.productVariationId, {
      available,
      currentStock,
      shortage,
    })
  }

  return results
}

async function executeStockUpdate(
  tx: TransactionClient,
  params: Omit<UpdateStockParams, 'tx'>
): Promise<UpdateStockResult> {
  const {
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity,
    type,
    unitCost,
    referenceType,
    referenceId,
    referenceNumber,
    userId,
    userDisplayName,
    notes,
    allowNegative = false,
    subUnitId, // UOM: Track which unit was used
    createdByName: providedCreatedByName, // Optional supplier/customer name
  } = params

  const quantityDecimal = toDecimal(quantity)

  const existingRows = await tx.$queryRaw<
    { id: number; qty_available: Prisma.Decimal }[]
  >(
    Prisma.sql`
      SELECT id, qty_available
      FROM variation_location_details
      WHERE product_variation_id = ${productVariationId}
        AND location_id = ${locationId}
      FOR UPDATE
    `
  )

  const existingRecord = existingRows[0] ?? null
  const previousBalanceDecimal = existingRecord
    ? toDecimal(existingRecord.qty_available)
    : new Prisma.Decimal(0)
  const newBalanceDecimal = previousBalanceDecimal.add(quantityDecimal)

  if (!allowNegative && newBalanceDecimal.lt(0)) {
    throw new Error(
      `Insufficient stock. Current: ${previousBalanceDecimal.toString()}, Requested: ${Math.abs(quantity)}, Shortage: ${newBalanceDecimal.negated().toString()}`
    )
  }

  if (existingRecord) {
    await tx.variationLocationDetails.update({
      where: { id: existingRecord.id },
      data: {
        qtyAvailable: newBalanceDecimal,
        updatedAt: new Date(),
      },
    })
  } else {
    await tx.variationLocationDetails.create({
      data: {
        productId,
        productVariationId,
        locationId,
        qtyAvailable: newBalanceDecimal,
      },
    })
  }

  const transaction = await tx.stockTransaction.create({
    data: {
      businessId,
      productId,
      productVariationId,
      locationId,
      type,
      quantity: quantityDecimal,
      unitCost: unitCost !== undefined ? toDecimal(unitCost) : undefined,
      balanceQty: newBalanceDecimal,
      referenceType,
      referenceId,
      createdBy: userId,
      notes: notes || `Stock ${quantity > 0 ? 'added' : 'deducted'} - ${type}`,
      subUnitId, // UOM: Store which unit was used in this transaction
    },
  })

  // Use provided createdByName (e.g., supplier/customer) if available, otherwise resolve from user
  let createdByName = providedCreatedByName || await resolveUserDisplayName(tx, userId, userDisplayName)
  // Ensure createdByName is not empty and doesn't exceed DB limit (191 chars)
  if (!createdByName || createdByName.trim().length === 0) {
    createdByName = `User#${userId}`
  }
  if (createdByName.length > 191) {
    createdByName = createdByName.substring(0, 191)
  }

  const unitCostDecimal = unitCost !== undefined ? toDecimal(unitCost) : null
  const historyReferenceId = referenceId ?? transaction.id
  const historyReferenceType = referenceType ?? 'stock_transaction'
  // Use provided referenceNumber, or fall back to ID as string
  const historyReferenceNumber = referenceNumber ?? historyReferenceId?.toString() ?? null

  await tx.productHistory.create({
    data: {
      businessId,
      locationId,
      productId,
      productVariationId,
      transactionType: type,
      transactionDate: transaction.createdAt,
      referenceType: historyReferenceType,
      referenceId: historyReferenceId,
      referenceNumber: historyReferenceNumber,
      quantityChange: quantityDecimal,
      balanceQuantity: newBalanceDecimal,
      unitCost: unitCostDecimal ?? undefined,
      totalValue:
        unitCostDecimal !== null
          ? unitCostDecimal.mul(quantityDecimal.abs())
          : undefined,
      createdBy: userId,
      createdByName,
      reason: notes || undefined,
    },
  })

  // CRITICAL: Validate that physical stock now matches ledger
  // This ensures no silent failures in stock updates
  if (ENABLE_STOCK_VALIDATION) {
    try {
      await validateStockConsistency(
        productVariationId,
        locationId,
        tx,
        `After ${type} operation (qty: ${quantity}, ref: ${referenceType}#${referenceId})`
      )
    } catch (validationError: any) {
      // Log the error but don't fail the transaction
      // This allows us to detect issues without breaking operations
      console.error('⚠️ STOCK VALIDATION FAILED:', validationError.message)

      // In production, you might want to:
      // 1. Send an alert/email to admins
      // 2. Create an audit log entry
      // 3. Optionally throw the error to fail the transaction

      // Uncomment below to make validation errors fail the transaction:
      // throw validationError
    }
  }

  return {
    transaction,
    previousBalance: parseFloat(previousBalanceDecimal.toString()),
    newBalance: parseFloat(newBalanceDecimal.toString()),
  }
}

/**
 * Update stock and create transaction record
 * This is the ONLY function that should modify stock quantities
 *
 * NOTE: Materialized view refresh is handled automatically:
 * - When called within a transaction (tx provided): No refresh (caller responsible)
 * - When called standalone: Debounced refresh after 2 seconds
 */
export async function updateStock(params: UpdateStockParams): Promise<UpdateStockResult> {
  const { tx, ...rest } = params

  if (tx) {
    // Within transaction - don't refresh yet (caller will handle it)
    return executeStockUpdate(tx, rest)
  }

  // Standalone operation - execute and schedule refresh
  const result = await prisma.$transaction(async (transaction) =>
    executeStockUpdate(transaction, rest)
  )

  // Schedule a debounced refresh (batches multiple rapid operations)
  // This ensures inventory reports stay up-to-date without excessive DB load
  debouncedRefreshStockView(2000).catch((error) => {
    console.error('[Stock Update] Failed to schedule view refresh:', error)
  })

  return result
}

/**
 * Add stock (purchases, returns, corrections)
 */
export async function addStock({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  type,
  unitCost,
  referenceType,
  referenceId,
  referenceNumber,
  userId,
  userDisplayName,
  notes,
  subUnitId,
  createdByName,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  type: StockTransactionType
  unitCost?: number
  referenceType?: string
  referenceId?: number
  referenceNumber?: string
  userId: number
  userDisplayName?: string
  notes?: string
  subUnitId?: number // UOM: Track which unit was used
  createdByName?: string // Supplier/Customer name for stock history display
  tx?: TransactionClient
}) {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive for adding stock')
  }

  return await updateStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity: Math.abs(quantity), // Ensure positive
    type,
    unitCost,
    referenceType,
    referenceId,
    referenceNumber,
    userId,
    userDisplayName,
    createdByName,
    notes,
    subUnitId, // UOM: Pass unit tracking
    tx,
  })
}

/**
 * Deduct stock (sales, transfers out, supplier returns)
 */
export async function deductStock({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  type,
  unitCost,
  referenceType,
  referenceId,
  referenceNumber,
  userId,
  notes,
  allowNegative = false,
  userDisplayName,
  subUnitId,
  skipAvailabilityCheck = false,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  type: StockTransactionType
  unitCost?: number
  referenceType?: string
  referenceId?: number
  referenceNumber?: string
  userId: number
  notes?: string
  allowNegative?: boolean
  userDisplayName?: string
  subUnitId?: number // UOM: Track which unit was used
  skipAvailabilityCheck?: boolean // Skip availability check if already validated by caller (performance optimization)
  tx?: TransactionClient
}) {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive for deducting stock')
  }

  // Check availability first (unless caller already validated)
  // PERFORMANCE: Sales API pre-validates, so this check is redundant (1-2s overhead)
  if (!skipAvailabilityCheck) {
    const availability = await checkStockAvailability({
      productVariationId,
      locationId,
      quantity,
      tx,
    })

    if (!availability.available && !allowNegative) {
      throw new Error(
        `Insufficient stock for product variation ${productVariationId} at location ${locationId}. ` +
          `Available: ${availability.currentStock}, Required: ${quantity}, Shortage: ${availability.shortage}`
      )
    }
  }

  return await updateStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity: -Math.abs(quantity), // Ensure negative
    type,
    unitCost,
    referenceType,
    referenceId,
    referenceNumber,
    userId,
    notes,
    allowNegative,
    userDisplayName,
    subUnitId, // UOM: Pass unit tracking
    tx,
  })
}

/**
 * Transfer stock between locations (two-step process)
 * Step 1: Deduct from source (marks as in_transit, but doesn't add to destination yet)
 */
export async function transferStockOut({
  businessId,
  productId,
  productVariationId,
  fromLocationId,
  quantity,
  transferId,
  userId,
  notes,
  userDisplayName,
  skipAvailabilityCheck,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  fromLocationId: number
  quantity: number
  transferId: number
  userId: number
  notes?: string
  userDisplayName?: string
  skipAvailabilityCheck?: boolean
  tx?: TransactionClient
}) {
  // Deduct from source location
  return await deductStock({
    businessId,
    productId,
    productVariationId,
    locationId: fromLocationId,
    quantity,
    type: StockTransactionType.TRANSFER_OUT,
    referenceType: 'transfer',
    referenceId: transferId,
    userId,
    notes: notes || `Transfer out - Stock Transfer #${transferId}`,
    userDisplayName,
    skipAvailabilityCheck,
    tx,
  })
}

/**
 * Step 2: Add to destination (after verification)
 */
export async function transferStockIn({
  businessId,
  productId,
  productVariationId,
  toLocationId,
  quantity,
  unitCost,
  transferId,
  userId,
  notes,
  userDisplayName,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  toLocationId: number
  quantity: number
  unitCost?: number
  transferId: number
  userId: number
  notes?: string
  userDisplayName?: string
  tx?: TransactionClient
}) {
  // Add to destination location
  return await addStock({
    businessId,
    productId,
    productVariationId,
    locationId: toLocationId,
    quantity,
    type: StockTransactionType.TRANSFER_IN,
    unitCost,
    referenceType: 'transfer',
    referenceId: transferId,
    userId,
    notes: notes || `Transfer in - Stock Transfer #${transferId}`,
    userDisplayName,
    tx,
  })
}

/**
 * Process a sale (deduct stock and create transaction)
 */
export async function processSale({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  unitCost,
  saleId,
  userId,
  userDisplayName,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  saleId: number
  userId: number
  userDisplayName?: string
  tx?: TransactionClient
}) {
  // PERFORMANCE: Skip availability check as Sales API already validates before transaction
  return await deductStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity,
    type: StockTransactionType.SALE,
    unitCost,
    referenceType: 'sale',
    referenceId: saleId,
    userId,
    notes: `Sale - Invoice #${saleId}`,
    userDisplayName,
    skipAvailabilityCheck: true, // Already validated by Sales API (saves 1-2s)
    tx,
  })
}

/**
 * Process a purchase receipt (add stock)
 */
export async function processPurchaseReceipt({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  unitCost,
  purchaseId,
  receiptId,
  userId,
  userDisplayName,
  subUnitId, // UOM support
  supplierName, // Supplier name for stock history display
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  purchaseId: number
  receiptId: number
  userId: number
  userDisplayName?: string
  subUnitId?: number // UOM: Track which unit was used in purchase
  supplierName?: string // Supplier name for stock history display
  tx?: TransactionClient
}) {
  // CRITICAL FIX: Do NOT convert to base unit
  // Inventory should be stored in the SAME unit as the transaction
  // Example: Buy 20 Rolls → Store as 20 Rolls (NOT 6000 Meters)
  // The subUnitId tracks which unit was used, conversion happens during display/reporting

  console.log(`[processPurchaseReceipt] Adding ${quantity} units (subUnitId: ${subUnitId || 'none'})`)

  return await addStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity: quantity, // Store in TRANSACTION unit, NOT base unit
    type: StockTransactionType.PURCHASE,
    unitCost,
    referenceType: 'purchase',
    referenceId: receiptId,
    userId,
    notes: `Purchase Receipt - PO #${purchaseId}, GRN #${receiptId}`,
    userDisplayName,
    subUnitId, // UOM: Track which unit was used (critical for conversions)
    createdByName: supplierName, // Show supplier name in stock history, not user who approved
    tx,
  })
}

/**
 * Process customer return (add stock back)
 */
export async function processCustomerReturn({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  unitCost,
  returnId,
  userId,
  userDisplayName,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  returnId: number
  userId: number
  userDisplayName?: string
  tx?: TransactionClient
}) {
  return await addStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity,
    type: StockTransactionType.CUSTOMER_RETURN,
    unitCost,
    referenceType: 'customer_return',
    referenceId: returnId,
    userId,
    notes: `Customer Return #${returnId}`,
    userDisplayName,
    tx,
  })
}

/**
 * Process supplier return (deduct stock)
 */
export async function processSupplierReturn({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  unitCost,
  returnId,
  returnNumber,
  supplierName,
  returnReason,
  userId,
  userDisplayName,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  returnId: number
  returnNumber?: string
  supplierName?: string
  returnReason?: string
  userId: number
  userDisplayName?: string
  tx?: TransactionClient
}) {
  // Build detailed notes with supplier and reason information
  const parts = ['Supplier Return']
  if (returnNumber) parts.push(returnNumber)
  if (supplierName) parts.push(`to ${supplierName}`)
  if (returnReason) parts.push(`(${returnReason})`)

  const notes = parts.join(' ')

  return await deductStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity,
    type: StockTransactionType.SUPPLIER_RETURN,
    unitCost,
    referenceType: 'supplier_return',
    referenceId: returnId,
    referenceNumber: returnNumber, // Pass the actual SR number
    userId,
    notes,
    userDisplayName,
    tx,
  })
}

/**
 * Get stock transaction history for a product
 */
export async function getStockTransactionHistory({
  productId,
  productVariationId,
  locationId,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
}: {
  productId: number
  productVariationId?: number
  locationId?: number
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: Prisma.StockTransactionWhereInput = {
    productId,
  }

  if (productVariationId) {
    where.productVariationId = productVariationId
  }

  if (locationId) {
    where.locationId = locationId
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const [transactions, total] = await Promise.all([
    prisma.stockTransaction.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
      include: {
        createdByUser: {
          select: {
            username: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.stockTransaction.count({ where }),
  ])

  return {
    transactions,
    total,
    limit,
    offset,
  }
}

/**
 * Get products with low stock (below alert quantity)
 */
export async function getLowStockProducts({
  businessId,
  locationId,
}: {
  businessId: number
  locationId?: number
}) {
  const where: any = {
    product: {
      businessId,
      enableStock: true,
      deletedAt: null,
    },
  }

  if (locationId) {
    where.locationId = locationId
  }

  // Get all stock records
  const stockRecords = await prisma.variationLocationDetails.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          alertQuantity: true,
        },
      },
      productVariation: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  })

  // Filter to only those below alert quantity
  const lowStock = stockRecords.filter((record) => {
    const alertQty = record.product.alertQuantity
      ? parseFloat(record.product.alertQuantity.toString())
      : 0
    const currentQty = parseFloat(record.qtyAvailable.toString())

    return alertQty > 0 && currentQty <= alertQty
  })

  return lowStock
}

/**
 * Get products with zero stock
 */
export async function getZeroStockProducts({
  businessId,
  locationId,
}: {
  businessId: number
  locationId?: number
}) {
  const where: any = {
    qtyAvailable: 0,
    product: {
      businessId,
      enableStock: true,
      deletedAt: null,
    },
  }

  if (locationId) {
    where.locationId = locationId
  }

  return await prisma.variationLocationDetails.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
      productVariation: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  })
}

/**
 * Process replacement issuance (deduct stock for replacement item)
 * Used when issuing replacement items for approved customer returns
 */
export async function processReplacementIssuance({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity,
  unitCost,
  returnId,
  returnNumber,
  userId,
  userDisplayName,
  tx,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  returnId: number
  returnNumber?: string
  userId: number
  userDisplayName?: string
  tx?: TransactionClient
}) {
  const notes = returnNumber
    ? `Replacement issued for return ${returnNumber}`
    : `Replacement issued for return #${returnId}`

  return await deductStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity,
    type: StockTransactionType.REPLACEMENT_ISSUED,
    unitCost,
    referenceType: 'customer_return',
    referenceId: returnId,
    referenceNumber: returnNumber,
    userId,
    notes,
    userDisplayName,
    tx,
  })
}
