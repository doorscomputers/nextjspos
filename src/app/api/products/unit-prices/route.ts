import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/products/unit-prices?productId=123
 * Get all unit prices for a product
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)
    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('productId') || '')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: {
        id: true,
        name: true,
        sku: true,
        subUnitIds: true,
        unitId: true,
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Get all unit prices
    const unitPrices = await prisma.productUnitPrice.findMany({
      where: {
        productId,
        businessId,
      },
      include: {
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
          },
        },
      },
      orderBy: {
        unitId: 'asc',
      },
    })

    // Parse sub-unit IDs
    const subUnitIds = product.subUnitIds
      ? (typeof product.subUnitIds === 'string'
          ? JSON.parse(product.subUnitIds)
          : product.subUnitIds)
      : []

    // Get all units (primary + sub-units)
    const allUnitIds = [product.unitId, ...subUnitIds].filter(Boolean)
    const units = await prisma.unit.findMany({
      where: {
        id: { in: allUnitIds },
      },
      select: {
        id: true,
        name: true,
        shortName: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        product,
        units,
        unitPrices,
      },
    })
  } catch (error) {
    console.error('Error fetching unit prices:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch unit prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/unit-prices
 * Update or create unit prices for a product
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)
    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_PRICE_EDIT)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { productId, unitPrices } = body

    if (!productId || !Array.isArray(unitPrices)) {
      return NextResponse.json(
        { error: 'productId and unitPrices array are required' },
        { status: 400 }
      )
    }

    // Verify product belongs to user's business
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Update unit prices in transaction
    const results = await prisma.$transaction(async (tx) => {
      const updates = []

      for (const { unitId, purchasePrice, sellingPrice } of unitPrices) {
        const result = await tx.productUnitPrice.upsert({
          where: {
            productId_unitId: {
              productId,
              unitId,
            },
          },
          update: {
            purchasePrice: parseFloat(purchasePrice),
            sellingPrice: parseFloat(sellingPrice),
          },
          create: {
            businessId,
            productId,
            unitId,
            purchasePrice: parseFloat(purchasePrice),
            sellingPrice: parseFloat(sellingPrice),
          },
        })

        updates.push(result)
      }

      return updates
    })

    return NextResponse.json({
      success: true,
      message: `Updated ${results.length} unit price(s)`,
      data: results,
    })
  } catch (error) {
    console.error('Error updating unit prices:', error)
    return NextResponse.json(
      {
        error: 'Failed to update unit prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
