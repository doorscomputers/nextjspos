/**
 * Stock History Utility
 * Business logic for stock history tracking and verification
 */

import { prisma } from '@/lib/prisma'
import { StockHistoryEntry, StockTransactionType } from '@/types/product'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Get human-readable transaction type label
 */
export function getTransactionTypeLabel(type: StockTransactionType): string {
  const labels: Record<StockTransactionType, string> = {
    opening_stock: 'Opening Stock',
    sale: 'Sale',
    purchase: 'Purchase',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    adjustment: 'Stock Adjustment'
  }

  return labels[type] || type
}

/**
 * Get stock history for a specific variation at a location
 * Rebuilds history from stock transactions
 */
export async function getVariationStockHistory(
  productId: number,
  variationId: number,
  locationId: number,
  businessId: number,
  startDate?: Date,
  endDate?: Date
): Promise<StockHistoryEntry[]> {
  // Build where clause
  const where: any = {
    businessId,
    productId,
    productVariationId: variationId,
    locationId
  }

  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) {
      where.createdAt.gte = startDate
    }
    if (endDate) {
      where.createdAt.lte = endDate
    }
  }

  // Fetch all transactions for this variation at this location
  const transactions = await prisma.stockTransaction.findMany({
    where,
    include: {
      createdByUser: {
        select: {
          username: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      createdAt: 'asc' // Build in ascending order for proper running balance
    }
  })

  // Build history entries with running balance
  const history: StockHistoryEntry[] = []
  let runningBalance = 0

  for (const transaction of transactions) {
    const quantity = parseFloat(transaction.quantity.toString())

    // Calculate quantity added/removed
    let quantityAdded = 0
    let quantityRemoved = 0

    if (quantity > 0) {
      quantityAdded = quantity
    } else {
      quantityRemoved = Math.abs(quantity)
    }

    runningBalance = parseFloat(transaction.balanceQty.toString())

    const createdBy = transaction.createdByUser
      ? `${transaction.createdByUser.firstName} ${transaction.createdByUser.lastName || ''}`.trim()
      : 'Unknown'

    history.push({
      id: transaction.id,
      date: transaction.createdAt,
      referenceNumber: transaction.referenceId?.toString() || null,
      transactionType: transaction.type as StockTransactionType,
      transactionTypeLabel: getTransactionTypeLabel(transaction.type as StockTransactionType),
      quantityAdded,
      quantityRemoved,
      runningBalance,
      unitCost: transaction.unitCost ? parseFloat(transaction.unitCost.toString()) : null,
      notes: transaction.notes,
      createdBy
    })
  }

  // Reverse the array so newest transactions appear first
  return history.reverse()
}

/**
 * Verify and correct stock discrepancies
 * Compares variation_location_details with calculated balance from transactions
 */
export async function verifyAndCorrectStock(
  productId: number,
  variationId: number,
  locationId: number,
  businessId: number
): Promise<{ corrected: boolean; oldQty: number; newQty: number; message: string }> {
  // Get current stock from variation_location_details
  const variationLocation = await prisma.variationLocationDetails.findFirst({
    where: {
      productId,
      productVariationId: variationId,
      locationId
    }
  })

  if (!variationLocation) {
    return {
      corrected: false,
      oldQty: 0,
      newQty: 0,
      message: 'Stock record not found for this variation at this location'
    }
  }

  const currentQty = parseFloat(variationLocation.qtyAvailable.toString())

  // Get the latest transaction balance
  const latestTransaction = await prisma.stockTransaction.findFirst({
    where: {
      businessId,
      productId,
      productVariationId: variationId,
      locationId
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (!latestTransaction) {
    // No transactions, stock should be 0
    if (currentQty !== 0) {
      await prisma.variationLocationDetails.update({
        where: { id: variationLocation.id },
        data: { qtyAvailable: 0 }
      })

      return {
        corrected: true,
        oldQty: currentQty,
        newQty: 0,
        message: 'Stock corrected to 0 (no transactions found)'
      }
    }

    return {
      corrected: false,
      oldQty: currentQty,
      newQty: currentQty,
      message: 'Stock is correct'
    }
  }

  const calculatedQty = parseFloat(latestTransaction.balanceQty.toString())

  // Check if there's a discrepancy
  if (Math.abs(currentQty - calculatedQty) > 0.0001) {
    // Correct the stock
    await prisma.variationLocationDetails.update({
      where: { id: variationLocation.id },
      data: { qtyAvailable: calculatedQty }
    })

    return {
      corrected: true,
      oldQty: currentQty,
      newQty: calculatedQty,
      message: `Stock discrepancy corrected from ${currentQty} to ${calculatedQty}`
    }
  }

  return {
    corrected: false,
    oldQty: currentQty,
    newQty: currentQty,
    message: 'Stock is correct'
  }
}

/**
 * Create a stock adjustment transaction
 * Used for manual stock corrections
 */
export async function createStockAdjustment(
  productId: number,
  variationId: number,
  locationId: number,
  businessId: number,
  userId: number,
  adjustmentQty: number,
  reason: string
): Promise<{ success: boolean; message: string; newBalance?: number }> {
  try {
    // Get current stock
    const variationLocation = await prisma.variationLocationDetails.findFirst({
      where: {
        productId,
        productVariationId: variationId,
        locationId
      }
    })

    if (!variationLocation) {
      return {
        success: false,
        message: 'Stock record not found'
      }
    }

    const currentQty = parseFloat(variationLocation.qtyAvailable.toString())
    const newBalance = currentQty + adjustmentQty

    if (newBalance < 0) {
      return {
        success: false,
        message: 'Adjustment would result in negative stock'
      }
    }

    // Create transaction using Prisma transaction
    await prisma.$transaction(async (tx) => {
      // Create stock transaction record
      await tx.stockTransaction.create({
        data: {
          businessId,
          productId,
          productVariationId: variationId,
          locationId,
          type: 'adjustment',
          quantity: adjustmentQty,
          balanceQty: newBalance,
          createdBy: userId,
          notes: reason,
          referenceType: 'adjustment',
          referenceId: null
        }
      })

      // Update variation location details
      await tx.variationLocationDetails.update({
        where: { id: variationLocation.id },
        data: { qtyAvailable: newBalance }
      })
    })

    return {
      success: true,
      message: 'Stock adjustment created successfully',
      newBalance
    }
  } catch (error) {
    console.error('Error creating stock adjustment:', error)
    return {
      success: false,
      message: 'Failed to create stock adjustment'
    }
  }
}

/**
 * Get stock summary for a product across all locations
 */
export async function getProductStockSummary(
  productId: number,
  businessId: number
) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
      deletedAt: null
    },
    include: {
      variations: {
        where: { deletedAt: null },
        include: {
          variationLocationDetails: true
        }
      }
    }
  })

  if (!product) {
    return null
  }

  // Calculate stock summary
  const summary = {
    productId: product.id,
    productName: product.name,
    totalStock: 0,
    locationSummary: [] as {
      locationId: number
      variations: {
        variationId: number
        variationName: string
        quantity: number
      }[]
      totalQuantity: number
    }[]
  }

  // Group by location
  const locationMap = new Map<number, any>()

  for (const variation of product.variations) {
    for (const detail of variation.variationLocationDetails) {
      const locationId = detail.locationId
      const quantity = parseFloat(detail.qtyAvailable.toString())

      summary.totalStock += quantity

      if (!locationMap.has(locationId)) {
        locationMap.set(locationId, {
          locationId,
          variations: [],
          totalQuantity: 0
        })
      }

      const location = locationMap.get(locationId)
      location.variations.push({
        variationId: variation.id,
        variationName: variation.name,
        quantity
      })
      location.totalQuantity += quantity
    }
  }

  summary.locationSummary = Array.from(locationMap.values())

  return summary
}

