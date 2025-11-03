/**
 * Journal Entries API Route
 * Create manual accounting entries
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/accounting/journal-entries
 *
 * Create a manual journal entry
 *
 * FOR NON-ACCOUNTANTS:
 * A journal entry is how you record financial transactions.
 * Every entry must have equal debits and credits (they must balance).
 *
 * Think of it like this:
 * - Debit = Money going INTO an account (or expense increasing)
 * - Credit = Money coming OUT of an account (or revenue increasing)
 *
 * Example: You pay $100 rent
 * - Debit: Rent Expense $100 (expense increases)
 * - Credit: Cash $100 (cash decreases)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'You do not have permission to access accounting features' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { entryDate, description, lines, referenceNumber } = body

    // Validate required fields
    if (!entryDate) {
      return NextResponse.json(
        { error: 'Entry date is required' },
        { status: 400 }
      )
    }

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    if (!lines || !Array.isArray(lines) || lines.length === 0) {
      return NextResponse.json(
        { error: 'At least one journal entry line is required' },
        { status: 400 }
      )
    }

    // Validate each line has required fields
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!line.accountCode) {
        return NextResponse.json(
          { error: `Line ${i + 1}: Account code is required` },
          { status: 400 }
        )
      }
      if (line.debit === undefined && line.credit === undefined) {
        return NextResponse.json(
          { error: `Line ${i + 1}: Either debit or credit must be specified` },
          { status: 400 }
        )
      }
    }

    // Calculate totals and validate balance
    const totalDebits = lines.reduce((sum: number, line: any) => {
      return sum + Number(line.debit || 0)
    }, 0)

    const totalCredits = lines.reduce((sum: number, line: any) => {
      return sum + Number(line.credit || 0)
    }, 0)

    const difference = Math.abs(totalDebits - totalCredits)

    if (difference > 0.01) {
      return NextResponse.json(
        {
          error: 'Journal entry is not balanced',
          details: `Total debits (${totalDebits.toFixed(2)}) must equal total credits (${totalCredits.toFixed(2)}). Difference: ${difference.toFixed(2)}`,
          totalDebits: totalDebits.toFixed(2),
          totalCredits: totalCredits.toFixed(2),
          difference: difference.toFixed(2)
        },
        { status: 400 }
      )
    }

    // Get all account codes
    const accountCodes = lines.map((line: any) => line.accountCode)
    const uniqueAccountCodes = [...new Set(accountCodes)]

    // Find accounts
    const accounts = await prisma.chartOfAccounts.findMany({
      where: {
        businessId: parseInt(session.user.businessId),
        accountCode: { in: uniqueAccountCodes }
      }
    })

    if (accounts.length !== uniqueAccountCodes.length) {
      const foundCodes = accounts.map(a => a.accountCode)
      const missingCodes = uniqueAccountCodes.filter(code => !foundCodes.includes(code))
      return NextResponse.json(
        {
          error: 'One or more account codes not found',
          missingCodes,
          foundCodes
        },
        { status: 400 }
      )
    }

    // Check if accounts allow manual entries
    for (const line of lines) {
      const account = accounts.find(a => a.accountCode === line.accountCode)
      if (account && !account.allowManualEntry) {
        return NextResponse.json(
          {
            error: `Account ${account.accountCode} (${account.accountName}) does not allow manual entries`,
            details: 'This account is managed automatically by the system'
          },
          { status: 400 }
        )
      }
    }

    // Create journal entry
    const entry = await prisma.journalEntry.create({
      data: {
        businessId: parseInt(session.user.businessId),
        entryDate: new Date(entryDate),
        description,
        referenceNumber: referenceNumber || null,
        status: 'posted',
        balanced: true,
        createdBy: session.user.id,
        lines: {
          create: lines.map((line: any) => {
            const account = accounts.find(a => a.accountCode === line.accountCode)!
            return {
              accountId: account.id,
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
              description: line.description || description
            }
          })
        }
      },
      include: {
        lines: {
          include: {
            account: {
              select: {
                accountCode: true,
                accountName: true,
                accountType: true
              }
            }
          }
        }
      }
    })

    // Update account balances
    for (const line of entry.lines) {
      const debitAmount = Number(line.debit)
      const creditAmount = Number(line.credit)

      await prisma.chartOfAccounts.update({
        where: { id: line.accountId },
        data: {
          currentBalance: {
            increment: line.account.accountType === 'asset' || line.account.accountType === 'expense'
              ? debitAmount - creditAmount
              : creditAmount - debitAmount
          },
          ytdDebit: { increment: debitAmount },
          ytdCredit: { increment: creditAmount }
        }
      })
    }

    // Create audit log
    await prisma.accountingAuditLog.create({
      data: {
        businessId: parseInt(session.user.businessId),
        entityType: 'JournalEntry',
        entityId: entry.id,
        action: 'create',
        description: `Manual journal entry created: ${description}`,
        userId: session.user.id,
        newValues: {
          entryDate: entry.entryDate.toISOString(),
          description: entry.description,
          totalDebits: totalDebits.toFixed(2),
          totalCredits: totalCredits.toFixed(2),
          lineCount: entry.lines.length
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Journal entry created successfully',
      data: {
        id: entry.id,
        entryDate: entry.entryDate,
        description: entry.description,
        referenceNumber: entry.referenceNumber,
        totalDebits: totalDebits.toFixed(2),
        totalCredits: totalCredits.toFixed(2),
        balanced: true,
        lineCount: entry.lines.length,
        lines: entry.lines.map(line => ({
          accountCode: line.account.accountCode,
          accountName: line.account.accountName,
          accountType: line.account.accountType,
          debit: Number(line.debit).toFixed(2),
          credit: Number(line.credit).toFixed(2),
          description: line.description
        }))
      }
    })
  } catch (error) {
    console.error('Journal Entry Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create journal entry',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/accounting/journal-entries
 *
 * List journal entries
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user, PERMISSIONS.ACCOUNTING_ACCESS)) {
      return NextResponse.json(
        { error: 'No accounting access' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const status = searchParams.get('status')

    const where: any = {
      businessId: parseInt(session.user.businessId)
    }

    if (startDate && endDate) {
      where.entryDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }

    if (status) {
      where.status = status
    }

    const entries = await prisma.journalEntry.findMany({
      where,
      include: {
        lines: {
          include: {
            account: {
              select: {
                accountCode: true,
                accountName: true,
                accountType: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            username: true,
            name: true
          }
        }
      },
      orderBy: { entryDate: 'desc' },
      take: 100
    })

    return NextResponse.json({
      success: true,
      data: {
        count: entries.length,
        entries: entries.map(entry => ({
          id: entry.id,
          entryDate: entry.entryDate,
          description: entry.description,
          referenceNumber: entry.referenceNumber,
          status: entry.status,
          balanced: entry.balanced,
          totalDebits: entry.lines.reduce((sum, line) => sum + Number(line.debit), 0).toFixed(2),
          totalCredits: entry.lines.reduce((sum, line) => sum + Number(line.credit), 0).toFixed(2),
          lineCount: entry.lines.length,
          createdBy: entry.creator?.username,
          createdAt: entry.createdAt,
          lines: entry.lines.map(line => ({
            accountCode: line.account.accountCode,
            accountName: line.account.accountName,
            accountType: line.account.accountType,
            debit: Number(line.debit).toFixed(2),
            credit: Number(line.credit).toFixed(2),
            description: line.description
          }))
        }))
      }
    })
  } catch (error) {
    console.error('List Journal Entries Error:', error)
    return NextResponse.json(
      { error: 'Failed to list journal entries', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
