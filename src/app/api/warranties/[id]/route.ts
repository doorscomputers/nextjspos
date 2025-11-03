import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'

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
    const { id } = await params
    const body = await request.json()

    const warranty = await prisma.warranty.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        name: body.name,
        description: body.description,
        duration: parseInt(body.duration),
        durationType: body.durationType
      }
    })

    return NextResponse.json({ warranty, message: 'Warranty updated successfully' })
  } catch (error) {
    console.error('Error updating warranty:', error)
    return NextResponse.json({ error: 'Failed to update warranty' }, { status: 500 })
  }
}

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
    const { id } = await params

    await prisma.warranty.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Warranty deleted successfully' })
  } catch (error) {
    console.error('Error deleting warranty:', error)
    return NextResponse.json({ error: 'Failed to delete warranty' }, { status: 500 })
  }
}
