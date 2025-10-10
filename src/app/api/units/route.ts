import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    const units = await prisma.unit.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null
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

    const unit = await prisma.unit.create({
      data: {
        businessId: parseInt(user.businessId),
        name: body.name,
        shortName: body.shortName,
        allowDecimal: body.allowDecimal || false
      }
    })

    return NextResponse.json({ unit, message: 'Unit created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating unit:', error)
    return NextResponse.json({ error: 'Failed to create unit' }, { status: 500 })
  }
}
