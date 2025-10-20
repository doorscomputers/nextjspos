import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

type StockLocationRange = {
  min?: string
  max?: string
}

type StockFilters = {
  search?: string
  productName?: string
  productSku?: string
  variationName?: string
  variationSku?: string
  category?: string
  brand?: string
  unit?: string
  minSellingPrice?: string
  maxSellingPrice?: string
  minTotalStock?: string
  maxTotalStock?: string
  locationFilters?: Record<string, StockLocationRange>
}

type PivotRow = {
  productId: number
  variationId: number
  productName: string
  productSku: string
  productImage: string | null
  variationName: string
  variationSku: string
  category: string
  brand: string
  unit: string
  sellingPrice: number
  stockByLocation: Record<number, number>
  totalStock: number
}

const textMatches = (value: string | null | undefined, filterValue?: string) => {
  if (!filterValue) return true
  return (value ?? '').toLowerCase().includes(filterValue.toLowerCase())
}

const numberMatchesRange = (value: number, range?: StockLocationRange | null, min?: string, max?: string) => {
  const minValue = range ? range.min : min
  const maxValue = range ? range.max : max

  const parsedMin = minValue !== undefined && minValue !== '' ? Number(minValue) : NaN
  const parsedMax = maxValue !== undefined && maxValue !== '' ? Number(maxValue) : NaN

  if (!Number.isNaN(parsedMin) && value < parsedMin) return false
  if (!Number.isNaN(parsedMax) && value > parsedMax) return false
  return true
}

const getSortValue = (row: PivotRow, key: string) => {
  if (key.startsWith('location-')) {
    const locationId = Number(key.split('-')[1])
    return row.stockByLocation[locationId] || 0
  }

  switch (key) {
    case 'productName':
      return row.productName
    case 'productSku':
      return row.productSku
    case 'variationName':
      return row.variationName
    case 'variationSku':
      return row.variationSku
    case 'category':
      return row.category
    case 'brand':
      return row.brand
    case 'unit':
      return row.unit
    case 'sellingPrice':
      return row.sellingPrice
    case 'totalStock':
      return row.totalStock
    default:
      return row.productName
  }
}

