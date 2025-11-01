import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET - List all post-dated cheques
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PAYMENT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const status = searchParams.get('status')
    const upcoming = searchParams.get('upcoming') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId)
    }

    if (status) {
      where.status = status
    }

    if (upcoming) {
      const today = new Date()
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
      where.chequeDate = {
        gte: today,
        lte: nextWeek,
      }
      where.status = 'pending'
    }

    const [cheques, total] = await Promise.all([
      prisma.postDatedCheque.findMany({
        where,
        select: {
          supplier: {
            select: {
              id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
              name: { select: { id: true, name: true } },
              mobile: { select: { id: true, name: true } },
              email: { select: { id: true, name: true } },
            },
          },
          payments: {
            select: {
              id: { select: { id: true, name: true } },
              paymentNumber: { select: { id: true, name: true } },
              paymentDate: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: {
          chequeDate: 'asc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.postDatedCheque.count({ where }),
    ])

    return NextResponse.json({
      cheques,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching post-dated cheques:', error)
    return NextResponse.json(
      { error: 'Failed to fetch post-dated cheques' },
      { status: 500 }
    )
  }
}
