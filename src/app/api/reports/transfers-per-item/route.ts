/**
 * Transfers per Item Report API
 *
 * Returns all stock transfers with item-level details for reporting
 * Supports filtering by date range, product, location, and status
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.STOCK_TRANSFER_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires STOCK_TRANSFER_VIEW permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const productId = searchParams.get('productId')
    const fromLocationId = searchParams.get('fromLocationId')
    const toLocationId = searchParams.get('toLocationId')
    const status = searchParams.get('status')

    // Build where clause
    const where: any = {
      businessId,
      deletedAt: null,
    }

    // Date range filter
    if (startDate || endDate) {
      where.transferDate = {}
      if (startDate) {
        where.transferDate.gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        where.transferDate.lte = endDateTime
      }
    }

    // Product filter
    if (productId) {
      where.items = {
        some: {
          productId: parseInt(productId)
        }
      }
    }

    // Location filters
    if (fromLocationId) {
      where.fromLocationId = parseInt(fromLocationId)
    }
    if (toLocationId) {
      where.toLocationId = parseInt(toLocationId)
    }

    // Status filter
    if (status && status !== 'all') {
      where.status = status
    }

    // Fetch transfers with related data
    const transfers = await prisma.stockTransfer.findMany({
      where,
      include: {
        items: true,
        fromLocation: {
          select: {
            id: true,
            name: true,
          }
        },
        toLocation: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: {
        transferDate: 'desc'
      }
    })

    // Get all unique product and variation IDs
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    for (const transfer of transfers) {
      for (const item of transfer.items) {
        productIds.add(item.productId)
        variationIds.add(item.productVariationId)
      }
    }

    // Fetch products and variations
    const [products, variations] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: Array.from(productIds) } },
        select: { id: true, name: true, sku: true }
      }),
      prisma.productVariation.findMany({
        where: { id: { in: Array.from(variationIds) } },
        select: { id: true, name: true, sku: true }
      })
    ])

    // Create lookup maps
    const productMap = new Map(products.map(p => [p.id, p]))
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Transform data into flat structure for DataGrid/PivotGrid
    const reportData = []

    for (const transfer of transfers) {
      for (const item of transfer.items) {
        // If productId filter is set, only include items that match
        if (productId && item.productId !== parseInt(productId)) {
          continue
        }

        reportData.push({
          // Transfer info
          transferId: transfer.id,
          transferNumber: transfer.transferNumber,
          transferDate: transfer.transferDate,
          transferDateFormatted: transfer.transferDate.toISOString().split('T')[0],
          status: transfer.status,
          statusLabel: getStatusLabel(transfer.status),

          // Product info
          productId: item.productId,
          productName: productMap.get(item.productId)?.name || 'Unknown Product',
          productSku: productMap.get(item.productId)?.sku || 'N/A',
          variationId: item.productVariationId,
          variationName: variationMap.get(item.productVariationId)?.name || 'Unknown Variation',
          variationSku: variationMap.get(item.productVariationId)?.sku || 'N/A',

          // Location info
          fromLocationId: transfer.fromLocationId,
          fromLocationName: transfer.fromLocation?.name || 'N/A',
          toLocationId: transfer.toLocationId,
          toLocationName: transfer.toLocation?.name || 'N/A',

          // Quantity info
          quantitySent: parseFloat(item.quantity),
          quantityReceived: item.receivedQuantity ? parseFloat(item.receivedQuantity) : null,
          verified: item.verified,
          hasDiscrepancy: item.hasDiscrepancy,
          discrepancyNotes: item.discrepancyNotes,

          // Quantity variance
          quantityVariance: item.receivedQuantity
            ? parseFloat(item.receivedQuantity) - parseFloat(item.quantity)
            : null,

          // User IDs
          createdById: transfer.createdBy,
          checkedById: transfer.checkedBy || null,
          sentById: transfer.sentBy || null,
          verifiedById: transfer.verifiedBy || null,
          completedById: transfer.completedBy || null,

          // Timestamps
          createdAt: transfer.createdAt,
          checkedAt: transfer.checkedAt,
          sentAt: transfer.sentAt,
          arrivedAt: transfer.arrivedAt,
          verifiedAt: transfer.verifiedAt,
          completedAt: transfer.completedAt,

          // Formatted dates for display
          createdAtFormatted: transfer.createdAt ? transfer.createdAt.toISOString().split('T')[0] : null,
          completedAtFormatted: transfer.completedAt ? transfer.completedAt.toISOString().split('T')[0] : null,

          // Stock status
          stockDeducted: transfer.stockDeducted,

          // Notes
          notes: transfer.notes,
        })
      }
    }

    // Calculate summary statistics
    const summary = {
      totalTransfers: transfers.length,
      totalItems: reportData.length,
      totalQuantitySent: reportData.reduce((sum, item) => sum + item.quantitySent, 0),
      totalQuantityReceived: reportData.reduce((sum, item) =>
        sum + (item.quantityReceived || 0), 0),

      byStatus: {} as Record<string, number>,
      byFromLocation: {} as Record<string, number>,
      byToLocation: {} as Record<string, number>,
      byProduct: {} as Record<string, number>,
    }

    // Group by status
    for (const item of reportData) {
      summary.byStatus[item.statusLabel] = (summary.byStatus[item.statusLabel] || 0) + 1
      summary.byFromLocation[item.fromLocationName] = (summary.byFromLocation[item.fromLocationName] || 0) + item.quantitySent
      summary.byToLocation[item.toLocationName] = (summary.byToLocation[item.toLocationName] || 0) + item.quantitySent
      summary.byProduct[item.productName] = (summary.byProduct[item.productName] || 0) + item.quantitySent
    }

    return NextResponse.json({
      success: true,
      data: reportData,
      summary,
      filters: {
        startDate,
        endDate,
        productId,
        fromLocationId,
        toLocationId,
        status,
      }
    })

  } catch (error: any) {
    console.error('Error generating transfers per item report:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate report',
        details: error.message
      },
      { status: 500 }
    )
  }
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    'draft': 'Draft',
    'pending_check': 'Pending Check',
    'checked': 'Checked',
    'in_transit': 'In Transit',
    'arrived': 'Arrived',
    'verifying': 'Verifying',
    'verified': 'Verified',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
  }
  return labels[status] || status
}
