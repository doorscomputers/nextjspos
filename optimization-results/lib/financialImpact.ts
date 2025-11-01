/**
 * Financial Impact Analyzer
 * Generates General Ledger (GL) journal entries for inventory transactions
 * Prepares data for integration with accounting systems (QuickBooks, Xero, etc.)
 */

import { prisma } from './prisma'

/**
 * Standard GL Account Codes
 * These map to typical chart of accounts structure
 */
export const GLAccounts = {
  // Balance Sheet Accounts
  CASH: '1000',
  ACCOUNTS_RECEIVABLE: '1100',
  INVENTORY_ASSET: '1200',
  ACCOUNTS_PAYABLE: '2000',

  // Income Statement Accounts
  SALES_REVENUE: '4000',
  COGS: '5000',
  PURCHASES: '5100',
  INVENTORY_ADJUSTMENT: '5200',
  INVENTORY_SHRINKAGE: '5210',
  INVENTORY_WRITE_OFF: '5220',
}

/**
 * GL Account Names for Display
 */
export const GLAccountNames: Record<string, string> = {
  '1000': 'Cash',
  '1100': 'Accounts Receivable',
  '1200': 'Inventory Asset',
  '2000': 'Accounts Payable',
  '4000': 'Sales Revenue',
  '5000': 'Cost of Goods Sold',
  '5100': 'Purchases',
  '5200': 'Inventory Adjustments',
  '5210': 'Inventory Shrinkage',
  '5220': 'Inventory Write-Off',
}

/**
 * Journal Entry Line
 */
export interface JournalEntryLine {
  account: string           // GL account code
  accountName: string       // GL account name
  debit: number
  credit: number
  description: string
}

/**
 * Complete Journal Entry
 */
export interface JournalEntry {
  entryDate: Date
  referenceType: string     // 'Sale', 'Purchase', 'Adjustment', 'Transfer'
  referenceId: string
  referenceNumber?: string  // Invoice/GRN/Correction number
  description: string
  lines: JournalEntryLine[]
  totalDebit: number
  totalCredit: number
  balanced: boolean         // totalDebit === totalCredit
}

/**
 * Generate GL Entry for Purchase Receipt
 *
 * Double Entry:
 * DR Inventory Asset (increase asset)
 * CR Accounts Payable (increase liability)
 */
export async function generatePurchaseGLEntry(
  receiptId: number,
  businessId: number
): Promise<JournalEntry> {

  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id: receiptId, businessId },
    select: {
      items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      supplier: {
        select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } }
      }
    }
  })

  if (!receipt) {
    throw new Error(`Purchase receipt ${receiptId} not found`)
  }

  // Calculate total purchase value (accepted quantity * unit cost)
  const totalValue = receipt.items.reduce((sum, item) => {
    const qty = Number(item.acceptedQty || 0)
    const cost = Number(item.unitCost || 0)
    return sum + (qty * cost)
  }, 0)

  const lines: JournalEntryLine[] = [
    {
      account: GLAccounts.INVENTORY_ASSET,
      accountName: GLAccountNames[GLAccounts.INVENTORY_ASSET],
      debit: totalValue,
      credit: 0,
      description: `Inventory received - ${receipt.items.length} items`
    },
    {
      account: GLAccounts.ACCOUNTS_PAYABLE,
      accountName: GLAccountNames[GLAccounts.ACCOUNTS_PAYABLE],
      debit: 0,
      credit: totalValue,
      description: `Payable to ${receipt.supplier?.name || 'Supplier'}`
    }
  ]

  return {
    entryDate: receipt.approvedAt || receipt.receivedAt || receipt.createdAt,
    referenceType: 'PurchaseReceipt',
    referenceId: receipt.id.toString(),
    referenceNumber: receipt.grnNumber,
    description: `Purchase from ${receipt.supplier?.name || 'Supplier'} - GRN #${receipt.grnNumber}`,
    lines,
    totalDebit: totalValue,
    totalCredit: totalValue,
    balanced: { select: { id: true, name: true } }
  }
}

