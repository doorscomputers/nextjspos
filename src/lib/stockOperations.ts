/**
 * STOCK OPERATIONS MODULE
 * =======================
 *
 * This is the CORE INVENTORY MANAGEMENT module for the entire POS system.
 * ALL inventory movements (purchases, sales, transfers, returns, adjustments) MUST go through these functions.
 *
 * KEY CONCEPTS:
 * -------------
 * 1. **Stock Transactions**: Every inventory movement creates a StockTransaction record in the database
 * 2. **Running Balance**: Each transaction updates the current stock balance in variation_location_details table
 * 3. **Product History**: Each transaction also creates a ProductHistory record for audit trail
 * 4. **Multi-Location**: Each product variation can have different stock levels at different business locations
 *
 * STOCK TRANSACTION TYPES:
 * ------------------------
 * - OPENING_STOCK: Initial stock when setting up inventory
 * - PURCHASE: Stock received from supplier (adds inventory)
 * - SALE: Stock sold to customer (deducts inventory)
 * - TRANSFER_IN: Stock received from another location (adds inventory)
 * - TRANSFER_OUT: Stock sent to another location (deducts inventory)
 * - ADJUSTMENT: Manual correction of stock levels (add or deduct)
 * - CUSTOMER_RETURN: Customer returns item (adds inventory back)
 * - SUPPLIER_RETURN: Returning defective items to supplier (deducts inventory)
 * - CORRECTION: System correction after stock count/audit (add or deduct)
 * - REPLACEMENT_ISSUED: Issuing replacement for returned item (deducts inventory)
 *
 * PERFORMANCE OPTIMIZATIONS:
 * --------------------------
 * This module uses PostgreSQL stored functions to minimize database round trips:
 * - Individual updates: 1 function call (vs 4 separate queries)
 * - Bulk updates: Processes 70 items in 30-45 seconds (vs 2-3 minutes)
 * - Debounced view refresh: Batches multiple operations to reduce load
 *
 * TRANSACTION SAFETY:
 * -------------------
 * - All operations use database transactions (ACID compliance)
 * - Row-level locking prevents concurrent modification conflicts
 * - Validation ensures negative stock is prevented (unless explicitly allowed)
 *
 * USAGE EXAMPLES:
 * ---------------
 * ```typescript
 * // Recording a purchase
 * await processPurchaseReceipt({
 *   businessId: 1,
 *   productId: 100,
 *   productVariationId: 200,
 *   locationId: 5,
 *   quantity: 50,
 *   unitCost: 25.00,
 *   purchaseId: 12,
 *   receiptId: 34,
 *   userId: 7
 * })
 *
 * // Processing a sale
 * await processSale({
 *   businessId: 1,
 *   productId: 100,
 *   productVariationId: 200,
 *   locationId: 5,
 *   quantity: 10,
 *   unitCost: 30.00,
 *   saleId: 56,
 *   userId: 7
 * })
 *
 * // Checking stock availability before sale
 * const { available, currentStock, shortage } = await checkStockAvailability({
 *   productVariationId: 200,
 *   locationId: 5,
 *   quantity: 10
 * })
 * ```
 */

import { prisma } from './prisma'
import { Prisma, type StockTransaction } from '@prisma/client'
import { validateStockConsistency } from './stockValidation'
import { convertToBaseUnit, type UnitWithConversion } from './uomConversion'
import { debouncedRefreshStockView } from './refreshStockView'

// Type alias for Prisma transaction client - used when operations are part of a larger transaction
type TransactionClient = Prisma.TransactionClient

/**
 * STOCK VALIDATION FLAG
 * ---------------------
 * Enable/disable post-operation stock validation.
 *
 * WARNING: NEVER enable this in production!
 * - Adds 10-20 seconds overhead PER ITEM
 * - Sums entire stock_transactions table history for each validation
 * - Only useful for debugging stock inconsistencies in development
 *
 * Current setting: HARDCODED to false for safety
 */
const ENABLE_STOCK_VALIDATION = false // HARDCODED to false - do not change without understanding performance impact

