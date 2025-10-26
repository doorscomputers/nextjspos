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
  supplier?: string
  category?: string
  brand?: string
  unit?: string
  minCost?: string
  maxCost?: string
  minPrice?: string
  maxPrice?: string
  minTotalStock?: string
  maxTotalStock?: string
  isActive?: string
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
  supplier: string
  category: string
  brand: string
  unit: string
  lastDeliveryDate: string | null
  lastQtyDelivered: number
  lastPurchaseCost: number
  cost: number
  price: number
  stockByLocation: Record<number, number>
  totalStock: number
  totalCost: number
  totalPrice: number
  isActive: boolean
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
    case 'supplier':
      return row.supplier
    case 'category':
      return row.category
    case 'brand':
      return row.brand
    case 'unit':
      return row.unit
    case 'lastDeliveryDate':
      return row.lastDeliveryDate || ''
    case 'lastQtyDelivered':
      return row.lastQtyDelivered
    case 'cost':
      return row.cost
    case 'price':
      return row.price
    case 'totalStock':
      return row.totalStock
    case 'totalCost':
      return row.totalCost
    case 'totalPrice':
      return row.totalPrice
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

const toNumber = (value: any): number => {
  if (value == null) return 0
  if (typeof value === 'object' && 'toNumber' in value) {
    return value.toNumber()
  }
  return sanitizeNumber(value)
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

    const body = (await request.json().catch((err) => {
      console.error('[Branch Stock Pivot] Error parsing request body:', err)
      return {}
    })) as Partial<{
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
    } = body || {}

    const baseLimit = Math.max(1, Number(limit) || 25)
    const requestedPage = Math.max(1, Number(page) || 1)
    const isDescending = sortOrder === 'desc'

    console.log('[Branch Stock Pivot] Starting query for businessId:', businessId)

    // Fetch stock records with supplier and last purchase info
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
            supplier: { select: { name: true } },
          },
        },
      },
    })

    console.log('[Branch Stock Pivot] Found stock data records:', stockData.length)

    // Last purchase info is now stored directly in ProductVariation
    // No need for complex queries - data is readily available from stockData.productVariation

    const allLocations = await prisma.businessLocation.findMany({
      where: {
        businessId,
        deletedAt: null,
        isActive: true,
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
      try {
        const key = `${item.productId}-${item.productVariationId}`
        const qty = toNumber(item.qtyAvailable)
        const cost = toNumber(item.productVariation.purchasePrice)
        const price = toNumber(item.productVariation.sellingPrice)

        if (!pivotMap.has(key)) {
          // Use last purchase data directly from ProductVariation
          const lastDelivery = item.productVariation.lastPurchaseDate
          const lastQty = toNumber(item.productVariation.lastPurchaseQuantity)
          const lastCost = toNumber(item.productVariation.lastPurchaseCost)

          pivotMap.set(key, {
            productId: item.productId,
            variationId: item.productVariationId,
            productName: item.product.name,
            productSku: item.product.sku,
            productImage: item.product.image,
            variationName: item.productVariation.name,
            variationSku: item.productVariation.sku,
            supplier: item.productVariation.supplier?.name || '',
            category: item.product.category?.name || '',
            brand: item.product.brand?.name || '',
            unit: item.productVariation.unit?.shortName || item.product.unit?.shortName || 'N/A',
            lastDeliveryDate: lastDelivery ? lastDelivery.toISOString().split('T')[0] : null,
            lastQtyDelivered: lastQty,
            lastPurchaseCost: lastCost,
            cost,
            price,
            stockByLocation: {},
            totalStock: 0,
            totalCost: 0,
            totalPrice: 0,
            isActive: item.product.isActive,
          })
        }

        const row = pivotMap.get(key)!
        row.stockByLocation[item.locationId] = qty
        row.totalStock += qty
        row.totalCost += qty * cost
        row.totalPrice += qty * price
      } catch (itemError) {
        console.error('[Branch Stock Pivot] Error processing item:', {
          productId: item.productId,
          variationId: item.productVariationId,
          error: itemError instanceof Error ? itemError.message : String(itemError),
        })
      }
    })

    let pivotRows = Array.from(pivotMap.values())

    // Apply filters
    const searchValue = filters.search?.trim().toLowerCase() ?? ''
    const locationFilters = filters.locationFilters ?? {}

    pivotRows = pivotRows.filter((row) => {
      const matchesSearch =
        searchValue === '' ||
        [row.productName, row.productSku, row.variationName, row.variationSku, row.category, row.brand, row.supplier, row.unit]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(searchValue))

      if (!matchesSearch) return false
      if (!textMatches(row.productName, filters.productName)) return false
      if (!textMatches(row.productSku, filters.productSku)) return false
      if (!textMatches(row.variationName, filters.variationName)) return false
      if (!textMatches(row.variationSku, filters.variationSku)) return false
      if (!textMatches(row.supplier, filters.supplier)) return false
      if (!textMatches(row.category, filters.category)) return false
      if (!textMatches(row.brand, filters.brand)) return false
      if (!textMatches(row.unit, filters.unit)) return false
      if (!numberMatchesRange(row.cost, null, filters.minCost, filters.maxCost)) return false
      if (!numberMatchesRange(row.price, null, filters.minPrice, filters.maxPrice)) return false
      if (!numberMatchesRange(row.totalStock, null, filters.minTotalStock, filters.maxTotalStock)) return false

      if (filters.isActive && filters.isActive !== 'all') {
        const activeFilter = filters.isActive === 'true'
        if (row.isActive !== activeFilter) return false
      }

      const matchesLocationRanges = Object.entries(locationFilters).every(([locationId, range]) => {
        const locationNumericId = Number(locationId)
        const qty = row.stockByLocation[locationNumericId] || 0
        return numberMatchesRange(qty, range)
      })

      return matchesLocationRanges
    })

    // Calculate totals across filtered data
    const locationTotals: Record<number, number> = {}
    const locationCostTotals: Record<number, number> = {}
    const locationPriceTotals: Record<number, number> = {}
    let grandTotal = 0
    let grandTotalCost = 0
    let grandTotalPrice = 0

    pivotRows.forEach((row) => {
      allLocations.forEach((location) => {
        const qty = row.stockByLocation[location.id] || 0
        locationTotals[location.id] = (locationTotals[location.id] || 0) + qty
        locationCostTotals[location.id] = (locationCostTotals[location.id] || 0) + (qty * row.cost)
        locationPriceTotals[location.id] = (locationPriceTotals[location.id] || 0) + (qty * row.price)
      })
      grandTotal += row.totalStock
      grandTotalCost += row.totalCost
      grandTotalPrice += row.totalPrice
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

    console.log('[Branch Stock Pivot] Returning response:', {
      rowsCount: paginatedRows.length,
      locationsCount: allLocations.length,
      totalCount,
      page: safePage,
      totalPages,
    })

    return NextResponse.json({
      rows: paginatedRows,
      locations: allLocations,
      totals: {
        byLocation: locationTotals,
        costByLocation: locationCostTotals,
        priceByLocation: locationPriceTotals,
        grandTotal,
        grandTotalCost,
        grandTotalPrice,
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
    console.error('[Branch Stock Pivot] Error generating branch stock pivot:', error)
    console.error('[Branch Stock Pivot] Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('[Branch Stock Pivot] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
    })
    return NextResponse.json(
      {
        error: 'Failed to generate branch stock pivot',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
