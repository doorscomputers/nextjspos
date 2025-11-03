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
    const taxRates = await prisma.taxRate.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ taxRates })
  } catch (error) {
    console.error('Error fetching tax rates:', error)
    return NextResponse.json({ error: 'Failed to fetch tax rates' }, { status: 500 })
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

    const taxRate = await prisma.taxRate.create({
      data: {
        businessId: parseInt(user.businessId),
        name: body.name,
        amount: parseFloat(body.amount),
        isDefault: body.isDefault || false
      }
    })

    return NextResponse.json({ taxRate, message: 'Tax rate created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating tax rate:', error)
    return NextResponse.json({ error: 'Failed to create tax rate' }, { status: 500 })
  }
}
