import { prisma } from './prisma'
import { Prisma, type StockTransaction } from '@prisma/client'
import { validateStockConsistency } from './stockValidation'
import { convertToBaseUnit, type UnitWithConversion } from './uomConversion'

type TransactionClient = Prisma.TransactionClient

// Enable/disable post-operation validation (can be toggled via env var)
const ENABLE_STOCK_VALIDATION = process.env.ENABLE_STOCK_VALIDATION !== 'false' // true by default

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

  const createdByName = await resolveUserDisplayName(tx, userId, userDisplayName)
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
 */
export async function updateStock(params: UpdateStockParams): Promise<UpdateStockResult> {
  const { tx, ...rest } = params

  if (tx) {
    return executeStockUpdate(tx, rest)
  }

  return prisma.$transaction(async (transaction) =>
    executeStockUpdate(transaction, rest)
  )
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
  tx?: TransactionClient
}) {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive for deducting stock')
  }

  // Check availability first
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
  tx?: TransactionClient
}) {
  return await addStock({
    businessId,
    productId,
    productVariationId,
    locationId,
    quantity,
    type: StockTransactionType.PURCHASE,
    unitCost,
    referenceType: 'purchase',
    referenceId: receiptId,
    userId,
    notes: `Purchase Receipt - PO #${purchaseId}, GRN #${receiptId}`,
    userDisplayName,
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
