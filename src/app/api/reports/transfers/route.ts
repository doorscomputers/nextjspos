import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)

    // Filters
    const fromLocationId = searchParams.get('fromLocationId')
    const toLocationId = searchParams.get('toLocationId')
    const status = searchParams.get('status')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const transferNumber = searchParams.get('transferNumber')

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    const businessId = parseInt(session.user.businessId)

    // Build where clause
    const whereClause: any = { businessId }

    if (fromLocationId && fromLocationId !== 'all') {
      whereClause.fromLocationId = parseInt(fromLocationId)
    }

    if (toLocationId && toLocationId !== 'all') {
      whereClause.toLocationId = parseInt(toLocationId)
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (transferNumber) {
      whereClause.transferNumber = { contains: transferNumber }
    }

    // Date range filter
    if (startDate || endDate) {
      whereClause.createdAt = {}
      if (startDate) {
        whereClause.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(endDate)
      }
    }

    // Get total count
    const totalCount = await prisma.stockTransfer.count({ where: whereClause })

    // Get transfers data
    const transfers = await prisma.stockTransfer.findMany({
      where: whereClause,
      include: {
        fromLocation: {
          select: {
            id: true,
            name: true,
          },
        },
        toLocation: {
          select: {
            id: true,
            name: true,
          },
        },
        originChecker: {
          select: {
            name: true,
            username: true,
          },
        },
        destinationReceiver: {
          select: {
            name: true,
            username: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            productVariation: {
              select: {
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Calculate summary statistics by status
    const statusSummary = await prisma.stockTransfer.groupBy({
      by: ['status'],
      where: { businessId },
      _count: true,
    })

    const summaryData = {
      totalTransfers: totalCount,
      byStatus: Object.fromEntries(
        statusSummary.map((s) => [s.status, s._count])
      ),
    }

    // Format transfers data
    const formattedTransfers = transfers.map((transfer) => {
      const totalQuantity = transfer.items.reduce(
        (sum, item) => sum + parseFloat(item.quantity.toString()),
        0
      )

      return {
        id: transfer.id,
        transferNumber: transfer.transferNumber,
        status: transfer.status,
        fromLocation: transfer.fromLocation.name,
        fromLocationId: transfer.fromLocationId,
        toLocation: transfer.toLocation.name,
        toLocationId: transfer.toLocationId,
        createdAt: transfer.createdAt.toISOString().split('T')[0],
        submittedAt: transfer.submittedAt
          ? transfer.submittedAt.toISOString().split('T')[0]
          : null,
        checkedAt: transfer.checkedAt
          ? transfer.checkedAt.toISOString().split('T')[0]
          : null,
        approvedAt: transfer.approvedAt
          ? transfer.approvedAt.toISOString().split('T')[0]
          : null,
        sentAt: transfer.sentAt ? transfer.sentAt.toISOString().split('T')[0] : null,
        arrivedAt: transfer.arrivedAt
          ? transfer.arrivedAt.toISOString().split('T')[0]
          : null,
        verifiedAt: transfer.verifiedAt
          ? transfer.verifiedAt.toISOString().split('T')[0]
          : null,
        completedAt: transfer.completedAt
          ? transfer.completedAt.toISOString().split('T')[0]
          : null,
        originChecker: transfer.originChecker
          ? transfer.originChecker.name
          : null,
        destinationReceiver: transfer.destinationReceiver
          ? transfer.destinationReceiver.name
          : null,
        itemCount: transfer.items.length,
        totalQuantity,
        stockDeducted: transfer.stockDeducted,
        items: transfer.items.map((item) => ({
          productName: item.product.name,
          variationName: item.productVariation.name,
          sku: item.productVariation.sku,
          quantity: parseFloat(item.quantity.toString()),
          unitCost: parseFloat(item.unitCost.toString()),
          totalValue:
            parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString()),
        })),
        notes: transfer.notes,
      }
    })

    return NextResponse.json({
      transfers: formattedTransfers,
      summary: summaryData,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error('Transfers report error:', error)
    return NextResponse.json(
      { error: 'Failed to generate transfers report' },
      { status: 500 }
    )
  }
}
