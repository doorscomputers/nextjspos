/**
 * Chart of Accounts Management System
 * Provides standard GL account structure and management functions
 */

import { prisma } from './prisma'

/**
 * Standard Chart of Accounts Structure
 * Following Generally Accepted Accounting Principles (GAAP)
 */
export const STANDARD_CHART_OF_ACCOUNTS = [
  // ============================================
  // ASSETS (1000-1999)
  // ============================================
  {
    accountCode: '1000',
    accountName: 'Cash',
    description: 'Cash on hand and in bank accounts',
    accountType: 'asset',
    accountSubType: 'current_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'current_assets',
    cashFlowSection: 'operating',
    isSystemAccount: true,
  },
  {
    accountCode: '1050',
    accountName: 'Petty Cash',
    description: 'Small cash amounts for minor expenses',
    accountType: 'asset',
    accountSubType: 'current_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'current_assets',
    cashFlowSection: 'operating',
    isSystemAccount: false,
  },
  {
    accountCode: '1100',
    accountName: 'Accounts Receivable',
    description: 'Money owed to business by customers',
    accountType: 'asset',
    accountSubType: 'current_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'current_assets',
    cashFlowSection: 'operating',
    isSystemAccount: true,
  },
  {
    accountCode: '1200',
    accountName: 'Inventory Asset',
    description: 'Value of goods available for sale',
    accountType: 'asset',
    accountSubType: 'current_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'current_assets',
    cashFlowSection: 'operating',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by inventory system
  },
  {
    accountCode: '1300',
    accountName: 'Prepaid Expenses',
    description: 'Expenses paid in advance',
    accountType: 'asset',
    accountSubType: 'current_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'current_assets',
    cashFlowSection: 'operating',
    isSystemAccount: false,
  },
  {
    accountCode: '1500',
    accountName: 'Equipment',
    description: 'Office and business equipment',
    accountType: 'asset',
    accountSubType: 'fixed_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'fixed_assets',
    cashFlowSection: 'investing',
    isSystemAccount: false,
  },
  {
    accountCode: '1550',
    accountName: 'Accumulated Depreciation - Equipment',
    description: 'Accumulated depreciation on equipment',
    accountType: 'asset',
    accountSubType: 'fixed_asset',
    normalBalance: 'credit', // Contra-asset account
    balanceSheetSection: 'fixed_assets',
    isSystemAccount: false,
  },
  {
    accountCode: '1600',
    accountName: 'Furniture and Fixtures',
    description: 'Office furniture and fixtures',
    accountType: 'asset',
    accountSubType: 'fixed_asset',
    normalBalance: 'debit',
    balanceSheetSection: 'fixed_assets',
    cashFlowSection: 'investing',
    isSystemAccount: false,
  },

  // ============================================
  // LIABILITIES (2000-2999)
  // ============================================
  {
    accountCode: '2000',
    accountName: 'Accounts Payable',
    description: 'Money owed to suppliers',
    accountType: 'liability',
    accountSubType: 'current_liability',
    normalBalance: 'credit',
    balanceSheetSection: 'current_liabilities',
    cashFlowSection: 'operating',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by purchase system
  },
  {
    accountCode: '2100',
    accountName: 'Sales Tax Payable',
    description: 'Sales tax collected from customers',
    accountType: 'liability',
    accountSubType: 'current_liability',
    normalBalance: 'credit',
    balanceSheetSection: 'current_liabilities',
    isSystemAccount: false,
  },
  {
    accountCode: '2200',
    accountName: 'Accrued Expenses',
    description: 'Expenses incurred but not yet paid',
    accountType: 'liability',
    accountSubType: 'current_liability',
    normalBalance: 'credit',
    balanceSheetSection: 'current_liabilities',
    isSystemAccount: false,
  },
  {
    accountCode: '2500',
    accountName: 'Long-Term Debt',
    description: 'Loans and debts due after one year',
    accountType: 'liability',
    accountSubType: 'long_term_liability',
    normalBalance: 'credit',
    balanceSheetSection: 'long_term_liabilities',
    cashFlowSection: 'financing',
    isSystemAccount: false,
  },

  // ============================================
  // EQUITY (3000-3999)
  // ============================================
  {
    accountCode: '3000',
    accountName: 'Owner\'s Equity',
    description: 'Owner\'s investment in the business',
    accountType: 'equity',
    accountSubType: 'capital',
    normalBalance: 'credit',
    balanceSheetSection: 'equity',
    isSystemAccount: true,
  },
  {
    accountCode: '3100',
    accountName: 'Retained Earnings',
    description: 'Accumulated profits retained in business',
    accountType: 'equity',
    accountSubType: 'retained_earnings',
    normalBalance: 'credit',
    balanceSheetSection: 'equity',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by period closing
  },
  {
    accountCode: '3200',
    accountName: 'Owner Draws',
    description: 'Money withdrawn by owner',
    accountType: 'equity',
    accountSubType: 'draws',
    normalBalance: 'debit', // Contra-equity account
    balanceSheetSection: 'equity',
    isSystemAccount: false,
  },

  // ============================================
  // REVENUE (4000-4999)
  // ============================================
  {
    accountCode: '4000',
    accountName: 'Sales Revenue',
    description: 'Revenue from product sales',
    accountType: 'revenue',
    accountSubType: 'operating_revenue',
    normalBalance: 'credit',
    incomeStatementSection: 'revenue',
    cashFlowSection: 'operating',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by sales system
  },
  {
    accountCode: '4100',
    accountName: 'Service Revenue',
    description: 'Revenue from services provided',
    accountType: 'revenue',
    accountSubType: 'operating_revenue',
    normalBalance: 'credit',
    incomeStatementSection: 'revenue',
    cashFlowSection: 'operating',
    isSystemAccount: false,
  },
  {
    accountCode: '4900',
    accountName: 'Other Income',
    description: 'Non-operating income',
    accountType: 'revenue',
    accountSubType: 'other_revenue',
    normalBalance: 'credit',
    incomeStatementSection: 'other_income',
    isSystemAccount: false,
  },

  // ============================================
  // COST OF GOODS SOLD (5000-5099)
  // ============================================
  {
    accountCode: '5000',
    accountName: 'Cost of Goods Sold (COGS)',
    description: 'Direct cost of products sold',
    accountType: 'expense',
    accountSubType: 'cogs',
    normalBalance: 'debit',
    incomeStatementSection: 'cogs',
    cashFlowSection: 'operating',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by sales system
  },

  // ============================================
  // OPERATING EXPENSES (5100-5999)
  // ============================================
  {
    accountCode: '5100',
    accountName: 'Purchases',
    description: 'Inventory purchases (periodic system)',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by purchase system
  },
  {
    accountCode: '5200',
    accountName: 'Inventory Adjustments',
    description: 'Inventory corrections and adjustments',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: true,
    allowManualEntry: false, // Managed by inventory correction system
  },
  {
    accountCode: '5210',
    accountName: 'Inventory Shrinkage',
    description: 'Inventory losses due to theft, damage, or errors',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: true,
    allowManualEntry: false,
  },
  {
    accountCode: '5220',
    accountName: 'Inventory Write-Off',
    description: 'Inventory written off (damaged, expired, obsolete)',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: true,
    allowManualEntry: false,
  },
  {
    accountCode: '5300',
    accountName: 'Rent Expense',
    description: 'Rent for business premises',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: false,
  },
  {
    accountCode: '5400',
    accountName: 'Utilities Expense',
    description: 'Electricity, water, internet, etc.',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: false,
  },
  {
    accountCode: '5500',
    accountName: 'Salaries and Wages',
    description: 'Employee compensation',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    cashFlowSection: 'operating',
    isSystemAccount: false,
  },
  {
    accountCode: '5600',
    accountName: 'Advertising and Marketing',
    description: 'Marketing and promotional expenses',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: false,
  },
  {
    accountCode: '5700',
    accountName: 'Office Supplies',
    description: 'Office supplies and consumables',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    isSystemAccount: false,
  },
  {
    accountCode: '5800',
    accountName: 'Depreciation Expense',
    description: 'Depreciation of fixed assets',
    accountType: 'expense',
    accountSubType: 'operating_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'operating_expenses',
    cashFlowSection: 'operating', // Non-cash expense
    isSystemAccount: false,
  },
  {
    accountCode: '5900',
    accountName: 'Interest Expense',
    description: 'Interest on loans and debts',
    accountType: 'expense',
    accountSubType: 'other_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'other_expenses',
    cashFlowSection: 'financing',
    isSystemAccount: false,
  },
  {
    accountCode: '5950',
    accountName: 'Bank Fees',
    description: 'Bank charges and fees',
    accountType: 'expense',
    accountSubType: 'other_expense',
    normalBalance: 'debit',
    incomeStatementSection: 'other_expenses',
    isSystemAccount: false,
  },
] as const

