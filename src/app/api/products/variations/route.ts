import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/products/variations
 * Get all product variations with product details for the authenticated user's business
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Fetch all variations with their product details
    const variations = await prisma.productVariation.findMany({
      where: {
        product: {
          businessId: businessId,
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: [
        {
          product: {
            name: 'asc',
          },
        },
        {
          name: 'asc',
        },
      ],
    })

    return NextResponse.json({
      success: true,
      variations,
    })
  } catch (error) {
    console.error('Error fetching product variations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch product variations' },
      { status: 500 }
    )
  }
}