/**
 * Helper function to convert various numeric types to Prisma.Decimal
 *
 * Why we use Decimal:
 * - JavaScript's number type has floating-point precision issues (0.1 + 0.2 = 0.30000000000000004)
 * - Financial calculations require exact precision (e.g., currency, inventory quantities)
 * - Prisma.Decimal ensures accurate calculations with no rounding errors
 *
 * @param value - Number, string, or existing Decimal to convert
 * @returns Prisma.Decimal for precise calculations
 */
const toDecimal = (value: number | string | Prisma.Decimal) =>
  value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value)

/**
 * Resolve user's display name for stock transaction records
 *
 * This function determines what name to show in stock history reports.
 * Priority order:
 * 1. If providedName is given (e.g., "John Doe Supplier"), use it
 * 2. Try to build name from user's firstName + lastName
 * 3. Fall back to username
 * 4. Last resort: "User#123"
 *
 * @param tx - Database transaction client
 * @param userId - ID of the user performing the transaction
 * @param providedName - Optional pre-formatted name to use
 * @returns Display name string (max 191 characters to fit database column)
 */
async function resolveUserDisplayName(
  tx: TransactionClient,
  userId: number,
  providedName?: string
): Promise<string> {
  // If a name was already provided, use it
  if (providedName && providedName.trim().length > 0) {
    return providedName.trim()
  }

  // Otherwise, look up the user in the database
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      firstName: true,
      lastName: true,
      username: true,
    },
  })

  // User not found - return fallback
  if (!user) {
    return `User#${userId}`
  }

  // Build name from firstName + lastName if available
  const nameParts = [user.firstName, user.lastName].filter(Boolean)
  if (nameParts.length > 0) {
    return nameParts.join(' ')
  }

  // Fall back to username, or user ID as last resort
  return user.username || `User#${userId}`
}

/**
 * PARAMETERS FOR STOCK UPDATE OPERATIONS
 * =======================================
 *
 * This interface defines all the data needed to record an inventory movement.
 *
 * REQUIRED FIELDS:
 * ----------------
 * @param businessId - Which business owns this inventory (multi-tenant isolation)
 * @param productId - The product being moved
 * @param productVariationId - The specific variant (size, color, etc.)
 * @param locationId - Which store/warehouse location
 * @param quantity - How many units (positive = add, negative = deduct)
 * @param type - Type of transaction (see StockTransactionType enum)
 * @param userId - Who is performing this operation
 *
 * OPTIONAL FIELDS:
 * ----------------
 * @param unitCost - Cost per unit (for valuation and COGS calculations)
 * @param referenceType - What triggered this ('sale', 'purchase', 'transfer', etc.)
 * @param referenceId - ID of the source record (sale ID, purchase ID, etc.)
 * @param referenceNumber - Human-readable reference (Invoice #123, PO #456)
 * @param userDisplayName - Override for user's display name
 * @param notes - Additional context or reason for the transaction
 * @param allowNegative - Allow stock to go negative (false by default for safety)
 * @param subUnitId - Unit of Measure ID (for items sold by different units like boxes, pieces)
 * @param createdByName - Name to show in history (e.g., supplier name, customer name)
 * @param tx - Database transaction to join (for batch operations)
 */
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

/**
 * RESULT OF STOCK UPDATE OPERATION
 * =================================
 *
 * After updating stock, this object tells you what happened.
 *
 * @param transaction - The StockTransaction record that was created
 * @param previousBalance - Stock level BEFORE the operation
 * @param newBalance - Stock level AFTER the operation
 *
 * Example:
 * - previousBalance: 100 units
 * - quantity: -10 (sale of 10 units)
 * - newBalance: 90 units
 */
export type UpdateStockResult = {
  transaction: StockTransaction
  previousBalance: number
  newBalance: number
}

