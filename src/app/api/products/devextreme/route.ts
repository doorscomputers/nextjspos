import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * DevExtreme-compatible Products API endpoint
 * Supports server-side pagination, filtering, sorting, and searching
 * Used by DevExtreme CustomStore with remoteOperations enabled
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Parse DevExtreme load options
    const { searchParams } = new URL(request.url)

    // Pagination
    const skip = parseInt(searchParams.get('skip') || '0')
    const take = Math.min(parseInt(searchParams.get('take') || '50'), 200) // Max 200 per page

    // Search
    const searchValue = searchParams.get('searchValue')?.trim() || ''
    const searchExpr = searchParams.get('searchExpr')?.trim() || 'name'
    const searchOperation = searchParams.get('searchOperation') || 'contains'

    // Sorting
    const sortField = searchParams.get('sort')
    const sortOrder = searchParams.get('sortOrder') || 'asc'

    // Filtering (DevExtreme filter format)
    const filterParam = searchParams.get('filter')
    let filters: any = null
    if (filterParam) {
      try {
        filters = JSON.parse(filterParam)
      } catch (e) {
        console.error('Failed to parse filter:', e)
      }
    }

    // Build base where clause
    const whereClause: any = {
      businessId,
      deletedAt: null,
      isActive: true // Only show active products by default
    }

    // Apply search
    if (searchValue) {
      whereClause.OR = [
        { name: { contains: searchValue, mode: 'insensitive' } },
        { sku: { contains: searchValue, mode: 'insensitive' } },
        { description: { contains: searchValue, mode: 'insensitive' } }
      ]
    }

    // Apply DevExtreme filters
    if (filters) {
      applyDevExtremeFilters(whereClause, filters)
    }

    // Build order by clause
    const orderBy: any = {}
    if (sortField) {
      orderBy[sortField] = sortOrder.toLowerCase()
    } else {
      orderBy.createdAt = 'desc' // Default sort
    }

    // Execute queries in parallel
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          type: true,
          sku: true,
          image: true, // Include image field
          enableStock: true,
          alertQuantity: true,
          isActive: true,
          createdAt: true,
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          unit: { select: { id: true, name: true, shortName: true } },
          tax: { select: { id: true, name: true, amount: true } },
          variations: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              sku: true,
              purchasePrice: true,
              sellingPrice: true,
              lastPurchaseDate: true,
              lastPurchaseCost: true,
              lastPurchaseQuantity: true,
              variationLocationDetails: {
                select: {
                  id: true,
                  qtyAvailable: true,
                  locationId: true
                }
              },
              supplier: { select: { id: true, name: true } }
            }
          }
        },
        orderBy,
        skip,
        take
      }),
      prisma.product.count({ where: whereClause })
    ])

    // Transform data for DevExtreme
    const transformedData = products.map((product) => {
      // Calculate total stock across all locations
      const totalStock = product.variations.reduce((sum, variation) => {
        const variationStock = variation.variationLocationDetails.reduce(
          (vSum, detail) => vSum + parseFloat(detail.qtyAvailable.toString()),
          0
        )
        return sum + variationStock
      }, 0)

      // Calculate total cost
      const totalCost = product.variations.reduce((sum, variation) => {
        const cost = variation.purchasePrice ? parseFloat(variation.purchasePrice.toString()) : 0
        const stock = variation.variationLocationDetails.reduce(
          (vSum, detail) => vSum + parseFloat(detail.qtyAvailable.toString()),
          0
        )
        return sum + (cost * stock)
      }, 0)

      // Get last supplier and purchase info (matching existing page structure)
      let lastSupplier = '-'
      let latestSupplier = '-'
      let lastPurchaseDate: Date | null = null
      let lastPurchaseCost: number | null = null
      let lastPurchaseQuantity: number | null = null

      if (product.variations && product.variations.length > 0) {
        // Get the most recent variation with supplier
        const variationsWithSupplier = product.variations.filter(v => v.supplier)
        if (variationsWithSupplier.length > 0) {
          latestSupplier = variationsWithSupplier[0].supplier?.name || '-'
        }

        // Get the variation with the most recent purchase date
        const variationsWithPurchaseDate = product.variations.filter(v => v.lastPurchaseDate)
        if (variationsWithPurchaseDate.length > 0) {
          // Sort by lastPurchaseDate descending
          const sorted = variationsWithPurchaseDate.sort((a, b) => {
            const dateA = a.lastPurchaseDate ? new Date(a.lastPurchaseDate).getTime() : 0
            const dateB = b.lastPurchaseDate ? new Date(b.lastPurchaseDate).getTime() : 0
            return dateB - dateA
          })
          const mostRecent = sorted[0]
          lastSupplier = mostRecent.supplier?.name || '-'
          lastPurchaseDate = mostRecent.lastPurchaseDate ? new Date(mostRecent.lastPurchaseDate) : null
          lastPurchaseCost = mostRecent.lastPurchaseCost ? parseFloat(mostRecent.lastPurchaseCost.toString()) : null
          lastPurchaseQuantity = mostRecent.lastPurchaseQuantity ? parseFloat(mostRecent.lastPurchaseQuantity.toString()) : null
        }
      }

      return {
        id: product.id,
        name: product.name,
        type: product.type,
        sku: product.sku,
        category: product.category?.name || '-',
        brand: product.brand?.name || '-',
        unit: product.unit?.shortName || product.unit?.name || '-',
        tax: product.tax ? `${product.tax.name} (${product.tax.amount}%)` : '-',
        enableStock: product.enableStock,
        alertQuantity: product.alertQuantity ? parseFloat(product.alertQuantity.toString()) : 0,
        totalStock: totalStock,
        totalCost: totalCost,
        isActive: product.isActive ? 'Active' : 'Inactive', // Match existing format
        status: product.isActive, // Boolean for filtering
        image: product.image,
        createdAt: product.createdAt,
        // Supplier and purchase fields (matching existing page)
        lastSupplier: lastSupplier,
        latestSupplier: latestSupplier,
        lastPurchaseDate: lastPurchaseDate,
        lastPurchaseCost: lastPurchaseCost,
        lastPurchaseQuantity: lastPurchaseQuantity,
        variationCount: product.variations.length,
        // Include variations for master-detail
        variations: product.variations.map(v => ({
          id: v.id,
          name: v.name,
          sku: v.sku,
          purchasePrice: v.purchasePrice ? parseFloat(v.purchasePrice.toString()) : 0,
          sellingPrice: v.sellingPrice ? parseFloat(v.sellingPrice.toString()) : 0,
          supplier: v.supplier,
          lastPurchaseDate: v.lastPurchaseDate,
          lastPurchaseCost: v.lastPurchaseCost ? parseFloat(v.lastPurchaseCost.toString()) : 0,
          lastPurchaseQuantity: v.lastPurchaseQuantity ? parseFloat(v.lastPurchaseQuantity.toString()) : 0,
          variationLocationDetails: v.variationLocationDetails.map(d => ({
            id: d.id,
            qtyAvailable: parseFloat(d.qtyAvailable.toString())
          }))
        }))
      }
    })

    // Return DevExtreme-compatible response
    return NextResponse.json({
      data: transformedData,
      totalCount: totalCount
    })
  } catch (error) {
    console.error('DevExtreme Products API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * Apply DevExtreme filter format to Prisma where clause
 */
function applyDevExtremeFilters(whereClause: any, filters: any) {
  // DevExtreme filter format: ["field", "operation", value] or [["field", "op", val], "and/or", ["field2", "op", val2]]

  if (!Array.isArray(filters)) return

  // Simple filter: ["name", "contains", "test"]
  if (filters.length === 3 && typeof filters[0] === 'string') {
    const [field, operation, value] = filters
    applyFilter(whereClause, field, operation, value)
    return
  }

  // Complex filter with AND/OR
  if (filters.length > 3) {
    const operator = filters[1] // 'and' or 'or'
    const conditions = filters.filter((f: any) => Array.isArray(f))

    if (operator === 'or') {
      whereClause.OR = whereClause.OR || []
      conditions.forEach((condition: any) => {
        const subWhere: any = {}
        applyFilter(subWhere, condition[0], condition[1], condition[2])
        whereClause.OR.push(subWhere)
      })
    } else {
      // AND conditions - apply directly
      conditions.forEach((condition: any) => {
        applyFilter(whereClause, condition[0], condition[1], condition[2])
      })
    }
  }
}

/**
 * Apply single filter to where clause
 */
function applyFilter(whereClause: any, field: string, operation: string, value: any) {
  switch (operation) {
    case 'contains':
      whereClause[field] = { contains: value, mode: 'insensitive' }
      break
    case 'notcontains':
      whereClause[field] = { not: { contains: value, mode: 'insensitive' } }
      break
    case 'startswith':
      whereClause[field] = { startsWith: value, mode: 'insensitive' }
      break
    case 'endswith':
      whereClause[field] = { endsWith: value, mode: 'insensitive' }
      break
    case '=':
      whereClause[field] = value
      break
    case '<>':
      whereClause[field] = { not: value }
      break
    case '>':
      whereClause[field] = { gt: value }
      break
    case '>=':
      whereClause[field] = { gte: value }
      break
    case '<':
      whereClause[field] = { lt: value }
      break
    case '<=':
      whereClause[field] = { lte: value }
      break
    default:
      whereClause[field] = value
  }
}
