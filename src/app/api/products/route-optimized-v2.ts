import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// OPTIMIZED GET - Server-side pagination, filtering, and sorting
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
    const isActive = searchParams.get('isActive')
    const productType = searchParams.get('productType')?.trim() || ''
    const categoryId = searchParams.get('categoryId')
    const brandId = searchParams.get('brandId')
    const enableStock = searchParams.get('enableStock')

    // Stock filtering (server-side)
    const stockMin = searchParams.get('stockMin') ? parseFloat(searchParams.get('stockMin')!) : undefined
    const stockMax = searchParams.get('stockMax') ? parseFloat(searchParams.get('stockMax')!) : undefined

    // Build optimized where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
      deletedAt: null
    }

    // Apply filters
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (isActive !== null && isActive !== undefined) {
      whereClause.isActive = isActive === 'true'
    }

    if (productType) {
      whereClause.type = productType
    }

    if (categoryId) {
      whereClause.categoryId = parseInt(categoryId)
    }

    if (brandId) {
      whereClause.brandId = parseInt(brandId)
    }

    if (enableStock !== null && enableStock !== undefined) {
      whereClause.enableStock = enableStock === 'true'
    }

    // Build orderBy clause
    const orderBy: any = {}
    if (sortBy === 'category') {
      orderBy.category = { name: sortOrder }
    } else if (sortBy === 'brand') {
      orderBy.brand = { name: sortOrder }
    } else if (sortBy === 'unit') {
      orderBy.unit = { name: sortOrder }
    } else {
      orderBy[sortBy] = sortOrder
    }

    // Get total count for pagination
    const totalCount = await prisma.product.count({
      where: whereClause
    })

    // Fetch products with minimal, optimized includes
    const products = await prisma.product.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        sku: true,
        type: true,
        isActive: true,
        enableStock: true,
        purchasePrice: true,
        sellingPrice: true,
        alertQuantity: true,
        createdAt: true,
        updatedAt: true,
        // Minimal relation data
        category: {
          select: {
            id: true,
            name: true
          }
        },
        brand: {
          select: {
            id: true,
            name: true
          }
        },
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        tax: {
          select: {
            id: true,
            name: true,
            amount: true
          }
        },
        // Only include variations if needed for stock calculation
        ...(stockMin !== undefined || stockMax !== undefined ? {
          variations: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              sku: true,
              variationLocationDetails: {
                select: {
                  qtyAvailable: true
                }
              }
            }
          }
        } : {})
      },
      orderBy,
      skip,
      take
    })

    // Apply server-side stock filtering if needed
    let filteredProducts = products
    if (stockMin !== undefined || stockMax !== undefined) {
      filteredProducts = products.filter(product => {
        if (!product.enableStock) return false

        let totalStock = 0
        if (product.type === 'variable' || product.type === 'single') {
          totalStock = (product as any).variations?.reduce((total: number, variation: any) => {
            const varStock = variation.variationLocationDetails.reduce((sum: number, detail: any) => sum + Number(detail.qtyAvailable), 0)
            return total + varStock
          }, 0) || 0
        }

        if (stockMin !== undefined && totalStock < stockMin) return false
        if (stockMax !== undefined && totalStock > stockMax) return false
        return true
      })
    }

    // Calculate total stock for each product (only if needed)
    const productsWithStock = filteredProducts.map(product => {
      let totalStock = 0
      if (product.enableStock && (product as any).variations) {
        totalStock = (product as any).variations.reduce((total: number, variation: any) => {
          const varStock = variation.variationLocationDetails.reduce((sum: number, detail: any) => sum + Number(detail.qtyAvailable), 0)
          return total + varStock
        }, 0)
      }

      return {
        ...product,
        totalStock,
        // Remove variations from response to reduce payload
        variations: undefined
      }
    })

    return NextResponse.json({
      data: productsWithStock,
      totalCount: filteredProducts.length,
      // DevExtreme DataGrid expects these fields
      summary: [{
        totalCount: filteredProducts.length
      }]
    })

  } catch (error) {
    console.error('Products API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