/**
 * Generate GL Entries for Sale
 *
 * Creates TWO journal entries:
 * 1. Revenue Entry:
 *    DR Cash/Accounts Receivable (increase asset)
 *    CR Sales Revenue (increase income)
 *
 * 2. COGS Entry:
 *    DR Cost of Goods Sold (increase expense)
 *    CR Inventory Asset (decrease asset)
 */
export async function generateSaleGLEntries(
  saleId: number,
  businessId: number
): Promise<JournalEntry[]> {

  const sale = await prisma.sale.findUnique({
    where: { id: saleId, businessId },
    select: {
      items: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
      customer: {
        select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } }
      }
    }
  })

  if (!sale) {
    throw new Error(`Sale ${saleId} not found`)
  }

  const totalRevenue = Number(sale.totalAmount || 0)

  // Calculate COGS from sale items
  const totalCOGS = sale.items.reduce((sum, item) => {
    const qty = Number(item.quantity || 0)
    const cost = Number(item.unitCost || 0)
    return sum + (qty * cost)
  }, 0)

  const entries: JournalEntry[] = []

  // Entry 1: Record Revenue
  const revenueEntry: JournalEntry = {
    entryDate: sale.saleDate || sale.createdAt,
    referenceType: 'Sale',
    referenceId: sale.id.toString(),
    referenceNumber: sale.invoiceNumber,
    description: `Sale #${sale.invoiceNumber} - Revenue`,
    lines: [
      {
        account: sale.customerId ? GLAccounts.ACCOUNTS_RECEIVABLE : GLAccounts.CASH,
        accountName: sale.customerId
          ? GLAccountNames[GLAccounts.ACCOUNTS_RECEIVABLE]
          : GLAccountNames[GLAccounts.CASH],
        debit: totalRevenue,
        credit: 0,
        description: sale.customerId
          ? `Receivable from ${sale.customer?.name || 'Customer'}`
          : 'Cash received'
      },
      {
        account: GLAccounts.SALES_REVENUE,
        accountName: GLAccountNames[GLAccounts.SALES_REVENUE],
        debit: 0,
        credit: totalRevenue,
        description: 'Sales revenue'
      }
    ],
    totalDebit: totalRevenue,
    totalCredit: totalRevenue,
    balanced: { select: { id: true, name: true } }
  }

  entries.push(revenueEntry)

  // Entry 2: Record COGS (if we have cost data)
  if (totalCOGS > 0) {
    const cogsEntry: JournalEntry = {
      entryDate: sale.saleDate || sale.createdAt,
      referenceType: 'Sale',
      referenceId: sale.id.toString(),
      referenceNumber: sale.invoiceNumber,
      description: `Sale #${sale.invoiceNumber} - COGS`,
      lines: [
        {
          account: GLAccounts.COGS,
          accountName: GLAccountNames[GLAccounts.COGS],
          debit: totalCOGS,
          credit: 0,
          description: 'Cost of goods sold'
        },
        {
          account: GLAccounts.INVENTORY_ASSET,
          accountName: GLAccountNames[GLAccounts.INVENTORY_ASSET],
          debit: 0,
          credit: totalCOGS,
          description: 'Inventory reduction'
        }
      ],
      totalDebit: totalCOGS,
      totalCredit: totalCOGS,
      balanced: { select: { id: true, name: true } }
    }

    entries.push(cogsEntry)
  }

  return entries
}

/**
 * Generate GL Entry for Inventory Adjustment
 *
 * Shortage (negative adjustment):
 * DR Inventory Adjustment Expense (increase expense)
 * CR Inventory Asset (decrease asset)
 *
 * Overage (positive adjustment):
 * DR Inventory Asset (increase asset)
 * CR Inventory Adjustment Income (increase income)
 */
