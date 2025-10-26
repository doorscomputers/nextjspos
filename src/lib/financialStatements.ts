/**
 * Financial Statement Generator
 * Generates Balance Sheet, Income Statement, Cash Flow Statement, and Trial Balance
 *
 * FOR NON-ACCOUNTANTS:
 * Think of these reports as different "views" of your business's health:
 * - Balance Sheet: What you own and owe (snapshot at a point in time)
 * - Income Statement: Did you make money? (over a period of time)
 * - Cash Flow: Where did your cash come from and go? (over a period of time)
 * - Trial Balance: A validation report (ensures books balance)
 */

import { prisma } from './prisma'
import { getChartOfAccounts } from './chartOfAccounts'

/**
 * Balance Sheet Structure
 *
 * FOR NON-ACCOUNTANTS:
 * The Balance Sheet answers: "What does my business own, and what does it owe?"
 *
 * FORMULA: Assets = Liabilities + Equity
 * - Assets: What you OWN (cash, inventory, equipment)
 * - Liabilities: What you OWE (bills, loans)
 * - Equity: What's LEFT OVER (owner's investment + profits)
 *
 * It's like your personal net worth statement!
 */
export interface BalanceSheet {
  asOfDate: Date
  businessId: number

  // ASSETS: What the business owns
  assets: {
    currentAssets: Array<{
      accountCode: string
      accountName: string
      balance: number
      explanation: string // Educational tooltip
    }>
    totalCurrentAssets: number

    fixedAssets: Array<{
      accountCode: string
      accountName: string
      balance: number
      explanation: string
    }>
    totalFixedAssets: number

    totalAssets: number
  }

  // LIABILITIES: What the business owes
  liabilities: {
    currentLiabilities: Array<{
      accountCode: string
      accountName: string
      balance: number
      explanation: string
    }>
    totalCurrentLiabilities: number

    longTermLiabilities: Array<{
      accountCode: string
      accountName: string
      balance: number
      explanation: string
    }>
    totalLongTermLiabilities: number

    totalLiabilities: number
  }

  // EQUITY: Owner's stake in the business
  equity: {
    ownerEquity: number
    retainedEarnings: number
    totalEquity: number
  }

  // VALIDATION: Must always be true!
  balanced: boolean // Assets === Liabilities + Equity
  difference: number // Should be 0

  // EDUCATIONAL METRICS
  metrics: {
    workingCapital: number // Current Assets - Current Liabilities
    currentRatio: number // Current Assets / Current Liabilities
    debtToEquityRatio: number // Total Liabilities / Total Equity
  }
}

/**
 * Income Statement Structure (Profit & Loss)
 *
 * FOR NON-ACCOUNTANTS:
 * Answers: "Did I make money this period?"
 *
 * SIMPLE FORMULA: Profit = Revenue - Expenses
 * - Revenue: Money you EARNED (sales)
 * - Expenses: Money you SPENT (costs, rent, salaries)
 * - Net Income: What's LEFT (profit if positive, loss if negative)
 */
export interface IncomeStatement {
  startDate: Date
  endDate: Date
  businessId: number

  // REVENUE: Money earned
  revenue: {
    salesRevenue: number
    otherRevenue: number
    totalRevenue: number
  }

  // COST OF GOODS SOLD: Direct costs
  cogs: {
    costOfGoodsSold: number
    explanation: string // "The cost of products you sold"
  }

  // GROSS PROFIT: Revenue - COGS
  grossProfit: {
    amount: number
    margin: number // Percentage
    explanation: string // "Profit before operating expenses"
  }

  // OPERATING EXPENSES: Running the business
  operatingExpenses: Array<{
    accountCode: string
    accountName: string
    amount: number
    explanation: string
  }>
  totalOperatingExpenses: number

  // OPERATING INCOME: Gross Profit - Operating Expenses
  operatingIncome: {
    amount: number
    margin: number
    explanation: string
  }

  // OTHER INCOME/EXPENSES
  otherIncome: number
  otherExpenses: number

  // NET INCOME: The bottom line!
  netIncome: {
    amount: number
    margin: number // Net profit margin %
    status: 'profit' | 'loss' | 'breakeven'
    explanation: string
  }

  // EDUCATIONAL METRICS
  metrics: {
    grossProfitMargin: number // (Gross Profit / Revenue) * 100
    operatingMargin: number // (Operating Income / Revenue) * 100
    netProfitMargin: number // (Net Income / Revenue) * 100
  }
}

