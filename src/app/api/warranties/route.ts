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
    const businessId = user.businessId

    const warranties = await prisma.warranty.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ warranties })
  } catch (error) {
    console.error('Error fetching warranties:', error)
    return NextResponse.json({ error: 'Failed to fetch warranties' }, { status: 500 })
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

    const warranty = await prisma.warranty.create({
      data: {
        businessId: parseInt(user.businessId),
        name: body.name,
        description: body.description,
        duration: parseInt(body.duration),
        durationType: body.durationType
      }
    })

    return NextResponse.json({ warranty, message: 'Warranty created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating warranty:', error)
    return NextResponse.json({ error: 'Failed to create warranty' }, { status: 500 })
  }
}
