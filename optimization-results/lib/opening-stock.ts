/**
 * Opening Stock Utility
 * Business logic for managing product opening stock
 */

import { prisma } from '@/lib/prisma'
import { OpeningStockInput } from '@/types/product'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * Calculate tax amount based on tax type
 */
export function calculateTax(
  amount: number,
  taxRate: number,
  taxType: 'inclusive' | 'exclusive'
): { taxAmount: number; totalWithTax: number; totalWithoutTax: number } {
  if (taxType === 'inclusive') {
    // Tax is already included in the amount
    const totalWithTax = amount
    const totalWithoutTax = amount / (1 + taxRate / 100)
    const taxAmount = totalWithTax - totalWithoutTax

    return {
      taxAmount: parseFloat(taxAmount.toFixed(4)),
      totalWithTax: parseFloat(totalWithTax.toFixed(4)),
      totalWithoutTax: parseFloat(totalWithoutTax.toFixed(4))
    }
  } else {
    // Tax is exclusive - needs to be added
    const totalWithoutTax = amount
    const taxAmount = amount * (taxRate / 100)
    const totalWithTax = amount + taxAmount

    return {
      taxAmount: parseFloat(taxAmount.toFixed(4)),
      totalWithTax: parseFloat(totalWithTax.toFixed(4)),
      totalWithoutTax: parseFloat(totalWithoutTax.toFixed(4))
    }
  }
}

/**
 * Get existing opening stock for a product
 */
export async function getOpeningStock(
  productId: number,
  businessId: number
) {
  // Get product with variations and their location details
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      businessId,
      deletedAt: null
    },
    select: {
      tax: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      variations: {
        where: { deletedAt: null },
        select: {
          variationLocationDetails: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
        }
      }
    }
  })

  if (!product) {
    return null
  }

  // Get all business locations
  const locations = await prisma.businessLocation.findMany({
    where: {
      businessId,
      deletedAt: null
    },
    orderBy: {
      name: 'asc'
    }
  })

  // Get existing opening stock transactions
  const openingStockTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      productId,
      type: 'opening_stock'
    },
    select: {
      productVariation: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
    }
  })

  // Build response structure
  const variations = product.variations.map(variation => {
    const variationLocations = locations.map(location => {
      // Find existing stock for this variation at this location
      const stockDetail = variation.variationLocationDetails.find(
        detail => detail.locationId === location.id
      )

      // Find opening stock transaction
      const openingStock = openingStockTransactions.find(
        transaction =>
          transaction.productVariationId === variation.id &&
          transaction.locationId === location.id
      )

      return {
        locationId: location.id,
        locationName: location.name,
        qtyAvailable: stockDetail ? parseFloat(stockDetail.qtyAvailable.toString()) : 0,
        openingStock: openingStock
          ? {
              id: openingStock.id,
              quantity: parseFloat(openingStock.quantity.toString()),
              unitCost: openingStock.unitCost
                ? parseFloat(openingStock.unitCost.toString())
                : 0,
              lotNumber: openingStock.notes || undefined, // Using notes field for lot number
              expiryDate: undefined // Would need additional field in schema
            }
          : undefined
      }
    })

    return {
      id: variation.id,
      name: variation.name,
      sku: variation.sku,
      locations: variationLocations
    }
  })

  return {
    product,
    variations,
    locations
  }
}

/**
 * Save opening stock (create or update)
 * Implements the exact business logic from Laravel
 */
