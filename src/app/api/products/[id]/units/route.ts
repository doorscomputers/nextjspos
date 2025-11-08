import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { getProductUnits } from '@/lib/uomConversion'

/**
 * GET /api/products/[id]/units
 * Get available units for a product (base unit + configured sub-units)
 * Used by UnitSelector component
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

    // Get product units using the UOM conversion library
    const units = await getProductUnits(productId, businessId)

    // Convert Decimal to string for JSON serialization
    const serializedUnits = units.map((unit) => ({
      ...unit,
      multiplier: unit.multiplier.toString(),
    }))

    return NextResponse.json({
      success: true,
      units: serializedUnits,
    })
  } catch (error) {
    console.error('Error fetching product units:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product units' },
      { status: 500 }
    )
  }
}
