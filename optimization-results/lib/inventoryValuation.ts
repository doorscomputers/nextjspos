/**
 * Inventory Valuation Engine
 * Calculates inventory value using FIFO, LIFO, or Weighted Average methods
 * Essential for accurate COGS, financial statements, and tax compliance
 */

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

/**
 * Valuation Methods
 */
export enum ValuationMethod {
  FIFO = 'fifo',           // First In, First Out
  LIFO = 'lifo',           // Last In, First Out
  WEIGHTED_AVG = 'avco',   // Weighted Average Cost (AVCO)
}

/**
 * Cost Layer for FIFO/LIFO tracking
 */
export interface CostLayer {
  purchaseDate: Date
  quantity: number
  remainingQty: number
  unitCost: number
  totalValue: number
  transactionId: number
}

/**
 * Inventory Valuation Result
 */
export interface InventoryValuation {
  productId: number
  productVariationId: number
  locationId: number
  method: ValuationMethod
  currentQty: number
  unitCost: number
  totalValue: number
  valuationDate: Date
  costLayers?: CostLayer[]
}

/**
 * FIFO Calculation Result
 */
interface ValuationCalculation {
  currentQty: number
  unitCost: number
  totalValue: number
  costLayers: CostLayer[]
}

/**
 * Calculate FIFO (First In, First Out) Value
 * Assumes oldest inventory is sold first
 */
async function calculateFIFOValue(
  productVariationId: number,
  locationId: number,
  businessId: number
): Promise<ValuationCalculation> {

  // Get all inbound transactions (purchases, transfers in, returns) in chronological order
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { gt: 0 }  // Only positive quantities (additions)
    },
    orderBy: { createdAt: 'asc' },  // FIFO: Oldest first
    select: {
      id: { select: { id: true, name: true } },
      quantity: { select: { id: true, name: true } },
      unitCost: { select: { id: true, name: true } },
      createdAt: { select: { id: true, name: true } }
    }
  })

  // Get all outbound transactions (sales, transfers out)
  const outboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { lt: 0 }  // Only negative quantities (deductions)
    },
    orderBy: { createdAt: 'asc' },
    select: {
      quantity: { select: { id: true, name: true } }
    }
  })

  // Build cost layers from inbound transactions
  const costLayers: CostLayer[] = inboundTransactions.map(txn => ({
    purchaseDate: txn.createdAt,
    quantity: Number(txn.quantity),
    remainingQty: Number(txn.quantity),  // Initially all remaining
    unitCost: Number(txn.unitCost || 0),
    totalValue: Number(txn.quantity) * Number(txn.unitCost || 0),
    transactionId: txn.id
  }))

  // Calculate total outbound quantity
  const totalOut = Math.abs(
    outboundTransactions.reduce((sum, txn) => sum + Number(txn.quantity), 0)
  )

  // Consume cost layers using FIFO logic (oldest first)
  let remainingOut = totalOut

  for (const layer of costLayers) {
    if (remainingOut === 0) break

    const toConsume = Math.min(layer.remainingQty, remainingOut)
    layer.remainingQty -= toConsume
    layer.totalValue = layer.remainingQty * layer.unitCost
    remainingOut -= toConsume
  }

  // Calculate totals from remaining layers
  const remainingLayers = costLayers.filter(layer => layer.remainingQty > 0)
  const currentQty = remainingLayers.reduce((sum, layer) => sum + layer.remainingQty, 0)
  const totalValue = remainingLayers.reduce((sum, layer) => sum + layer.totalValue, 0)
  const unitCost = currentQty > 0 ? totalValue / currentQty : 0

  return {
    currentQty,
    unitCost,
    totalValue,
    costLayers: remainingLayers
  }
}

/**
 * Calculate LIFO (Last In, First Out) Value
 * Assumes newest inventory is sold first
 */
async function calculateLIFOValue(
  productVariationId: number,
  locationId: number,
  businessId: number
): Promise<ValuationCalculation> {

  // Get inbound transactions in REVERSE chronological order (newest first)
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { gt: 0 }
    },
    orderBy: { createdAt: 'desc' },  // LIFO: Newest first
    select: {
      id: { select: { id: true, name: true } },
      quantity: { select: { id: true, name: true } },
      unitCost: { select: { id: true, name: true } },
      createdAt: { select: { id: true, name: true } }
    }
  })

  // Build cost layers
  const costLayers: CostLayer[] = inboundTransactions.map(txn => ({
    purchaseDate: txn.createdAt,
    quantity: Number(txn.quantity),
    remainingQty: Number(txn.quantity),
    unitCost: Number(txn.unitCost || 0),
    totalValue: Number(txn.quantity) * Number(txn.unitCost || 0),
    transactionId: txn.id
  }))

  // Get total outbound quantity
  const totalOutResult = await prisma.stockTransaction.aggregate({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { lt: 0 }
    },
    _sum: { quantity: { select: { id: true, name: true } } }
  })

  const totalOut = Math.abs(Number(totalOutResult._sum.quantity || 0))
  let remainingOut = totalOut

  // Consume from NEWEST layers first (already sorted DESC)
  for (const layer of costLayers) {
    if (remainingOut === 0) break

    const toConsume = Math.min(layer.remainingQty, remainingOut)
    layer.remainingQty -= toConsume
    layer.totalValue = layer.remainingQty * layer.unitCost
    remainingOut -= toConsume
  }

  // Calculate totals
  const remainingLayers = costLayers.filter(layer => layer.remainingQty > 0)
  const currentQty = remainingLayers.reduce((sum, layer) => sum + layer.remainingQty, 0)
  const totalValue = remainingLayers.reduce((sum, layer) => sum + layer.totalValue, 0)
  const unitCost = currentQty > 0 ? totalValue / currentQty : 0

  return {
    currentQty,
    unitCost,
    totalValue,
    costLayers: remainingLayers
  }
}

