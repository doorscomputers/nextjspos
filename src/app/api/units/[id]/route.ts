import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

    const unit = await prisma.unit.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        name: body.name,
        shortName: body.shortName,
        allowDecimal: body.allowDecimal
      }
    })

    return NextResponse.json({ unit, message: 'Unit updated successfully' })
  } catch (error) {
    console.error('Error updating unit:', error)
    return NextResponse.json({ error: 'Failed to update unit' }, { status: 500 })
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

    await prisma.unit.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Unit deleted successfully' })
  } catch (error) {
    console.error('Error deleting unit:', error)
    return NextResponse.json({ error: 'Failed to delete unit' }, { status: 500 })
  }
}
