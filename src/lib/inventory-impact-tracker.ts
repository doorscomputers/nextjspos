/**
 * Inventory Impact Tracker
 *
 * Service to track inventory changes before and after transactions
 * Generates impact reports showing what changed
 */

import { prisma } from '@/lib/prisma'
import { ProductImpact, LocationImpact, TransactionImpact } from '@/types/inventory-impact'

interface ProductLocationKey {
  productId: number
  productName: string
  sku: string
  variationId: number
  variationName: string
  locationId: number
  locationName: string
}

/**
 * Capture current inventory state for specific products and locations
 */
export async function captureInventorySnapshot(
  productVariationIds: number[],
  locationIds: number[]
): Promise<Map<string, { qty: number; product: ProductLocationKey }>> {
  const snapshot = new Map<string, { qty: number; product: ProductLocationKey }>()

  // Get current inventory for all product+location combinations
  const inventoryRecords = await prisma.variationLocationDetails.findMany({
    where: {
      productVariationId: { in: productVariationIds },
      locationId: { in: locationIds }
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true
        }
      },
      productVariation: {
        select: {
          id: true,
          name: true,
          sku: true
        }
      }
    }
  })

  // Get location names
  const locations = await prisma.businessLocation.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, name: true }
  })
  const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

  for (const record of inventoryRecords) {
    const key = `${record.productVariationId}-${record.locationId}`
    snapshot.set(key, {
      qty: parseFloat(record.qtyAvailable.toString()),
      product: {
        productId: record.productId,
        productName: record.product.name,
        sku: record.product.sku,
        variationId: record.productVariationId,
        variationName: record.productVariation.name,
        locationId: record.locationId,
        locationName: locationMap.get(record.locationId) || 'Unknown'
      }
    })
  }

  return snapshot
}

/**
 * Compare before and after snapshots to generate impact report
 */
export function calculateImpact(
  beforeSnapshot: Map<string, { qty: number; product: ProductLocationKey }>,
  afterSnapshot: Map<string, { qty: number; product: ProductLocationKey }>
): ProductImpact[] {
  const impacts: ProductImpact[] = []

  // Get all keys from both snapshots
  const allKeys = new Set([...beforeSnapshot.keys(), ...afterSnapshot.keys()])

  for (const key of allKeys) {
    const before = beforeSnapshot.get(key)
    const after = afterSnapshot.get(key)

    // Get product info (prefer after snapshot as it's more recent)
    const product = after?.product || before?.product

    if (!product) continue

    const previousQty = before?.qty ?? 0
    const newQty = after?.qty ?? 0
    const changeQty = newQty - previousQty

    // Only include if there was a change
    if (Math.abs(changeQty) > 0.0001) {
      impacts.push({
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        variationId: product.variationId,
        variationName: product.variationName,
        locationId: product.locationId,
        locationName: product.locationName,
        previousQty,
        changeQty,
        newQty
      })
    }
  }

  return impacts
}

/**
 * Group impacts by location
 */
export function groupImpactsByLocation(
  impacts: ProductImpact[],
  type: 'single' | 'source' | 'destination' = 'single'
): LocationImpact[] {
  const locationGroups = new Map<number, ProductImpact[]>()

  for (const impact of impacts) {
    if (!locationGroups.has(impact.locationId)) {
      locationGroups.set(impact.locationId, [])
    }
    locationGroups.get(impact.locationId)!.push(impact)
  }

  return Array.from(locationGroups.entries()).map(([locationId, products]) => ({
    locationId,
    locationName: products[0]?.locationName || 'Unknown',
    type,
    products: products.sort((a, b) => a.productName.localeCompare(b.productName))
  }))
}

/**
 * Format transaction impact for reporting
 */
export function formatTransactionImpact(
  transactionType: TransactionImpact['transactionType'],
  transactionId: number | string,
  referenceNumber: string,
  impacts: ProductImpact[],
  locationTypes?: Record<number, 'source' | 'destination' | 'single'>,
  performedBy?: string
): TransactionImpact {
  // Group by location
  const locationGroups = new Map<number, ProductImpact[]>()
  for (const impact of impacts) {
    if (!locationGroups.has(impact.locationId)) {
      locationGroups.set(impact.locationId, [])
    }
    locationGroups.get(impact.locationId)!.push(impact)
  }

  const locations: LocationImpact[] = Array.from(locationGroups.entries()).map(([locationId, products]) => ({
    locationId,
    locationName: products[0]?.locationName || 'Unknown',
    type: locationTypes?.[locationId] || 'single',
    products: products.sort((a, b) => a.productName.localeCompare(b.productName))
  }))

  const totalUnitsChanged = impacts.reduce((sum, impact) => sum + Math.abs(impact.changeQty), 0)

  return {
    transactionType,
    transactionId,
    referenceNumber,
    transactionDate: new Date(),
    locations,
    totalProductsAffected: impacts.length,
    totalUnitsChanged,
    performedBy
  }
}

/**
 * Complete workflow: Capture → Execute → Compare → Report
 */
export class InventoryImpactTracker {
  private beforeSnapshot?: Map<string, { qty: number; product: ProductLocationKey }>

  /**
   * Step 1: Capture inventory before transaction
   */
  async captureBefore(productVariationIds: number[], locationIds: number[]) {
    this.beforeSnapshot = await captureInventorySnapshot(productVariationIds, locationIds)
  }

  /**
   * Step 2: Execute your transaction
   * (This happens in your API code)
   */

  /**
   * Step 3: Capture inventory after transaction and generate report
   */
  async captureAfterAndReport(
    productVariationIds: number[],
    locationIds: number[],
    transactionType: TransactionImpact['transactionType'],
    transactionId: number | string,
    referenceNumber: string,
    locationTypes?: Record<number, 'source' | 'destination' | 'single'>,
    performedBy?: string
  ): Promise<TransactionImpact | null> {
    if (!this.beforeSnapshot) {
      console.error('InventoryImpactTracker: Must call captureBefore() first!')
      return null
    }

    const afterSnapshot = await captureInventorySnapshot(productVariationIds, locationIds)
    const impacts = calculateImpact(this.beforeSnapshot, afterSnapshot)

    if (impacts.length === 0) {
      return null // No changes detected
    }

    return formatTransactionImpact(
      transactionType,
      transactionId,
      referenceNumber,
      impacts,
      locationTypes,
      performedBy
    )
  }

  /**
   * Reset tracker for next use
   */
  reset() {
    this.beforeSnapshot = undefined
  }
}