/**
 * Cash Flow Statement Structure
 *
 * FOR NON-ACCOUNTANTS:
 * Answers: "Where did my cash come from, and where did it go?"
 *
 * IMPORTANT: Profit ≠ Cash!
 * You can be profitable but run out of cash (if customers haven't paid yet)
 * Or have cash but be unprofitable (if you took a loan)
 */
export interface CashFlowStatement {
  startDate: Date
  endDate: Date
  businessId: number

  // OPERATING ACTIVITIES: Day-to-day business
  operating: {
    netIncome: number
    adjustments: Array<{
      description: string
      amount: number
      explanation: string
    }>
    netCashFromOperating: number
  }

  // INVESTING ACTIVITIES: Buying/selling assets
  investing: {
    activities: Array<{
      description: string
      amount: number
      explanation: string
    }>
    netCashFromInvesting: number
  }

  // FINANCING ACTIVITIES: Loans and equity
  financing: {
    activities: Array<{
      description: string
      amount: number
      explanation: string
    }>
    netCashFromFinancing: number
  }

  // NET CHANGE IN CASH
  netCashChange: number
  beginningCash: number
  endingCash: number

  // EDUCATIONAL METRICS
  metrics: {
    cashConversionCycle: number // Days to convert inventory to cash
    operatingCashFlow: number
  }
}

/**
 * Trial Balance
 *
 * FOR NON-ACCOUNTANTS:
 * This is a "sanity check" report that ensures your books are balanced.
 *
 * GOLDEN RULE: Total Debits MUST = Total Credits
 * If they don't match, something is wrong!
 */
export interface TrialBalance {
  asOfDate: Date
  businessId: number

  accounts: Array<{
    accountCode: string
    accountName: string
    accountType: string
    debitBalance: number
    creditBalance: number
  }>

  totals: {
    totalDebits: number
    totalCredits: number
    difference: number
    balanced: boolean // Must be true!
  }

  // VALIDATION RESULTS
  validation: {
    status: 'balanced' | 'unbalanced'
    message: string
    errors: string[]
  }
}

/**
 * Generate Balance Sheet
 */