export async function generateAdjustmentGLEntry(
  correctionId: number,
  businessId: number
): Promise<JournalEntry> {

  const correction = await prisma.inventoryCorrection.findUnique({
    where: { id: correctionId, businessId },
    select: {
      product: {
        select: { id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } }, name: { select: { id: true, name: true } }, sku: { select: { id: true, name: true } } }
      },
      variation: {
        select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } }, sku: { select: { id: true, name: true } } }
      },
      location: {
        select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } }
      }
    }
  })

  if (!correction) {
    throw new Error(`Inventory correction ${correctionId} not found`)
  }

  const adjustmentQty = Number(correction.difference || 0)
  const unitCost = Number(correction.unitCost || 0)
  const adjustmentValue = Math.abs(adjustmentQty * unitCost)

  const isShortage = adjustmentQty < 0
  const productName = `${correction.product?.name || 'Unknown'} - ${correction.variation?.name || 'Default'}`

  // Determine which adjustment account to use based on reason
  let adjustmentAccount = GLAccounts.INVENTORY_ADJUSTMENT
  if (correction.reason?.toLowerCase().includes('shrink')) {
    adjustmentAccount = GLAccounts.INVENTORY_SHRINKAGE
  } else if (correction.reason?.toLowerCase().includes('write') ||
             correction.reason?.toLowerCase().includes('damage')) {
    adjustmentAccount = GLAccounts.INVENTORY_WRITE_OFF
  }

  const lines: JournalEntryLine[] = isShortage ? [
    // Shortage: DR Adjustment Expense, CR Inventory
    {
      account: adjustmentAccount,
      accountName: GLAccountNames[adjustmentAccount],
      debit: adjustmentValue,
      credit: 0,
      description: `Inventory shortage - ${correction.reason || 'Physical count adjustment'}`
    },
    {
      account: GLAccounts.INVENTORY_ASSET,
      accountName: GLAccountNames[GLAccounts.INVENTORY_ASSET],
      debit: 0,
      credit: adjustmentValue,
      description: `Inventory reduction - ${productName}`
    }
  ] : [
    // Overage: DR Inventory, CR Adjustment Income
    {
      account: GLAccounts.INVENTORY_ASSET,
      accountName: GLAccountNames[GLAccounts.INVENTORY_ASSET],
      debit: adjustmentValue,
      credit: 0,
      description: `Inventory increase - ${productName}`
    },
    {
      account: adjustmentAccount,
      accountName: GLAccountNames[adjustmentAccount],
      debit: 0,
      credit: adjustmentValue,
      description: `Inventory overage - ${correction.reason || 'Physical count adjustment'}`
    }
  ]

  return {
    entryDate: correction.approvedAt || correction.createdAt,
    referenceType: 'InventoryCorrection',
    referenceId: correction.id.toString(),
    referenceNumber: correction.id.toString(),
    description: `Inventory ${isShortage ? 'shortage' : 'overage'} - ${productName} @ ${correction.location?.name}`,
    lines,
    totalDebit: adjustmentValue,
    totalCredit: adjustmentValue,
    balanced: { select: { id: true, name: true } }
  }
}

/**
 * Generate GL Entries for Stock Transfer
 *
 * Note: Transfers between locations don't affect GL
 * (both locations are within same business entity)
 * This function is provided for audit trail purposes only
 */
export async function generateTransferGLEntry(
  transferId: number,
  businessId: number
): Promise<JournalEntry | null> {

  // Transfers within same business don't create GL entries
  // Just return null to indicate no GL impact
  // However, we could track this for inter-company transfers in the future

  return null
}

/**
 * Get All GL Entries for a Period
 */
