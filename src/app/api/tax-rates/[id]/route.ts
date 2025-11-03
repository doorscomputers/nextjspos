import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

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

    const taxRate = await prisma.taxRate.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        name: body.name,
        amount: parseFloat(body.amount),
        isDefault: body.isDefault
      }
    })

    return NextResponse.json({ taxRate, message: 'Tax rate updated successfully' })
  } catch (error) {
    console.error('Error updating tax rate:', error)
    return NextResponse.json({ error: 'Failed to update tax rate' }, { status: 500 })
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

    await prisma.taxRate.update({
      where: {
        id: parseInt(id),
        businessId: parseInt(user.businessId)
      },
      data: {
        deletedAt: new Date()
      }
    })

    return NextResponse.json({ message: 'Tax rate deleted successfully' })
  } catch (error) {
    console.error('Error deleting tax rate:', error)
    return NextResponse.json({ error: 'Failed to delete tax rate' }, { status: 500 })
  }
}
