import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

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

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    // Get current product
    const product = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Toggle isActive
    const updated = await prisma.product.update({
      where: { id: productId },
      data: { isActive: !product.isActive }
    })

    return NextResponse.json({
      message: `Product ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      isActive: updated.isActive
    })
  } catch (error) {
    console.error('Error toggling product active status:', error)
    return NextResponse.json({ error: 'Failed to toggle product status' }, { status: 500 })
  }
}
