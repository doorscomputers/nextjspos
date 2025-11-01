/**
 * Period Closing System
 * Automates month/quarter/year-end closing processes
 *
 * FOR NON-ACCOUNTANTS:
 * Period closing is like "balancing your checkbook" at the end of each month.
 * It ensures all transactions are recorded and calculates your profit/loss.
 * Once closed, transactions in that period can't be changed (prevents errors).
 */

import { prisma } from './prisma'
import { getChartOfAccounts, getAccountByCode, updateAccountBalance } from './chartOfAccounts'

/**
 * Create fiscal periods for a year
 *
 * WHAT THIS DOES:
 * - Creates 12 monthly periods for the year
 * - Creates 4 quarterly periods
 * - Creates 1 yearly period
 *
 * WHY: Allows you to track performance by month, quarter, and year
 */
export async function createFiscalYear(businessId: number, year: number) {
  const periods = []

  // Create 12 monthly periods
  for (let month = 1; month <= 12; month++) {
    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 0) // Last day of month

    const period = await prisma.fiscalPeriod.create({
      data: {
        businessId,
        periodType: 'month',
        fiscalYear: year,
        periodNumber: month,
        startDate,
        endDate,
        status: 'open',
      },
    })
    periods.push(period)
  }

  // Create 4 quarterly periods
  for (let quarter = 1; quarter <= 4; quarter++) {
    const startMonth = (quarter - 1) * 3 + 1
    const endMonth = quarter * 3
    const startDate = new Date(year, startMonth - 1, 1)
    const endDate = new Date(year, endMonth, 0)

    const period = await prisma.fiscalPeriod.create({
      data: {
        businessId,
        periodType: 'quarter',
        fiscalYear: year,
        periodNumber: quarter,
        startDate,
        endDate,
        status: 'open',
      },
    })
    periods.push(period)
  }

  // Create yearly period
  const yearPeriod = await prisma.fiscalPeriod.create({
    data: {
      businessId,
      periodType: 'year',
      fiscalYear: year,
      periodNumber: 1,
      startDate: new Date(year, 0, 1),
      endDate: new Date(year, 11, 31),
      status: 'open',
    },
  })
  periods.push(yearPeriod)

  return periods
}

/**
 * Get current open period
 *
 * WHAT THIS DOES:
 * Returns the accounting period for today's date
 *
 * WHY: Transactions must be recorded in the correct period
 */
export async function getCurrentPeriod(
  businessId: number,
  periodType: 'month' | 'quarter' | 'year' = 'month'
) {
  const today = new Date()

  return await prisma.fiscalPeriod.findFirst({
    where: {
      businessId,
      periodType,
      startDate: { lte: today },
      endDate: { gte: today },
    },
  })
}

/**
 * Close accounting period
 *
 * WHAT THIS DOES:
 * 1. Validates all transactions are recorded
 * 2. Calculates profit/loss for the period
 * 3. Updates retained earnings
 * 4. Locks the period (no more changes allowed)
 *
 * FOR NON-ACCOUNTANTS:
 * This is like "filing your taxes" - once done, you can't go back and change things.
 * It ensures your financial records are accurate and final.
 */
export async function closePeriod(
  businessId: number,
  periodId: number,
  userId: number,
  closingNotes?: string
) {
  const period = await prisma.fiscalPeriod.findUnique({
    where: { id: periodId, businessId },
  })

  if (!period) {
    throw new Error('Period not found')
  }

  if (period.status !== 'open') {
    throw new Error(`Period is already ${period.status}`)
  }

  // Step 1: Validate all entries balance
  const validationResult = await validatePeriodEntries(businessId, periodId)
  if (!validationResult.valid) {
    throw new Error(
      `Cannot close period: ${validationResult.errors.join(', ')}`
    )
  }

  // Step 2: Calculate account balances for the period
  await calculatePeriodBalances(businessId, periodId)

  // Step 3: Calculate profit/loss (Revenue - Expenses)
  const retainedEarnings = await calculateNetIncome(businessId, period.startDate, period.endDate)

  // Step 4: Transfer net income to retained earnings
  await transferToRetainedEarnings(businessId, retainedEarnings)

  // Step 5: Close the period
  const closedPeriod = await prisma.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status: 'closed',
      closedAt: new Date(),
      closedBy: userId,
      closingNotes,
      retainedEarnings,
    },
  })

  // Step 6: Log the closure
  await prisma.accountingAuditLog.create({
    data: {
      businessId,
      entityType: 'FiscalPeriod',
      entityId: periodId,
      periodId,
      action: 'close_period',
      description: `Period ${period.periodType} ${period.periodNumber}/${period.fiscalYear} closed`,
      userId,
      newValues: {
        status: 'closed',
        retainedEarnings: retainedEarnings.toString(),
      },
    },
  })

  return {
    success: { select: { id: true, name: true } },
    period: closedPeriod,
    retainedEarnings,
    message: `Period closed successfully. Net income: ${retainedEarnings >= 0 ? 'Profit' : 'Loss'} of ${Math.abs(retainedEarnings).toFixed(2)}`,
  }
}