/**
 * Initialize Chart of Accounts for a new business
 */
export async function initializeChartOfAccounts(businessId: number) {
  const accounts = []

  for (const accountTemplate of STANDARD_CHART_OF_ACCOUNTS) {
    const account = await prisma.chartOfAccounts.create({
      data: {
        businessId,
        ...accountTemplate,
        currentBalance: 0,
        ytdDebit: 0,
        ytdCredit: 0,
      },
    })
    accounts.push(account)
  }

  return accounts
}

/**
 * Get all accounts for a business
 */
export async function getChartOfAccounts(businessId: number) {
  return await prisma.chartOfAccounts.findMany({
    where: { businessId },
    orderBy: { accountCode: 'asc' },
  })
}

/**
 * Get account by code
 */
export async function getAccountByCode(businessId: number, accountCode: string) {
  return await prisma.chartOfAccounts.findUnique({
    where: {
      businessId_accountCode: {
        businessId,
        accountCode,
      },
    },
  })
}

/**
 * Batch get accounts by multiple codes
 * PERFORMANCE: Fetches all accounts in a single query instead of N sequential queries
 * Saves ~200-400ms for 4 account lookups in accounting integration
 */
export async function batchGetAccountsByCodes(
  businessId: number,
  accountCodes: string[],
  tx?: any  // Optional transaction client for atomicity
): Promise<Map<string, any>> {
  const client = tx ?? prisma  // Use transaction client if provided

  const accounts = await client.chartOfAccounts.findMany({
    where: {
      businessId,
      accountCode: { in: accountCodes },
    },
  })

  // Return as a map for easy lookup
  return new Map(accounts.map(account => [account.accountCode, account]))
}

