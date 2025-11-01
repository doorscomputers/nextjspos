import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const variationId = parseInt(params.id)

    if (isNaN(variationId)) {
      return NextResponse.json({ error: 'Invalid variation ID' }, { status: 400 })
    }

    // Find the variation and its product
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: variationId,
        product: {
          businessId: parseInt(session.user.businessId),
        },
      },
      select: {
        product: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } },
          },
        },
      },
    })

    if (!variation) {
      return NextResponse.json({ error: 'Variation not found' }, { status: 404 })
    }

    return NextResponse.json({
      variation: {
        id: variation.id,
        name: variation.name,
        sku: variation.sku,
      },
      product: variation.product,
    })
  } catch (error) {
    console.error('Error fetching product variation:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
