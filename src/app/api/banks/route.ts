import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// GET - List all banks
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.BANK_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)

    const banks = await prisma.bank.findMany({
      where: {
        businessId,
        deletedAt: null,
      },
      orderBy: [
        { isActive: 'desc' },
        { bankName: 'asc' },
      ],
    })

    return NextResponse.json(banks)
  } catch (error) {
    console.error('Error fetching banks:', error)
    return NextResponse.json(
      { error: 'Failed to fetch banks' },
      { status: 500 }
    )
  }
}

// POST - Create new bank
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.BANK_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = parseInt(session.user.businessId)
    const userId = parseInt(String(session.user.id))

    const body = await request.json()
    const {
      bankName,
      accountType,
      accountNumber,
      openingBalance = 0,
      openingBalanceDate,
      notes,
    } = body

    // Validation
    if (!bankName || !accountType || !accountNumber) {
      return NextResponse.json(
        { error: 'Bank name, account type, and account number are required' },
        { status: 400 }
      )
    }

    const validAccountTypes = ['savings', 'cheque', 'credit_card']
    if (!validAccountTypes.includes(accountType)) {
      return NextResponse.json(
        { error: 'Invalid account type. Must be: savings, cheque, or credit_card' },
        { status: 400 }
      )
    }

    // Check for duplicate account number
    const existingBank = await prisma.bank.findFirst({
      where: {
        businessId,
        accountNumber,
        deletedAt: null,
      },
    })

    if (existingBank) {
      return NextResponse.json(
        { error: 'A bank account with this account number already exists' },
        { status: 400 }
      )
    }

    // Create bank account and opening balance transaction in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create bank account
      const bank = await tx.bank.create({
        data: {
          businessId,
          bankName: bankName.trim(),
          accountType,
          accountNumber: accountNumber.trim(),
          openingBalance: parseFloat(openingBalance),
          openingBalanceDate: openingBalanceDate ? new Date(openingBalanceDate) : new Date(),
          currentBalance: parseFloat(openingBalance), // Set current balance to opening balance
          notes: notes?.trim() || null,
          createdBy: userId,
        },
      })

      // If there's an opening balance, create a bank transaction
      if (parseFloat(openingBalance) !== 0) {
        await tx.bankTransaction.create({
          data: {
            businessId,
            bankId: bank.id,
            transactionDate: openingBalanceDate ? new Date(openingBalanceDate) : new Date(),
            transactionType: 'opening_balance',
            amount: parseFloat(openingBalance),
            bankName: bankName.trim(),
            accountNumber: accountNumber.trim(),
            balanceAfter: parseFloat(openingBalance),
            description: `Opening balance for ${bankName} - ${accountNumber}`,
            createdBy: userId,
          },
        })
      }

      return bank
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error creating bank:', error)
    return NextResponse.json(
      { error: 'Failed to create bank account' },
      { status: 500 }
    )
  }
}
