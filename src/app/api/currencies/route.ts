import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - Fetch all currencies
export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currencies = await prisma.currency.findMany({
      orderBy: { country: 'asc' },
    })

    return NextResponse.json({ currencies })
  } catch (error) {
    console.error('Error fetching currencies:', error)
    return NextResponse.json({ error: 'Failed to fetch currencies' }, { status: 500 })
  }
}