const sanitizeNumber = (value: unknown, fallback = 0) => {
  if (value == null) return fallback
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as { businessId?: number | string }
    const businessIdRaw = sessionUser.businessId
    const businessId =
      typeof businessIdRaw === 'string' ? parseInt(businessIdRaw, 10) : businessIdRaw

    if (!businessId || Number.isNaN(businessId)) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Fetch all variation location details with related data
    const stockData = await prisma.variationLocationDetails.findMany({
      where: {
        product: {
          businessId,
          deletedAt: null,
        },
      },
      include: {
        product: {
          include: {
            category: true,
            brand: true,
            unit: true,
          },
        },
        productVariation: {
          include: {
            unit: true,
          },
        },
      },
      orderBy: {
        product: {
          name: 'asc',
        },
      },
    })

    // Get location names
    const locationIds = [...new Set(stockData.map((item) => item.locationId))]
    const locations = await prisma.businessLocation.findMany({
      where: {
        id: { in: locationIds },
        deletedAt: null,
        isActive: true, // Only show active locations
      },
    })

    const locationMap = Object.fromEntries(locations.map((loc) => [loc.id, loc.name]))

    // Transform data for frontend
    const stock = stockData.map((item) => ({
      productId: item.product.id,
      productName: item.product.name,
      productSku: item.product.sku,
      productImage: item.product.image,
      variationId: item.productVariation.id,
      variationName: item.productVariation.name,
      variationSku: item.productVariation.sku,
      locationId: item.locationId,
      locationName: locationMap[item.locationId] || 'Unknown',
      qtyAvailable:
        typeof item.qtyAvailable === 'object' && 'toNumber' in item.qtyAvailable
          ? item.qtyAvailable.toNumber()
          : Number(item.qtyAvailable),
      unit: item.productVariation.unit?.shortName || item.product.unit?.shortName || 'N/A',
      category: item.product.category?.name || '',
      brand: item.product.brand?.name || '',
      sellingPrice:
        item.productVariation.sellingPrice && 'toNumber' in item.productVariation.sellingPrice
          ? item.productVariation.sellingPrice.toNumber()
          : sanitizeNumber(item.productVariation.sellingPrice),
    }))

    return NextResponse.json({ stock })
  } catch (error) {
    console.error('Error fetching stock data:', error)
    return NextResponse.json({ error: 'Failed to fetch stock data' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as { businessId?: number | string }
    const businessIdRaw = sessionUser.businessId
    const businessId =
      typeof businessIdRaw === 'string' ? parseInt(businessIdRaw, 10) : businessIdRaw

    if (!businessId || Number.isNaN(businessId)) {
      return NextResponse.json({ error: 'Invalid business context' }, { status: 400 })
    }

    const body = (await request.json().catch(() => ({}))) as Partial<{
      page: number
      limit: number
      sortKey: string
      sortOrder: 'asc' | 'desc'
      filters: StockFilters
      exportAll: boolean
    }>
    const {
      page = 1,
      limit = 25,
      sortKey = 'productName',
      sortOrder = 'asc',
      filters = {},
      exportAll = false,
    }: {
      page?: number
      limit?: number
      sortKey?: string
      sortOrder?: 'asc' | 'desc'
      filters?: StockFilters
      exportAll?: boolean
    } = body || {}

    const baseLimit = Math.max(1, Number(limit) || 25)
    const requestedPage = Math.max(1, Number(page) || 1)
    const isDescending = sortOrder === 'desc'

    // Fetch stock records for the business
    const stockData = await prisma.variationLocationDetails.findMany({
      where: {
        product: {
          businessId,
          deletedAt: null,
        },
      },
      include: {
        product: {
          include: {
            category: { select: { name: true } },
            brand: { select: { name: true } },
            unit: { select: { shortName: true } },
          },
        },
        productVariation: {
          include: {
            unit: { select: { shortName: true } },
          },
        },
      },
    })

    const allLocations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: true, // Only show active locations
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: 'asc',
      },
    })

    // Pivot data into variation-level rows
    const pivotMap = new Map<string, PivotRow>()

    stockData.forEach((item) => {
      const key = `${item.productId}-${item.productVariationId}`
      const qty =
        typeof item.qtyAvailable === 'object' && 'toNumber' in item.qtyAvailable
          ? item.qtyAvailable.toNumber()
          : Number(item.qtyAvailable)
      const sellingPrice =
        item.productVariation.sellingPrice && 'toNumber' in item.productVariation.sellingPrice
          ? item.productVariation.sellingPrice.toNumber()
          : sanitizeNumber(item.productVariation.sellingPrice)

      if (!pivotMap.has(key)) {
        pivotMap.set(key, {
          productId: item.productId,
          variationId: item.productVariationId,
          productName: item.product.name,
          productSku: item.product.sku,
          productImage: item.product.image,
          variationName: item.productVariation.name,
          variationSku: item.productVariation.sku,
          category: item.product.category?.name || '',
          brand: item.product.brand?.name || '',
          unit: item.productVariation.unit?.shortName || item.product.unit?.shortName || 'N/A',
          sellingPrice,
          stockByLocation: {},
          totalStock: 0,
        })
      }

      const row = pivotMap.get(key)!
      row.stockByLocation[item.locationId] = qty
      row.totalStock += qty
    })

    let pivotRows = Array.from(pivotMap.values())

    const searchValue = filters.search?.trim().toLowerCase() ?? ''
    const locationFilters = filters.locationFilters ?? {}

    pivotRows = pivotRows.filter((row) => {
      const matchesSearch =
        searchValue === '' ||
        [row.productName, row.productSku, row.variationName, row.variationSku, row.category, row.brand, row.unit]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(searchValue))

      if (!matchesSearch) return false
      if (!textMatches(row.productName, filters.productName)) return false
      if (!textMatches(row.productSku, filters.productSku)) return false
      if (!textMatches(row.variationName, filters.variationName)) return false
      if (!textMatches(row.variationSku, filters.variationSku)) return false
      if (!textMatches(row.category, filters.category)) return false
      if (!textMatches(row.brand, filters.brand)) return false
      if (!textMatches(row.unit, filters.unit)) return false
      if (!numberMatchesRange(row.sellingPrice ?? 0, null, filters.minSellingPrice, filters.maxSellingPrice))
        return false
      if (!numberMatchesRange(row.totalStock, null, filters.minTotalStock, filters.maxTotalStock)) return false

      const matchesLocationRanges = Object.entries(locationFilters).every(([locationId, range]) => {
        const locationNumericId = Number(locationId)
        const qty = row.stockByLocation[locationNumericId] || 0
        return numberMatchesRange(qty, range)
      })

      return matchesLocationRanges
    })

    // Calculate totals across filtered data
    const locationTotals: Record<number, number> = {}
    let grandTotal = 0

    pivotRows.forEach((row) => {
      allLocations.forEach((location) => {
        const qty = row.stockByLocation[location.id] || 0
        locationTotals[location.id] = (locationTotals[location.id] || 0) + qty
      })
      grandTotal += row.totalStock
    })

    // Apply sorting
    pivotRows.sort((a, b) => {
      const valueA = getSortValue(a, sortKey)
      const valueB = getSortValue(b, sortKey)

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return isDescending ? valueB - valueA : valueA - valueB
      }

      const stringA = String(valueA ?? '').toLowerCase()
      const stringB = String(valueB ?? '').toLowerCase()

      if (stringA < stringB) return isDescending ? 1 : -1
      if (stringA > stringB) return isDescending ? -1 : 1
      return 0
    })

    const totalCount = pivotRows.length
    const effectiveLimit = exportAll ? totalCount : baseLimit
    const totalPages = exportAll ? 1 : Math.max(1, Math.ceil(totalCount / effectiveLimit))
    const safePage = exportAll ? 1 : Math.min(requestedPage, totalPages)
    const startIndex = exportAll ? 0 : (safePage - 1) * effectiveLimit
    const paginatedRows = exportAll
      ? pivotRows
      : pivotRows.slice(startIndex, startIndex + effectiveLimit)

    return NextResponse.json({
      rows: paginatedRows,
      locations: allLocations,
      totals: {
        byLocation: locationTotals,
        grandTotal,
      },
      pagination: {
        page: safePage,
        limit: effectiveLimit,
        totalCount,
        totalPages,
      },
      sorting: {
        sortKey,
        sortOrder,
      },
    })
  } catch (error) {
    console.error('Error generating stock report:', error)
    return NextResponse.json({ error: 'Failed to generate stock report' }, { status: 500 })
  }
}