export async function saveOpeningStock(
  inputs: OpeningStockInput[],
  businessId: number,
  userId: number
): Promise<{ success: boolean; message: string; errors?: string[] }> {
  if (!inputs || inputs.length === 0) {
    return {
      success: false,
      message: 'No opening stock data provided'
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const input of inputs) {
        const { productId, variationId, locationId, quantity, unitCost, lotNumber, expiryDate } = input

        if (quantity <= 0) {
          continue // Skip zero or negative quantities
        }

        // Get product and variation info
        const product = await tx.product.findFirst({
          where: {
            id: productId,
            businessId,
            deletedAt: null
          },
          select: {
            tax: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            taxType: { select: { id: true, name: true } }
          }
        })

        if (!product) {
          throw new Error(`Product ${productId} not found`)
        }

        const variation = await tx.productVariation.findFirst({
          where: {
            id: variationId,
            productId,
            deletedAt: null
          }
        })

        if (!variation) {
          throw new Error(`Variation ${variationId} not found`)
        }

        // Get or create variation location detail
        const variationLocation = await tx.variationLocationDetails.findFirst({
          where: {
            productId,
            productVariationId: variationId,
            locationId
          }
        })

        // Calculate current stock
        const currentQty = variationLocation
          ? parseFloat(variationLocation.qtyAvailable.toString())
          : 0

        // Check if opening stock already exists
        const existingOpeningStock = await tx.stockTransaction.findFirst({
          where: {
            businessId,
            productId,
            productVariationId: variationId,
            locationId,
            type: 'opening_stock'
          }
        })

        let newBalance = currentQty

        if (existingOpeningStock) {
          // Update existing opening stock
          const oldQuantity = parseFloat(existingOpeningStock.quantity.toString())
          const difference = quantity - oldQuantity
          newBalance = currentQty + difference

          await tx.stockTransaction.update({
            where: { id: existingOpeningStock.id },
            data: {
              quantity,
              unitCost,
              balanceQty: newBalance,
              notes: lotNumber
            }
          })
        } else {
          // Create new opening stock transaction
          newBalance = currentQty + quantity

          await tx.stockTransaction.create({
            data: {
              businessId,
              productId,
              productVariationId: variationId,
              locationId,
              type: 'opening_stock',
              quantity,
              unitCost: unitCost || 0,
              balanceQty: newBalance,
              createdBy: userId,
              notes: lotNumber,
              referenceType: 'opening_stock'
            }
          })
        }

        // Update or create variation location detail
        if (variationLocation) {
          await tx.variationLocationDetails.update({
            where: { id: variationLocation.id },
            data: {
              qtyAvailable: newBalance
            }
          })
        } else {
          await tx.variationLocationDetails.create({
            data: {
              productId,
              productVariationId: variationId,
              locationId,
              qtyAvailable: newBalance,
              sellingPrice: variation.sellingPrice
            }
          })
        }
      }
    })

    return {
      success: { select: { id: true, name: true } },
      message: 'Opening stock saved successfully'
    }
  } catch (error) {
    console.error('Error saving opening stock:', error)
    return {
      success: false,
      message: 'Failed to save opening stock',
      errors: [error instanceof Error ? error.message : 'Unknown error']
    }
  }
}

/**
 * Delete opening stock
 * Only allowed if the opening stock hasn't been sold
 */
export async function deleteOpeningStock(
  transactionId: number,
  businessId: number
): Promise<{ success: boolean; message: string }> {
  try {
    const transaction = await prisma.stockTransaction.findFirst({
      where: {
        id: transactionId,
        businessId,
        type: 'opening_stock'
      }
    })

    if (!transaction) {
      return {
        success: false,
        message: 'Opening stock transaction not found'
      }
    }

    // Check if any stock has been sold
    const originalQty = parseFloat(transaction.quantity.toString())
    const currentBalance = parseFloat(transaction.balanceQty.toString())

    if (currentBalance < originalQty) {
      return {
        success: false,
        message: 'Cannot delete opening stock that has been partially sold'
      }
    }

    // Delete using transaction
    await prisma.$transaction(async (tx) => {
      // Update variation location detail (subtract the opening stock quantity)
      const variationLocation = await tx.variationLocationDetails.findFirst({
        where: {
          productId: transaction.productId,
          productVariationId: transaction.productVariationId,
          locationId: transaction.locationId
        }
      })

      if (variationLocation) {
        const newQty = parseFloat(variationLocation.qtyAvailable.toString()) - originalQty

        await tx.variationLocationDetails.update({
          where: { id: variationLocation.id },
          data: { qtyAvailable: Math.max(0, newQty) }
        })
      }

      // Delete the transaction
      await tx.stockTransaction.delete({
        where: { id: transactionId }
      })
    })

    return {
      success: { select: { id: true, name: true } },
      message: 'Opening stock deleted successfully'
    }
  } catch (error) {
    console.error('Error deleting opening stock:', error)
    return {
      success: false,
      message: 'Failed to delete opening stock'
    }
  }
}

/**
 * Calculate opening stock value
 * Used for reports and analytics
 */
export async function calculateOpeningStockValue(businessId: number, locationId?: number) {
  const where: any = {
    businessId,
    type: 'opening_stock'
  }

  if (locationId) {
    where.locationId = locationId
  }

  const openingStockTransactions = await prisma.stockTransaction.findMany({
    where,
    select: {
      product: {
        select: {
          tax: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
        }
      },
      productVariation: { select: { id: true, name: true } }
    }
  })

  let totalValue = 0
  let totalQuantity = 0

  for (const transaction of openingStockTransactions) {
    const quantity = parseFloat(transaction.quantity.toString())
    const unitCost = parseFloat(transaction.unitCost?.toString() || '0')
    const value = quantity * unitCost

    totalValue += value
    totalQuantity += quantity
  }

  return {
    totalValue: parseFloat(totalValue.toFixed(2)),
    totalQuantity: parseFloat(totalQuantity.toFixed(2)),
    transactionCount: openingStockTransactions.length
  }
}
