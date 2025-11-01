import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const locationId = searchParams.get('locationId')

    const businessId = parseInt(session.user.businessId)

    const whereClause: any = {
      stockTransfer: {
        businessId,
        deletedAt: null
      },
      hasDiscrepancy: { select: { id: true, name: true } } // Only items with discrepancies
    }

    if (startDate || endDate) {
      whereClause.stockTransfer.createdAt = {}
      if (startDate) whereClause.stockTransfer.createdAt.gte = new Date(startDate)
      if (endDate) whereClause.stockTransfer.createdAt.lte = new Date(endDate)
    }

    if (locationId) {
      whereClause.stockTransfer.OR = [
        { fromLocationId: parseInt(locationId) },
        { toLocationId: parseInt(locationId) }
      ]
    }

    const discrepancyItems = await prisma.stockTransferItem.findMany({
      where: whereClause,
      select: {
        stockTransfer: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            transferNumber: { select: { id: true, name: true } },
            fromLocationId: { select: { id: true, name: true } },
            toLocationId: { select: { id: true, name: true } },
            createdAt: { select: { id: true, name: true } },
            verifiedAt: { select: { id: true, name: true } },
            status: { select: { id: true, name: true } }
          }
        }
      }
    })

    // Fetch product and variation details
    const productIds = new Set<number>()
    const variationIds = new Set<number>()
    discrepancyItems.forEach(item => {
      productIds.add(item.productId)
      variationIds.add(item.productVariationId)
    })

    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } }, sku: { select: { id: true, name: true } } }
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } }, sku: { select: { id: true, name: true } } }
    })

    const productMap = new Map(products.map(p => [p.id, p]))
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Fetch location names
    const locationIds = new Set<number>()
    discrepancyItems.forEach(item => {
      locationIds.add(item.stockTransfer.fromLocationId)
      locationIds.add(item.stockTransfer.toLocationId)
    })

    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: Array.from(locationIds) },
        businessId
      },
      select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } }
    })

    const locationMap = new Map(locations.map(l => [l.id, l.name]))

    // Fetch verifier names
    const verifierIds = new Set<number>()
    discrepancyItems.forEach(item => {
      if (item.verifiedBy) verifierIds.add(item.verifiedBy)
    })

    const verifiers = await prisma.user.findMany({
      where: { id: { in: Array.from(verifierIds) } },
      select: { id: { select: { id: true, name: true } }, username: { select: { id: true, name: true } } }
    })

    const verifierMap = new Map(verifiers.map(u => [u.id, u.username]))

    // Enrich discrepancy data
    const enrichedDiscrepancies = discrepancyItems.map(item => {
      const product = productMap.get(item.productId)
      const variation = variationMap.get(item.productVariationId)

      const sentQty = parseFloat(item.quantity.toString())
      const receivedQty = item.receivedQuantity ? parseFloat(item.receivedQuantity.toString()) : sentQty
      const difference = receivedQty - sentQty

      return {
        transferNumber: item.stockTransfer.transferNumber,
        transferStatus: item.stockTransfer.status,
        productName: product?.name || 'Unknown Product',
        variationName: variation?.name || 'Unknown Variation',
        sku: variation?.sku || product?.sku || 'N/A',
        sentQuantity: sentQty,
        receivedQuantity: receivedQty,
        difference: difference,
        differencePercentage: sentQty > 0 ? ((difference / sentQty) * 100).toFixed(2) : '0',
        fromLocation: locationMap.get(item.stockTransfer.fromLocationId) || `Location ${item.stockTransfer.fromLocationId}`,
        toLocation: locationMap.get(item.stockTransfer.toLocationId) || `Location ${item.stockTransfer.toLocationId}`,
        verifiedBy: item.verifiedBy ? verifierMap.get(item.verifiedBy) || 'Unknown' : 'Not Verified',
        verifiedAt: item.verifiedAt,
        discrepancyNotes: item.discrepancyNotes,
        createdAt: item.stockTransfer.createdAt
      }
    })

    // Calculate summary statistics
    const totalDiscrepancies = enrichedDiscrepancies.length
    const totalSentQuantity = enrichedDiscrepancies.reduce((sum, d) => sum + d.sentQuantity, 0)
    const totalReceivedQuantity = enrichedDiscrepancies.reduce((sum, d) => sum + d.receivedQuantity, 0)
    const totalDifference = totalReceivedQuantity - totalSentQuantity

    // Group by location
    const discrepanciesByLocation = new Map<string, number>()
    enrichedDiscrepancies.forEach(d => {
      const key = d.toLocation
      discrepanciesByLocation.set(key, (discrepanciesByLocation.get(key) || 0) + 1)
    })

    // Sort by most recent
    enrichedDiscrepancies.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      summary: {
        totalDiscrepancies,
        totalSentQuantity,
        totalReceivedQuantity,
        totalDifference,
        differencePercentage: totalSentQuantity > 0
          ? ((totalDifference / totalSentQuantity) * 100).toFixed(2)
          : '0',
        byLocation: Array.from(discrepanciesByLocation.entries()).map(([location, count]) => ({
          location,
          count
        }))
      },
      discrepancies: enrichedDiscrepancies
    })
  } catch (error) {
    console.error('Stock discrepancy report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate stock discrepancy report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
