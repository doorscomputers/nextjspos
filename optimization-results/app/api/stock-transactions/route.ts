import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const type = searchParams.get('type')
    const productId = searchParams.get('productId')
    const referenceId = searchParams.get('referenceId')
    const referenceType = searchParams.get('referenceType')

    const where: any = {
      businessId: parseInt(businessId)
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (type) {
      where.type = type
    }

    if (productId) {
      where.productId = parseInt(productId)
    }

    if (referenceId) {
      where.referenceId = parseInt(referenceId)
    }

    if (referenceType) {
      where.referenceType = referenceType
    }

    const transactions = await prisma.stockTransaction.findMany({
      where,
      select: {
        product: {
          select: {
            name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            sku: { select: { id: true, name: true } }
          }
        },
        productVariation: {
          select: {
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } }
          }
        },
        createdByUser: {
          select: {
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json({ transactions })
  } catch (error) {
    console.error('Error fetching stock transactions:', error)
    return NextResponse.json({ error: 'Failed to fetch stock transactions' }, { status: 500 })
  }
}
