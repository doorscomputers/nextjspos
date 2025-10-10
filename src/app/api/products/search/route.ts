import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * Smart Product Search API
 *
 * Search logic:
 * 1. If search term matches SKU EXACTLY (equals operator) - return that specific variation
 * 2. If no exact match, search by product name using CONTAINS operator
 *
 * This allows quick SKU/barcode scanning (exact match) while still supporting fuzzy name search
 * Note: Barcode field is not currently in the schema, using SKU for exact matching
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
    const query = searchParams.get('q') || ''
    const limit = parseInt(searchParams.get('limit') || '20')

    if (!query.trim()) {
      return NextResponse.json({ products: [] })
    }

    const businessId = parseInt(session.user.businessId)
    const searchTrimmed = query.trim()

    console.log(`=== Product Search Debug ===`)
    console.log(`Search term: "${searchTrimmed}"`)
    console.log(`Business ID: ${businessId}`)
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
                    barcode: null,
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
                  barcode: null,
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