/**
 * STOCK TRANSACTION TYPES ENUM
 * =============================
 *
 * This enum defines all possible types of inventory movements in the system.
 * Every stock change must specify one of these types.
 *
 * INVENTORY INCREASING TRANSACTIONS (Add Stock):
 * -----------------------------------------------
 * - OPENING_STOCK: Initial inventory when first setting up the system
 * - PURCHASE: Receiving goods from a supplier (most common way to add stock)
 * - TRANSFER_IN: Receiving inventory transferred from another location/branch
 * - CUSTOMER_RETURN: Customer returns a previously sold item (adds it back to inventory)
 * - ADJUSTMENT: Manual increase in stock (e.g., found misplaced items during audit)
 *
 * INVENTORY DECREASING TRANSACTIONS (Remove Stock):
 * --------------------------------------------------
 * - SALE: Selling items to customers (most common way to remove stock)
 * - TRANSFER_OUT: Sending inventory to another location/branch
 * - SUPPLIER_RETURN: Returning defective/damaged items back to supplier
 * - REPLACEMENT_ISSUED: Giving customer a replacement for defective item
 * - ADJUSTMENT: Manual decrease in stock (e.g., discovered theft, damage, expiry)
 *
 * SPECIAL TRANSACTIONS:
 * ---------------------
 * - CORRECTION: System correction after physical stock count reveals discrepancy
 *   (can be positive or negative depending on actual vs system count)
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
 * Get current stock quantity for a product variation at a specific location
 *
 * This function queries the variation_location_details table which maintains
 * the running balance (current stock on hand) for each product variant at each location.
 *
 * @param productVariationId - The product variant to check
 * @param locationId - The business location (warehouse, store, branch)
 * @param tx - Optional database transaction to use (for consistent reads within larger transaction)
 * @returns Current stock quantity as a number (0 if no record exists)
 *
 * Example:
 * ```typescript
 * const currentStock = await getCurrentStock({
 *   productVariationId: 123,
 *   locationId: 5
 * })
 * console.log(`Current stock: ${currentStock} units`)
 * ```
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

  // Convert Prisma.Decimal to number for easier JavaScript usage
  return stock ? parseFloat(stock.qtyAvailable.toString()) : 0
}

/**
 * Check if sufficient stock is available for an operation
 *
 * This function is used BEFORE attempting to deduct stock (e.g., before processing a sale)
 * to verify that there's enough inventory available. It prevents negative stock situations.
 *
 * @param productVariationId - The product variant to check
 * @param locationId - The business location
 * @param quantity - How many units are needed
 * @param tx - Optional database transaction for consistent reads
 * @returns Object with availability status and stock details:
 *   - available: true if currentStock >= quantity, false otherwise
 *   - currentStock: How many units are actually in stock right now
 *   - shortage: If not available, how many units short (0 if available)
 *
 * Example:
 * ```typescript
 * const { available, currentStock, shortage } = await checkStockAvailability({
 *   productVariationId: 123,
 *   locationId: 5,
 *   quantity: 50
 * })
 *
 * if (!available) {
 *   console.error(`Not enough stock! Need ${quantity}, have ${currentStock}, short by ${shortage}`)
 * }
 * ```
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
 * Batch check stock availability for multiple items at once
 *
 * PERFORMANCE OPTIMIZATION:
 * -------------------------
 * Instead of checking each item one-by-one (which would be N database queries),
 * this function fetches ALL stock levels in a SINGLE query, then processes them in memory.
 *
 * Performance gain: Saves ~1-2 seconds for a 10-item sale transaction
 *
 * Use Case:
 * ---------
 * When processing a sale with multiple items, you need to verify ALL items are in stock
 * BEFORE starting the transaction. This function does that efficiently.
 *
 * @param items - Array of items to check, each with productVariationId and quantity needed
 * @param locationId - The business location where stock will be deducted
 * @param tx - Optional database transaction for consistent reads
 * @returns Map where key = productVariationId, value = availability info
 *
 * Example:
 * ```typescript
 * const items = [
 *   { productVariationId: 100, quantity: 5 },
 *   { productVariationId: 200, quantity: 10 },
 *   { productVariationId: 300, quantity: 3 }
 * ]
 *
 * const results = await batchCheckStockAvailability({ items, locationId: 5 })
 *
 * for (const item of items) {
 *   const check = results.get(item.productVariationId)
 *   if (!check.available) {
 *     console.error(`Item ${item.productVariationId}: Need ${item.quantity}, have ${check.currentStock}`)
 *   }
 * }
 * ```
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

/**
 * CORE STOCK UPDATE FUNCTION (INTERNAL)
 * ======================================
 *
 * This is the HEART of the entire inventory system. Every inventory movement ultimately
 * goes through this function. It handles:
 *
 * 1. **Validation**: Checks if operation would cause negative stock (unless allowed)
 * 2. **Stock Update**: Updates the variation_location_details table (current balance)
 * 3. **Transaction Record**: Creates StockTransaction record (audit trail)
 * 4. **History Record**: Creates ProductHistory record (user-friendly history)
 * 5. **Locking**: Uses row-level locks to prevent concurrent modification conflicts
 *
 * PERFORMANCE OPTIMIZATION:
 * -------------------------
 * This function uses a PostgreSQL stored function (update_inventory_with_history)
 * that performs ALL operations server-side in a single function call.
 *
 * Traditional approach would require 4 separate queries:
 * 1. SELECT current balance (with lock)
 * 2. UPSERT variation_location_details (update balance)
 * 3. INSERT into stock_transactions
 * 4. INSERT into product_history
 *
 * With stored function: 1 function call = massive performance gain
 * Expected: 70 items in 60-90 seconds (vs 5-6 minutes with separate queries)
 *
 * TRANSACTION SAFETY:
 * -------------------
 * - This function MUST be called within a database transaction (tx parameter required)
 * - Uses SELECT FOR UPDATE in the stored function for row-level locking
 * - Prevents race conditions when multiple users modify same product simultaneously
 *
 * @param tx - Database transaction client (REQUIRED - this function doesn't create its own transaction)
 * @param params - All the data needed for the stock update (see UpdateStockParams)
 * @returns UpdateStockResult with transaction record and before/after balances
 *
 * IMPORTANT: Do NOT call this directly - use the public wrapper functions instead:
 * - updateStock() - for general updates
 * - addStock() - for purchases, returns
 * - deductStock() - for sales, transfers out
 * - processSale() - specifically for sales
 * - processPurchaseReceipt() - specifically for purchases
 */
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

  // Convert quantity to Decimal for precise calculations (no floating-point errors)
  const quantityDecimal = toDecimal(quantity)

  // STEP 1: Get current stock balance (WITHOUT locking yet)
  // --------------------------------------------------------
  // We need to know the current balance to calculate the new balance.
  // NOTE: We're NOT locking the row here - the stored function will do that.
  // This is just a preview read to validate before calling the stored function.
  const existingRows = await tx.$queryRaw<
    { id: number; qty_available: Prisma.Decimal }[]
  >(
    Prisma.sql`
      SELECT id, qty_available
      FROM variation_location_details
      WHERE product_variation_id = ${productVariationId}
        AND location_id = ${locationId}
    `
  )

  // Extract current balance (or 0 if this product doesn't exist at this location yet)
  const existingRecord = existingRows[0] ?? null
  const previousBalanceDecimal = existingRecord
    ? toDecimal(existingRecord.qty_available)
    : new Prisma.Decimal(0)

  // Calculate what the new balance will be after this operation
  // Example: previousBalance = 100, quantity = -10 (sale) => newBalance = 90
  const newBalanceDecimal = previousBalanceDecimal.add(quantityDecimal)

  // VALIDATION: Check for negative stock (unless explicitly allowed)
  // -----------------------------------------------------------------
  // This pre-check prevents us from calling the stored function if we know it will fail.
  // The stored function ALSO validates this, but catching it early provides better error messages.
  if (!allowNegative && newBalanceDecimal.lt(0)) {
    throw new Error(
      `Insufficient stock. Current: ${previousBalanceDecimal.toString()}, Requested: ${Math.abs(quantity)}, Shortage: ${newBalanceDecimal.negated().toString()}`
    )
  }

  // Resolve the display name for the person performing this operation
  // This will appear in stock history reports
  let createdByName = providedCreatedByName || await resolveUserDisplayName(tx, userId, userDisplayName)
  if (!createdByName || createdByName.trim().length === 0) {
    createdByName = `User#${userId}`  // Fallback if no name available
  }
  // Truncate if too long (database column limit is VARCHAR(191))
  if (createdByName.length > 191) {
    createdByName = createdByName.substring(0, 191)
  }

  // Prepare all values for the stored function call
  const unitCostDecimal = unitCost !== undefined ? toDecimal(unitCost) : null
  const notesText = notes || `Stock ${quantity > 0 ? 'added' : 'deducted'} - ${type}`
  const historyReferenceType = referenceType ?? 'stock_transaction'

  // STEP 2: CALL POSTGRESQL STORED FUNCTION
  // ========================================
  // This is the CRITICAL performance optimization.
  // Instead of 4 separate database queries:
  //   1. SELECT (with lock)
  //   2. UPSERT variation_location_details
  //   3. INSERT stock_transactions
  //   4. INSERT product_history
  //
  // We call ONE stored function that does ALL of this server-side.
  //
  // Performance Impact:
  // - Individual operation: 4 round trips → 1 round trip
  // - Bulk operation (70 items): 280 round trips → 70 round trips
  // - Time saved: 5-6 minutes → 60-90 seconds
  //
  // The stored function also includes:
  // - SELECT FOR UPDATE (row-level locking to prevent race conditions)
  // - Negative stock validation
  // - Automatic timestamp handling

  // Calculate total value (quantity × unit cost) for inventory valuation
  const totalValue = unitCostDecimal !== null ? unitCostDecimal.mul(quantityDecimal.abs()) : null

  // PostgreSQL is strict about NULL types - must explicitly pass null (not undefined)
  const refNumberParam = referenceNumber !== null && referenceNumber !== undefined ? referenceNumber : null
  const notesParam = notes !== null && notes !== undefined ? notes : null
  const subUnitParam = subUnitId !== null && subUnitId !== undefined ? subUnitId : null
  const totalValueParam = totalValue !== null ? totalValue : null

  // Call the stored function with all parameters
  // Function signature: update_inventory_with_history(businessId, productId, variationId, ...)
  // Returns: previous_balance, new_balance, transaction_id, transaction_date, history_id
  const batchResult = await tx.$queryRaw<
    {
      previous_balance: Prisma.Decimal
      new_balance: Prisma.Decimal
      transaction_id: number
      transaction_date: Date
      history_id: number
    }[]
  >(
    Prisma.sql`
      SELECT * FROM update_inventory_with_history(
        ${businessId}::INTEGER,
        ${productId}::INTEGER,
        ${productVariationId}::INTEGER,
        ${locationId}::INTEGER,
        ${type}::TEXT,
        ${quantityDecimal}::DECIMAL,
        ${unitCostDecimal}::DECIMAL,
        ${newBalanceDecimal}::DECIMAL,
        ${previousBalanceDecimal}::DECIMAL,
        ${referenceType}::TEXT,
        ${referenceId}::INTEGER,
        ${refNumberParam}::TEXT,
        ${userId}::INTEGER,
        ${createdByName}::TEXT,
        ${notesText}::TEXT,
        ${notesParam}::TEXT,
        ${subUnitParam}::INTEGER,
        ${totalValueParam}::DECIMAL,
        ${allowNegative}::BOOLEAN
      )
    `
  )

  // Verify the function executed successfully
  if (!batchResult || batchResult.length === 0) {
    throw new Error('Stored function execution failed - no results returned')
  }

  const result = batchResult[0]

  // Reconstruct transaction object for compatibility with existing code
  // (We only have ID and timestamp from the function, but that's all we need)
  const transaction = {
    id: result.transaction_id,
    createdAt: result.transaction_date,
  } as StockTransaction

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
 * Bulk update stock for multiple items in a single function call
 * PERFORMANCE: 70 items in 30-45 seconds (vs 2-3 minutes with individual calls)
 * Eliminates network round trips and transaction overhead
 */
