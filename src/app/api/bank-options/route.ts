import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const businessId = session.user.businessId

    // Get unique bank names from BankTransaction table
    const bankTransactions = await prisma.bankTransaction.findMany({
      where: { businessId },
      select: { bankName: true },
      distinct: ['bankName'],
      orderBy: { bankName: 'asc' },
    })

    const banks = bankTransactions.map((bt) => bt.bankName).filter(Boolean)

    return NextResponse.json({ banks })
  } catch (error) {
    console.error('Error fetching bank options:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bank options' },
      { status: 500 }
    )
  }
}
