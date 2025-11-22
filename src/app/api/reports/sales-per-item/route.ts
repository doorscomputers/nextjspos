import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { getUserAccessibleLocationIds } from '@/lib/rbac'
import type { Prisma } from '@prisma/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const businessIdRaw = parseInt(session.user.businessId)
    const businessId = typeof businessIdRaw === 'string' ? parseInt(businessIdRaw, 10) : businessIdRaw

    if (!businessId || Number.isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const categoryId = searchParams.get('categoryId')
    const sortBy = searchParams.get('sortBy') || 'totalRevenue'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const searchTerm = search.trim()
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')

    const buildEmptyResponse = () =>
      NextResponse.json({
        items: [],
        pagination: { page, limit, totalCount: 0, totalPages: 0 },
        summary: { totalProducts: 0, totalQuantitySold: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, averageMargin: 0 }
      })

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: session.user.id,
      permissions: session.user.permissions || [],
      roles: session.user.roles || [],
      businessId: parseInt(session.user.businessId),
      locationIds: session.user.locationIds?.map(id => parseInt(String(id))) || []
    })

    // Get all locations for this business to ensure business ID filtering
    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true }
    })
    const businessLocationIds = businessLocations.map(loc => loc.id)

    // Build where clause for sales with proper location filtering
    const saleWhere: Prisma.SaleWhereInput = {
      status: { not: 'voided' },
    }

    // If user has limited location access, enforce it
    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id)) // Ensure they're in current business

      if (normalizedLocationIds.length === 0) {
        return buildEmptyResponse()
      }
      saleWhere.locationId = { in: normalizedLocationIds }
    } else {
      // User has access to all locations, but still filter by business
      saleWhere.locationId = { in: businessLocationIds }
    }

    // Automatic cashier filtering - cashiers can only see their own sales
    const isCashier = session.user.roles?.some(role => role.toLowerCase().includes('cashier'))
    if (isCashier && !session.user.permissions?.includes('sell.view')) {
      // Cashiers with only sell.view_own permission can only see their own sales
      const userId = typeof session.user.id === 'string' ? Number.parseInt(session.user.id, 10) : session.user.id
      if (Number.isInteger(userId) && !Number.isNaN(userId)) {
        saleWhere.createdBy = userId
      }
    }

    // Date filtering
    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {}
      if (startDate) {
        dateFilter.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        dateFilter.lte = end
      }
      if (Object.keys(dateFilter).length > 0) {
        saleWhere.saleDate = dateFilter
      }
    }

    // Location filtering
    if (locationId) {
      saleWhere.locationId = parseInt(locationId)
    }

    // Build where clause for sale items
    const itemWhere: Prisma.SaleItemWhereInput = {
      sale: {
        is: saleWhere,
      },
    }

    // If category or search filters are provided, narrow sale items by matching products first
    if (categoryId || searchTerm) {
      const productWhere: Prisma.ProductWhereInput = {
        businessId,
      }
      if (categoryId) {
        productWhere.categoryId = Number.parseInt(categoryId, 10)
      }
      if (searchTerm) {
        productWhere.OR = [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { sku: { contains: searchTerm, mode: 'insensitive' } },
        ]
      }
      const matchingProducts = await prisma.product.findMany({
        where: productWhere,
        select: { id: true },
      })
      const matchingIds = matchingProducts.map((product) => product.id)
      if (matchingIds.length === 0) {
        return buildEmptyResponse()
      }
      itemWhere.productId = { in: matchingIds }
    }

    // OPTIMIZED: Fetch sale items, products, and locations in parallel
    const [saleItems, locations] = await Promise.all([
      prisma.saleItem.findMany({
        where: itemWhere,
        include: {
          sale: {
            select: {
              id: true,
              invoiceNumber: true,
              saleDate: true,
              createdAt: true,
              locationId: true,
              customerId: true,
              createdBy: true,
              customer: {
                select: {
                  name: true,
                },
              },
              creator: {
                select: {
                  firstName: true,
                  surname: true,
                  username: true,
                },
              },
            },
          },
        },
      }),
      // Fetch locations in parallel
      prisma.businessLocation.findMany({
        where: { businessId },
        select: { id: true, name: true }
      })
    ])

    if (saleItems.length === 0) {
      return buildEmptyResponse()
    }

    // Batch fetch products for all sale items
    const productIds = Array.from(new Set(saleItems.map((item) => item.productId)))
    const products = productIds.length
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            name: true,
            sku: true,
            categoryId: true,
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            purchasePrice: true,
          },
        })
      : []
    const productDetails = new Map(products.map((product) => [product.id, product]))
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

    // Aggregate by product
    const productSalesMap = new Map<number, {
      productId: number
      productName: string
      sku: string
      category: string
      quantitySold: number
      totalRevenue: number
      totalCost: number
      totalProfit: number
      transactionCount: number
      prices: number[]
    }>()

    for (const item of saleItems) {
      const productInfo = productDetails.get(item.productId)
      const quantity = typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity?.toString() || '0')
      const unitPrice = typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice?.toString() || '0')
      const revenue = quantity * unitPrice
      const costPerUnit = productInfo?.purchasePrice ? parseFloat(productInfo.purchasePrice.toString()) : 0
      const cost = quantity * costPerUnit
      const profit = revenue - cost

      if (!productSalesMap.has(item.productId)) {
        productSalesMap.set(item.productId, {
          productId: item.productId,
          productName: productInfo?.name || 'Unknown Product',
          sku: productInfo?.sku || 'N/A',
          category: productInfo?.category?.name || 'N/A',
          quantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalProfit: 0,
          transactionCount: 0,
          prices: [],
        })
      }

      const productData = productSalesMap.get(item.productId)!
      productData.quantitySold += quantity
      productData.totalRevenue += revenue
      productData.totalCost += cost
      productData.totalProfit += profit
      productData.transactionCount += 1
      productData.prices.push(unitPrice)
    }

    // Convert map to array and calculate averages
    const aggregatedItems = Array.from(productSalesMap.values()).map(item => ({
      productId: item.productId,
      productName: item.productName,
      sku: item.sku,
      category: item.category,
      quantitySold: item.quantitySold,
      totalRevenue: item.totalRevenue,
      totalCost: item.totalCost,
      totalProfit: item.totalProfit,
      profitMargin: item.totalRevenue > 0 ? (item.totalProfit / item.totalRevenue) * 100 : 0,
      averagePrice: item.prices.length > 0 ? item.prices.reduce((a, b) => a + b, 0) / item.prices.length : 0,
      transactionCount: item.transactionCount,
    }))

    // Sort aggregated results
    const sortField = sortBy as keyof typeof aggregatedItems[0]
    aggregatedItems.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      return 0
    })

    // Pagination
    const totalCount = aggregatedItems.length
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedResults = aggregatedItems.slice(startIndex, endIndex)

    // Calculate overall summary
    const summary = {
      totalProducts: totalCount,
      totalQuantitySold: aggregatedItems.reduce((sum, item) => sum + item.quantitySold, 0),
      totalRevenue: aggregatedItems.reduce((sum, item) => sum + item.totalRevenue, 0),
      totalCost: aggregatedItems.reduce((sum, item) => sum + item.totalCost, 0),
      totalProfit: aggregatedItems.reduce((sum, item) => sum + item.totalProfit, 0),
      averageMargin: aggregatedItems.length > 0
        ? aggregatedItems.reduce((sum, item) => sum + item.profitMargin, 0) / aggregatedItems.length
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
  } catch (error: unknown) {
    console.error('Sales Per Item Report Error:', error)
    const details = error instanceof Error ? error.message : 'Unknown error'
    const stack = error instanceof Error ? error.stack : undefined
    if (stack) {
      console.error('Error stack:', stack)
    }
    return NextResponse.json(
      {
        error: 'Failed to generate sales per item report',
        details,
        stack: process.env.NODE_ENV === 'development' ? stack : undefined,
      },
      { status: 500 }
    )
  }
}
