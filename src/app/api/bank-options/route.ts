import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)

    // Get unique bank names from BankTransaction table
    // If table doesn't exist or has no records, return empty array
    let banks: string[] = []

    try {
      const bankTransactions = await prisma.bankTransaction.findMany({
        where: { businessId },
        select: { bankName: true },
        distinct: ['bankName'],
        orderBy: { bankName: 'asc' },
      })

      banks = bankTransactions.map((bt) => bt.bankName).filter(Boolean) as string[]
    } catch (dbError) {
      console.log('BankTransaction table may not exist yet, returning empty bank list')
      // Return empty array if table doesn't exist
    }

    return NextResponse.json({ banks })
  } catch (error) {
    console.error('Error fetching bank options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bank options' },
      { status: 500 }
    )
  }
}
