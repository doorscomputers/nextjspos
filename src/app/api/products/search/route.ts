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
          },
          include: {
            variations: {
              where: {
                sku: { equals: searchTrimmed, mode: 'insensitive' },
                deletedAt: null,
              },
              orderBy: { name: 'asc' },
            },
          },
          take: 1,
        })

        const results = exactMatch
          .filter(p => p.variations && p.variations.length > 0)
          .map(product => ({
            id: product.id,
            name: product.name,
            categoryName: null,
            variations: product.variations.map(v => ({
              id: v.id,
              name: v.name,
              sku: v.sku,
              enableSerialNumber: Boolean(product.enableProductInfo),
              defaultPurchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
              defaultSellingPrice: v.sellingPrice ? Number(v.sellingPrice) : 0,
            })),
            matchType: 'exact' as const,
          }))

        return NextResponse.json({ products: results })
      }

      // TYPE 2: PRODUCT NAME PREFIX/CONTAINS SEARCH
      if (type === 'name') {
        const searchCondition = method === 'beginsWith'
          ? { startsWith: searchTrimmed, mode: 'insensitive' as const }
          : { contains: searchTrimmed, mode: 'insensitive' as const }

        const nameMatches = await prisma.product.findMany({
          where: {
            businessId,
            isActive: true,
            deletedAt: null,
            name: searchCondition,
          },
          include: {
            variations: {
              where: { deletedAt: null },
              orderBy: { name: 'asc' },
            },
          },
          orderBy: { name: 'asc' },
          take: limit,
        })

        const results = nameMatches
          .filter(p => p.variations && p.variations.length > 0)
          .map(product => ({
            id: product.id,
            name: product.name,
            categoryName: null,
            variations: product.variations.map(v => ({
              id: v.id,
              name: v.name,
              sku: v.sku,
              enableSerialNumber: Boolean(product.enableProductInfo),
              defaultPurchasePrice: v.purchasePrice ? Number(v.purchasePrice) : 0,
              defaultSellingPrice: v.sellingPrice ? Number(v.sellingPrice) : 0,
            })),
            matchType: 'fuzzy' as const,
          }))

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
        variations: {
          some: {
            sku: { equals: searchTrimmed, mode: 'insensitive' },
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
          },
          orderBy: { name: 'asc' },
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
        OR: [
          { name: { contains: searchTrimmed, mode: 'insensitive' } },
          {
            variations: {
              some: {
                name: { contains: searchTrimmed, mode: 'insensitive' },
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
          // Return ALL variations of matching products, not filtered by search term
          orderBy: { name: 'asc' },
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
