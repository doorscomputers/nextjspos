import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/supplier-returns/[id]
 * Get supplier return details
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
    const businessId = user.businessId
    const { id: returnId } = await params

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_RETURN_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const supplierReturn = await prisma.supplierReturn.findFirst({
      where: {
        id: parseInt(returnId),
        businessId: parseInt(businessId),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            mobile: true,
            email: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
            productVariation: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!supplierReturn) {
      return NextResponse.json({ error: 'Supplier return not found' }, { status: 404 })
    }

    return NextResponse.json(supplierReturn)
  } catch (error) {
    console.error('Error fetching supplier return:', error)
    return NextResponse.json(
      { error: 'Failed to fetch supplier return' },
      { status: 500 }
    )
  }
}
