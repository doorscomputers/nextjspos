import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'

// GET - Get single bank
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.BANK_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = session.user.businessId
    const bankId = parseInt(params.id)

    const bank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        businessId,
        deletedAt: null,
      },
      include: {
        bankTransactions: {
          orderBy: { transactionDate: 'desc' },
          take: 10, // Last 10 transactions
        },
      },
    })

    if (!bank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 })
    }

    return NextResponse.json(bank)
  } catch (error) {
    console.error('Error fetching bank:', error)
    return NextResponse.json(
      { error: 'Failed to fetch bank' },
      { status: 500 }
    )
  }
}

// PUT - Update bank
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.BANK_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = session.user.businessId
    const bankId = parseInt(params.id)

    const body = await request.json()
    const {
      bankName,
      accountType,
      accountNumber,
      isActive,
      notes,
    } = body

    // Check if bank exists
    const existingBank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        businessId,
        deletedAt: null,
      },
    })

    if (!existingBank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 })
    }

    // Validation
    if (accountType) {
      const validAccountTypes = ['savings', 'cheque', 'credit_card']
      if (!validAccountTypes.includes(accountType)) {
        return NextResponse.json(
          { error: 'Invalid account type. Must be: savings, cheque, or credit_card' },
          { status: 400 }
        )
      }
    }

    // Check for duplicate account number (if changing)
    if (accountNumber && accountNumber !== existingBank.accountNumber) {
      const duplicateBank = await prisma.bank.findFirst({
        where: {
          businessId,
          accountNumber,
          id: { not: bankId },
          deletedAt: null,
        },
      })

      if (duplicateBank) {
        return NextResponse.json(
          { error: 'A bank account with this account number already exists' },
          { status: 400 }
        )
      }
    }

    // Update bank
    const updatedBank = await prisma.bank.update({
      where: { id: bankId },
      data: {
        ...(bankName && { bankName: bankName.trim() }),
        ...(accountType && { accountType }),
        ...(accountNumber && { accountNumber: accountNumber.trim() }),
        ...(typeof isActive === 'boolean' && { isActive }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
      },
    })

    return NextResponse.json(updatedBank)
  } catch (error) {
    console.error('Error updating bank:', error)
    return NextResponse.json(
      { error: 'Failed to update bank' },
      { status: 500 }
    )
  }
}

// DELETE - Soft delete bank
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.BANK_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const businessId = session.user.businessId
    const bankId = parseInt(params.id)

    // Check if bank exists
    const existingBank = await prisma.bank.findFirst({
      where: {
        id: bankId,
        businessId,
        deletedAt: null,
      },
    })

    if (!existingBank) {
      return NextResponse.json({ error: 'Bank not found' }, { status: 404 })
    }

    // Check if bank has transactions
    const transactionCount = await prisma.bankTransaction.count({
      where: { bankId },
    })

    if (transactionCount > 0) {
      return NextResponse.json(
        { error: 'Cannot delete bank account with existing transactions. Set to inactive instead.' },
        { status: 400 }
      )
    }

    // Soft delete
    const deletedBank = await prisma.bank.update({
      where: { id: bankId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    })

    return NextResponse.json({ message: 'Bank deleted successfully', bank: deletedBank })
  } catch (error) {
    console.error('Error deleting bank:', error)
    return NextResponse.json(
      { error: 'Failed to delete bank' },
      { status: 500 }
    )
  }
}
