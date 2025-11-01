import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// GET - List all bank transactions with running balance
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.BANK_TRANSACTION_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const bankName = searchParams.get('bankName')
    const transactionType = searchParams.get('transactionType')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
    }

    if (bankName) {
      where.bankName = {
        contains: bankName,
        mode: 'insensitive',
      }
    }

    if (transactionType) {
      where.transactionType = transactionType
    }

    if (startDate || endDate) {
      where.transactionDate = {}
      if (startDate) {
        where.transactionDate.gte = new Date(startDate)
      }
      if (endDate) {
        where.transactionDate.lte = new Date(endDate)
      }
    }

    const [transactions, total] = await Promise.all([
      prisma.bankTransaction.findMany({
        where,
        select: {
          payment: {
            select: {
              supplier: {
                select: {
                  id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                  name: { select: { id: true, name: true } },
                },
              },
              accountsPayable: {
                select: {
                  id: { select: { id: true, name: true } },
                  invoiceNumber: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: {
          transactionDate: 'asc', // Ascending for running balance calculation
        },
        skip: offset,
        take: limit,
      }),
      prisma.bankTransaction.count({ where }),
    ])

    // Calculate running balance
    let runningBalance = 0
    const transactionsWithBalance = transactions.map((tx) => {
      runningBalance += parseFloat(tx.amount.toString())
      return {
        ...tx,
        runningBalance,
      }
    })

    // Reverse for display (newest first)
    const displayTransactions = transactionsWithBalance.reverse()

    return NextResponse.json({
      transactions: displayTransactions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching bank transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bank transactions' },
      { status: 500 }
    )
  }
}
