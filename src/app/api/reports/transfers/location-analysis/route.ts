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

    const businessId = parseInt(session.user.businessId)

    const whereClause: any = {
      businessId,
      deletedAt: null
    }

    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) whereClause.createdAt.gte = new Date(startDate + 'T00:00:00')
      if (endDate) whereClause.createdAt.lte = new Date(endDate + 'T23:59:59.999')
    }

    const transfers = await prisma.stockTransfer.findMany({
      where: whereClause,
      include: {
        items: true
      }
    })

    // Fetch all locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true }
    })

    const locationMap = new Map(locations.map(l => [l.id, l]))

    // Analyze transfers by location
    const locationAnalysis = new Map<number, any>()

    locations.forEach(location => {
      locationAnalysis.set(location.id, {
        locationId: location.id,
        locationName: location.name,
        transfersOut: 0,
        transfersIn: 0,
        itemsSent: 0,
        itemsReceived: 0,
        quantitySent: 0,
        quantityReceived: 0,
        netFlow: 0, // Positive = more received than sent
        completedTransfersOut: 0,
        completedTransfersIn: 0
      })
    })

    transfers.forEach(transfer => {
      const fromData = locationAnalysis.get(transfer.fromLocationId)
      const toData = locationAnalysis.get(transfer.toLocationId)

      const isCompleted = transfer.status === 'completed'
      const totalQuantity = transfer.items.reduce(
        (sum, item) => sum + parseFloat(item.quantity.toString()),
        0
      )

      if (fromData) {
        fromData.transfersOut++
        fromData.itemsSent += transfer.items.length
        fromData.quantitySent += totalQuantity
        if (isCompleted) fromData.completedTransfersOut++
      }

      if (toData) {
        toData.transfersIn++
        toData.itemsReceived += transfer.items.length
        toData.quantityReceived += totalQuantity
        if (isCompleted) fromData.completedTransfersIn++
      }
    })

    // Calculate net flow
    locationAnalysis.forEach(data => {
      data.netFlow = data.quantityReceived - data.quantitySent
    })

    // Convert to array and sort by total transfer activity
    const analysisArray = Array.from(locationAnalysis.values())
    analysisArray.sort((a, b) => {
      const aTotal = a.transfersOut + a.transfersIn
      const bTotal = b.transfersOut + b.transfersIn
      return bTotal - aTotal
    })

    // Calculate location pairs (routes)
    const locationPairs = new Map<string, any>()

    transfers.forEach(transfer => {
      const key = `${transfer.fromLocationId}-${transfer.toLocationId}`

      if (!locationPairs.has(key)) {
        locationPairs.set(key, {
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.toLocationId,
          transferCount: 0,
          completedCount: 0,
          totalQuantity: 0
        })
      }

      const pairData = locationPairs.get(key)!
      pairData.transferCount++
      if (transfer.status === 'completed') pairData.completedCount++

      const totalQuantity = transfer.items.reduce(
        (sum, item) => sum + parseFloat(item.quantity.toString()),
        0
      )
      pairData.totalQuantity += totalQuantity
    })

    // Enrich location pairs with names
    const enrichedPairs = Array.from(locationPairs.values())
      .map(pair => ({
        ...pair,
        fromLocation: locationMap.get(pair.fromLocationId)?.name || `Location ${pair.fromLocationId}`,
        toLocation: locationMap.get(pair.toLocationId)?.name || `Location ${pair.toLocationId}`
      }))
      .sort((a, b) => b.transferCount - a.transferCount)

    return NextResponse.json({
      totalLocations: locations.length,
      totalTransfers: transfers.length,
      locationAnalysis: analysisArray,
      topRoutes: enrichedPairs.slice(0, 10), // Top 10 most active routes
      allRoutes: enrichedPairs
    })
  } catch (error) {
    console.error('Location analysis report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate location analysis report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
