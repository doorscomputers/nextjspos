import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * Optimized Product Search API
 *
 * TWO MODES:
 * 1. LEGACY MODE (backward compatible): Uses 'q' parameter
 *    - Tries exact SKU match first, then fuzzy name search
 *
 * 2. OPTIMIZED MODE (new): Uses 'type' and 'method' parameters
 *    - type=sku: Exact match on SKU/Barcode (FAST ⚡)
 *    - type=name&method=beginsWith: Prefix search (FAST ⚡)
 *    - type=name&method=contains: Full text search (SLOWER 🐌)
 *
 * EXAMPLES:
 * Legacy: /api/products/search?q=ABC123
 * SKU: /api/products/search?type=sku&query=ABC123
 * Name: /api/products/search?type=name&query=Product&method=beginsWith
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams

    // NEW OPTIMIZED PARAMETERS
    const type = searchParams.get('type') // "sku" | "name"
    const query = searchParams.get('query') // New optimized query param
    const method = searchParams.get('method') || 'beginsWith' // "beginsWith" | "contains"

    // LEGACY PARAMETERS (backward compatibility)
    const legacyQuery = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '20')
    const supplierId = searchParams.get('supplierId') // Optional supplier filter

    // NEW PERFORMANCE FILTERS
    const locationId = searchParams.get('locationId') // Filter by location (for transfer/POS)
    const withStock = searchParams.get('withStock') === 'true' // Only products with stock > 0

    const businessId = parseInt(session.user.businessId)

    // ================================================================
    // OPTIMIZED MODE: Use 'type' and 'query' parameters
    // ================================================================
    if (type && query) {
      const searchTrimmed = query.trim()

      if (!searchTrimmed) {
        return NextResponse.json({ products: [] })
      }

      // TYPE 1: SKU EXACT MATCH (FASTEST)
      if (type === 'sku') {
        const whereConditions: any = {
          businessId,
          isActive: true,
          deletedAt: null,
          variations: {
            some: {
              sku: { equals: searchTrimmed, mode: 'insensitive' },
              deletedAt: null,
            },
          },
        }

        // Add stock filter for transfer/POS (only products with stock > 0 OR notForSelling items)
        if (withStock && locationId) {
          // Use OR to include products that either have stock OR are "Not for Selling" (services/charges)
          whereConditions.OR = [
            {
              variations: {
                some: {
                  sku: { equals: searchTrimmed, mode: 'insensitive' },
                  deletedAt: null,
                  variationLocationDetails: {
                    some: {
                      locationId: parseInt(locationId),
                      qtyAvailable: { gt: 0 },
                    },
                  },
                },
              },
            },
            {
              notForSelling: true, // Always include service items regardless of stock
              variations: {
                some: {
                  sku: { equals: searchTrimmed, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
            },
          ]
          // Remove the default variations filter since we're using OR
          delete whereConditions.variations
        }

        const exactMatch = await prisma.product.findMany({
          where: whereConditions,
          include: {
            variations: {
              where: {
                sku: { equals: searchTrimmed, mode: 'insensitive' },
                deletedAt: null,
              },
              include: withStock && locationId ? {
                variationLocationDetails: {
                  where: {
                    locationId: parseInt(locationId),
                  },
                  select: {
                    qtyAvailable: true,
                  },
                },
              } : undefined,
              orderBy: { name: 'asc' },
            },
          },
          take: 1,
        })

        const results = exactMatch
          .filter(p => p.variations && p.variations.length > 0)
          .map(product => {
            const variations = product.variations
              .filter(v => {
                // If withStock filter is enabled, only include variations with stock > 0
                // BUT always include "Not for Selling" items (services/charges) regardless of stock
                if (withStock && locationId && v.variationLocationDetails && !product.notForSelling) {
                  const stockRecord = v.variationLocationDetails[0]
                  const stock = stockRecord ? Number(stockRecord.qtyAvailable) : 0
                  return stock > 0
                }
                return true
              })
              .map((v: any) => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                enableSerialNumber: Boolean(product.enableProductInfo),
                defaultPurchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
                defaultSellingPrice: v.sellingPrice ? Number(v.sellingPrice) : 0,
                // Include stock quantity if requested (services always show 0 stock but are still available)
                stock: withStock && locationId && v.variationLocationDetails
                  ? Number(v.variationLocationDetails[0]?.qtyAvailable || 0)
                  : undefined,
                notForSelling: product.notForSelling, // Include flag for POS to identify services
              }))

            return {
              id: product.id,
              name: product.name,
              categoryName: null,
              variations,
              matchType: 'exact' as const,
              notForSelling: product.notForSelling, // Include at product level too
            }
          })
          .filter(p => p.variations.length > 0) // Remove products with no valid variations

        return NextResponse.json({ products: results })
      }

      // TYPE 2: PRODUCT NAME PREFIX/CONTAINS SEARCH
      if (type === 'name') {
        const searchCondition = method === 'beginsWith'
          ? { startsWith: searchTrimmed, mode: 'insensitive' as const }
          : { contains: searchTrimmed, mode: 'insensitive' as const }

        const whereConditions: any = {
          businessId,
          isActive: true,
          deletedAt: null,
          name: searchCondition,
        }

        // Add stock filter for transfer/POS (only products with stock > 0 OR notForSelling items)
        if (withStock && locationId) {
          // Use OR to include products that either have stock OR are "Not for Selling" (services/charges)
          whereConditions.OR = [
            {
              variations: {
                some: {
                  deletedAt: null,
                  variationLocationDetails: {
                    some: {
                      locationId: parseInt(locationId),
                      qtyAvailable: { gt: 0 },
                    },
                  },
                },
              },
            },
            {
              notForSelling: true, // Always include service items regardless of stock
            },
          ]
        }

        const nameMatches = await prisma.product.findMany({
          where: whereConditions,
          include: {
            variations: {
              where: { deletedAt: null },
              include: withStock && locationId ? {
                variationLocationDetails: {
                  where: {
                    locationId: parseInt(locationId),
                  },
                  select: {
                    qtyAvailable: true,
                  },
                },
              } : undefined,
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
          take: limit,
        })

        const results = nameMatches
          .filter(p => p.variations && p.variations.length > 0)
          .map(product => {
            const variations = product.variations
              .filter(v => {
                // If withStock filter is enabled, only include variations with stock > 0
                // BUT always include "Not for Selling" items (services/charges) regardless of stock
                if (withStock && locationId && v.variationLocationDetails && !product.notForSelling) {
                  const stockRecord = v.variationLocationDetails[0]
                  const stock = stockRecord ? Number(stockRecord.qtyAvailable) : 0
                  return stock > 0
                }
                return true
              })
              .map((v: any) => ({
                id: v.id,
                name: v.name,
                sku: v.sku,
                enableSerialNumber: Boolean(product.enableProductInfo),
                defaultPurchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
                defaultSellingPrice: v.sellingPrice ? Number(v.sellingPrice) : 0,
                // Include stock quantity if requested (services always show 0 stock but are still available)
                stock: withStock && locationId && v.variationLocationDetails
                  ? Number(v.variationLocationDetails[0]?.qtyAvailable || 0)
                  : undefined,
                notForSelling: product.notForSelling, // Include flag for POS to identify services
              }))

            return {
              id: product.id,
              name: product.name,
              categoryName: null,
              notForSelling: product.notForSelling, // Include at product level too
              variations,
              matchType: 'fuzzy' as const,
            }
          })
          .filter(p => p.variations.length > 0) // Remove products with no valid variations

        console.log(`[Product Search] Found ${results.length} products with stock at location ${locationId}`)

        return NextResponse.json({ products: results })
      }

      return NextResponse.json(
        { error: 'Invalid type. Use "sku" or "name"' },
        { status: 400 }
      )
    }

    // ================================================================
    // LEGACY MODE: Use 'q' parameter (backward compatibility)
    // ================================================================
    if (!legacyQuery.trim()) {
      return NextResponse.json({ products: [] })
    }

    const searchTrimmed = legacyQuery.trim()

    console.log(`=== Product Search Debug ===`)
    console.log(`Search term: "${searchTrimmed}"`)
    console.log(`Business ID: ${businessId}`)
    console.log(`Supplier ID filter: ${supplierId || 'none'}`)
    console.log(`User: ${session.user.username}`)

    // Step 1: Try exact SKU match first (EQUALS operator)
    const exactMatch = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        deletedAt: null,
        variations: {
          some: {
            sku: { equals: searchTrimmed, mode: 'insensitive' },
            deletedAt: null,
          },
        },
        // Filter by supplier if supplierId is provided
        ...(supplierId ? {
          purchaseItems: {
            some: {
              purchase: {
                supplierId: parseInt(supplierId),
                businessId,
              },
            },
          },
        } : {}),
      },
      include: {
        variations: {
          where: {
            sku: { equals: searchTrimmed, mode: 'insensitive' },
            deletedAt: null,
          },
          orderBy: { name: 'asc' },
        },
        // OPTIMIZATION: Include unit configuration for unit pricing
        unit: {
          include: {
            baseUnit: true,
          },
        },
        unitPrices: {
          include: {
            unit: true,
          },
        },
      },
      take: 5,
    })

    // If exact SKU match found, return immediately
    if (exactMatch.length > 0) {
      const results = exactMatch
        .filter(p => p.variations && p.variations.length > 0)
        .map(product => {
          try {
            return {
              id: product.id,
              name: product.name,
              categoryName: null,
              variations: product.variations.map(v => {
                try {
                  return {
                    id: v.id,
                    name: v.name,
                    sku: v.sku,
                    enableSerialNumber: Boolean(product.enableProductInfo),
                    defaultPurchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
                    defaultSellingPrice: v.sellingPrice ? Number(v.sellingPrice) : 0,
                  }
                } catch (err) {
                  console.error('Error mapping variation:', err)
                  throw err
                }
              }),
              matchType: 'exact' as const,
              // OPTIMIZATION: Include unit configuration for purchase page
              unit: product.unit ? {
                id: product.unit.id,
                name: product.unit.name,
                shortName: product.unit.shortName,
                baseUnitMultiplier: product.unit.baseUnitMultiplier ? Number(product.unit.baseUnitMultiplier) : 1,
                baseUnit: product.unit.baseUnit,
              } : null,
              unitPrices: product.unitPrices ? product.unitPrices.map((up: any) => ({
                unitId: up.unitId,
                purchasePrice: Number(up.purchasePrice),
                sellingPrice: Number(up.sellingPrice),
              })) : [],
              subUnitIds: product.subUnitIds,
            }
          } catch (err) {
            console.error('Error mapping product:', err)
            throw err
          }
        })

      return NextResponse.json({ products: results })
    }

    // Step 2: No exact match - search by product name or variation name (CONTAINS operator)
    console.log('No exact SKU match found, trying fuzzy search...')
    const fuzzyMatches = await prisma.product.findMany({
      where: {
        businessId,
        isActive: true,
        deletedAt: null,
        OR: [
          { name: { contains: searchTrimmed, mode: 'insensitive' } },
          {
            variations: {
              some: {
                name: { contains: searchTrimmed, mode: 'insensitive' },
                deletedAt: null,
              },
            },
          },
        ],
        // Filter by supplier if supplierId is provided
        ...(supplierId ? {
          purchaseItems: {
            some: {
              purchase: {
                supplierId: parseInt(supplierId),
                businessId,
              },
            },
          },
        } : {}),
      },
      include: {
        variations: {
          where: {
            deletedAt: null,
          },
          // Return ALL variations of matching products, not filtered by search term
          orderBy: { name: 'asc' },
        },
        // OPTIMIZATION: Include unit configuration for unit pricing
        unit: {
          include: {
            baseUnit: true,
          },
        },
        unitPrices: {
          include: {
            unit: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: limit,
    })

    console.log(`Fuzzy search found ${fuzzyMatches.length} products`)
    fuzzyMatches.forEach(p => {
      console.log(`  - ${p.name} (${p.variations.length} variations)`)
    })

    const results = fuzzyMatches
      .filter(p => p.variations && p.variations.length > 0)
      .map(product => {
        try {
          return {
            id: product.id,
            name: product.name,
            categoryName: null,
            variations: product.variations.map(v => {
              try {
                return {
                  id: v.id,
                  name: v.name,
                  sku: v.sku,
                  enableSerialNumber: Boolean(product.enableProductInfo),
                  defaultPurchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
                  defaultSellingPrice: v.sellingPrice ? Number(v.sellingPrice) : 0,
                }
              } catch (err) {
                console.error('Error mapping variation:', err)
                throw err
              }
            }),
            matchType: 'fuzzy' as const,
            // OPTIMIZATION: Include unit configuration for purchase page
            unit: product.unit ? {
              id: product.unit.id,
              name: product.unit.name,
              shortName: product.unit.shortName,
              baseUnitMultiplier: product.unit.baseUnitMultiplier ? Number(product.unit.baseUnitMultiplier) : 1,
              baseUnit: product.unit.baseUnit,
            } : null,
            unitPrices: product.unitPrices ? product.unitPrices.map((up: any) => ({
              unitId: up.unitId,
              purchasePrice: Number(up.purchasePrice),
              sellingPrice: Number(up.sellingPrice),
            })) : [],
            subUnitIds: product.subUnitIds,
          }
        } catch (err) {
          console.error('Error mapping product:', err)
          throw err
        }
      })

    console.log(`Returning ${results.length} products after filtering`)
    console.log(`=== End Product Search ===\n`)

    return NextResponse.json({ products: results })
  } catch (error) {
    console.error('Error searching products:', error)
    console.error('Error details:', error instanceof Error ? error.message : String(error))
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      {
        error: 'Failed to search products',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
