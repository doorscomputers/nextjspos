import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/products/search-async
 * Async product search for dropdown/autocomplete components
 * Searches by product name, product SKU, variation name, or variation SKU
 * Requires minimum 3 character input
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const searchTerm = searchParams.get('q') || ''
    const productIdParam = searchParams.get('productId')
    const limit = parseInt(searchParams.get('limit') || '50')

    // FAST PATH: Direct product ID lookup (for URL parameters)
    if (productIdParam) {
      const productId = parseInt(productIdParam)
      
      const where: any = {
        id: productId,
        businessId,
        deletedAt: null,
      }

      const products = await prisma.product.findMany({
        where,
        take: 1,
        select: {
          id: true,
          name: true,
          sku: true,
          variations: {
            where: {
              deletedAt: null,
            },
            select: {
              id: true,
              name: true,
              sku: true,
            },
            orderBy: {
              name: 'asc',
            },
          },
        },
      })

      // Flatten products with variations
      const options: any[] = []
      products.forEach((product) => {
        if (product.variations && product.variations.length > 0) {
          product.variations.forEach((variation) => {
            const displayName =
              variation.name === 'DUMMY' || variation.name === 'Default'
                ? product.name
                : `${product.name} - ${variation.name}`

            options.push({
              id: variation.id,
              productId: product.id,
              variationId: variation.id,
              displayName,
              sku: variation.sku,
            })
          })
        }
      })

      return NextResponse.json({
        success: true,
        data: options,
        total: options.length,
      })
    }

    // Require minimum 3 characters for search (unless exact barcode/SKU match)
    if (searchTerm.length < 3 && searchTerm.length > 0) {
      return NextResponse.json({
        success: true,
        data: [],
        message: 'Please enter at least 3 characters to search'
      })
    }

    // If no search term, return empty (don't load everything)
    if (!searchTerm || searchTerm.trim() === '') {
      return NextResponse.json({
        success: true,
        data: []
      })
    }

    const trimmedSearch = searchTerm.trim()

    // Build where clause - search in both product AND variation fields
    const where: any = {
      businessId,
      deletedAt: null,
      OR: [
        {
          name: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        },
        {
          sku: {
            contains: trimmedSearch,
            mode: 'insensitive',
          },
        },
        {
          // Also search in variation SKUs
          variations: {
            some: {
              deletedAt: null,
              sku: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          },
        },
        {
          // Also search in variation names
          variations: {
            some: {
              deletedAt: null,
              name: {
                contains: trimmedSearch,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    }

    // Fetch products with variations
    const products = await prisma.product.findMany({
      where,
      take: limit,
      select: {
        id: true,
        name: true,
        sku: true,
        variations: {
          where: {
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            sku: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
      orderBy: [
        {
          name: 'asc',
        },
      ],
    })

    // Flatten products with variations for SelectBox
    const options: any[] = []

    products.forEach((product) => {
      if (product.variations && product.variations.length > 0) {
        product.variations.forEach((variation) => {
          const displayName =
            variation.name === 'DUMMY' || variation.name === 'Default'
              ? `${product.name} - ${variation.sku}`
              : `${product.name} - ${variation.name} - ${variation.sku}`

          options.push({
            id: variation.id, // variation ID
            productId: product.id,
            variationId: variation.id,
            displayName,
            sku: variation.sku,
          })
        })
      }
    })

    return NextResponse.json({
      success: true,
      data: options,
      total: options.length,
    })
  } catch (error: any) {
    console.error('Error in async product search:', error)
    return NextResponse.json(
      {
        error: 'Failed to search products',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
