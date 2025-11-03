import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/purchases/amendments/[id]
 * Get details of a specific amendment
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
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PURCHASE_AMENDMENT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const amendmentId = parseInt(id)

    const amendment = await prisma.purchaseAmendment.findFirst({
      where: {
        id: amendmentId,
        businessId: parseInt(businessId),
      },
      include: {
        purchase: {
          include: {
            supplier: true,
            location: true,
            items: {
              include: {
                product: {
                  select: {
                    name: true,
                  },
                },
                productVariation: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!amendment) {
      return NextResponse.json({ error: 'Amendment not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: amendment,
    })
  } catch (error: any) {
    console.error('Error fetching amendment:', error)
    return NextResponse.json(
      { error: 'Failed to fetch amendment', details: error.message },
      { status: 500 }
    )
  }
}
