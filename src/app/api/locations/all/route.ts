import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch ALL locations for user's business (no permission filtering)
// This is used for transfer destinations - users can transfer TO any branch
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Fetch ALL locations for this business
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({ locations })
  } catch (error) {
    console.error('Error fetching all locations:', error)
    return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 })
  }
}