async function executeBulkStockUpdate(
  tx: TransactionClient,
  items: Omit<UpdateStockParams, 'tx'>[]
): Promise<Array<{ success: boolean; error?: string; result?: UpdateStockResult }>> {
  if (items.length === 0) {
    return []
  }

  // BULK OPTIMIZATION 1: Batch fetch all stock balances in single query (saves ~4 seconds for 11 items)
  const variationLocationPairs = items.map((item) => ({
    productVariationId: item.productVariationId,
    locationId: item.locationId,
  }))

  // Build WHERE clause for all pairs: (variation_id = X AND location_id = Y) OR (variation_id = Z AND location_id = W) ...
  const conditions = variationLocationPairs
    .map(
      (pair) =>
        `(product_variation_id = ${pair.productVariationId} AND location_id = ${pair.locationId})`
    )
    .join(' OR ')

  const allBalances = await tx.$queryRaw<
    { product_variation_id: number; location_id: number; id: number; qty_available: Prisma.Decimal }[]
  >(
    Prisma.sql([
      `SELECT product_variation_id, location_id, id, qty_available FROM variation_location_details WHERE ${conditions}`,
    ])
  )

  // Create lookup map: "variationId_locationId" => balance
  const balanceMap = new Map<string, { id: number; qty_available: Prisma.Decimal }>()
  for (const row of allBalances) {
    const key = `${row.product_variation_id}_${row.location_id}`
    balanceMap.set(key, { id: row.id, qty_available: row.qty_available })
  }

  // BULK OPTIMIZATION 2: Resolve user display name ONCE (saves ~3.8 seconds for 11 items)
  const firstItem = items[0]
  let cachedUserDisplayName = firstItem.createdByName
  if (!cachedUserDisplayName) {
    cachedUserDisplayName = await resolveUserDisplayName(
      tx,
      firstItem.userId,
      firstItem.userDisplayName
    )
  }
  if (!cachedUserDisplayName || cachedUserDisplayName.trim().length === 0) {
    cachedUserDisplayName = `User#${firstItem.userId}`
  }
  if (cachedUserDisplayName.length > 191) {
    cachedUserDisplayName = cachedUserDisplayName.substring(0, 191)
  }

  // Prepare JSONB array for bulk function
  const bulkItems = await Promise.all(
    items.map(async (params) => {
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
        subUnitId,
        createdByName: providedCreatedByName,
      } = params

      const quantityDecimal = toDecimal(quantity)

      // Get current balance from cached map (no query!)
      const balanceKey = `${productVariationId}_${locationId}`
      const existingRecord = balanceMap.get(balanceKey) ?? null
      const previousBalanceDecimal = existingRecord
        ? toDecimal(existingRecord.qty_available)
        : new Prisma.Decimal(0)
      const newBalanceDecimal = previousBalanceDecimal.add(quantityDecimal)

      // Use cached user display name (no query!)
      let createdByName = providedCreatedByName || cachedUserDisplayName

      const unitCostDecimal = unitCost !== undefined ? toDecimal(unitCost) : null
      const notesText = notes || `Stock ${quantity > 0 ? 'added' : 'deducted'} - ${type}`
      const totalValue =
        unitCostDecimal !== null ? unitCostDecimal.mul(quantityDecimal.abs()) : null

      return {
        businessId,
        productId,
        variationId: productVariationId,
        locationId,
        type,
        quantity: quantityDecimal.toString(),
        unitCost: unitCostDecimal?.toString() || null,
        newBalance: newBalanceDecimal.toString(),
        previousBalance: previousBalanceDecimal.toString(),
        referenceType: referenceType ?? 'stock_transaction',
        referenceId: referenceId ?? null,
        referenceNumber: referenceNumber ?? null,
        userId,
        createdByName,
        notes: notesText,
        reason: notes ?? null,
        subUnitId: subUnitId ?? null,
        totalValue: totalValue?.toString() || null,
        allowNegative,
      }
    })
  )

  // Call bulk stored function
  const bulkResults = await tx.$queryRaw<
    {
      item_index: number
      success: boolean
      previous_balance: Prisma.Decimal | null
      new_balance: Prisma.Decimal | null
      transaction_id: number | null
      transaction_date: Date | null
      history_id: number | null
      error_message: string | null
    }[]
  >(
    Prisma.sql`
      SELECT * FROM bulk_update_inventory_with_history(${JSON.stringify(
        bulkItems
      )}::jsonb)
    `
  )

  // Map results back to UpdateStockResult format
  return bulkResults.map((dbResult, index) => {
    if (!dbResult.success) {
      return {
        success: false,
        error: dbResult.error_message || 'Unknown error',
      }
    }

    const originalParams = items[index]
    return {
      success: true,
      result: {
        transaction: {
          id: dbResult.transaction_id!,
          createdAt: dbResult.transaction_date!,
        } as StockTransaction,
        previousBalance: dbResult.previous_balance
          ? parseFloat(dbResult.previous_balance.toString())
          : 0,
        newBalance: dbResult.new_balance ? parseFloat(dbResult.new_balance.toString()) : 0,
      },
    }
  })
}

