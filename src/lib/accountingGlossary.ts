/**
 * Accounting Glossary & Help System
 * Educational content for non-accountants
 */

export interface GlossaryTerm {
  term: string
  simple: string // Simple explanation
  detailed: string // Detailed explanation
  example?: string // Real-world example
  formula?: string // If applicable
}

/**
 * Comprehensive Accounting Glossary
 */
export const ACCOUNTING_GLOSSARY: Record<string, GlossaryTerm> = {
  // FUNDAMENTAL CONCEPTS
  assets: {
    term: 'Assets',
    simple: 'Things your business owns that have value',
    detailed: 'Assets are resources owned by your business that can provide future economic benefit. They can be converted to cash or used to generate revenue.',
    example: 'Cash in your bank account ($10,000), inventory in your store ($50,000), or a delivery truck ($30,000) are all assets.',
  },

  liabilities: {
    term: 'Liabilities',
    simple: 'Money your business owes to others',
    detailed: 'Liabilities are debts and obligations your business must pay. They represent claims against your assets by creditors, suppliers, or lenders.',
    example: 'Unpaid supplier invoices ($5,000), a business loan ($20,000), or sales tax you collected but haven\'t remitted ($1,000) are liabilities.',
  },

  equity: {
    term: 'Equity',
    simple: 'The owner\'s stake in the business',
    detailed: 'Equity represents the owner\'s residual interest in the business after all liabilities are subtracted from assets. It\'s what would be left if you sold everything and paid all debts.',
    example: 'If your business has $100,000 in assets and $40,000 in liabilities, your equity is $60,000.',
    formula: 'Equity = Assets - Liabilities',
  },

  revenue: {
    term: 'Revenue',
    simple: 'Money earned from selling products or services',
    detailed: 'Revenue is the total income generated from business operations before any expenses are deducted. It\'s often called "sales" or "income."',
    example: 'If you sold 100 shirts at $20 each, your revenue is $2,000.',
  },

  expenses: {
    term: 'Expenses',
    simple: 'Costs of running your business',
    detailed: 'Expenses are the costs incurred to generate revenue and operate your business. They reduce your profit.',
    example: 'Rent ($2,000/month), employee salaries ($10,000/month), and electricity bills ($300/month) are all expenses.',
  },

  netIncome: {
    term: 'Net Income',
    simple: 'Your profit or loss',
    detailed: 'Net Income is the bottom line - what\'s left after all revenues are collected and all expenses are paid. Positive means profit, negative means loss.',
    example: 'If you have $50,000 in revenue and $40,000 in expenses, your net income is $10,000 profit.',
    formula: 'Net Income = Revenue - Expenses',
  },

  // BALANCE SHEET TERMS
  currentAssets: {
    term: 'Current Assets',
    simple: 'Assets that will become cash within a year',
    detailed: 'Current assets are resources that can be quickly converted to cash or will be used up within one year.',
    example: 'Cash, money owed by customers (accounts receivable), and inventory for sale.',
  },

  fixedAssets: {
    term: 'Fixed Assets',
    simple: 'Long-term assets used to run the business',
    detailed: 'Fixed assets are long-term resources not intended for sale. They typically last more than one year and help you run your business.',
    example: 'Buildings, vehicles, equipment, furniture, and computers.',
  },

  accountsReceivable: {
    term: 'Accounts Receivable',
    simple: 'Money customers owe you',
    detailed: 'When you make a sale on credit (customer promises to pay later), you record an account receivable. It\'s money you\'ve earned but haven\'t collected yet.',
    example: 'You sold $1,000 worth of products to a customer who will pay in 30 days. Until they pay, you have $1,000 in accounts receivable.',
  },

  accountsPayable: {
    term: 'Accounts Payable',
    simple: 'Money you owe to suppliers',
    detailed: 'When you buy inventory or services on credit (you promise to pay later), you record an account payable. It\'s a bill you need to pay.',
    example: 'You received $5,000 worth of inventory from a supplier with payment due in 30 days. You have $5,000 in accounts payable.',
  },

  inventory: {
    term: 'Inventory',
    simple: 'Products available for sale',
    detailed: 'Inventory is the goods you have in stock and ready to sell to customers. It\'s valued at the cost you paid for it.',
    example: 'If you run a clothing store with 500 shirts that cost $10 each, your inventory is worth $5,000.',
  },

  retainedEarnings: {
    term: 'Retained Earnings',
    simple: 'Profits kept in the business',
    detailed: 'Retained earnings are accumulated profits that haven\'t been paid out to owners as dividends. They stay in the business for growth and operations.',
    example: 'If your business made $100,000 profit over 3 years and you withdrew $30,000, your retained earnings are $70,000.',
  },

  workingCapital: {
    term: 'Working Capital',
    simple: 'Money available for day-to-day operations',
    detailed: 'Working capital measures your ability to pay short-term obligations. Positive working capital means you can cover your bills.',
    example: 'If you have $50,000 in current assets and $30,000 in current liabilities, your working capital is $20,000.',
    formula: 'Working Capital = Current Assets - Current Liabilities',
  },

  // INCOME STATEMENT TERMS
  grossProfit: {
    term: 'Gross Profit',
    simple: 'Profit before operating expenses',
    detailed: 'Gross profit is revenue minus the direct cost of products sold (COGS). It shows how much you make before paying for rent, salaries, etc.',
    example: 'You sold products for $100,000 that cost you $60,000. Your gross profit is $40,000.',
    formula: 'Gross Profit = Revenue - Cost of Goods Sold',
  },

  cogs: {
    term: 'Cost of Goods Sold (COGS)',
    simple: 'What you paid for products you sold',
    detailed: 'COGS is the direct cost of products or materials sold during a period. It doesn\'t include operating expenses like rent or salaries.',
    example: 'You sold 100 shirts for $20 each ($2,000 revenue). Each shirt cost you $8 to buy. Your COGS is $800.',
  },

  grossMargin: {
    term: 'Gross Margin',
    simple: 'Percentage of profit on each sale',
    detailed: 'Gross margin shows what percentage of each sale is profit after covering direct costs. Higher is better!',
    example: 'If you sell a product for $100 that cost you $60, your gross margin is 40%.',
    formula: 'Gross Margin = (Gross Profit / Revenue) × 100',
  },

  operatingExpenses: {
    term: 'Operating Expenses',
    simple: 'Costs of running the business',
    detailed: 'Operating expenses are costs incurred in the normal course of business but not directly tied to producing products. They include rent, salaries, utilities, etc.',
    example: 'Monthly rent ($3,000), employee salaries ($15,000), and advertising ($2,000) are operating expenses totaling $20,000.',
  },

  operatingIncome: {
    term: 'Operating Income',
    simple: 'Profit from core business operations',
    detailed: 'Operating income shows profit from your main business activities, before interest and taxes. It excludes one-time gains or losses.',
    example: 'If your gross profit is $50,000 and operating expenses are $30,000, your operating income is $20,000.',
    formula: 'Operating Income = Gross Profit - Operating Expenses',
  },

  netProfitMargin: {
    term: 'Net Profit Margin',
    simple: 'Overall profitability percentage',
    detailed: 'Net profit margin shows what percentage of revenue becomes profit. It measures overall business efficiency.',
    example: 'If you have $100,000 revenue and $10,000 net income, your net profit margin is 10% - you keep $0.10 of every dollar.',
    formula: 'Net Profit Margin = (Net Income / Revenue) × 100',
  },

  depreciation: {
    term: 'Depreciation',
    simple: 'Spreading asset cost over time',
    detailed: 'Depreciation allocates the cost of a long-term asset (like equipment) over its useful life. It\'s a non-cash expense that reduces profit.',
    example: 'You buy a $12,000 computer system expected to last 3 years. You record $4,000 depreciation expense each year.',
  },

  // DOUBLE-ENTRY BOOKKEEPING
  debit: {
    term: 'Debit',
    simple: 'Left side of an accounting entry',
    detailed: 'In double-entry bookkeeping, a debit increases assets and expenses, or decreases liabilities and equity. Not the same as "bad" - it\'s just a side!',
    example: 'When you receive cash, you debit (increase) your Cash account.',
  },

  credit: {
    term: 'Credit',
    simple: 'Right side of an accounting entry',
    detailed: 'A credit increases liabilities, equity, and revenue, or decreases assets and expenses. Every transaction has equal debits and credits.',
    example: 'When you make a sale, you credit (increase) your Sales Revenue account.',
  },

  journalEntry: {
    term: 'Journal Entry',
    simple: 'Recording a financial transaction',
    detailed: 'A journal entry records a business transaction by debiting one or more accounts and crediting one or more accounts. Debits must always equal credits.',
    example: 'When you buy $500 of inventory on credit: Debit Inventory $500, Credit Accounts Payable $500.',
  },

  // FINANCIAL RATIOS
  currentRatio: {
    term: 'Current Ratio',
    simple: 'Can you pay your bills?',
    detailed: 'The current ratio measures your ability to pay short-term obligations. Above 1.0 is good - it means you have more assets than debts due soon.',
    example: 'With $50,000 in current assets and $25,000 in current liabilities, your current ratio is 2.0 - very healthy!',
    formula: 'Current Ratio = Current Assets / Current Liabilities',
  },

  debtToEquityRatio: {
    term: 'Debt-to-Equity Ratio',
    simple: 'How much you owe vs. own',
    detailed: 'This ratio compares total debt to owner\'s equity. Lower is generally better - it means less reliance on borrowed money.',
    example: 'With $40,000 in liabilities and $60,000 in equity, your ratio is 0.67 - you owe $0.67 for every dollar of equity.',
    formula: 'Debt-to-Equity = Total Liabilities / Total Equity',
  },

  // PERIOD CLOSING
  fiscalPeriod: {
    term: 'Fiscal Period',
    simple: 'An accounting timeframe',
    detailed: 'A fiscal period is a specific time span (month, quarter, year) for which you measure financial performance. It helps track progress over time.',
    example: 'January 2025 is a monthly fiscal period. Q1 2025 (Jan-Mar) is a quarterly period.',
  },

  periodClosing: {
    term: 'Period Closing',
    simple: 'Finalizing accounts for a period',
    detailed: 'Period closing is the process of calculating final balances, generating financial statements, and "locking" the period so no more changes can be made.',
    example: 'At month-end, you close January to finalize profit/loss and prepare for February. No more January transactions can be added.',
  },

  trialBalance: {
    term: 'Trial Balance',
    simple: 'A balancing check',
    detailed: 'A trial balance lists all account balances to verify that total debits equal total credits. It\'s a validation step before financial statements.',
    example: 'If all debits ($500,000) equal all credits ($500,000), your trial balance is correct!',
  },

  // CASH FLOW
  cashFlow: {
    term: 'Cash Flow',
    simple: 'Movement of money in and out',
    detailed: 'Cash flow tracks actual money received and spent, unlike profit which includes unpaid sales and non-cash expenses.',
    example: 'You made a $10,000 sale on credit (profit yes, cash flow no). When the customer pays next month, you get cash flow.',
  },

  operatingCashFlow: {
    term: 'Operating Cash Flow',
    simple: 'Cash from day-to-day business',
    detailed: 'Cash generated from normal business operations - sales, expenses, inventory. Positive is healthy!',
    example: 'Collecting $50,000 from customers and paying $35,000 for expenses gives $15,000 operating cash flow.',
  },
}