/**
 * Validate period entries
 *
 * WHAT THIS CHECKS:
 * - All journal entries balance (debits = credits)
 * - No unposted entries
 * - All transactions recorded
 */
async function validatePeriodEntries(businessId: number, periodId: number) {
  const errors: string[] = []
  const period = await prisma.fiscalPeriod.findUnique({ where: { id: periodId } })

  if (!period) {
    return { valid: false, errors: ['Period not found'] }
  }

  // Check for unposted journal entries
  const unpostedEntries = await prisma.journalEntry.count({
    where: {
      businessId,
      entryDate: {
        gte: period.startDate,
        lte: period.endDate,
      },
      status: 'draft',
    },
  })

  if (unpostedEntries > 0) {
    errors.push(`${unpostedEntries} journal entries are still in draft status. Please post or delete them.`)
  }

  // Check for unbalanced entries
  const unbalancedEntries = await prisma.journalEntry.count({
    where: {
      businessId,
      entryDate: {
        gte: period.startDate,
        lte: period.endDate,
      },
      balanced: false,
    },
  })

  if (unbalancedEntries > 0) {
    errors.push(`${unbalancedEntries} journal entries are not balanced (debits ≠ credits)`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate account balances for period
 *
 * WHAT THIS DOES:
 * Summarizes all transactions for each account during the period
 */
async function calculatePeriodBalances(businessId: number, periodId: number) {
  const period = await prisma.fiscalPeriod.findUnique({ where: { id: periodId } })
  if (!period) throw new Error('Period not found')

  const accounts = await getChartOfAccounts(businessId)

  for (const account of accounts) {
    // Get all journal entry lines for this account in this period
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: {
            gte: period.startDate,
            lte: period.endDate,
          },
          status: 'posted',
        },
      },
    })

    const debitTotal = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const creditTotal = lines.reduce((sum, line) => sum + Number(line.credit), 0)

    // Get opening balance (closing balance from previous period or 0)
    const previousPeriod = await prisma.fiscalPeriod.findFirst({
      where: {
        businessId,
        periodType: period.periodType,
        endDate: { lt: period.startDate },
      },
      orderBy: { endDate: 'desc' },
    })

    let openingBalance = 0
    if (previousPeriod) {
      const previousBalance = await prisma.accountBalance.findUnique({
        where: {
          accountId_periodId: {
            accountId: account.id,
            periodId: previousPeriod.id,
          },
        },
      })
      openingBalance = Number(previousBalance?.closingBalance || 0)
    }

    // Calculate closing balance
    let closingBalance = openingBalance
    if (account.normalBalance === 'debit') {
      closingBalance += debitTotal - creditTotal
    } else {
      closingBalance += creditTotal - debitTotal
    }

    // Save period balance
    await prisma.accountBalance.upsert({
      where: {
        accountId_periodId: {
          accountId: account.id,
          periodId: period.id,
        },
      },
      create: {
        businessId,
        accountId: account.id,
        periodId: period.id,
        openingBalance,
        debitTotal,
        creditTotal,
        closingBalance,
      },
      update: {
        openingBalance,
        debitTotal,
        creditTotal,
        closingBalance,
      },
    })
  }
}

/**
 * Calculate Net Income (Profit/Loss)
 *
 * FOR NON-ACCOUNTANTS:
 * Net Income = All Revenue - All Expenses
 * Positive = Profit (you made money!)
 * Negative = Loss (you spent more than you earned)
 */
async function calculateNetIncome(
  businessId: number,
  startDate: Date,
  endDate: Date
): Promise<number> {
  // Get revenue accounts (credit balances)
  const revenueAccounts = await prisma.chartOfAccounts.findMany({
    where: {
      businessId,
      accountType: 'revenue',
      isActive: { select: { id: true, name: true } },
    },
  })

  // Get expense accounts (debit balances)
  const expenseAccounts = await prisma.chartOfAccounts.findMany({
    where: {
      businessId,
      accountType: 'expense',
      isActive: { select: { id: true, name: true } },
    },
  })

  let totalRevenue = 0
  let totalExpenses = 0

  // Calculate total revenue
  for (const account of revenueAccounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: { gte: startDate, lte: endDate },
          status: 'posted',
        },
      },
    })

    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)
    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    totalRevenue += credits - debits // Revenue has credit balance
  }

  // Calculate total expenses
  for (const account of expenseAccounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: { gte: startDate, lte: endDate },
          status: 'posted',
        },
      },
    })

    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)
    totalExpenses += debits - credits // Expenses have debit balance
  }

  return totalRevenue - totalExpenses
}

