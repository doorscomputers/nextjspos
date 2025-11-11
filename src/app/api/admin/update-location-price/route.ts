import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/admin/update-location-price
 * Quick admin tool to update prices for a specific product/location
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(session.user.businessId)
    const userId = parseInt(session.user.id)

    // Check admin permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_PRICE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { productName, locationName, unitPrices } = body

    if (!productName || !locationName || !Array.isArray(unitPrices)) {
      return NextResponse.json({
        error: 'productName, locationName, and unitPrices array are required',
        example: {
          productName: 'Sample UTP CABLE',
          locationName: 'Bambang',
          unitPrices: [
            { unitName: 'Roll', purchasePrice: 1900, sellingPrice: 2014 },
            { unitName: 'Meter', purchasePrice: 8, sellingPrice: 9 }
          ]
        }
      }, { status: 400 })
    }

    // Find product
    const product = await prisma.product.findFirst({
      where: {
        name: productName,
        businessId
      },
      select: { id: true, name: true }
    })

    if (!product) {
      return NextResponse.json({ error: `Product "${productName}" not found` }, { status: 404 })
    }

    // Find location
    const location = await prisma.businessLocation.findFirst({
      where: {
        name: locationName,
        businessId
      },
      select: { id: true, name: true }
    })

    if (!location) {
      return NextResponse.json({ error: `Location "${locationName}" not found` }, { status: 404 })
    }

    // Get unit IDs from names
    const unitNames = unitPrices.map(up => up.unitName)
    const units = await prisma.unit.findMany({
      where: {
        name: { in: unitNames },
        businessId
      },
      select: { id: true, name: true }
    })

    if (units.length !== unitNames.length) {
      return NextResponse.json({
        error: 'Some units not found',
        requested: unitNames,
        found: units.map(u => u.name)
      }, { status: 404 })
    }

    // Update prices
    const results = []
    for (const unitPriceData of unitPrices) {
      const unit = units.find(u => u.name === unitPriceData.unitName)
      if (!unit) continue

      const result = await prisma.productUnitLocationPrice.upsert({
        where: {
          productId_locationId_unitId: {
            productId: product.id,
            locationId: location.id,
            unitId: unit.id
          }
        },
        update: {
          purchasePrice: unitPriceData.purchasePrice,
          sellingPrice: unitPriceData.sellingPrice,
          lastUpdatedBy: userId,
          updatedAt: new Date()
        },
        create: {
          businessId,
          productId: product.id,
          locationId: location.id,
          unitId: unit.id,
          purchasePrice: unitPriceData.purchasePrice,
          sellingPrice: unitPriceData.sellingPrice,
          lastUpdatedBy: userId
        }
      })

      results.push({
        unit: unit.name,
        purchasePrice: result.purchasePrice,
        sellingPrice: result.sellingPrice
      })
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} unit price(s) for ${product.name} at ${location.name}`,
      data: {
        product: product.name,
        location: location.name,
        prices: results
      }
    })

  } catch (error) {
    console.error('Error updating location price:', error)
    return NextResponse.json(
      {
        error: 'Failed to update location price',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
