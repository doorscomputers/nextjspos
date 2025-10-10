import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Fetch all variation location details with related data
    const stockData = await prisma.variationLocationDetails.findMany({
      where: {
        product: {
          businessId: parseInt(businessId),
          deletedAt: null
        }
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            unit: true
          }
        },
        productVariation: {
          include: {
            unit: true
          }
        }
      },
      orderBy: {
        product: {
          name: 'asc'
        }
      }
    })

    // Get location names
    const locationIds = [...new Set(stockData.map(item => item.locationId))]
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: locationIds },
        deletedAt: null
      }
    })

    const locationMap = Object.fromEntries(
      locations.map(loc => [loc.id, loc.name])
    )

    // Transform data for frontend
    const stock = stockData.map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productSku: item.product.sku,
      productImage: item.product.image,
      variationId: item.productVariation.id,
      variationName: item.productVariation.name,
      variationSku: item.productVariation.sku,
      locationId: item.locationId,
      locationName: locationMap[item.locationId] || 'Unknown',
      qtyAvailable: parseFloat(item.qtyAvailable.toString()),
      unit: item.productVariation.unit?.shortName || item.product.unit?.shortName || 'N/A',
      category: item.product.category?.name || '',
      brand: item.product.brand?.name || '',
      sellingPrice: parseFloat(item.productVariation.sellingPrice?.toString() || '0')
    }))

    return NextResponse.json({ stock })
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
}
