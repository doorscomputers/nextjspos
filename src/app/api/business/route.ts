import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Get current business details
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) },
      select: {
        id: true,
        name: true,
        taxNumber1: true,
        taxLabel1: true,
        taxNumber2: true,
        taxLabel2: true,
        logo: true,
        invoiceWarrantyRemarks: true,
        createdAt: true,
      }
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json(business)
  } catch (error) {
    console.error('Error fetching business:', error)
    return NextResponse.json(
      { error: 'Failed to fetch business details' },
      { status: 500 }
    )
  }
}
