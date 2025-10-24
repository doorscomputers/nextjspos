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
    adjustment: 'Stock Adjustment',
    purchase_return: 'Purchase Return',
    customer_return: 'Customer Return',
    supplier_return: 'Supplier Return',
    correction: 'Stock Correction'
  }

  return labels[type] || type
}

/**
 * Get stock history for a specific variation at a location
 * COMPREHENSIVE MULTI-SOURCE QUERY - Matches Inventory Ledger logic
 * Pulls from ALL transaction sources to prevent fraud and ensure accuracy
 */
export async function getVariationStockHistory(
  productId: number,
  variationId: number,
  locationId: number,
  businessId: number,
  startDate?: Date,
  endDate?: Date
): Promise<StockHistoryEntry[]> {
  // Set default date range if not provided
  const finalStartDate = startDate || new Date('1970-01-01')

  // Adjust end date to include the entire day (add 1 day to include all transactions on that date)
  let finalEndDate = endDate || new Date('2099-12-31')
  if (endDate) {
    finalEndDate = new Date(endDate)
    finalEndDate.setDate(finalEndDate.getDate() + 1) // Add 1 day to include entire end date
  }

  // Query ALL transaction sources in parallel (same as Inventory Ledger)
  const [
    purchaseReceipts,
    sales,
    transfersOut,
    transfersIn,
    inventoryCorrections,
    purchaseReturns,
    customerReturns,
    productHistoryRecords
  ] = await Promise.all([
    // 1. Purchase Receipts (GRN) - Stock Received
    prisma.purchaseReceipt.findMany({
      where: {
        businessId,
        locationId,
        status: 'approved',
        approvedAt: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        supplier: { select: { name: true } }
      },
      orderBy: { approvedAt: 'asc' }
    }),

    // 2. Sales - Stock Sold
    prisma.sale.findMany({
      where: {
        businessId,
        locationId,
        saleDate: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        customer: { select: { name: true } }
      },
      orderBy: { saleDate: 'asc' }
    }),

    // 3. Transfers Out (from this location)
    prisma.stockTransfer.findMany({
      where: {
        businessId,
        fromLocationId: locationId,
        stockDeducted: true,
        sentAt: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        toLocation: { select: { name: true } }
      },
      orderBy: { sentAt: 'asc' }
    }),

    // 4. Transfers In (to this location)
    prisma.stockTransfer.findMany({
      where: {
        businessId,
        toLocationId: locationId,
        status: 'completed',
        completedAt: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        fromLocation: { select: { name: true } }
      },
      orderBy: { completedAt: 'asc' }
    }),

    // 5. Inventory Corrections
    prisma.inventoryCorrection.findMany({
      where: {
        businessId,
        locationId,
        productId,
        productVariationId: variationId,
        status: 'approved',
        approvedAt: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        stockTransaction: true  // Include the linked stock transaction to get actual adjustment
      },
      orderBy: { approvedAt: 'asc' }
    }),

    // 6. Purchase Returns (returned to supplier)
    prisma.supplierReturn.findMany({
      where: {
        businessId,
        locationId: locationId,
        status: 'approved',
        approvedAt: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        supplier: { select: { name: true } }
      },
      orderBy: { approvedAt: 'asc' }
    }),

    // 7. Customer Returns (returned by customers)
    prisma.customerReturn.findMany({
      where: {
        businessId,
        locationId,
        status: 'approved',
        approvedAt: {
          gte: finalStartDate,
          lte: finalEndDate
        }
      },
      include: {
        items: {
          where: {
            productId,
            productVariationId: variationId
          }
        },
        customer: { select: { name: true } }
      },
      orderBy: { approvedAt: 'asc' }
    }),

    // 8. Product History - ONLY for unique transaction types
    // (opening_stock, manual adjustments that aren't in dedicated tables)
    prisma.productHistory.findMany({
      where: {
        businessId,
        locationId,
        productId,
        productVariationId: variationId,
        transactionDate: {
          gte: finalStartDate,
          lte: finalEndDate
        },
        // Exclude transaction types that are already covered by dedicated tables above
        // INCLUDING 'adjustment' since inventory corrections are now handled separately
        transactionType: {
          notIn: ['purchase', 'sale', 'transfer_in', 'transfer_out', 'purchase_return', 'supplier_return', 'customer_return', 'adjustment']
        }
      },
      orderBy: { transactionDate: 'asc' }
    })
  ])

  // Build unified transaction array
  const transactions: any[] = []

  // Process Purchase Receipts
  for (const receipt of purchaseReceipts) {
    if (receipt.items.length > 0) {
      for (const item of receipt.items) {
        transactions.push({
          date: receipt.approvedAt!,
          type: 'purchase',
          typeLabel: 'Purchase',
          referenceNumber: receipt.receiptNumber,
          quantityAdded: parseFloat(item.quantityReceived.toString()),
          quantityRemoved: 0,
          notes: `Stock Received - GRN #${receipt.receiptNumber} from ${receipt.supplier.name}`,
          createdBy: receipt.supplier.name
        })
      }
    }
  }

  // Process Sales
  for (const sale of sales) {
    if (sale.items.length > 0) {
      for (const item of sale.items) {
        transactions.push({
          date: sale.saleDate,
          type: 'sale',
          typeLabel: 'Sale',
          referenceNumber: sale.invoiceNumber,
          quantityAdded: 0,
          quantityRemoved: parseFloat(item.quantity.toString()),
          notes: `Sale to ${sale.customer?.name || 'Walk-in Customer'}`,
          createdBy: sale.customer?.name || 'Walk-in Customer'
        })
      }
    }
  }

  // Process Transfers Out
  for (const transfer of transfersOut) {
    if (transfer.items.length > 0) {
      for (const item of transfer.items) {
        transactions.push({
          date: transfer.sentAt!,
          type: 'transfer_out',
          typeLabel: 'Transfer Out',
          referenceNumber: transfer.transferNumber,
          quantityAdded: 0,
          quantityRemoved: parseFloat(item.quantity.toString()),
          notes: `Transfer to ${transfer.toLocation.name}`,
          createdBy: `To: ${transfer.toLocation.name}`
        })
      }
    }
  }

  // Process Transfers In
  for (const transfer of transfersIn) {
    if (transfer.items.length > 0) {
      for (const item of transfer.items) {
        transactions.push({
          date: transfer.completedAt!,
          type: 'transfer_in',
          typeLabel: 'Transfer In',
          referenceNumber: transfer.transferNumber,
          quantityAdded: parseFloat(item.quantity.toString()),
          quantityRemoved: 0,
          notes: `Transfer from ${transfer.fromLocation.name}`,
          createdBy: `From: ${transfer.fromLocation.name}`
        })
      }
    }
  }

  // Process Inventory Corrections
  for (const correction of inventoryCorrections) {
    // Get the actual adjustment from the linked stock transaction
    // The stock transaction quantity is positive for additions, negative for subtractions
    if (correction.stockTransaction) {
      const adjustment = parseFloat(correction.stockTransaction.quantity.toString())
      transactions.push({
        date: correction.approvedAt!,
        type: 'adjustment',
        typeLabel: 'Inventory Correction',
        referenceNumber: correction.correctionNumber,
        quantityAdded: adjustment > 0 ? adjustment : 0,
        quantityRemoved: adjustment < 0 ? Math.abs(adjustment) : 0,
        notes: `Inventory correction: ${correction.reason}${correction.remarks ? ' - ' + correction.remarks : ''}`,
        createdBy: 'Inventory Correction'
      })
    }
  }

  // Process Purchase Returns
  for (const returnRecord of purchaseReturns) {
    if (returnRecord.items.length > 0) {
      for (const item of returnRecord.items) {
        transactions.push({
          date: returnRecord.approvedAt!,
          type: 'purchase_return',
          typeLabel: 'Purchase Return',
          referenceNumber: returnRecord.returnNumber,
          quantityAdded: 0,
          quantityRemoved: parseFloat(item.quantity.toString()),
          notes: `Returned to ${returnRecord.supplier.name}`,
          createdBy: returnRecord.supplier.name
        })
      }
    }
  }

  // Process Customer Returns
  for (const returnRecord of customerReturns) {
    if (returnRecord.items.length > 0) {
      for (const item of returnRecord.items) {
        transactions.push({
          date: returnRecord.approvedAt!,
          type: 'customer_return',
          typeLabel: 'Customer Return',
          referenceNumber: returnRecord.returnNumber,
          quantityAdded: parseFloat(item.quantityReturned.toString()),
          quantityRemoved: 0,
          notes: `Return from ${returnRecord.customer?.name || 'Customer'}`,
          createdBy: returnRecord.customer?.name || 'Customer'
        })
      }
    }
  }

  // Process Product History records (opening stock, etc.)
  for (const historyRecord of productHistoryRecords) {
    const quantityChange = parseFloat(historyRecord.quantityChange.toString())
    transactions.push({
      date: historyRecord.transactionDate,
      type: historyRecord.transactionType,
      typeLabel: historyRecord.transactionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      referenceNumber: historyRecord.referenceNumber || `${historyRecord.transactionType.toUpperCase()}-${historyRecord.id}`,
      quantityAdded: quantityChange > 0 ? quantityChange : 0,
      quantityRemoved: quantityChange < 0 ? Math.abs(quantityChange) : 0,
      notes: historyRecord.reason || '',
      createdBy: historyRecord.createdByName || 'System'
    })
  }

  // Sort all transactions by date (ascending)
  transactions.sort((a, b) => a.date.getTime() - b.date.getTime())

  // Calculate running balance
  let runningBalance = 0
  const history: StockHistoryEntry[] = []

  for (let i = 0; i < transactions.length; i++) {
    const txn = transactions[i]
    runningBalance += txn.quantityAdded
    runningBalance -= txn.quantityRemoved

    history.push({
      id: i + 1,
      date: txn.date,
      referenceNumber: txn.referenceNumber,
      transactionType: txn.type as StockTransactionType,
      transactionTypeLabel: txn.typeLabel,
      quantityAdded: txn.quantityAdded,
      quantityRemoved: txn.quantityRemoved,
      runningBalance,
      unitCost: null,
      notes: txn.notes,
      createdBy: txn.createdBy
    })
  }

  // Reverse so newest appears first
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
