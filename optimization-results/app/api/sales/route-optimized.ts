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
    if (!user.permissions?.includes(PERMISSIONS.SELL_VIEW)) {
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
    const customerId = searchParams.get('customerId')
    const locationId = searchParams.get('locationId')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const paymentStatus = searchParams.get('paymentStatus')?.trim() || ''

    // Build where clause
    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    // Apply filters
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } }
      ]
    }

    if (status) {
      where.status = status
    }

    if (customerId) {
      where.customerId = parseInt(customerId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (paymentStatus) {
      if (paymentStatus === 'paid') {
        where.paymentStatus = 'paid'
      } else if (paymentStatus === 'unpaid') {
        where.paymentStatus = { in: ['unpaid', 'partial'] }
      }
    }

    // Date range filtering
    if (startDate || endDate) {
      where.saleDate = {}
      if (startDate) {
        const parts = startDate.split('-')
        const localStart = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0)
        where.saleDate.gte = localStart
      }
      if (endDate) {
        const parts = endDate.split('-')
        const localEnd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 23, 59, 59, 999)
        where.saleDate.lte = localEnd
      }
    }

    // Build orderBy clause
    const orderBy: any = {}
    if (sortBy === 'customer') {
      orderBy.customer = { name: sortOrder }
    } else if (sortBy === 'location') {
      orderBy.location = { name: sortOrder }
    } else if (sortBy === 'saleDate') {
      orderBy.saleDate = sortOrder
    } else {
      orderBy[sortBy] = sortOrder
    }

    // Get total count for pagination
    const totalCount = await prisma.sale.count({
      where
    })

    // Fetch sales with optimized includes
    const sales = await prisma.sale.findMany({
      where,
      select: {
        id: { select: { id: true, name: true } },
        invoiceNumber: { select: { id: true, name: true } },
        saleDate: { select: { id: true, name: true } },
        status: { select: { id: true, name: true } },
        subtotal: { select: { id: true, name: true } },
        taxAmount: { select: { id: true, name: true } },
        discountAmount: { select: { id: true, name: true } },
        totalAmount: { select: { id: true, name: true } },
        paymentStatus: { select: { id: true, name: true } },
        notes: { select: { id: true, name: true } },
        createdAt: { select: { id: true, name: true } },
        updatedAt: { select: { id: true, name: true } },
        // Minimal relation data
        customer: {
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
            unitPrice: { select: { id: true, name: true } },
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
        // Only include payments summary
        payments: {
          select: {
            id: { select: { id: true, name: true } },
            amount: { select: { id: true, name: true } },
            paymentMethod: { select: { id: true, name: true } },
            paidAt: { select: { id: true, name: true } }
          }
        }
      },
      orderBy,
      skip,
      take
    })

    // Calculate additional metrics for each sale
    const salesWithMetrics = sales.map((sale: any) => {
      const totalItems = sale.items.length
      const totalQuantity = sale.items.reduce((sum: number, item: any) => sum + Number(item.quantity), 0)
      const totalPaid = sale.payments.reduce((sum: number, payment: any) => sum + Number(payment.amount), 0)
      const balance = Number(sale.totalAmount) - totalPaid
      const isFullyPaid = balance <= 0
      const isPartiallyPaid = totalPaid > 0 && balance > 0
      const isUnpaid = totalPaid === 0

      return {
        ...sale,
        // Additional calculated fields
        totalItems,
        totalQuantity,
        totalPaid,
        balance,
        isFullyPaid,
        isPartiallyPaid,
        isUnpaid,
        // Format dates
        saleDate: sale.saleDate.toISOString().split('T')[0],
        createdAt: sale.createdAt.toISOString(),
        updatedAt: sale.updatedAt.toISOString(),
        // Format customer name
        customerName: sale.customer?.name || 'Walk-in Customer',
        // Format location name
        locationName: sale.location?.name || 'Unknown',
        // Format creator name
        creatorName: sale.createdByUser
          ? `${sale.createdByUser.firstName || ''} ${sale.createdByUser.lastName || ''}`.trim() || sale.createdByUser.username
          : 'Unknown'
      }
    })

    return NextResponse.json({
      data: salesWithMetrics,
      totalCount,
      // DevExtreme DataGrid expects these fields
      summary: [{
        totalCount
      }]
    })

  } catch (error) {
    console.error('Sales API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    )
  }
}
