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

    // Get summary by status
    const statusSummary = await prisma.stockTransfer.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { select: { id: true, name: true } },
    })

    // Get summary by from location
    const fromLocationSummary = await prisma.stockTransfer.groupBy({
      by: ['fromLocationId'],
      where: whereClause,
      _count: { select: { id: true, name: true } },
    })

    // Get summary by to location
    const toLocationSummary = await prisma.stockTransfer.groupBy({
      by: ['toLocationId'],
      where: whereClause,
      _count: { select: { id: true, name: true } },
    })

    // Fetch location names
    const locationIds = new Set<number>()
    fromLocationSummary.forEach(s => locationIds.add(s.fromLocationId))
    toLocationSummary.forEach(s => locationIds.add(s.toLocationId))

    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: Array.from(locationIds) },
        businessId
      },
      select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } }
    })

    const locationMap = new Map(locations.map(l => [l.id, l.name]))

    // Get total transfers and items
    const totalTransfers = await prisma.stockTransfer.count({ where: whereClause })

    const totalItemsResult = await prisma.stockTransferItem.aggregate({
      where: {
        stockTransfer: whereClause
      },
      _sum: {
        quantity: { select: { id: true, name: true } }
      }
    })

    return NextResponse.json({
      summary: {
        totalTransfers,
        totalItemsTransferred: totalItemsResult._sum.quantity || 0,
        byStatus: statusSummary.map(s => ({
          status: s.status,
          count: s._count,
          percentage: ((s._count / totalTransfers) * 100).toFixed(2)
        })),
        byFromLocation: fromLocationSummary.map(s => ({
          locationId: s.fromLocationId,
          locationName: locationMap.get(s.fromLocationId) || `Location ${s.fromLocationId}`,
          count: s._count,
          percentage: ((s._count / totalTransfers) * 100).toFixed(2)
        })),
        byToLocation: toLocationSummary.map(s => ({
          locationId: s.toLocationId,
          locationName: locationMap.get(s.toLocationId) || `Location ${s.toLocationId}`,
          count: s._count,
          percentage: ((s._count / totalTransfers) * 100).toFixed(2)
        }))
      }
    })
  } catch (error) {
    console.error('Transfer summary report error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate transfer summary report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
