import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { duplicateProduct } from '@/lib/product-actions'

/**
 * POST /api/products/[id]/duplicate
 * Duplicate a product with all its variations
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
    const businessId = user.businessId
    const userId = user.id

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    // Get optional name suffix from request body
    const body = await request.json().catch(() => ({}))
    const nameSuffix = body.nameSuffix || ' (Copy)'

    // Duplicate the product
    const result = await duplicateProduct(
      productId,
      parseInt(businessId),
      parseInt(userId),
      nameSuffix
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error duplicating product:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to duplicate product' },
      { status: 500 }
    )
  }
}
