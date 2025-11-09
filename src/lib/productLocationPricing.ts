/**
 * Product Location Pricing Library
 *
 * Manages location-specific pricing for products with multi-unit support.
 * Allows different purchase/selling prices per location per unit.
 * Falls back to global unit prices if no location-specific price is set.
 */

import { Decimal } from '@prisma/client/runtime/library'
import { prisma } from '@/lib/prisma'
import { getProductUnitPrices, UnitPrice } from '@/lib/productUnitPricing'

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface LocationUnitPrice {
  locationId: number
  locationName: string
  unitId: number
  unitName: string
  unitShortName: string
  purchasePrice: Decimal
  sellingPrice: Decimal
  multiplier: Decimal // Conversion multiplier to base unit
  isBaseUnit: boolean
  isLocationSpecific: boolean // true if set for this location, false if using global price
  lastUpdatedBy?: number
  lastUpdatedAt?: Date
}

export interface LocationUnitPriceInput {
  locationId: number
  unitId: number
  purchasePrice: number
  sellingPrice: number
}

export interface BulkLocationPriceInput {
  productId: number
  prices: LocationUnitPriceInput[]
}

// ============================================================================
// FETCH LOCATION UNIT PRICES
// ============================================================================

/**
 * Get all location-specific unit prices for a product
 * Returns prices for all locations or filtered by location IDs
 */
