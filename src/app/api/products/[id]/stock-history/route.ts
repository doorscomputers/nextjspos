import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { getVariationStockHistory, verifyAndCorrectStock } from '@/lib/stock-history'

/**
 * GET /api/products/[id]/stock-history
 * Get stock history for a product variation at a location
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
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const variationId = searchParams.get('variationId')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const autoCorrect = searchParams.get('autoCorrect') === 'true'

    if (!variationId || !locationId) {
      return NextResponse.json(
        { error: 'variationId and locationId are required' },
        { status: 400 }
      )
    }

    // Auto-correct stock if requested
    if (autoCorrect) {
      const correction = await verifyAndCorrectStock(
        productId,
        parseInt(variationId),
        parseInt(locationId),
        parseInt(businessId)
      )

      if (correction.corrected) {
        console.log(`Stock corrected: ${correction.message}`)
      }
    }

    // Get stock history
    const history = await getVariationStockHistory(
      productId,
      parseInt(variationId),
      parseInt(locationId),
      parseInt(businessId),
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    )

    return NextResponse.json({ history }, { status: 200 })
  } catch (error) {
    console.error('Error fetching stock history:', error)
    return NextResponse.json({ error: 'Failed to fetch stock history' }, { status: 500 })
  }
}
