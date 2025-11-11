import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/products/unit-prices?productId=123&locationIds=2,3,4
 * Get all unit prices for a product (global or location-specific)
 */

// Disable caching for pricing data - must always be fresh
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)
    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('productId') || '')
    const locationIdsParam = searchParams.get('locationIds')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Parse location IDs if provided
    const locationIds = locationIdsParam
      ? locationIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      : []

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        subUnitIds: true,
        unitId: true,
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Parse sub-unit IDs
    const subUnitIds = product.subUnitIds
      ? (typeof product.subUnitIds === 'string'
          ? JSON.parse(product.subUnitIds)
          : product.subUnitIds)
      : []

    // Get all units (primary + sub-units)
    const allUnitIds = [product.unitId, ...subUnitIds].filter(Boolean)
    const units = await prisma.unit.findMany({
      where: {
        id: { in: allUnitIds },
      },
      select: {
        id: true,
        name: true,
        shortName: true,
      },
    })

    // Determine which prices to fetch
    let unitPrices: any[] = []

    if (locationIds.length > 0) {
      // Fetch location-specific prices for the first location (for simplicity in the editor)
      const locationId = locationIds[0]

      const locationSpecificPrices = await prisma.productUnitLocationPrice.findMany({
        where: {
          productId,
          locationId,
          businessId,
        },
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
        orderBy: {
          unitId: 'asc',
        },
      })

      // Fallback to global prices if location-specific not found
      const globalPrices = await prisma.productUnitPrice.findMany({
        where: {
          productId,
          businessId,
        },
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
        orderBy: {
          unitId: 'asc',
        },
      })

      // Merge: prefer location-specific, fallback to global
      const priceMap = new Map()

      // First add global prices
      globalPrices.forEach(gp => {
        priceMap.set(gp.unitId, {
          ...gp,
          isLocationSpecific: false,
        })
      })

      // Then override with location-specific prices
      locationSpecificPrices.forEach(lsp => {
        priceMap.set(lsp.unitId, {
          id: lsp.id,
          unitId: lsp.unitId,
          unit: lsp.unit,
          purchasePrice: lsp.purchasePrice,
          sellingPrice: lsp.sellingPrice,
          isLocationSpecific: true,
        })
      })

      unitPrices = Array.from(priceMap.values())
    } else {
      // Fetch global prices only
      unitPrices = await prisma.productUnitPrice.findMany({
        where: {
          productId,
          businessId,
        },
        include: {
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            },
          },
        },
        orderBy: {
          unitId: 'asc',
        },
      })
    }

    const response = NextResponse.json({
      success: true,
      data: {
        product,
        units,
        unitPrices,
      },
    })

    // Prevent browser caching of pricing data
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response
  } catch (error) {
    console.error('Error fetching unit prices:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch unit prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/unit-prices
 * Update or create unit prices for a product
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)
    const userId = parseInt(session.user.id) // FIX: Add userId
    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_PRICE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, unitPrices, locationIds } = body

    if (!productId || !Array.isArray(unitPrices)) {
      return NextResponse.json(
        { error: 'productId and unitPrices array are required' },
        { status: 400 }
      )
    }

    // Determine if this is location-specific pricing
    const isLocationSpecific = locationIds && Array.isArray(locationIds) && locationIds.length > 0

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Update unit prices in transaction
    const results = await prisma.$transaction(async (tx) => {
      const updates = []

      if (isLocationSpecific) {
        // Save location-specific unit prices
        for (const locationId of locationIds) {
          for (const { unitId, purchasePrice, sellingPrice } of unitPrices) {
            const result = await tx.productUnitLocationPrice.upsert({
              where: {
                productId_locationId_unitId: {
                  productId,
                  locationId,
                  unitId,
                },
              },
              update: {
                purchasePrice: parseFloat(purchasePrice),
                sellingPrice: parseFloat(sellingPrice),
                lastUpdatedBy: userId,
                updatedAt: new Date(),
              },
              create: {
                businessId,
                productId,
                locationId,
                unitId,
                purchasePrice: parseFloat(purchasePrice),
                sellingPrice: parseFloat(sellingPrice),
                lastUpdatedBy: userId,
              },
            })

            updates.push(result)
          }
        }
      } else {
        // Save global unit prices
        for (const { unitId, purchasePrice, sellingPrice } of unitPrices) {
          const result = await tx.productUnitPrice.upsert({
            where: {
              productId_unitId: {
                productId,
                unitId,
              },
            },
            update: {
              purchasePrice: parseFloat(purchasePrice),
              sellingPrice: parseFloat(sellingPrice),
            },
            create: {
              businessId,
              productId,
              unitId,
              purchasePrice: parseFloat(purchasePrice),
              sellingPrice: parseFloat(sellingPrice),
            },
          })

          updates.push(result)
        }
      }

      return updates
    })

    return NextResponse.json({
      success: true,
      message: isLocationSpecific
        ? `Updated ${results.length} location-specific unit price(s)`
        : `Updated ${results.length} unit price(s)`,
      data: results,
    })
  } catch (error) {
    console.error('Error updating unit prices:', error)

    // Detailed error logging
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }

    return NextResponse.json(
      {
        error: 'Failed to update unit prices',
        details: error instanceof Error ? error.message : 'Unknown error',
        errorType: error instanceof Error ? error.name : typeof error,
      },
      { status: 500 }
    )
  }
}
