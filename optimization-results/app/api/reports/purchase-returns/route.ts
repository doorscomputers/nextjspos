import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const businessIdInt = parseInt(businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Filters
    const locationId = searchParams.get('locationId')
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')
    const returnReason = searchParams.get('returnReason')
    const returnNumber = searchParams.get('returnNumber')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const productSearch = searchParams.get('productSearch')

    // Sorting
    const sortBy = searchParams.get('sortBy') || 'returnDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Predefined date ranges
    const dateRange = searchParams.get('dateRange')

    let dateFilter: any = {}

    if (dateRange) {
      const now = new Date()
      switch (dateRange) {
        case 'today':
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
          const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
          dateFilter = { gte: todayStart, lte: todayEnd }
          break
        case 'yesterday':
          const yesterday = new Date(now)
          yesterday.setDate(yesterday.getDate() - 1)
          const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0)
          const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59)
          dateFilter = { gte: yesterdayStart, lte: yesterdayEnd }
          break
        case 'thisWeek':
          const weekStart = new Date(now)
          weekStart.setDate(weekStart.getDate() - weekStart.getDay())
          weekStart.setHours(0, 0, 0, 0)
          dateFilter = { gte: weekStart }
          break
        case 'lastWeek':
          const lastWeekStart = new Date(now)
          lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7)
          lastWeekStart.setHours(0, 0, 0, 0)
          const lastWeekEnd = new Date(lastWeekStart)
          lastWeekEnd.setDate(lastWeekEnd.getDate() + 6)
          lastWeekEnd.setHours(23, 59, 59, 999)
          dateFilter = { gte: lastWeekStart, lte: lastWeekEnd }
          break
        case 'thisMonth':
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          dateFilter = { gte: monthStart }
          break
        case 'lastMonth':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
          dateFilter = { gte: lastMonthStart, lte: lastMonthEnd }
          break
        case 'thisQuarter': {
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const quarterStart = new Date(now.getFullYear(), quarterStartMonth, 1)
          dateFilter = { gte: quarterStart }
          break
        }
        case 'lastQuarter': {
          const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
          const lastQuarterStart = new Date(now.getFullYear(), quarterStartMonth - 3, 1)
          const lastQuarterEnd = new Date(
            now.getFullYear(),
            quarterStartMonth,
            0,
            23,
            59,
            59,
            999
          )
          dateFilter = { gte: lastQuarterStart, lte: lastQuarterEnd }
          break
        }
        case 'thisYear':
          const yearStart = new Date(now.getFullYear(), 0, 1)
          dateFilter = { gte: yearStart }
          break
        case 'lastYear':
          const lastYearStart = new Date(now.getFullYear() - 1, 0, 1)
          const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999)
          dateFilter = { gte: lastYearStart, lte: lastYearEnd }
          break
      }
    } else if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate)
      if (endDate) {
        const endDateObj = new Date(endDate)
        endDateObj.setHours(23, 59, 59, 999)
        dateFilter.lte = endDateObj
      }
    }

    const where: any = {
      businessId: businessIdInt,
    }

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: user.id,
      permissions: user.permissions || [],
      roles: user.roles || [],
      businessId: user.businessId,
      locationIds: user.locationIds || []
    })

    // Get all locations for this business
    const businessLocations = await prisma.businessLocation.findMany({
      where: { businessId: businessIdInt, deletedAt: null },
      select: { id: { select: { id: true, name: true } } }
    })
    const businessLocationIds = businessLocations.map(loc => loc.id)

    // If user has limited location access, enforce it
    if (accessibleLocationIds !== null) {
      const normalizedLocationIds = accessibleLocationIds
        .map((id) => Number(id))
        .filter((id): id is number => Number.isFinite(id) && Number.isInteger(id))
        .filter((id) => businessLocationIds.includes(id))

      if (normalizedLocationIds.length === 0) {
        return NextResponse.json({
          returns: [],
          summary: {
            totalReturns: 0,
            totalAmount: 0,
            totalItems: 0,
            pendingReturns: 0,
            approvedReturns: 0,
          },
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        })
      }
      where.locationId = { in: normalizedLocationIds }
    } else {
      where.locationId = { in: businessLocationIds }
    }

    // Override with specific location filter if provided
    if (locationId && locationId !== 'all') {
      const requestedLocationId = parseInt(locationId)
      if (accessibleLocationIds !== null) {
        const normalizedIds = accessibleLocationIds.map((id) => Number(id))
        if (normalizedIds.includes(requestedLocationId)) {
          where.locationId = requestedLocationId
        }
      } else if (businessLocationIds.includes(requestedLocationId)) {
        where.locationId = requestedLocationId
      }
    }

    if (supplierId && supplierId !== 'all') {
      where.supplierId = parseInt(supplierId)
    }

    if (status && status !== 'all') {
      where.status = status
    }

    if (returnReason && returnReason !== 'all') {
      where.returnReason = returnReason
    }

    if (returnNumber) {
      where.returnNumber = {
        contains: returnNumber,
      }
    }

    if (Object.keys(dateFilter).length > 0) {
      where.returnDate = dateFilter
    }

    // Product search requires a different approach
    let productFilteredReturnIds: number[] = []
    if (productSearch) {
      // First, find matching products
      const matchingProducts = await prisma.product.findMany({
        where: {
          businessId: businessIdInt,
          deletedAt: null,
          name: {
            contains: productSearch,
            mode: 'insensitive',
          },
        },
        select: { id: { select: { id: true, name: true } } },
      })

      // Then find matching variations
      const matchingVariations = await prisma.productVariation.findMany({
        where: {
          businessId: businessIdInt,
          deletedAt: null,
          OR: [
            {
              name: {
                contains: productSearch,
                mode: 'insensitive',
              },
            },
            {
              sku: {
                contains: productSearch,
                mode: 'insensitive',
              },
            },
          ],
        },
        select: { id: { select: { id: true, name: true } } },
      })

      const productIds = matchingProducts.map(p => p.id)
      const variationIds = matchingVariations.map(v => v.id)

      // Now find return items that match
      const returnItems = await prisma.supplierReturnItem.findMany({
        where: {
          OR: [
            { productId: { in: productIds } },
            { productVariationId: { in: variationIds } },
          ],
        },
        select: {
          supplierReturnId: { select: { id: true, name: true } },
        },
      })

      productFilteredReturnIds = [...new Set(returnItems.map(item => item.supplierReturnId))]

      if (productFilteredReturnIds.length === 0) {
        return NextResponse.json({
          returns: [],
          summary: {
            totalReturns: 0,
            totalAmount: 0,
            totalItems: 0,
            pendingReturns: 0,
            approvedReturns: 0,
          },
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        })
      }

      where.id = {
        in: productFilteredReturnIds,
      }
    }

    // Build sort order
    const orderBy: any = {}
    if (sortBy === 'returnDate' || sortBy === 'totalAmount' || sortBy === 'returnNumber' || sortBy === 'createdAt') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.returnDate = 'desc'
    }

    // Fetch data with pagination
    const returnsPromise = prisma.supplierReturn.findMany({
      where,
      select: {
        supplier: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            mobile: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
          },
        },
        items: { select: { id: true, name: true } },
      },
      orderBy,
      skip: offset,
      take: limit,
    })

    const countPromise = prisma.supplierReturn.count({ where })

    const [returns, total] = await Promise.all([returnsPromise, countPromise])

    // Get location names
    const locationIds = Array.from(
      new Set(
        returns
          .map((ret) => ret.locationId)
          .filter((id): id is number => typeof id === 'number')
      )
    )

    let locationMap: Record<number, { id: number; name: string }> = {}

    if (locationIds.length > 0) {
      const locations = await prisma.businessLocation.findMany({
        where: {
          id: { in: locationIds },
          deletedAt: null,
          businessId: businessIdInt,
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
        },
      })

      locationMap = locations.reduce((acc, loc) => {
        acc[loc.id] = loc
        return acc
      }, {} as Record<number, { id: number; name: string }>)
    }

    // Get product and variation data for all return items
    const productIds = Array.from(
      new Set(
        returns.flatMap((ret) => ret.items.map((item) => item.productId))
      )
    )

    const variationIds = Array.from(
      new Set(
        returns.flatMap((ret) => ret.items.map((item) => item.productVariationId))
      )
    )

    let productMap: Record<number, { id: number; name: string }> = {}
    let variationMap: Record<number, { id: number; name: string; sku: string | null }> = {}

    if (productIds.length > 0) {
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          deletedAt: null,
          businessId: businessIdInt,
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
        },
      })

      productMap = products.reduce((acc, product) => {
        acc[product.id] = product
        return acc
      }, {} as Record<number, { id: number; name: string }>)
    }

    if (variationIds.length > 0) {
      const variations = await prisma.productVariation.findMany({
        where: {
          id: { in: variationIds },
          deletedAt: null,
          businessId: businessIdInt,
        },
        select: {
          id: { select: { id: true, name: true } },
          name: { select: { id: true, name: true } },
          sku: { select: { id: true, name: true } },
        },
      })

      variationMap = variations.reduce((acc, variation) => {
        acc[variation.id] = variation
        return acc
      }, {} as Record<number, { id: number; name: string; sku: string | null }>)
    }

    // Calculate summary for all matching records
    const allReturns = await prisma.supplierReturn.findMany({
      where,
      select: {
        items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      },
    })

    const summary = {
      totalReturns: total,
      totalAmount: allReturns.reduce((sum, ret) => sum + parseFloat(ret.totalAmount.toString()), 0),
      totalItems: allReturns.reduce((sum, ret) => sum + ret.items.length, 0),
      pendingReturns: allReturns.filter(r => r.status === 'pending').length,
      approvedReturns: allReturns.filter(r => r.status === 'approved').length,
    }

    // Format returns data for response
    const returnsData = returns.map((ret) => ({
      id: ret.id,
      returnNumber: ret.returnNumber,
      returnDate: ret.returnDate.toISOString().split('T')[0],
      supplier: {
        id: ret.supplier.id,
        name: ret.supplier.name,
        mobile: ret.supplier.mobile,
        email: ret.supplier.email,
      },
      location: locationMap[ret.locationId]?.name || 'Unknown',
      locationId: ret.locationId,
      status: ret.status,
      returnReason: ret.returnReason,
      totalAmount: parseFloat(ret.totalAmount.toString()),
      notes: ret.notes,
      itemCount: ret.items.length,
      createdBy: ret.createdBy,
      createdAt: ret.createdAt.toISOString(),
      approvedBy: ret.approvedBy,
      approvedAt: ret.approvedAt?.toISOString() || null,
      items: ret.items.map((item) => {
        const product = productMap[item.productId]
        const variation = variationMap[item.productVariationId]

        return {
          id: item.id,
          productName: product?.name || 'Unknown Product',
          variationName: variation?.name || 'Standard',
          sku: variation?.sku ?? '',
          quantity: parseFloat(item.quantity.toString()),
          unitCost: parseFloat(item.unitCost.toString()),
          condition: item.condition,
          serialNumbers: item.serialNumbers as any,
          notes: item.notes,
          total: parseFloat(item.quantity.toString()) * parseFloat(item.unitCost.toString()),
        }
      }),
    }))

    return NextResponse.json({
      returns: returnsData,
      summary,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching purchase returns report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch purchase returns report' },
      { status: 500 }
    )
  }
}
