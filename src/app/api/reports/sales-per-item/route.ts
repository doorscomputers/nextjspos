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
    const categoryId = searchParams.get('categoryId')
    const sortBy = searchParams.get('sortBy') || 'totalRevenue'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    // Build where clause for sales
    const saleWhere: any = {
      businessId: session.user.businessId,
      status: { not: 'VOID' },
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
          items: [],
          pagination: { page, limit, totalCount: 0, totalPages: 0 },
          summary: { totalProducts: 0, totalQuantitySold: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, averageMargin: 0 }
        })
      }
      saleWhere.locationId = { in: accessibleLocationIds }
    }

    // Automatic cashier filtering - cashiers can only see their own sales
    const isCashier = session.user.roles?.some(role => role.toLowerCase().includes('cashier'))
    if (isCashier && !session.user.permissions?.includes('sell.view')) {
      // Cashiers with only sell.view_own permission can only see their own sales
      saleWhere.userId = parseInt(session.user.id)
    }

    // Date filtering
    if (startDate || endDate) {
      saleWhere.createdAt = {}
      if (startDate) {
        saleWhere.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        saleWhere.createdAt.lte = end
      }
    }

    // Location filtering
    if (locationId) {
      saleWhere.locationId = parseInt(locationId)
    }

    // Build where clause for sale items
    const itemWhere: any = {
      sale: saleWhere,
    }

    // Category filtering
    if (categoryId) {
      itemWhere.product = {
        categoryId: parseInt(categoryId),
      }
    }

    // Search by product name or SKU
    if (search) {
      itemWhere.product = {
        ...itemWhere.product,
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
        ],
      }
    }

    // Get sale items grouped by product
    const saleItems = await prisma.saleItem.findMany({
      where: itemWhere,
      include: {
        product: {
          include: {
            category: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        sale: {
          select: {
            createdAt: true,
            locationId: true,
            location: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    // Group by product and calculate metrics
    const productMap = new Map()

    saleItems.forEach((item) => {
      if (!item.product) return

      const productId = item.productId
      if (!productMap.has(productId)) {
        productMap.set(productId, {
          productId,
          productName: item.product.name,
          sku: item.product.sku,
          category: item.product.category?.name || 'N/A',
          categoryId: item.product.categoryId,
          quantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          averagePrice: 0,
          transactionCount: new Set(),
          locations: new Map(),
        })
      }

      const productData = productMap.get(productId)
      productData.quantitySold += item.quantity
      productData.totalRevenue += item.subtotal
      productData.totalCost += item.quantity * (item.product.cost || 0)
      productData.transactionCount.add(item.saleId)

      // Track sales by location
      const locName = item.sale.location?.name || 'N/A'
      if (!productData.locations.has(locName)) {
        productData.locations.set(locName, {
          quantity: 0,
          revenue: 0,
        })
      }
      const locData = productData.locations.get(locName)
      locData.quantity += item.quantity
      locData.revenue += item.subtotal
    })

    // Convert to array and calculate derived metrics
    let productSummary = Array.from(productMap.values()).map((item) => {
      const profit = item.totalRevenue - item.totalCost
      const margin = item.totalRevenue > 0 ? (profit / item.totalRevenue) * 100 : 0

      return {
        ...item,
        totalProfit: profit,
        profitMargin: margin,
        averagePrice: item.quantitySold > 0 ? item.totalRevenue / item.quantitySold : 0,
        transactionCount: item.transactionCount.size,
        locationBreakdown: Array.from(item.locations.entries()).map(([name, data]) => ({
          location: name,
          quantity: data.quantity,
          revenue: data.revenue,
        })),
      }
    })

    // Remove temporary Set and Map objects
    productSummary = productSummary.map(({ locations, transactionCount, ...rest }) => rest)

    // Sort results
    if (sortBy === 'productName') {
      productSummary.sort((a, b) => {
        const aVal = a.productName.toLowerCase()
        const bVal = b.productName.toLowerCase()
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    } else if (sortBy === 'category') {
      productSummary.sort((a, b) => {
        const aVal = a.category.toLowerCase()
        const bVal = b.category.toLowerCase()
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    } else {
      productSummary.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a] as number
        const bVal = b[sortBy as keyof typeof b] as number
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    // Pagination
    const totalCount = productSummary.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedResults = productSummary.slice(startIndex, endIndex)

    // Calculate overall summary
    const summary = {
      totalProducts: totalCount,
      totalQuantitySold: productSummary.reduce((sum, item) => sum + item.quantitySold, 0),
      totalRevenue: productSummary.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalCost: productSummary.reduce((sum, item) => sum + item.totalCost, 0),
      totalProfit: productSummary.reduce((sum, item) => sum + item.totalProfit, 0),
      averageMargin:
        productSummary.length > 0
          ? productSummary.reduce((sum, item) => sum + item.profitMargin, 0) /
            productSummary.length
          : 0,
    }

    return NextResponse.json({
      items: paginatedResults,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary,
    })
  } catch (error) {
    console.error('Sales Per Item Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales per item report' },
      { status: 500 }
    )
  }
}
