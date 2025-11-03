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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const productId = searchParams.get('productId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    const businessId = parseInt(session.user.businessId)

    const whereClause: any = {
      stockTransfer: {
        businessId,
        deletedAt: null,
        status: 'completed' // Only completed transfers affect inventory
      }
    }

    if (startDate || endDate) {
      whereClause.stockTransfer.createdAt = {}
      if (startDate) whereClause.stockTransfer.createdAt.gte = new Date(startDate + 'T00:00:00')
      if (endDate) whereClause.stockTransfer.createdAt.lte = new Date(endDate + 'T23:59:59.999')
    }

    if (productId) {
      whereClause.productId = parseInt(productId)
    }

    if (locationId) {
      whereClause.stockTransfer.OR = [
        { fromLocationId: parseInt(locationId) },
        { toLocationId: parseInt(locationId) }
      ]
    }

    const transferItems = await prisma.stockTransferItem.findMany({
      where: whereClause,
      include: {
        stockTransfer: {
          select: {
            id: true,
            transferNumber: true,
            fromLocationId: true,
            toLocationId: true,
            createdAt: true,
            completedAt: true
          }
        }
      }
    })

    // Group by product and variation
    const movementByProduct = new Map<string, any>()

    transferItems.forEach(item => {
      const key = `${item.productId}-${item.productVariationId}`

      if (!movementByProduct.has(key)) {
        movementByProduct.set(key, {
          productId: item.productId,
          productVariationId: item.productVariationId,
          totalQuantityMoved: 0,
          transferCount: 0,
          transfers: []
        })
      }

      const productData = movementByProduct.get(key)!
      productData.totalQuantityMoved += parseFloat(item.quantity.toString())
      productData.transferCount += 1
      productData.transfers.push({
        transferNumber: item.stockTransfer.transferNumber,
        quantity: parseFloat(item.quantity.toString()),
        fromLocationId: item.stockTransfer.fromLocationId,
        toLocationId: item.stockTransfer.toLocationId,
        completedAt: item.stockTransfer.completedAt
      })
    })

    // Fetch product and variation details
    const productIds = new Set<number>()
    const variationIds = new Set<number>()
    movementByProduct.forEach(data => {
      productIds.add(data.productId)
      variationIds.add(data.productVariationId)
    })

    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true, sku: true }
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, name: true, sku: true }
    })

    const productMap = new Map(products.map(p => [p.id, p]))
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Fetch location names
    const locationIds = new Set<number>()
    transferItems.forEach(item => {
      locationIds.add(item.stockTransfer.fromLocationId)
      locationIds.add(item.stockTransfer.toLocationId)
    })

    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: Array.from(locationIds) },
        businessId
      },
      select: { id: true, name: true }
    })

    const locationMap = new Map(locations.map(l => [l.id, l.name]))

    // Enrich data
    const enrichedMovement = Array.from(movementByProduct.values()).map(data => {
      const product = productMap.get(data.productId)
      const variation = variationMap.get(data.productVariationId)

      return {
        productName: product?.name || 'Unknown Product',
        variationName: variation?.name || 'Unknown Variation',
        sku: variation?.sku || product?.sku || 'N/A',
        totalQuantityMoved: data.totalQuantityMoved,
        transferCount: data.transferCount,
        transfers: data.transfers.map((t: any) => ({
          ...t,
          fromLocation: locationMap.get(t.fromLocationId) || `Location ${t.fromLocationId}`,
          toLocation: locationMap.get(t.toLocationId) || `Location ${t.toLocationId}`
        }))
      }
    })

    // Sort by total quantity moved (descending)
    enrichedMovement.sort((a, b) => b.totalQuantityMoved - a.totalQuantityMoved)

    return NextResponse.json({
      totalProducts: enrichedMovement.length,
      totalQuantityMoved: enrichedMovement.reduce((sum, p) => sum + p.totalQuantityMoved, 0),
      totalTransfers: transferItems.length,
      movements: enrichedMovement
    })
  } catch (error) {
    console.error('Inventory movement report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate inventory movement report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