/**
 * Get glossary term
 */
export function getGlossaryTerm(key: string): GlossaryTerm | undefined {
  return ACCOUNTING_GLOSSARY[key]
}

/**
 * Get simple explanation
 */
export function getSimpleExplanation(key: string): string {
  const term = ACCOUNTING_GLOSSARY[key]
  return term ? term.simple : 'No explanation available'
}

/**
 * Get detailed explanation
 */
export function getDetailedExplanation(key: string): string {
  const term = ACCOUNTING_GLOSSARY[key]
  if (!term) return 'No explanation available'

  let text = term.detailed
  if (term.example) text += `\n\nExample: ${term.example}`
  if (term.formula) text += `\n\nFormula: ${term.formula}`

  return text
}

/**
 * Common help messages for UI components
 */
export const HELP_MESSAGES = {
  balanceSheet: {
    title: 'Understanding the Balance Sheet',
    content: `The Balance Sheet shows what your business owns (assets), owes (liabilities), and the owner's stake (equity) at a specific point in time.

Think of it like a snapshot of your business's financial health.

KEY FORMULA: Assets = Liabilities + Equity
This must ALWAYS be true!

If you have $100,000 in assets and $30,000 in liabilities, your equity is $70,000.`,
  },

  incomeStatement: {
    title: 'Understanding the Income Statement',
    content: `The Income Statement (also called Profit & Loss or P&L) shows whether you made money during a specific period.

SIMPLE FORMULA: Profit = Revenue - Expenses

Positive Net Income = Profit (good!)
Negative Net Income = Loss (review your costs)
Zero Net Income = Break-even (no profit or loss)

This report helps you understand:
• Are you making money?
• Which expenses are too high?
• Is your pricing profitable?`,
  },

  cashFlow: {
    title: 'Understanding Cash Flow',
    content: `The Cash Flow Statement shows where your cash came from and where it went.

IMPORTANT: Profit ≠ Cash!

You can be profitable but run out of cash (if customers haven't paid yet).
Or have cash but be unprofitable (if you took a loan).

This report tracks actual money movement - critical for paying bills!`,
  },

  trialBalance: {
    title: 'Understanding the Trial Balance',
    content: `The Trial Balance is a "sanity check" that ensures your books are balanced.

GOLDEN RULE: Total Debits MUST equal Total Credits

If they don't match, there's an error somewhere in your journal entries.

This report is used before generating financial statements to ensure accuracy.`,
  },

  periodClosing: {
    title: 'Understanding Period Closing',
    content: `Period closing is like "balancing your checkbook" at month-end.

WHAT IT DOES:
1. Calculates your profit or loss for the period
2. Updates retained earnings
3. "Locks" the period so no more changes can be made
4. Prepares financial statements

WHY IT'S IMPORTANT:
• Ensures accurate financial records
• Prevents accidental changes to past months
• Required for tax reporting
• Helps track monthly performance

Once closed, you can only reopen with special permission (like "un-filing your taxes").`,
  },
}
