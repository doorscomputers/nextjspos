import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/pos/product-units?productId=123
 * Get unit information and prices for a product (optimized for POS)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)

    const { searchParams } = new URL(request.url)
    const productId = parseInt(searchParams.get('productId') || '')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required' }, { status: 400 })
    }

    // Get product with unit information
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId,
      },
      select: {
        id: true,
        unitId: true,
        subUnitIds: true,
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true,
            allowDecimal: true,
            baseUnitId: true,
            baseUnitMultiplier: true,
          },
        },
      },
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

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
        businessId,
      },
      select: {
        id: true,
        name: true,
        shortName: true,
        allowDecimal: true,
        baseUnitId: true,
        baseUnitMultiplier: true,
      },
    })

    // Get unit prices
    const unitPrices = await prisma.productUnitPrice.findMany({
      where: {
        productId,
        businessId,
      },
      select: {
        unitId: true,
        purchasePrice: true,
        sellingPrice: true,
      },
    })

    // Convert to plain objects for JSON serialization
    const unitsData = units.map(u => ({
      id: u.id,
      name: u.name,
      shortName: u.shortName,
      allowDecimal: u.allowDecimal,
      baseUnitId: u.baseUnitId,
      baseUnitMultiplier: u.baseUnitMultiplier ? parseFloat(String(u.baseUnitMultiplier)) : null,
    }))

    const unitPricesData = unitPrices.map(up => ({
      unitId: up.unitId,
      purchasePrice: parseFloat(String(up.purchasePrice)),
      sellingPrice: parseFloat(String(up.sellingPrice)),
    }))

    return NextResponse.json({
      success: true,
      data: {
        primaryUnitId: product.unitId,
        units: unitsData,
        unitPrices: unitPricesData,
      },
    })
  } catch (error) {
    console.error('Error fetching product units:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch product units',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
