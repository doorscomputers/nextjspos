import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { getUserAccessibleLocationIds } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId')
    const cashierId = searchParams.get('cashierId')
    const paymentMethod = searchParams.get('paymentMethod')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {
      businessId: session.user.businessId,
    }

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: session.user.id,
      permissions: session.user.permissions || [],
      roles: session.user.roles || [],
      businessId: session.user.businessId,
      locationIds: session.user.locationIds || []
    })

    // If user has limited location access, enforce it
    if (accessibleLocationIds !== null) {
      if (accessibleLocationIds.length === 0) {
        // User has no location access - return empty results
        return NextResponse.json({
          sales: [],
          pagination: { page, limit, totalCount: 0, totalPages: 0 },
          summary: { totalSales: 0, totalAmount: 0, totalTax: 0, totalDiscount: 0, netSales: 0 }
        })
      }
      where.locationId = { in: accessibleLocationIds }
    }

    // Automatic cashier filtering - cashiers can only see their own sales
    const isCashier = session.user.roles?.some(role => role.toLowerCase().includes('cashier'))
    if (isCashier && !session.user.permissions?.includes('sell.view')) {
      // Cashiers with only sell.view_own permission can only see their own sales
      where.userId = parseInt(session.user.id)
    }

    // Date filtering
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Location filtering
    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Cashier filtering
    if (cashierId) {
      where.userId = parseInt(cashierId)
    }

    // Payment method filtering
    if (paymentMethod && paymentMethod !== 'all') {
      where.paymentMethod = paymentMethod
    }

    // Search by invoice number or customer name
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customer: { name: { contains: search } } },
      ]
    }

    // Get total count
    const totalCount = await prisma.sale.count({ where })

    // Build orderBy
    const orderBy: any = {}
    if (sortBy === 'invoiceNumber') {
      orderBy.invoiceNumber = sortOrder
    } else if (sortBy === 'customer') {
      orderBy.customer = { name: sortOrder }
    } else if (sortBy === 'cashier') {
      orderBy.user = { username: sortOrder }
    } else if (sortBy === 'location') {
      orderBy.location = { name: sortOrder }
    } else if (sortBy === 'totalAmount' || sortBy === 'createdAt') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    // Get sales
    const sales = await prisma.sale.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
            contactNumber: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
              },
            },
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    })

    // Calculate summary
    const summary = await prisma.sale.aggregate({
      where,
      _sum: {
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
      },
      _count: true,
    })

    // Format response
    const formattedSales = sales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.createdAt,
      cashier: sale.user
        ? `${sale.user.firstName || ''} ${sale.user.lastName || ''}`.trim() || sale.user.username
        : 'N/A',
      cashierId: sale.user?.id,
      location: sale.location?.name || 'N/A',
      locationId: sale.location?.id,
      customer: sale.customer?.name || 'Walk-in Customer',
      customerId: sale.customer?.id,
      customerContact: sale.customer?.contactNumber || '',
      paymentMethod: sale.paymentMethod,
      items: sale.items.length,
      subtotal: sale.totalAmount - sale.taxAmount,
      tax: sale.taxAmount,
      discount: sale.discountAmount,
      totalAmount: sale.totalAmount,
      status: sale.status,
      itemDetails: sale.items.map((item) => ({
        product: item.product?.name || 'N/A',
        sku: item.product?.sku || '',
        quantity: item.quantity,
        price: item.unitPrice,
        subtotal: item.subtotal,
      })),
    }))

    return NextResponse.json({
      sales: formattedSales,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalSales: summary._count,
        totalAmount: summary._sum.totalAmount || 0,
        totalTax: summary._sum.taxAmount || 0,
        totalDiscount: summary._sum.discountAmount || 0,
        netSales: (summary._sum.totalAmount || 0) - (summary._sum.taxAmount || 0),
      },
    })
  } catch (error) {
    console.error('Sales Journal Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales journal report' },
      { status: 500 }
    )
  }
}