/**
 * Get low stock products based on alert quantity
 */
export async function getLowStockProducts(businessId: number, locationId?: number) {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      deletedAt: null,
      enableStock: true,
      alertQuantity: {
        not: null,
        gt: 0
      }
    },
    include: {
      category: true,
      brand: true,
      unit: true,
      variations: {
        where: { deletedAt: null },
        include: {
          variationLocationDetails: locationId
            ? {
                where: { locationId }
              }
            : true
        }
      }
    }
  })

  const lowStockProducts: any[] = []

  for (const product of products) {
    const alertQty = parseFloat(product.alertQuantity?.toString() || '0')

    if (product.type === 'variable') {
      for (const variation of product.variations) {
        let totalVariationStock = 0

        for (const detail of variation.variationLocationDetails) {
          totalVariationStock += parseFloat(detail.qtyAvailable.toString())
        }

        if (totalVariationStock <= alertQty) {
          lowStockProducts.push({
            productId: product.id,
            productName: product.name,
            variationId: variation.id,
            variationName: variation.name,
            sku: variation.sku,
            currentStock: totalVariationStock,
            alertQuantity: alertQty,
            category: product.category?.name,
            brand: product.brand?.name
          })
        }
      }
    } else {
      // For single products, check total stock
      let totalStock = 0
      for (const variation of product.variations) {
        for (const detail of variation.variationLocationDetails) {
          totalStock += parseFloat(detail.qtyAvailable.toString())
        }
      }

      if (totalStock <= alertQty) {
        lowStockProducts.push({
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          currentStock: totalStock,
          alertQuantity: alertQty,
          category: product.category?.name,
          brand: product.brand?.name
        })
      }
    }
  }

  return lowStockProducts
}
