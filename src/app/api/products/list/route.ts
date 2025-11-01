import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

const SORT_FIELD_MAP: Record<string, any> = {
  name: { name: undefined },
  sku: { sku: undefined },
  createdAt: { createdAt: undefined },
  updatedAt: { updatedAt: undefined },
  type: { type: undefined },
  isActive: { isActive: undefined },
  'category.name': { category: { name: undefined } },
  'brand.name': { brand: { name: undefined } },
  'unit.shortName': { unit: { shortName: undefined } },
}

type SortDirection = 'asc' | 'desc'

function parseInteger(value: string | null, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (!value) return fallback
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function buildOrderBy(sortBy: string | null, sortDir: SortDirection): any {
  if (!sortBy) {
    return { createdAt: 'desc' }
  }

  const mapping = SORT_FIELD_MAP[sortBy]
  if (!mapping) {
    return { createdAt: 'desc' }
  }

  const key = Object.keys(mapping)[0]
  const nested = mapping[key]

  if (nested === undefined) {
    return { [key]: sortDir }
  }

  return {
    [key]: {
      [Object.keys(nested)[0]]: sortDir
    }
  }
}

function normalizeDecimal(value: any) {
  if (value === null || value === undefined) return null
  return Number(value)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)

    const page = parseInteger(searchParams.get('page'), 1)
    const limit = parseInteger(searchParams.get('limit'), DEFAULT_LIMIT, 1, MAX_LIMIT)
    const skip = (page - 1) * limit

    const sortByParam = searchParams.get('sortBy')
    const sortDirParam = searchParams.get('sortDirection') === 'asc' ? 'asc' : 'desc'
    const orderBy = buildOrderBy(sortByParam, sortDirParam)

    const activeFilter = searchParams.get('active')
    const search = searchParams.get('search')?.trim() || ''
    const sku = searchParams.get('sku')?.trim() || ''
    const categoryName = searchParams.get('categoryName')?.trim() || ''
    const brandName = searchParams.get('brandName')?.trim() || ''
    const unitName = searchParams.get('unitName')?.trim() || ''
    const productType = searchParams.get('productType')?.trim() || ''
    const stockMin = searchParams.get('stockMin') ? Number.parseFloat(searchParams.get('stockMin') as string) : undefined
    const stockMax = searchParams.get('stockMax') ? Number.parseFloat(searchParams.get('stockMax') as string) : undefined
    const taxName = searchParams.get('taxName')?.trim() || ''

    const whereClause: any = {
      businessId: Number(businessId),
      deletedAt: null,
    }

    if (activeFilter !== null) {
      if (activeFilter === 'true') {
        whereClause.isActive = true
      } else if (activeFilter === 'false') {
        whereClause.isActive = false
      }
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { productDescription: { contains: search, mode: 'insensitive' } },
      ]
    }

    if (sku) {
      whereClause.sku = { contains: sku, mode: 'insensitive' }
    }

    if (categoryName) {
      whereClause.category = {
        name: { contains: categoryName, mode: 'insensitive' }
      }
    }

    if (brandName) {
      whereClause.brand = {
        name: { contains: brandName, mode: 'insensitive' }
      }
    }

    if (unitName) {
      whereClause.unit = {
        OR: [
          { name: { contains: unitName, mode: 'insensitive' } },
          { shortName: { contains: unitName, mode: 'insensitive' } },
        ]
      }
    }

    if (productType) {
      whereClause.type = productType
    }

    if (taxName) {
      whereClause.tax = {
        name: { contains: taxName, mode: 'insensitive' }
      }
    }

    const stockFilterEnabled = stockMin !== undefined || stockMax !== undefined

    let totalCount = 0
    let productRecords: any[] = []
    let stockTotalsMap = new Map<number, number>()

    if (stockFilterEnabled) {
      const baseProducts = await prisma.product.findMany({
        where: whereClause,
        select: { id: true },
        orderBy,
      })

      if (baseProducts.length === 0) {
        return NextResponse.json({
          products: [],
          pagination: {
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            limit,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          }
        })
      }

      const productIds = baseProducts.map((item) => item.id)

      const stockTotals = await prisma.variationLocationDetails.groupBy({
        by: ['productId'],
        where: {
          productId: { in: productIds }
        },
        _sum: { qtyAvailable: true }
      })

      stockTotalsMap = new Map(stockTotals.map((item) => [
        item.productId,
        Number(item._sum.qtyAvailable ?? 0)
      ]))

      const filteredProductIds = productIds.filter((id) => {
        const totalStock = stockTotalsMap.get(id) ?? 0
        if (stockMin !== undefined && totalStock < stockMin) return false
        if (stockMax !== undefined && totalStock > stockMax) return false
        return true
      })

      totalCount = filteredProductIds.length

      if (totalCount === 0) {
        return NextResponse.json({
          products: [],
          pagination: {
            totalCount: 0,
            totalPages: 0,
            currentPage: page,
            limit,
            hasNextPage: false,
            hasPreviousPage: page > 1,
          }
        })
      }

      const pagedIds = filteredProductIds.slice(skip, skip + limit)

      const products = await prisma.product.findMany({
        where: {
          id: { in: pagedIds }
        },
        select: {
          id: true,
          name: true,
          sku: true,
          image: true,
          type: true,
          enableStock: true,
          alertQuantity: true,
          isActive: true,
          purchasePrice: true,
          sellingPrice: true,
          createdAt: true,
          updatedAt: true,
          category: {
            select: {
              id: true,
              name: true,
            }
          },
          brand: {
            select: {
              id: true,
              name: true,
            }
          },
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
            }
          },
          tax: {
            select: {
              id: true,
              name: true,
              amount: true,
            }
          },
        },
      })

      const productMap = new Map(products.map((product) => [product.id, product]))
      productRecords = pagedIds.map((id) => productMap.get(id)).filter(Boolean)
    } else {
      const [count, products] = await Promise.all([
        prisma.product.count({ where: whereClause }),
        prisma.product.findMany({
          where: whereClause,
          select: {
            id: true,
            name: true,
            sku: true,
            image: true,
            type: true,
            enableStock: true,
            alertQuantity: true,
            isActive: true,
            purchasePrice: true,
            sellingPrice: true,
            createdAt: true,
            updatedAt: true,
            category: {
              select: {
                id: true,
                name: true,
              }
            },
            brand: {
              select: {
                id: true,
                name: true,
              }
            },
            unit: {
              select: {
                id: true,
                name: true,
                shortName: true,
              }
            },
            tax: {
              select: {
                id: true,
                name: true,
                amount: true,
              }
            },
          },
          orderBy,
          skip,
          take: limit,
        })
      ])

      totalCount = count

      if (products.length > 0) {
        const productIds = products.map((product) => product.id)
        const totals = await prisma.variationLocationDetails.groupBy({
          by: ['productId'],
          where: {
            productId: { in: productIds }
          },
          _sum: { qtyAvailable: true }
        })
        stockTotalsMap = new Map(totals.map((item) => [
          item.productId,
          Number(item._sum.qtyAvailable ?? 0)
        ]))
      }

      productRecords = products
    }

    const canViewPurchasePrice = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)
    const canViewSupplier = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW_SUPPLIER)

    const productsResponse = productRecords.map((product) => {
      const totalStock = product.enableStock ? (stockTotalsMap.get(product.id) ?? 0) : null

      const serialized = {
        ...product,
        alertQuantity: normalizeDecimal(product.alertQuantity),
        purchasePrice: normalizeDecimal(product.purchasePrice),
        sellingPrice: normalizeDecimal(product.sellingPrice),
        tax: product.tax ? {
          ...product.tax,
          amount: normalizeDecimal(product.tax.amount),
        } : null,
        totalStock,
      }

      if (!canViewPurchasePrice) {
        serialized.purchasePrice = null
      }

      if (!canViewSupplier) {
        delete (serialized as any).supplier
        delete (serialized as any).supplierId
      }

      return serialized
    })

    const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit)

    return NextResponse.json({
      products: productsResponse,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      }
    })
  } catch (error) {
    console.error('Error fetching products list:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