export async function generateBalanceSheet(
  businessId: number,
  asOfDate: Date
): Promise<BalanceSheet> {
  const accounts = await getChartOfAccounts(businessId)

  // Get account balances as of date
  const getBalance = async (accountCode: string) => {
    const account = accounts.find(a => a.accountCode === accountCode)
    if (!account) return 0

    // Sum all posted journal entries up to asOfDate
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: { lte: asOfDate },
          status: 'posted',
        },
      },
    })

    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)

    // Return based on normal balance
    if (account.normalBalance === 'debit') {
      return debits - credits
    } else {
      return credits - debits
    }
  }

  // ASSETS
  const cash = await getBalance('1000')
  const accountsReceivable = await getBalance('1100')
  const inventory = await getBalance('1200')
  const prepaidExpenses = await getBalance('1300')

  const equipment = await getBalance('1500')
  const accumulatedDepreciation = await getBalance('1550')
  const furniture = await getBalance('1600')

  const totalCurrentAssets = cash + accountsReceivable + inventory + prepaidExpenses
  const totalFixedAssets = equipment + furniture - accumulatedDepreciation
  const totalAssets = totalCurrentAssets + totalFixedAssets

  // LIABILITIES
  const accountsPayable = await getBalance('2000')
  const salesTaxPayable = await getBalance('2100')
  const accruedExpenses = await getBalance('2200')
  const longTermDebt = await getBalance('2500')

  const totalCurrentLiabilities = accountsPayable + salesTaxPayable + accruedExpenses
  const totalLongTermLiabilities = longTermDebt
  const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities

  // EQUITY
  const ownerEquity = await getBalance('3000')
  const retainedEarnings = await getBalance('3100')
  const ownerDraws = await getBalance('3200')

  const totalEquity = ownerEquity + retainedEarnings - ownerDraws

  // VALIDATION
  const difference = totalAssets - (totalLiabilities + totalEquity)
  const balanced = Math.abs(difference) < 0.01 // Allow for rounding

  // METRICS
  const workingCapital = totalCurrentAssets - totalCurrentLiabilities
  const currentRatio = totalCurrentLiabilities > 0 ? totalCurrentAssets / totalCurrentLiabilities : 0
  const debtToEquityRatio = totalEquity > 0 ? totalLiabilities / totalEquity : 0

  return {
    asOfDate,
    businessId,
    assets: {
      currentAssets: [
        {
          accountCode: '1000',
          accountName: 'Cash',
          balance: cash,
          explanation: 'Money in bank and on hand. This is the most liquid asset - you can spend it immediately.',
        },
        {
          accountCode: '1100',
          accountName: 'Accounts Receivable',
          balance: accountsReceivable,
          explanation: 'Money customers owe you. You\'ve made the sale but haven\'t received payment yet.',
        },
        {
          accountCode: '1200',
          accountName: 'Inventory',
          balance: inventory,
          explanation: 'Value of products available for sale. This will become cash when you sell them.',
        },
        {
          accountCode: '1300',
          accountName: 'Prepaid Expenses',
          balance: prepaidExpenses,
          explanation: 'Expenses you\'ve paid in advance (like insurance or rent).',
        },
      ],
      totalCurrentAssets,
      fixedAssets: [
        {
          accountCode: '1500',
          accountName: 'Equipment',
          balance: equipment,
          explanation: 'Office equipment, computers, machinery - things you use to run the business.',
        },
        {
          accountCode: '1550',
          accountName: 'Accumulated Depreciation',
          balance: -accumulatedDepreciation,
          explanation: 'How much value your equipment has lost over time (wear and tear).',
        },
        {
          accountCode: '1600',
          accountName: 'Furniture & Fixtures',
          balance: furniture,
          explanation: 'Office furniture, shelves, displays, etc.',
        },
      ],
      totalFixedAssets,
      totalAssets,
    },
    liabilities: {
      currentLiabilities: [
        {
          accountCode: '2000',
          accountName: 'Accounts Payable',
          balance: accountsPayable,
          explanation: 'Money you owe suppliers. Bills you need to pay soon.',
        },
        {
          accountCode: '2100',
          accountName: 'Sales Tax Payable',
          balance: salesTaxPayable,
          explanation: 'Sales tax collected from customers that must be paid to the government.',
        },
        {
          accountCode: '2200',
          accountName: 'Accrued Expenses',
          balance: accruedExpenses,
          explanation: 'Expenses incurred but not yet paid (like utilities you used but haven\'t been billed for).',
        },
      ],
      totalCurrentLiabilities,
      longTermLiabilities: [
        {
          accountCode: '2500',
          accountName: 'Long-Term Debt',
          balance: longTermDebt,
          explanation: 'Loans and debts that don\'t need to be paid for more than a year.',
        },
      ],
      totalLongTermLiabilities,
      totalLiabilities,
    },
    equity: {
      ownerEquity,
      retainedEarnings,
      totalEquity,
    },
    balanced,
    difference,
    metrics: {
      workingCapital,
      currentRatio,
      debtToEquityRatio,
    },
  }
}

/**
 * Generate Income Statement
 */
