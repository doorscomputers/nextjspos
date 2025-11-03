import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
    const locationId = searchParams.get('locationId')
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
      locationIds: session.user.locationIds || []
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

    // Get sale items grouped by product
    const saleItems = await prisma.saleItem.findMany({
      where: itemWhere,
      include: {
        sale: {
          select: {
            createdAt: true,
            locationId: true,
          },
        },
      },
    })

    if (saleItems.length === 0) {
      return buildEmptyResponse()
    }

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

    // Fetch all business locations for lookup
    const locations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true }
    })
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]))

    // Group by product and calculate metrics
    type LocationTotals = { quantity: number; revenue: number }
    type ProductAccumulator = {
      productId: number
      productName: string
      sku: string
      category: string
      categoryId: number | null
      quantitySold: number
      totalRevenue: number
      totalCost: number
      transactionIds: Set<number>
      locations: Map<string, LocationTotals>
    }
    const productMap = new Map<number, ProductAccumulator>()

    saleItems.forEach((item) => {
      const productId = item.productId
      const productInfo = productDetails.get(productId)
      const productName = productInfo?.name || 'Unknown Product'
      const sku = productInfo?.sku || 'N/A'
      const categoryName = productInfo?.category?.name || 'N/A'
      const categoryIdValue = productInfo?.categoryId ?? null

      if (!productMap.has(productId)) {
        const accumulator: ProductAccumulator = {
          productId,
          productName,
          sku,
          category: categoryName,
          categoryId: categoryIdValue,
          quantitySold: 0,
          totalRevenue: 0,
          totalCost: 0,
          transactionIds: new Set<number>(),
          locations: new Map<string, LocationTotals>(),
        }
        productMap.set(productId, accumulator)
      }

      const productData = productMap.get(productId)
      if (!productData) {
        return
      }
      const quantity =
        typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity?.toString() || '0')
      const unitPrice =
        typeof item.unitPrice === 'number' ? item.unitPrice : parseFloat(item.unitPrice?.toString() || '0')
      const subtotal = quantity * unitPrice
      const unitCost =
        typeof item.unitCost === 'number'
          ? item.unitCost
          : parseFloat(item.unitCost?.toString() || productInfo?.purchasePrice?.toString() || '0')

      productData.quantitySold += quantity
      productData.totalRevenue += subtotal
      productData.totalCost += quantity * unitCost
      productData.transactionIds.add(item.saleId)

      // Track sales by location
      const saleLocationId = item.sale?.locationId ?? null
      const locName = saleLocationId ? locationMap.get(saleLocationId) || 'N/A' : 'N/A'
      if (!productData.locations.has(locName)) {
        productData.locations.set(locName, { quantity: 0, revenue: 0 })
      }
      const locData = productData.locations.get(locName)
      if (locData) {
        locData.quantity += quantity
        locData.revenue += subtotal
      }
    })

    // Convert to array and calculate derived metrics
    type ProductSummaryItem = {
      productId: number
      productName: string
      sku: string
      category: string
      categoryId: number | null
      quantitySold: number
      totalRevenue: number
      totalCost: number
      totalProfit: number
      profitMargin: number
      averagePrice: number
      transactionCount: number
      locationBreakdown: Array<{ location: string; quantity: number; revenue: number }>
    }

    const productSummary: ProductSummaryItem[] = Array.from(productMap.values()).map((item) => {
      const totalProfit = item.totalRevenue - item.totalCost
      const profitMargin = item.totalRevenue > 0 ? (totalProfit / item.totalRevenue) * 100 : 0
      const locationBreakdown = Array.from(item.locations.entries()).map(([name, data]) => ({
        location: name,
        quantity: data.quantity,
        revenue: data.revenue,
      }))

      return {
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        category: item.category,
        categoryId: item.categoryId,
        quantitySold: item.quantitySold,
        totalRevenue: item.totalRevenue,
        totalCost: item.totalCost,
        totalProfit,
        profitMargin,
        averagePrice: item.quantitySold > 0 ? item.totalRevenue / item.quantitySold : 0,
        transactionCount: item.transactionIds.size,
        locationBreakdown,
      }
    })

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