export async function getProductLocationPrices(
  productId: number,
  businessId: number,
  locationIds?: number[]
): Promise<LocationUnitPrice[]> {
  // Get global unit prices first (for fallback)
  const globalPrices = await getProductUnitPrices(productId, businessId)

  if (globalPrices.length === 0) {
    return []
  }

  // Get locations
  const whereLocation: any = {
    businessId,
    isActive: true,
    deletedAt: null,
  }

  if (locationIds && locationIds.length > 0) {
    whereLocation.id = { in: locationIds }
  }

  const locations = await prisma.businessLocation.findMany({
    where: whereLocation,
    orderBy: { name: 'asc' },
  })

  // Get location-specific prices
  const locationPrices = await prisma.productUnitLocationPrice.findMany({
    where: {
      productId,
      businessId,
      ...(locationIds && locationIds.length > 0
        ? { locationId: { in: locationIds } }
        : {}),
    },
    include: {
      location: true,
      unit: true,
      lastUpdatedByUser: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  })

  // Build result array
  const result: LocationUnitPrice[] = []

  for (const location of locations) {
    for (const globalPrice of globalPrices) {
      // Check if there's a location-specific price
      const locationPrice = locationPrices.find(
        lp => lp.locationId === location.id && lp.unitId === globalPrice.unitId
      )

      if (locationPrice) {
        // Use location-specific price
        result.push({
          locationId: location.id,
          locationName: location.name,
          unitId: globalPrice.unitId,
          unitName: globalPrice.unitName,
          unitShortName: globalPrice.unitShortName,
          purchasePrice: locationPrice.purchasePrice,
          sellingPrice: locationPrice.sellingPrice,
          multiplier: globalPrice.multiplier,
          isBaseUnit: globalPrice.isBaseUnit,
          isLocationSpecific: true,
          lastUpdatedBy: locationPrice.lastUpdatedBy || undefined,
          lastUpdatedAt: locationPrice.updatedAt,
        })
      } else {
        // Use global price as fallback
        result.push({
          locationId: location.id,
          locationName: location.name,
          unitId: globalPrice.unitId,
          unitName: globalPrice.unitName,
          unitShortName: globalPrice.unitShortName,
          purchasePrice: globalPrice.purchasePrice,
          sellingPrice: globalPrice.sellingPrice,
          multiplier: globalPrice.multiplier,
          isBaseUnit: globalPrice.isBaseUnit,
          isLocationSpecific: false,
        })
      }
    }
  }

  console.log(
    `[getProductLocationPrices] Product ${productId}: Found ${result.length} location unit prices (${locations.length} locations × ${globalPrices.length} units)`
  )
  return result
}

/**
 * Get price for a specific unit at a specific location
 * Falls back to global unit price if no location-specific price exists
 */
export async function getLocationUnitPrice(
  productId: number,
  locationId: number,
  unitId: number,
  businessId: number
): Promise<LocationUnitPrice | null> {
  const prices = await getProductLocationPrices(productId, businessId, [
    locationId,
  ])
  return (
    prices.find(p => p.locationId === locationId && p.unitId === unitId) || null
  )
}

/**
 * Get all location prices for a specific location
 * Useful for manager view (showing only their assigned location)
 * OPTIMIZED: Single query with joins instead of N+1 queries
 */
export async function getLocationPricesForLocation(
  locationId: number,
  businessId: number,
  productIds?: number[]
): Promise<
  {
    productId: number
    productName: string
    productSKU: string
    prices: LocationUnitPrice[]
  }[]
> {
  console.log(`[getLocationPricesForLocation] Fetching prices for location ${locationId}`)
  const startTime = Date.now()

  // Build where clause for products
  const whereProduct: any = {
    businessId,
    deletedAt: null,
  }

  if (productIds && productIds.length > 0) {
    whereProduct.id = { in: productIds }
  }

  // OPTIMIZED: Single query with all necessary joins
  const productsWithUnits = await prisma.product.findMany({
    where: whereProduct,
    select: {
      id: true,
      name: true,
      sku: true,
      productUnits: {
        select: {
          unitId: true,
          purchasePrice: true,
          sellingPrice: true,
          multiplier: true,
          isBaseUnit: true,
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Get all location-specific prices for this location in one query
  const locationSpecificPrices = await prisma.productUnitLocationPrice.findMany({
    where: {
      businessId,
      locationId,
      ...(productIds && productIds.length > 0 ? { productId: { in: productIds } } : {}),
    },
    select: {
      productId: true,
      unitId: true,
      purchasePrice: true,
      sellingPrice: true,
      lastUpdatedBy: true,
      updatedAt: true,
    },
  })

  // Create a map for fast lookup
  const locationPriceMap = new Map<string, any>()
  locationSpecificPrices.forEach(price => {
    const key = `${price.productId}-${price.unitId}`
    locationPriceMap.set(key, price)
  })

  // Get location name
  const location = await prisma.businessLocation.findUnique({
    where: { id: locationId },
    select: { name: true },
  })

  const locationName = location?.name || 'Unknown'

  // Build result
  const result = productsWithUnits
    .filter(product => product.productUnits.length > 0)
    .map(product => {
      const prices: LocationUnitPrice[] = product.productUnits.map(pu => {
        const key = `${product.id}-${pu.unitId}`
        const locationPrice = locationPriceMap.get(key)

        if (locationPrice) {
          // Use location-specific price
          return {
            locationId,
            locationName,
            unitId: pu.unitId,
            unitName: pu.unit.name,
            unitShortName: pu.unit.shortName,
            purchasePrice: locationPrice.purchasePrice,
            sellingPrice: locationPrice.sellingPrice,
            multiplier: pu.multiplier,
            isBaseUnit: pu.isBaseUnit,
            isLocationSpecific: true,
            lastUpdatedBy: locationPrice.lastUpdatedBy || undefined,
            lastUpdatedAt: locationPrice.updatedAt,
          }
        } else {
          // Use global price
          return {
            locationId,
            locationName,
            unitId: pu.unitId,
            unitName: pu.unit.name,
            unitShortName: pu.unit.shortName,
            purchasePrice: pu.purchasePrice,
            sellingPrice: pu.sellingPrice,
            multiplier: pu.multiplier,
            isBaseUnit: pu.isBaseUnit,
            isLocationSpecific: false,
          }
        }
      })

      return {
        productId: product.id,
        productName: product.name,
        productSKU: product.sku,
        prices,
      }
    })

  const elapsed = Date.now() - startTime
  console.log(
    `[getLocationPricesForLocation] ✅ Fetched ${result.length} products with prices in ${elapsed}ms`
  )

  return result
}

// ============================================================================
// SAVE LOCATION UNIT PRICES
// ============================================================================

/**
 * Save or update location-specific unit prices for a product
 * Only saves prices that differ from global prices (optimization)
 */
export async function saveProductLocationPrices(
  productId: number,
  businessId: number,
  prices: LocationUnitPriceInput[],
  userId: number
): Promise<void> {
  console.log(
    `[saveProductLocationPrices] Saving ${prices.length} location unit prices for product ${productId}`
  )

  // Validate prices
  for (const price of prices) {
    if (price.purchasePrice < 0) {
      throw new Error(
        `Purchase price for unit ${price.unitId} at location ${price.locationId} cannot be negative`
      )
    }
    if (price.sellingPrice < 0) {
      throw new Error(
        `Selling price for unit ${price.unitId} at location ${price.locationId} cannot be negative`
      )
    }
    if (price.sellingPrice < price.purchasePrice) {
      throw new Error(
        `Selling price cannot be less than purchase price for unit ${price.unitId} at location ${price.locationId}`
      )
    }
  }

  // Get global prices for comparison
  const globalPrices = await getProductUnitPrices(productId, businessId)

  // Use transaction for atomicity
  await prisma.$transaction(async tx => {
    // Process each price
    for (const price of prices) {
      const globalPrice = globalPrices.find(gp => gp.unitId === price.unitId)

      if (!globalPrice) {
        console.warn(
          `[saveProductLocationPrices] No global price found for unit ${price.unitId}, skipping`
        )
        continue
      }

      // Check if price is same as global (use Decimal comparison)
      const isSameAsGlobal =
        new Decimal(price.purchasePrice).equals(globalPrice.purchasePrice) &&
        new Decimal(price.sellingPrice).equals(globalPrice.sellingPrice)

      if (isSameAsGlobal) {
        // Delete location-specific price (use global price)
        await tx.productUnitLocationPrice.deleteMany({
          where: {
            productId,
            locationId: price.locationId,
            unitId: price.unitId,
            businessId,
          },
        })
        console.log(
          `[saveProductLocationPrices] Removed location price (same as global) for location ${price.locationId} unit ${price.unitId}`
        )
      } else {
        // Upsert location-specific price
        await tx.productUnitLocationPrice.upsert({
          where: {
            productId_locationId_unitId: {
              productId,
              locationId: price.locationId,
              unitId: price.unitId,
            },
          },
          create: {
            businessId,
            productId,
            locationId: price.locationId,
            unitId: price.unitId,
            purchasePrice: new Decimal(price.purchasePrice),
            sellingPrice: new Decimal(price.sellingPrice),
            lastUpdatedBy: userId,
          },
          update: {
            purchasePrice: new Decimal(price.purchasePrice),
            sellingPrice: new Decimal(price.sellingPrice),
            lastUpdatedBy: userId,
            updatedAt: new Date(),
          },
        })
        console.log(
          `[saveProductLocationPrices] Saved location price for location ${price.locationId} unit ${price.unitId}`
        )
      }
    }
  })

  console.log(
    `[saveProductLocationPrices] ✅ Processed ${prices.length} location unit prices for product ${productId}`
  )
}

/**
 * Delete all location-specific prices for a product
 */
export async function deleteProductLocationPrices(
  productId: number,
  businessId: number
): Promise<void> {
  await prisma.productUnitLocationPrice.deleteMany({
    where: { productId, businessId },
  })
  console.log(
    `[deleteProductLocationPrices] ✅ Deleted all location prices for product ${productId}`
  )
}

/**
 * Delete location-specific prices for a specific location
 */
export async function deleteLocationPrices(
  locationId: number,
  businessId: number
): Promise<void> {
  await prisma.productUnitLocationPrice.deleteMany({
    where: { locationId, businessId },
  })
  console.log(
    `[deleteLocationPrices] ✅ Deleted all location prices for location ${locationId}`
  )
}

// ============================================================================
// BULK OPERATIONS
// ============================================================================

/**
 * Copy global prices to all locations
 * Useful for initial setup or resetting location prices
 */
export async function copyGlobalPricesToLocations(
  productId: number,
  businessId: number,
  locationIds: number[],
  userId: number
): Promise<void> {
  console.log(
    `[copyGlobalPricesToLocations] Copying global prices to ${locationIds.length} locations for product ${productId}`
  )

  // Get global prices
  const globalPrices = await getProductUnitPrices(productId, businessId)

  if (globalPrices.length === 0) {
    throw new Error('No global unit prices found for this product')
  }

  // Build input array
  const prices: LocationUnitPriceInput[] = []

  for (const locationId of locationIds) {
    for (const globalPrice of globalPrices) {
      prices.push({
        locationId,
        unitId: globalPrice.unitId,
        purchasePrice: parseFloat(globalPrice.purchasePrice.toString()),
        sellingPrice: parseFloat(globalPrice.sellingPrice.toString()),
      })
    }
  }

  // Save (this will not create location-specific records since prices match global)
  await saveProductLocationPrices(productId, businessId, prices, userId)

  console.log(
    `[copyGlobalPricesToLocations] ✅ Copied prices to ${locationIds.length} locations`
  )
}

/**
 * Apply percentage adjustment to location prices
 * Useful for bulk price updates (e.g., increase all prices by 10%)
 */
export async function applyPriceAdjustment(
  productId: number,
  businessId: number,
  locationIds: number[],
  purchaseAdjustmentPercent: number,
  sellingAdjustmentPercent: number,
  userId: number
): Promise<void> {
  console.log(
    `[applyPriceAdjustment] Adjusting prices by ${purchaseAdjustmentPercent}%/${sellingAdjustmentPercent}% for product ${productId}`
  )

  // Get current prices
  const currentPrices = await getProductLocationPrices(
    productId,
    businessId,
    locationIds
  )

  // Calculate new prices
  const newPrices: LocationUnitPriceInput[] = currentPrices.map(price => {
    const purchaseMultiplier = new Decimal(1).add(
      new Decimal(purchaseAdjustmentPercent).div(100)
    )
    const sellingMultiplier = new Decimal(1).add(
      new Decimal(sellingAdjustmentPercent).div(100)
    )

    return {
      locationId: price.locationId,
      unitId: price.unitId,
      purchasePrice: parseFloat(
        price.purchasePrice.mul(purchaseMultiplier).toFixed(2)
      ),
      sellingPrice: parseFloat(
        price.sellingPrice.mul(sellingMultiplier).toFixed(2)
      ),
    }
  })

  // Save adjusted prices
  await saveProductLocationPrices(productId, businessId, newPrices, userId)

  console.log(
    `[applyPriceAdjustment] ✅ Adjusted ${newPrices.length} prices`
  )
}