/**
 * Calculate Weighted Average Cost Value
 * Uses average cost of all purchases weighted by quantity
 */
async function calculateWeightedAverageValue(
  productVariationId: number,
  locationId: number,
  businessId: number
): Promise<ValuationCalculation> {

  // Get all inbound transactions
  const inboundTransactions = await prisma.stockTransaction.findMany({
    where: {
      businessId,
      productVariationId,
      locationId,
      quantity: { gt: 0 }
    },
    select: {
      quantity: { select: { id: true, name: true } },
      unitCost: { select: { id: true, name: true } }
    }
  })

  // Calculate weighted average cost
  let totalCost = 0
  let totalQty = 0

  for (const txn of inboundTransactions) {
    const qty = Number(txn.quantity)
    const cost = Number(txn.unitCost || 0)
    totalCost += qty * cost
    totalQty += qty
  }

  const weightedAvgCost = totalQty > 0 ? totalCost / totalQty : 0

  // Get current stock quantity from variationLocationDetails
  const stockRecord = await prisma.variationLocationDetails.findUnique({
    where: {
      productVariationId_locationId: {
        productVariationId,
        locationId
      }
    },
    select: { qtyAvailable: { select: { id: true, name: true } } }
  })

  const currentQty = Number(stockRecord?.qtyAvailable || 0)
  const totalValue = currentQty * weightedAvgCost

  return {
    currentQty,
    unitCost: weightedAvgCost,
    totalValue,
    costLayers: []  // No cost layers for weighted average
  }
}

/**
 * Get Inventory Valuation
 * Main function to calculate inventory value based on chosen method
 */
export async function getInventoryValuation(
  productVariationId: number,
  locationId: number,
  businessId: number,
  method?: ValuationMethod
): Promise<InventoryValuation> {

  // Get business accounting method if not specified
  if (!method) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { accountingMethod: { select: { id: true, name: true } } }
    })
    method = (business?.accountingMethod as ValuationMethod) || ValuationMethod.WEIGHTED_AVG
  }

  let calculation: ValuationCalculation

  switch (method) {
    case ValuationMethod.FIFO:
      calculation = await calculateFIFOValue(productVariationId, locationId, businessId)
      break

    case ValuationMethod.LIFO:
      calculation = await calculateLIFOValue(productVariationId, locationId, businessId)
      break

    case ValuationMethod.WEIGHTED_AVG:
      calculation = await calculateWeightedAverageValue(productVariationId, locationId, businessId)
      break

    default:
      throw new Error(`Unsupported valuation method: ${method}`)
  }

  // Get product info for reference
  const variation = await prisma.productVariation.findUnique({
    where: { id: productVariationId },
    select: {
      productId: { select: { id: true, name: true } }
    }
  })

  return {
    productId: variation?.productId || 0,
    productVariationId,
    locationId,
    method,
    currentQty: calculation.currentQty,
    unitCost: calculation.unitCost,
    totalValue: calculation.totalValue,
    valuationDate: new Date(),
    costLayers: calculation.costLayers
  }
}

/**
 * Get Valuation for All Products at a Location
 */
export async function getLocationInventoryValuation(
  locationId: number,
  businessId: number,
  method?: ValuationMethod
): Promise<InventoryValuation[]> {

  // Get all variations with stock at this location
  const stockRecords = await prisma.variationLocationDetails.findMany({
    where: {
      locationId,
      qtyAvailable: { gt: 0 }
    },
    select: {
      productVariationId: { select: { id: true, name: true } },
      productId: { select: { id: true, name: true } }
    }
  })

  const valuations: InventoryValuation[] = []

  for (const record of stockRecords) {
    try {
      const valuation = await getInventoryValuation(
        record.productVariationId,
        locationId,
        businessId,
        method
      )

      if (valuation.currentQty > 0) {
        valuations.push(valuation)
      }
    } catch (error) {
      console.error(`Failed to calculate valuation for variation ${record.productVariationId}:`, error)
      // Continue with other products
    }
  }

  return valuations
}

/**
 * Get Total Inventory Value for Business
 */
export async function getTotalInventoryValue(
  businessId: number,
  locationId?: number,
  method?: ValuationMethod
): Promise<{
  totalValue: number
  totalQuantity: number
  itemCount: number
  method: ValuationMethod
}> {

  let valuations: InventoryValuation[]

  if (locationId) {
    valuations = await getLocationInventoryValuation(locationId, businessId, method)
  } else {
    // Get all locations for business
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null
      },
      select: { id: { select: { id: true, name: true } } }
    })

    valuations = []
    for (const location of locations) {
      const locationValuations = await getLocationInventoryValuation(
        location.id,
        businessId,
        method
      )
      valuations.push(...locationValuations)
    }
  }

  const totalValue = valuations.reduce((sum, v) => sum + v.totalValue, 0)
  const totalQuantity = valuations.reduce((sum, v) => sum + v.currentQty, 0)
  const itemCount = valuations.length

  // Get method from business if not specified
  if (!method) {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { accountingMethod: { select: { id: true, name: true } } }
    })
    method = (business?.accountingMethod as ValuationMethod) || ValuationMethod.WEIGHTED_AVG
  }

  return {
    totalValue,
    totalQuantity,
    itemCount,
    method
  }
}
