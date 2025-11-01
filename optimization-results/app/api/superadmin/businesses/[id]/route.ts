import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isSuperAdmin } from '@/lib/rbac'

// GET - Get single business
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
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const business = await prisma.business.findUnique({
      where: { id: parseInt(id) },
      select: {
        owner: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            surname: { select: { id: true, name: true } },
          }
        },
        currency: { select: { id: true, name: true } },
        subscriptions: {
          select: {
            package: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        },
        locations: { select: { id: true, name: true } },
        _count: {
          select: {
            users: { select: { id: true, name: true } },
            locations: { select: { id: true, name: true } },
          }
        }
      }
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business })
  } catch (error) {
    console.error('Error fetching business:', error)
    return NextResponse.json({ error: 'Failed to fetch business' }, { status: 500 })
  }
}

// PUT - Update business
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      name,
      currencyId,
      startDate,
      taxNumber1,
      taxLabel1,
      taxNumber2,
      taxLabel2,
      defaultProfitPercent,
      timeZone,
      fyStartMonth,
      accountingMethod,
      defaultSalesDiscount,
      sellPriceTax,
      skuPrefix,
      enableTooltip,
    } = body

    const business = await prisma.business.update({
      where: { id: parseInt(id) },
      data: {
        name,
        currencyId: currencyId ? parseInt(currencyId) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        taxNumber1,
        taxLabel1,
        taxNumber2,
        taxLabel2,
        defaultProfitPercent: defaultProfitPercent ? parseFloat(defaultProfitPercent) : undefined,
        timeZone,
        fyStartMonth: fyStartMonth ? parseInt(fyStartMonth) : undefined,
        accountingMethod,
        defaultSalesDiscount: defaultSalesDiscount ? parseFloat(defaultSalesDiscount) : null,
        sellPriceTax,
        skuPrefix,
        enableTooltip,
      },
      select: {
        owner: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            email: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            surname: { select: { id: true, name: true } },
          }
        },
        currency: { select: { id: true, name: true } },
      }
    })

    return NextResponse.json({ business, message: 'Business updated successfully' })
  } catch (error) {
    console.error('Error updating business:', error)
    return NextResponse.json({ error: 'Failed to update business' }, { status: 500 })
  }
}

// DELETE - Delete business
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    if (!isSuperAdmin({ id: user.id, permissions: user.permissions || [], roles: user.roles || [] })) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    await prisma.business.delete({
      where: { id: parseInt(id) }
    })

    return NextResponse.json({ message: 'Business deleted successfully' })
  } catch (error) {
    console.error('Error deleting business:', error)
    return NextResponse.json({ error: 'Failed to delete business' }, { status: 500 })
  }
}
