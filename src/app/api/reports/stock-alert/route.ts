import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    const businessId = parseInt(session.user.businessId)

    // Get ALL products with alert quantity set
    const allProductsWithAlerts = await prisma.variationLocationDetails.findMany({
      where: {
        ...(locationId && locationId !== 'all' ? { locationId: parseInt(locationId) } : {}),
        product: {
          businessId,
          alertQuantity: { not: null },
        },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            alertQuantity: true,
            category: {
              select: {
                name: true,
              },
            },
          },
        },
        productVariation: {
          select: {
            name: true,
          },
        },
      },
      orderBy: [
        { product: { name: 'asc' } },
        { locationId: 'asc' },
      ],
    })

    // Fetch location names for all unique locationIds
    const locationIds = [...new Set(allProductsWithAlerts.map(item => item.locationId))]
    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    })
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

    // Filter to find products where current quantity is below or equal to alert quantity
    const stockAlerts = allProductsWithAlerts.filter((item) => {
      const alertQty = item.product.alertQuantity
        ? parseFloat(item.product.alertQuantity.toString())
        : 0
      const currentQty = parseFloat(item.qtyAvailable.toString())
      return alertQty > 0 && currentQty <= alertQty
    })

    // Get location name if filtering by specific location
    let locationName = 'All Locations'
    if (locationId && locationId !== 'all') {
      const location = await prisma.businessLocation.findUnique({
        where: { id: parseInt(locationId) },
        select: { name: true },
      })
      locationName = location?.name || 'Unknown Location'
    }

    return NextResponse.json({
      success: true,
      data: {
        locationId: locationId || 'all',
        locationName,
        totalProducts: allProductsWithAlerts.length,
        lowStockCount: stockAlerts.length,
        alerts: stockAlerts.map((item) => ({
          id: item.id,
          productId: item.product.id,
          productName: item.product.name,
          variationName: item.productVariation.name,
          sku: item.product.sku,
          category: item.product.category?.name || 'Uncategorized',
          locationId: item.locationId,
          locationName: locationMap.get(item.locationId) || 'Unknown Location',
          currentQty: parseFloat(item.qtyAvailable.toString()),
          alertQty: parseFloat(item.product.alertQuantity?.toString() || '0'),
          difference: parseFloat(item.product.alertQuantity?.toString() || '0') - parseFloat(item.qtyAvailable.toString()),
          percentageOfAlert: (parseFloat(item.qtyAvailable.toString()) / parseFloat(item.product.alertQuantity?.toString() || '1')) * 100,
        })),
      },
    })
  } catch (error) {
    console.error('Stock alert report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate stock alert report',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
