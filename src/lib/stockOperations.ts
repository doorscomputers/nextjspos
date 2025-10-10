import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

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
}

/**
 * Get current stock for a product variation at a location
 */
export async function getCurrentStock({
  productVariationId,
  locationId,
}: {
  productVariationId: number
  locationId: number
}): Promise<number> {
  const stock = await prisma.variationLocationDetails.findUnique({
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
}: {
  productVariationId: number
  locationId: number
  quantity: number
}): Promise<{ available: boolean; currentStock: number; shortage: number }> {
  const currentStock = await getCurrentStock({ productVariationId, locationId })
  const available = currentStock >= quantity
  const shortage = available ? 0 : quantity - currentStock

  return {
    available,
    currentStock,
    shortage,
  }
}

/**
 * Update stock and create transaction record
 * This is the ONLY function that should modify stock quantities
 */
export async function updateStock({
  businessId,
  productId,
  productVariationId,
  locationId,
  quantity, // Positive for additions, negative for subtractions
  type,
  unitCost,
  referenceType,
  referenceId,
  userId,
  notes,
  allowNegative = false,
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
  userId: number
  notes?: string
  allowNegative?: boolean
}) {
  // Get current stock
  const currentStock = await getCurrentStock({ productVariationId, locationId })

  // Calculate new balance
  const newBalance = currentStock + quantity

  // Prevent negative stock if not allowed
  if (!allowNegative && newBalance < 0) {
    throw new Error(
      `Insufficient stock. Current: ${currentStock}, Requested: ${Math.abs(quantity)}, Shortage: ${Math.abs(newBalance)}`
    )
  }

  // Use transaction to ensure atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Update variation location details
    await tx.variationLocationDetails.upsert({
      where: {
        productVariationId_locationId: {
          productVariationId,
          locationId,
        },
      },
      update: {
        qtyAvailable: newBalance,
      },
      create: {
        productId,
        productVariationId,
        locationId,
        qtyAvailable: newBalance,
      },
    })

    // Create stock transaction record
    const transaction = await tx.stockTransaction.create({
      data: {
        businessId,
        productId,
        productVariationId,
        locationId,
        type,
        quantity,
        unitCost,
        balanceQty: newBalance,
        referenceType,
        referenceId,
        createdBy: userId,
        notes: notes || `Stock ${quantity > 0 ? 'added' : 'deducted'} - ${type}`,
      },
    })

    return {
      transaction,
      previousBalance: currentStock,
      newBalance,
    }
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
  userId,
  notes,
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
  userId: number
  notes?: string
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
    userId,
    notes,
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
  userId,
  notes,
  allowNegative = false,
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
  userId: number
  notes?: string
  allowNegative?: boolean
}) {
  if (quantity <= 0) {
    throw new Error('Quantity must be positive for deducting stock')
  }

  // Check availability first
  const availability = await checkStockAvailability({
    productVariationId,
    locationId,
    quantity,
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
    userId,
    notes,
    allowNegative,
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
}: {
  businessId: number
  productId: number
  productVariationId: number
  fromLocationId: number
  quantity: number
  transferId: number
  userId: number
  notes?: string
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
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  saleId: number
  userId: number
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
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  returnId: number
  userId: number
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
  userId,
}: {
  businessId: number
  productId: number
  productVariationId: number
  locationId: number
  quantity: number
  unitCost: number
  returnId: number
  userId: number
}) {
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
    userId,
    notes: `Supplier Return #${returnId}`,
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