/**
 * Transfer net income to retained earnings
 *
 * FOR NON-ACCOUNTANTS:
 * This is like putting your profit into a "savings account" within the business.
 * It becomes part of the business's equity (what the business owns after paying debts).
 */
async function transferToRetainedEarnings(businessId: number, netIncome: number) {
  const retainedEarningsAccount = await getAccountByCode(businessId, '3100')
  if (!retainedEarningsAccount) {
    throw new Error('Retained Earnings account not found')
  }

  // Update retained earnings balance
  await updateAccountBalance(
    retainedEarningsAccount.id,
    netIncome < 0 ? Math.abs(netIncome) : 0, // Loss reduces retained earnings (debit)
    netIncome > 0 ? netIncome : 0 // Profit increases retained earnings (credit)
  )
}

/**
 * Reopen a closed period (DANGEROUS!)
 *
 * FOR NON-ACCOUNTANTS:
 * This is like "un-filing your taxes" - very rare and requires special permission.
 * Only use if you discover a major error that MUST be fixed.
 *
 * REQUIRES: ACCOUNTING_PERIOD_REOPEN permission (Super Admin only by default)
 */
export async function reopenPeriod(businessId: number, periodId: number, userId: number) {
  const period = await prisma.fiscalPeriod.findUnique({
    where: { id: periodId, businessId },
  })

  if (!period) {
    throw new Error('Period not found')
  }

  if (period.status !== 'closed') {
    throw new Error(`Period is ${period.status}, not closed`)
  }

  // Reopen period
  const reopenedPeriod = await prisma.fiscalPeriod.update({
    where: { id: periodId },
    data: {
      status: 'open',
      closedAt: null,
      closedBy: null,
    },
  })

  // Log the reopening (VERY IMPORTANT for audit)
  await prisma.accountingAuditLog.create({
    data: {
      businessId,
      entityType: 'FiscalPeriod',
      entityId: periodId,
      periodId,
      action: 'reopen_period',
      description: `PERIOD REOPENED: ${period.periodType} ${period.periodNumber}/${period.fiscalYear}`,
      userId,
      oldValues: { status: 'closed' },
      newValues: { status: 'open' },
    },
  })

  return reopenedPeriod
}

/**
 * Get period summary
 *
 * WHAT YOU GET:
 * - Period status (open/closed)
 * - Total revenue
 * - Total expenses
 * - Net income (profit/loss)
 * - Number of transactions
 */
export async function getPeriodSummary(businessId: number, periodId: number) {
  const period = await prisma.fiscalPeriod.findUnique({
    where: { id: periodId, businessId },
  })

  if (!period) {
    throw new Error('Period not found')
  }

  const netIncome = await calculateNetIncome(businessId, period.startDate, period.endDate)

  const transactionCount = await prisma.journalEntry.count({
    where: {
      businessId,
      entryDate: {
        gte: period.startDate,
        lte: period.endDate,
      },
      status: 'posted',
    },
  })

  // Get revenue and expense totals
  const totalRevenue = await getTotalRevenue(businessId, period.startDate, period.endDate)
  const totalExpenses = await getTotalExpenses(businessId, period.startDate, period.endDate)

  return {
    period,
    totalRevenue,
    totalExpenses,
    netIncome,
    profitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    transactionCount,
    status: period.status,
    canClose: period.status === 'open',
    canReopen: period.status === 'closed',
  }
}

async function getTotalRevenue(businessId: number, startDate: Date, endDate: Date) {
  const revenueAccounts = await prisma.chartOfAccounts.findMany({
    where: { businessId, accountType: 'revenue', isActive: { select: { id: true, name: true } } },
  })

  let total = 0
  for (const account of revenueAccounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: { gte: startDate, lte: endDate },
          status: 'posted',
        },
      },
    })
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)
    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    total += credits - debits
  }
  return total
}

async function getTotalExpenses(businessId: number, startDate: Date, endDate: Date) {
  const expenseAccounts = await prisma.chartOfAccounts.findMany({
    where: { businessId, accountType: 'expense', isActive: { select: { id: true, name: true } } },
  })

  let total = 0
  for (const account of expenseAccounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: { gte: startDate, lte: endDate },
          status: 'posted',
        },
      },
    })
    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)
    total += debits - credits
  }
  return total
}
