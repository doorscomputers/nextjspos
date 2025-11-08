import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const units = await prisma.unit.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        baseUnit: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ units })
  } catch (error) {
    console.error('Error fetching units:', error)
    return NextResponse.json({ error: 'Failed to fetch units' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const body = await request.json()

    // Validate UOM conversion setup
    if (body.baseUnitId && !body.baseUnitMultiplier) {
      return NextResponse.json(
        { error: 'Conversion multiplier is required when base unit is specified' },
        { status: 400 }
      )
    }

    const unit = await prisma.unit.create({
      data: {
        businessId: parseInt(user.businessId),
        name: body.name,
        shortName: body.shortName,
        allowDecimal: body.allowDecimal || false,
        baseUnitId: body.baseUnitId ? parseInt(body.baseUnitId) : null,
        baseUnitMultiplier: body.baseUnitMultiplier ? parseFloat(body.baseUnitMultiplier) : null,
      },
      include: {
        baseUnit: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        }
      }
    })

    return NextResponse.json({ unit, message: 'Unit created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
  }
}