/**
 * Bulk update stock for multiple items
 * Public wrapper that provides same interface as updateStock but for bulk operations
 */
export async function bulkUpdateStock(
  items: UpdateStockParams[]
): Promise<Array<{ success: boolean; error?: string; result?: UpdateStockResult }>> {
  if (items.length === 0) {
    return []
  }

  // Check if all items share same transaction
  const firstTx = items[0].tx
  const allSameTx = items.every((item) => item.tx === firstTx)

  if (firstTx && allSameTx) {
    // All items in same transaction - execute directly
    return executeBulkStockUpdate(
      firstTx,
      items.map(({ tx, ...rest }) => rest)
    )
  }

  // Different transactions or no transaction - execute in new transaction
  return await prisma.$transaction(async (transaction) => {
    return executeBulkStockUpdate(
      transaction,
      items.map(({ tx, ...rest }) => rest)
    )
  })
}

/**
 * UPDATE STOCK - Main public function for stock operations
 * =========================================================
 *
 * This is the PRIMARY ENTRY POINT for ALL stock updates in the system.
 * Whether you're recording a sale, purchase, transfer, or adjustment - it goes through here.
 *
 * WHAT IT DOES:
 * -------------
 * 1. Updates the stock balance in variation_location_details table
 * 2. Creates a StockTransaction record (audit trail)
 * 3. Creates a ProductHistory record (user-friendly history)
 * 4. Schedules materialized view refresh (for reports)
 *
 * TRANSACTION HANDLING:
 * ---------------------
 * - If `tx` parameter is provided: Joins existing transaction (caller handles commit/rollback)
 * - If `tx` is NOT provided: Creates its own transaction automatically
 *
 * MATERIALIZED VIEW REFRESH:
 * --------------------------
 * The system maintains a materialized view for fast inventory reports.
 * - When called WITHIN a transaction (tx provided): Caller must refresh the view
 * - When called STANDALONE: Automatically schedules debounced refresh after 2 seconds
 *   (Debouncing batches multiple rapid updates into one refresh for performance)
 *
 * @param params - All stock operation parameters (see UpdateStockParams type)
 * @returns UpdateStockResult with transaction record and before/after balances
 *
 * Example Usage:
 * ```typescript
 * // Standalone operation (auto-refresh)
 * const result = await updateStock({
 *   businessId: 1,
 *   productId: 100,
 *   productVariationId: 200,
 *   locationId: 5,
 *   quantity: 50,
 *   type: StockTransactionType.PURCHASE,
 *   userId: 7
 * })
 *
 * // Within existing transaction (manual refresh)
 * await prisma.$transaction(async (tx) => {
 *   await updateStock({ ...params, tx })
 *   // ... other operations ...
 *   await refreshStockView() // Manual refresh at end
 * })
 * ```
 *
 * NOTE: For most use cases, use the helper functions instead:
 * - processSale() - for sales
 * - processPurchaseReceipt() - for purchases
 * - addStock() - for adding inventory
 * - deductStock() - for removing inventory
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
 * ADD STOCK - Helper function for operations that INCREASE inventory
 * ===================================================================
 *
 * Use this function when inventory is being ADDED (quantity must be positive).
 *
 * Common Use Cases:
 * -----------------
 * - PURCHASE: Receiving goods from supplier
 * - CUSTOMER_RETURN: Customer returns an item
 * - TRANSFER_IN: Receiving stock from another location
 * - ADJUSTMENT: Manual increase (found misplaced items, etc.)
 * - CORRECTION: Physical count shows more stock than system
 *
 * This is a convenience wrapper around updateStock() that:
 * 1. Validates quantity is positive
 * 2. Ensures quantity is passed as positive number
 * 3. Calls updateStock() with the correct parameters
 *
 * @param quantity - Must be POSITIVE (will throw error if <= 0)
 * @param type - Transaction type (usually PURCHASE, CUSTOMER_RETURN, TRANSFER_IN, etc.)
 * @param unitCost - Optional cost per unit for inventory valuation
 * @param subUnitId - Optional Unit of Measure ID (e.g., if buying by boxes vs pieces)
 * @param createdByName - Optional name to show in history (e.g., supplier name)
 *
 * Example:
 * ```typescript
 * await addStock({
 *   businessId: 1,
 *   productId: 100,
 *   productVariationId: 200,
 *   locationId: 5,
 *   quantity: 50,  // Add 50 units
 *   type: StockTransactionType.PURCHASE,
 *   unitCost: 25.00,
 *   userId: 7,
 *   createdByName: "ABC Supplier Co."
 * })
 * ```
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
 * DEDUCT STOCK - Helper function for operations that DECREASE inventory
 * ======================================================================
 *
 * Use this function when inventory is being REMOVED (quantity must be positive).
 *
 * Common Use Cases:
 * -----------------
 * - SALE: Selling items to customers
 * - TRANSFER_OUT: Sending stock to another location
 * - SUPPLIER_RETURN: Returning defective items to supplier
 * - REPLACEMENT_ISSUED: Giving customer a replacement item
 * - ADJUSTMENT: Manual decrease (theft, damage, expiry, etc.)
 * - CORRECTION: Physical count shows less stock than system
 *
 * This is a convenience wrapper around updateStock() that:
 * 1. Validates quantity is positive
 * 2. Checks stock availability BEFORE deducting (unless skipAvailabilityCheck = true)
 * 3. Converts quantity to NEGATIVE before passing to updateStock()
 * 4. Prevents negative stock (unless allowNegative = true)
 *
 * @param quantity - Must be POSITIVE (function converts it to negative internally)
 * @param type - Transaction type (usually SALE, TRANSFER_OUT, SUPPLIER_RETURN, etc.)
 * @param allowNegative - Allow stock to go negative? Default: false (throws error if insufficient)
 * @param skipAvailabilityCheck - Skip pre-check? Default: false (use true if already validated)
 * @param unitCost - Optional cost per unit for COGS calculation
 * @param subUnitId - Optional Unit of Measure ID
 *
 * IMPORTANT: The quantity parameter should be POSITIVE.
 * Example: To deduct 10 units, pass quantity: 10 (NOT -10)
 * The function automatically converts it to -10 internally.
 *
 * Example:
 * ```typescript
 * await deductStock({
 *   businessId: 1,
 *   productId: 100,
 *   productVariationId: 200,
 *   locationId: 5,
 *   quantity: 10,  // Deduct 10 units (pass as positive!)
 *   type: StockTransactionType.SALE,
 *   unitCost: 30.00,
 *   userId: 7,
 *   allowNegative: false  // Throw error if insufficient stock
 * })
 * ```
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
  allowNegative,
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
  allowNegative?: boolean
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
    allowNegative,
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
