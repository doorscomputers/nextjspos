import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/admin/populate-location-prices
 * Populate location-specific unit prices for all locations based on global prices
 * Admin only
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(session.user.businessId)

    // Check admin permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_PRICE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { overwriteExisting = false } = body

    // Get all products with unit prices for this business
    const products = await prisma.product.findMany({
      where: {
        businessId,
        unitPrices: {
          some: {}
        }
      },
      include: {
        unitPrices: {
          include: {
            unit: true
          }
        }
      }
    })

    // Get all business locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: {
        id: true,
        name: true,
        businessId: true
      }
    })

    let created = 0
    let updated = 0
    let skipped = 0

    // For each product
    for (const product of products) {
      // For each location
      for (const location of locations) {
        // For each unit price
        for (const unitPrice of product.unitPrices) {
          // Check if location-specific price already exists
          const existing = await prisma.productUnitLocationPrice.findUnique({
            where: {
              productId_locationId_unitId: {
                productId: product.id,
                locationId: location.id,
                unitId: unitPrice.unitId
              }
            }
          })

          if (existing) {
            if (overwriteExisting) {
              // Update existing price
              await prisma.productUnitLocationPrice.update({
                where: {
                  productId_locationId_unitId: {
                    productId: product.id,
                    locationId: location.id,
                    unitId: unitPrice.unitId
                  }
                },
                data: {
                  purchasePrice: unitPrice.purchasePrice,
                  sellingPrice: unitPrice.sellingPrice,
                  lastUpdatedBy: parseInt(session.user.id),
                  updatedAt: new Date()
                }
              })
              updated++
            } else {
              // Skip if already exists
              skipped++
            }
          } else {
            // Create location-specific price from global price
            await prisma.productUnitLocationPrice.create({
              data: {
                businessId,
                productId: product.id,
                locationId: location.id,
                unitId: unitPrice.unitId,
                purchasePrice: unitPrice.purchasePrice,
                sellingPrice: unitPrice.sellingPrice,
                lastUpdatedBy: parseInt(session.user.id)
              }
            })
            created++
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Location prices populated successfully',
      data: {
        created,
        updated,
        skipped,
        totalLocations: locations.length,
        totalProducts: products.length
      }
    })

  } catch (error) {
    console.error('Error populating location prices:', error)
    return NextResponse.json(
      {
        error: 'Failed to populate location prices',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
