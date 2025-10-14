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
    const whereClause: any = {
      businessId,
      deletedAt: null
    }

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
        // Start of day in local timezone
        const startDateTime = new Date(startDate + 'T00:00:00')
        whereClause.createdAt.gte = startDateTime
      }
      if (endDate) {
        // End of day in local timezone (23:59:59.999)
        const endDateTime = new Date(endDate + 'T23:59:59.999')
        whereClause.createdAt.lte = endDateTime
      }
    }

    // Get total count
    const totalCount = await prisma.stockTransfer.count({ where: whereClause })

    // Get transfers data with items (no product/variation relations exist)
    const transfers = await prisma.stockTransfer.findMany({
      where: whereClause,
      include: {
        items: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })

    // Get all location IDs, user IDs, and product/variation IDs we need
    const locationIds = new Set<number>()
    const userIds = new Set<number>()
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    transfers.forEach(transfer => {
      locationIds.add(transfer.fromLocationId)
      locationIds.add(transfer.toLocationId)
      if (transfer.checkedBy) userIds.add(transfer.checkedBy)
      if (transfer.arrivedBy) userIds.add(transfer.arrivedBy)

      transfer.items.forEach(item => {
        if (item.productId) productIds.add(item.productId)
        if (item.productVariationId) variationIds.add(item.productVariationId)
      })
    })

    // Fetch locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: Array.from(locationIds) },
        businessId
      },
      select: {
        id: true,
        name: true
      }
    })

    const locationMap = new Map(locations.map(l => [l.id, l.name]))

    // Fetch users
    const users = await prisma.user.findMany({
      where: {
        id: { in: Array.from(userIds) }
      },
      select: {
        id: true,
        username: true
      }
    })

    const userMap = new Map(users.map(u => [u.id, u.username]))

    // Fetch products
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true, sku: true }
    })
    const productMap = new Map(products.map(p => [p.id, p]))

    // Fetch product variations
    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, name: true, sku: true }
    })
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Calculate summary statistics by status
    const statusSummary = await prisma.stockTransfer.groupBy({
      by: ['status'],
      where: { businessId, deletedAt: null },
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
        status: transfer.status.toUpperCase(),
        fromLocation: locationMap.get(transfer.fromLocationId) || `Location ${transfer.fromLocationId}`,
        fromLocationId: transfer.fromLocationId,
        toLocation: locationMap.get(transfer.toLocationId) || `Location ${transfer.toLocationId}`,
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
        originChecker: transfer.checkedBy ? userMap.get(transfer.checkedBy) : null,
        destinationReceiver: transfer.arrivedBy ? userMap.get(transfer.arrivedBy) : null,
        itemCount: transfer.items.length,
        totalQuantity,
        stockDeducted: transfer.stockDeducted,
        items: transfer.items.map((item) => {
          const product = productMap.get(item.productId)
          const variation = variationMap.get(item.productVariationId)

          return {
            productName: product?.name || 'Unknown Product',
            variationName: variation?.name || 'Unknown Variation',
            sku: variation?.sku || product?.sku || 'N/A',
            quantity: parseFloat(item.quantity.toString()),
            unitCost: 0, // Unit cost not tracked in transfers
            totalValue: 0, // Total value not tracked in transfers
          }
        }),
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
      {
        error: 'Failed to generate transfers report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