export async function getGLEntriesForPeriod(
  businessId: number,
  startDate: Date,
  endDate: Date,
  transactionTypes?: string[] // ['Sale', 'Purchase', 'Adjustment']
): Promise<JournalEntry[]> {

  const entries: JournalEntry[] = []

  // Get Sales (if requested)
  if (!transactionTypes || transactionTypes.includes('Sale')) {
    const sales = await prisma.sale.findMany({
      where: {
        businessId,
        status: { in: ['completed', 'invoiced'] },
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: { id: { select: { id: true, name: true } } }
    })

    for (const sale of sales) {
      try {
        const saleEntries = await generateSaleGLEntries(sale.id, businessId)
        entries.push(...saleEntries)
      } catch (error) {
        console.error(`Error generating GL entries for sale ${sale.id}:`, error)
      }
    }
  }

  // Get Purchase Receipts (if requested)
  if (!transactionTypes || transactionTypes.includes('Purchase')) {
    const receipts = await prisma.purchaseReceipt.findMany({
      where: {
        businessId,
        status: 'approved',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: { id: { select: { id: true, name: true } } }
    })

    for (const receipt of receipts) {
      try {
        const purchaseEntry = await generatePurchaseGLEntry(receipt.id, businessId)
        entries.push(purchaseEntry)
      } catch (error) {
        console.error(`Error generating GL entry for purchase receipt ${receipt.id}:`, error)
      }
    }
  }

  // Get Inventory Corrections (if requested)
  if (!transactionTypes || transactionTypes.includes('Adjustment')) {
    const corrections = await prisma.inventoryCorrection.findMany({
      where: {
        businessId,
        status: 'approved',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: { id: { select: { id: true, name: true } } }
    })

    for (const correction of corrections) {
      try {
        const adjustmentEntry = await generateAdjustmentGLEntry(correction.id, businessId)
        entries.push(adjustmentEntry)
      } catch (error) {
        console.error(`Error generating GL entry for correction ${correction.id}:`, error)
      }
    }
  }

  // Sort by entry date
  entries.sort((a, b) => a.entryDate.getTime() - b.entryDate.getTime())

  return entries
}

/**
 * Export GL Entries to CSV Format
 */
export function exportToCSV(entries: JournalEntry[]): string {
  const rows = [
    ['Date', 'Type', 'Reference', 'Ref Number', 'Account', 'Account Name', 'Debit', 'Credit', 'Description']
  ]

  for (const entry of entries) {
    for (const line of entry.lines) {
      rows.push([
        entry.entryDate.toISOString().split('T')[0],
        entry.referenceType,
        entry.referenceId,
        entry.referenceNumber || '',
        line.account,
        line.accountName,
        line.debit.toFixed(2),
        line.credit.toFixed(2),
        line.description
      ])
    }

    // Add blank row between entries
    rows.push(['', '', '', '', '', '', '', '', ''])
  }

  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}

/**
 * Export to QuickBooks IIF Format
 */
export function exportToQuickBooksIIF(entries: JournalEntry[]): string {
  let iif = '!TRNS\tTRNSID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n'
  iif += '!SPL\tSPLID\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n'
  iif += '!ENDTRNS\n'

  for (const entry of entries) {
    // Format: MM/DD/YYYY for QuickBooks
    const date = entry.entryDate
    const formattedDate = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`

    for (const line of entry.lines) {
      const amount = line.debit > 0 ? line.debit : -line.credit
      iif += `TRNS\t\tGENERAL JOURNAL\t${formattedDate}\t${line.accountName}\t\t${amount.toFixed(2)}\t${entry.description}\n`
    }
    iif += 'ENDTRNS\n'
  }

  return iif
}

/**
 * Calculate GL Summary by Account
 */
export function summarizeByAccount(entries: JournalEntry[]): Array<{
  account: string
  accountName: string
  totalDebit: number
  totalCredit: number
  netAmount: number
}> {

  const accountMap = new Map<string, {
    account: string
    accountName: string
    totalDebit: number
    totalCredit: number
  }>()

  for (const entry of entries) {
    for (const line of entry.lines) {
      if (!accountMap.has(line.account)) {
        accountMap.set(line.account, {
          account: line.account,
          accountName: line.accountName,
          totalDebit: 0,
          totalCredit: 0
        })
      }

      const account = accountMap.get(line.account)!
      account.totalDebit += line.debit
      account.totalCredit += line.credit
    }
  }

  return Array.from(accountMap.values())
    .map(acc => ({
      ...acc,
      netAmount: acc.totalDebit - acc.totalCredit
    }))
    .sort((a, b) => a.account.localeCompare(b.account))
}

/**
 * Validate Journal Entry Balance
 */
export function validateEntry(entry: JournalEntry): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  // Check that debits equal credits
  if (Math.abs(entry.totalDebit - entry.totalCredit) > 0.01) {
    errors.push(`Entry is not balanced: Debit ${entry.totalDebit} != Credit ${entry.totalCredit}`)
  }

  // Check that we have at least 2 lines
  if (entry.lines.length < 2) {
    errors.push('Entry must have at least 2 lines (double-entry accounting)')
  }

  // Check that at least one debit and one credit
  const hasDebit = entry.lines.some(l => l.debit > 0)
  const hasCredit = entry.lines.some(l => l.credit > 0)
  if (!hasDebit || !hasCredit) {
    errors.push('Entry must have both debit and credit lines')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