/**
 * Get accounts by type
 */
export async function getAccountsByType(
  businessId: number,
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
) {
  return await prisma.chartOfAccounts.findMany({
    where: {
      businessId,
      accountType,
      isActive: true,
    },
    orderBy: { accountCode: 'asc' },
  })
}

/**
 * Create new account
 */
export async function createAccount(
  businessId: number,
  accountData: {
    accountCode: string
    accountName: string
    description?: string
    parentId?: number
    accountType: string
    accountSubType: string
    normalBalance: string
    balanceSheetSection?: string
    incomeStatementSection?: string
    cashFlowSection?: string
  }
) {
  return await prisma.chartOfAccounts.create({
    data: {
      businessId,
      ...accountData,
      currentBalance: 0,
      ytdDebit: 0,
      ytdCredit: 0,
    },
  })
}

/**
 * Update account balance (called after posting journal entries)
 */
export async function updateAccountBalance(
  accountId: number,
  debitAmount: number,
  creditAmount: number
) {
  const account = await prisma.chartOfAccounts.findUnique({
    where: { id: accountId },
  })

  if (!account) {
    throw new Error(`Account ${accountId} not found`)
  }

  // Calculate new balance based on normal balance
  let newBalance = Number(account.currentBalance)
  if (account.normalBalance === 'debit') {
    newBalance += debitAmount - creditAmount
  } else {
    newBalance += creditAmount - debitAmount
  }

  return await prisma.chartOfAccounts.update({
    where: { id: accountId },
    data: {
      currentBalance: newBalance,
      ytdDebit: Number(account.ytdDebit) + debitAmount,
      ytdCredit: Number(account.ytdCredit) + creditAmount,
    },
  })
}

/**
 * Get account balance
 */
export async function getAccountBalance(businessId: number, accountCode: string) {
  const account = await getAccountByCode(businessId, accountCode)
  if (!account) {
    throw new Error(`Account ${accountCode} not found`)
  }
  return Number(account.currentBalance)
}

/**
 * Validate account code uniqueness
 */
export async function isAccountCodeAvailable(businessId: number, accountCode: string) {
  const existing = await getAccountByCode(businessId, accountCode)
  return !existing
}

/**
 * Get active accounts for dropdown/selection
 */
export async function getActiveAccounts(businessId: number) {
  return await prisma.chartOfAccounts.findMany({
    where: {
      businessId,
      isActive: true,
      allowManualEntry: true, // Only show accounts that allow manual entries
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true,
      normalBalance: true,
    },
    orderBy: { accountCode: 'asc' },
  })
}
