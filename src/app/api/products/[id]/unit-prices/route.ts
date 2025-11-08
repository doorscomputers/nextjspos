import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import {
  getProductUnitPrices,
  saveProductUnitPrices,
  UnitPriceInput,
} from '@/lib/productUnitPricing'

/**
 * GET /api/products/[id]/unit-prices
 * Get all unit prices for a product
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = Number(user.businessId)
    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    // Get unit prices
    const prices = await getProductUnitPrices(productId, businessId)

    // Serialize Decimal to string
    const serializedPrices = prices.map(p => ({
      ...p,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      multiplier: p.multiplier.toString(),
    }))

    return NextResponse.json({
      success: true,
      prices: serializedPrices,
    })
  } catch (error) {
    console.error('Error fetching unit prices:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unit prices' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products/[id]/unit-prices
 * Save unit prices for a product
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = Number(user.businessId)

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { id } = await params
    const productId = parseInt(id)

    if (isNaN(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { prices } = body as { prices: UnitPriceInput[] }

    if (!Array.isArray(prices)) {
      return NextResponse.json(
        { error: 'Invalid prices data' },
        { status: 400 }
      )
    }

    // Validate product exists
    const { prisma } = await import('@/lib/prisma')
    const product = await prisma.product.findUnique({
      where: { id: productId, businessId },
    })

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      )
    }

    // Save unit prices
    await saveProductUnitPrices(productId, businessId, prices)

    // Fetch updated prices
    const updatedPrices = await getProductUnitPrices(productId, businessId)

    // Serialize
    const serializedPrices = updatedPrices.map(p => ({
      ...p,
      purchasePrice: p.purchasePrice.toString(),
      sellingPrice: p.sellingPrice.toString(),
      multiplier: p.multiplier.toString(),
    }))

    return NextResponse.json({
      success: true,
      message: 'Unit prices saved successfully',
      prices: serializedPrices,
    })
  } catch (error: any) {
    console.error('Error saving unit prices:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save unit prices' },
      { status: 500 }
    )
  }
}