export async function generateIncomeStatement(
  businessId: number,
  startDate: Date,
  endDate: Date
): Promise<IncomeStatement> {
  const accounts = await getChartOfAccounts(businessId)

  const getPeriodBalance = async (accountCode: string) => {
    const account = accounts.find(a => a.accountCode === accountCode)
    if (!account) return 0

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

    if (account.normalBalance === 'debit') {
      return debits - credits
    } else {
      return credits - debits
    }
  }

  // REVENUE
  const salesRevenue = await getPeriodBalance('4000')
  const serviceRevenue = await getPeriodBalance('4100')
  const otherIncome = await getPeriodBalance('4900')
  const totalRevenue = salesRevenue + serviceRevenue + otherIncome

  // COGS
  const costOfGoodsSold = await getPeriodBalance('5000')

  // GROSS PROFIT
  const grossProfit = totalRevenue - costOfGoodsSold
  const grossProfitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0

  // OPERATING EXPENSES
  const rent = await getPeriodBalance('5300')
  const utilities = await getPeriodBalance('5400')
  const salaries = await getPeriodBalance('5500')
  const advertising = await getPeriodBalance('5600')
  const officeSupplies = await getPeriodBalance('5700')
  const depreciation = await getPeriodBalance('5800')
  const inventoryAdjustments = await getPeriodBalance('5200')

  const operatingExpenses = [
    { accountCode: '5200', accountName: 'Inventory Adjustments', amount: inventoryAdjustments, explanation: 'Corrections to inventory from physical counts' },
    { accountCode: '5300', accountName: 'Rent Expense', amount: rent, explanation: 'Cost of renting business space' },
    { accountCode: '5400', accountName: 'Utilities', amount: utilities, explanation: 'Electricity, water, internet, phone' },
    { accountCode: '5500', accountName: 'Salaries & Wages', amount: salaries, explanation: 'Employee compensation' },
    { accountCode: '5600', accountName: 'Advertising', amount: advertising, explanation: 'Marketing and promotional costs' },
    { accountCode: '5700', accountName: 'Office Supplies', amount: officeSupplies, explanation: 'Paper, pens, printer ink, etc.' },
    { accountCode: '5800', accountName: 'Depreciation', amount: depreciation, explanation: 'Value lost on equipment over time (non-cash expense)' },
  ]

  const totalOperatingExpenses = operatingExpenses.reduce((sum, exp) => sum + exp.amount, 0)

  // OPERATING INCOME
  const operatingIncome = grossProfit - totalOperatingExpenses
  const operatingMargin = totalRevenue > 0 ? (operatingIncome / totalRevenue) * 100 : 0

  // OTHER INCOME/EXPENSES
  const interestExpense = await getPeriodBalance('5900')
  const bankFees = await getPeriodBalance('5950')
  const otherExpenses = interestExpense + bankFees

  // NET INCOME
  const netIncome = operatingIncome + otherIncome - otherExpenses
  const netProfitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0

  let status: 'profit' | 'loss' | 'breakeven' = 'breakeven'
  if (netIncome > 0.01) status = 'profit'
  else if (netIncome < -0.01) status = 'loss'

  return {
    startDate,
    endDate,
    businessId,
    revenue: {
      salesRevenue,
      otherRevenue: serviceRevenue + otherIncome,
      totalRevenue,
    },
    cogs: {
      costOfGoodsSold,
      explanation: 'The direct cost of products you sold. For example, if you sold a shirt for $20 and bought it for $10, the COGS is $10.',
    },
    grossProfit: {
      amount: grossProfit,
      margin: grossProfitMargin,
      explanation: 'Revenue minus COGS. This is your profit before paying for rent, salaries, and other operating expenses.',
    },
    operatingExpenses,
    totalOperatingExpenses,
    operatingIncome: {
      amount: operatingIncome,
      margin: operatingMargin,
      explanation: 'Gross Profit minus Operating Expenses. This is profit from your core business operations.',
    },
    otherIncome,
    otherExpenses,
    netIncome: {
      amount: netIncome,
      margin: netProfitMargin,
      status,
      explanation:
        status === 'profit'
          ? `Congratulations! You made a profit of ${netIncome.toFixed(2)}. This means your revenue exceeded all your expenses.`
          : status === 'loss'
          ? `You had a loss of ${Math.abs(netIncome).toFixed(2)}. This means your expenses exceeded your revenue. Review your costs and pricing.`
          : 'You broke even - revenue equals expenses. No profit or loss.',
    },
    metrics: {
      grossProfitMargin,
      operatingMargin,
      netProfitMargin,
    },
  }
}

/**
 * Generate Trial Balance
 */
export async function generateTrialBalance(
  businessId: number,
  asOfDate: Date
): Promise<TrialBalance> {
  const accounts = await getChartOfAccounts(businessId)
  const trialBalanceAccounts = []

  let totalDebits = 0
  let totalCredits = 0

  for (const account of accounts) {
    const lines = await prisma.journalEntryLine.findMany({
      where: {
        accountId: account.id,
        journalEntry: {
          businessId,
          entryDate: { lte: asOfDate },
          status: 'posted',
        },
      },
    })

    const debits = lines.reduce((sum, line) => sum + Number(line.debit), 0)
    const credits = lines.reduce((sum, line) => sum + Number(line.credit), 0)

    const debitBalance = account.normalBalance === 'debit' ? debits - credits : 0
    const creditBalance = account.normalBalance === 'credit' ? credits - debits : 0

    if (debitBalance !== 0 || creditBalance !== 0) {
      trialBalanceAccounts.push({
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        debitBalance,
        creditBalance,
      })

      totalDebits += debitBalance
      totalCredits += creditBalance
    }
  }

  const difference = totalDebits - totalCredits
  const balanced = Math.abs(difference) < 0.01

  return {
    asOfDate,
    businessId,
    accounts: trialBalanceAccounts,
    totals: {
      totalDebits,
      totalCredits,
      difference,
      balanced,
    },
    validation: {
      status: balanced ? 'balanced' : 'unbalanced',
      message: balanced
        ? '✅ Trial Balance is BALANCED! Your books are in good shape.'
        : `❌ Trial Balance is UNBALANCED by ${Math.abs(difference).toFixed(2)}. There may be an error in your journal entries.`,
      errors: balanced ? [] : ['Total Debits do not equal Total Credits'],
    },
  }
}
