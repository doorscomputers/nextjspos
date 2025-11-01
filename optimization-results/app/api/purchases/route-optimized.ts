import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// OPTIMIZED GET - Server-side pagination, filtering, and sorting for DevExtreme DataGrid
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Parse DevExtreme DataGrid parameters
    const { searchParams } = new URL(request.url)

    // Pagination
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip')!) : 0
    const take = searchParams.get('take') ? parseInt(searchParams.get('take')!) : 50

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Filtering
    const search = searchParams.get('search')?.trim() || ''
    const status = searchParams.get('status')?.trim() || ''
    const supplierId = searchParams.get('supplierId')
    const locationId = searchParams.get('locationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    // Apply filters
    if (search) {
      where.OR = [
        { purchaseOrderNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Date range filtering
    if (startDate || endDate) {
      where.purchaseDate = {}
      if (startDate) {
        const parts = startDate.split('-')
        const localStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
        where.purchaseDate.gte = localStart
      }
      if (endDate) {
        const parts = endDate.split('-')
        const localEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
        where.purchaseDate.lte = localEnd
      }
    }

    // Build orderBy clause
    const orderBy: any = {}
    if (sortBy === 'supplier') {
      orderBy.supplier = { name: sortOrder }
    } else if (sortBy === 'location') {
      orderBy.location = { name: sortOrder }
    } else {
      orderBy[sortBy] = sortOrder
    }

    // Get total count for pagination
    const totalCount = await prisma.purchase.count({
      where
    })

    // Fetch purchases with optimized includes
    const purchases = await prisma.purchase.findMany({
      where,
      select: {
        id: { select: { id: true, name: true } },
        purchaseOrderNumber: { select: { id: true, name: true } },
        purchaseDate: { select: { id: true, name: true } },
        expectedDeliveryDate: { select: { id: true, name: true } },
        status: { select: { id: true, name: true } },
        subtotal: { select: { id: true, name: true } },
        taxAmount: { select: { id: true, name: true } },
        discountAmount: { select: { id: true, name: true } },
        shippingCost: { select: { id: true, name: true } },
        totalAmount: { select: { id: true, name: true } },
        notes: { select: { id: true, name: true } },
        createdAt: { select: { id: true, name: true } },
        updatedAt: { select: { id: true, name: true } },
        // Minimal relation data
        supplier: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
            mobile: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } }
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } }
          }
        },
        createdByUser: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
          }
        },
        // Only include items count and basic info for list view
        items: {
          select: {
            id: { select: { id: true, name: true } },
            quantity: { select: { id: true, name: true } },
            quantityReceived: { select: { id: true, name: true } },
            unitCost: { select: { id: true, name: true } },
            lineTotal: { select: { id: true, name: true } },
            product: {
              select: {
                name: { select: { id: true, name: true } },
                sku: { select: { id: true, name: true } }
              }
            },
            productVariation: {
              select: {
                name: { select: { id: true, name: true } },
                sku: { select: { id: true, name: true } }
              }
            }
          }
        },
        // Only include receipts count and basic info
        receipts: {
          select: {
            id: { select: { id: true, name: true } },
            receiptNumber: { select: { id: true, name: true } },
            receivedAt: { select: { id: true, name: true } },
            status: { select: { id: true, name: true } },
            notes: { select: { id: true, name: true } }
          }
        }
      },
      orderBy,
      skip,
      take
    })

    // Calculate additional metrics for each purchase
    const purchasesWithMetrics = purchases.map((purchase: any) => {
      const totalItems = purchase.items.length
      const totalQuantity = purchase.items.reduce((sum: number, item: any) => sum + Number(item.quantity), 0)
      const totalReceived = purchase.items.reduce((sum: number, item: any) => sum + Number(item.quantityReceived), 0)
      const receiptCount = purchase.receipts.length
      const isFullyReceived = totalQuantity > 0 && totalReceived >= totalQuantity
      const isPartiallyReceived = totalReceived > 0 && totalReceived < totalQuantity
      const isNotReceived = totalReceived === 0

      return {
        ...purchase,
        // Additional calculated fields
        totalItems,
        totalQuantity,
        totalReceived,
        receiptCount,
        isFullyReceived,
        isPartiallyReceived,
        isNotReceived,
        // Format dates
        purchaseDate: purchase.purchaseDate.toISOString().split('T')[0],
        expectedDeliveryDate: purchase.expectedDeliveryDate?.toISOString().split('T')[0] || null,
        createdAt: purchase.createdAt.toISOString(),
        updatedAt: purchase.updatedAt.toISOString(),
        // Format supplier name
        supplierName: purchase.supplier.name,
        // Format location name
        locationName: purchase.location.name,
        // Format creator name
        creatorName: purchase.createdByUser
          ? `${purchase.createdByUser.firstName || ''} ${purchase.createdByUser.lastName || ''}`.trim() || purchase.createdByUser.username
          : 'Unknown'
      }
    })

    return NextResponse.json({
      data: purchasesWithMetrics,
      totalCount,
      // DevExtreme DataGrid expects these fields
      summary: [{
        totalCount
      }]
    })

  } catch (error) {
    console.error('Purchases API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchases' },
      { status: 500 }
    )
  }
}
