import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// POST - Create manual bank transaction (for reconciliation)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.BANK_TRANSACTION_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = session.user.businessId
    const userId = session.user.id

    const body = await request.json()
    const {
      bankId,
      transactionType,
      amount,
      transactionDate,
      transactionNumber,
      description,
    } = body

    // Validation
    if (!bankId || !transactionType || !amount || !transactionDate) {
      return NextResponse.json(
        { error: 'Bank account, transaction type, amount, and date are required' },
        { status: 400 }
      )
    }

    const validTypes = ['manual_debit', 'manual_credit']
    if (!validTypes.includes(transactionType)) {
      return NextResponse.json(
        { error: 'Invalid transaction type. Must be: manual_debit or manual_credit' },
        { status: 400 }
      )
    }

    // Check if bank exists and belongs to business
    const bank = await prisma.bank.findFirst({
      where: {
        id: parseInt(bankId),
        businessId,
        deletedAt: null,
      },
    })

    if (!bank) {
      return NextResponse.json(
        { error: 'Bank account not found' },
        { status: 404 }
      )
    }

    if (!bank.isActive) {
      return NextResponse.json(
        { error: 'Cannot create transaction for inactive bank account' },
        { status: 400 }
      )
    }

    // Create transaction and update bank balance in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Calculate new balance
      const currentBalance = parseFloat(bank.currentBalance.toString())
      const transactionAmount = parseFloat(amount)
      const newBalance = currentBalance + transactionAmount

      // Create bank transaction
      const bankTransaction = await tx.bankTransaction.create({
        data: {
          businessId,
          bankId: parseInt(bankId),
          transactionDate: new Date(transactionDate),
          transactionType,
          amount: transactionAmount,
          bankName: bank.bankName,
          accountNumber: bank.accountNumber,
          transactionNumber: transactionNumber?.trim() || null,
          balanceAfter: newBalance,
          description: description?.trim() || null,
          createdBy: userId,
        },
      })

      // Update bank current balance
      await tx.bank.update({
        where: { id: parseInt(bankId) },
        data: {
          currentBalance: newBalance,
        },
      })

      return bankTransaction
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating manual bank transaction:', error)
    return NextResponse.json(
      { error: 'Failed to create bank transaction' },
      { status: 500 }
    )
  }
}
