/**
 * Accounting Integration Module
 *
 * Connects POS transactions to Chart of Accounts
 * Creates automatic journal entries for:
 * - Sales (cash and credit)
 * - Purchases
 * - Payments received from customers
 * - Payments made to suppliers
 *
 * FOR NON-ACCOUNTANTS:
 * This file automatically creates accounting entries when you:
 * - Make a sale (cash or credit)
 * - Buy inventory from suppliers
 * - Collect money from customers
 * - Pay suppliers
 */

import { prisma } from './prisma'
import { getAccountByCode } from './chartOfAccounts'

/**
 * Create journal entry for a CASH SALE
 *
 * WHAT HAPPENS:
 * - Cash account increases (you received money)
 * - Sales Revenue increases (you made a sale)
 * - COGS increases (expense for products sold)
 * - Inventory decreases (products left the store)
 */
export async function recordCashSale(params: {
  businessId: number
  userId: number
  saleId: number
  saleDate: Date
  totalAmount: number
  costOfGoodsSold: number
  invoiceNumber: string
}) {
  const { businessId, userId, saleId, saleDate, totalAmount, costOfGoodsSold, invoiceNumber } = params

  // Get accounts
  const cashAccount = await getAccountByCode(businessId, '1000') // Cash
  const revenueAccount = await getAccountByCode(businessId, '4000') // Sales Revenue
  const cogsAccount = await getAccountByCode(businessId, '5000') // COGS
  const inventoryAccount = await getAccountByCode(businessId, '1200') // Inventory

  if (!cashAccount || !revenueAccount || !cogsAccount || !inventoryAccount) {
    throw new Error('Required accounts not found. Please initialize Chart of Accounts first.')
  }

  // Create journal entry
  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      entryDate: saleDate,
      description: `Cash Sale - Invoice ${invoiceNumber}`,
      referenceNumber: invoiceNumber,
      sourceType: 'sale',
      sourceId: saleId,
      status: 'posted',
      balanced: true,
      createdBy: userId,
      lines: {
        create: [
          // DR: Cash (receive money)
          {
            accountId: cashAccount.id,
            debit: totalAmount,
            credit: 0,
            description: 'Cash received from customer'
          },
          // CR: Sales Revenue (record sale)
          {
            accountId: revenueAccount.id,
            debit: 0,
            credit: totalAmount,
            description: 'Sales revenue'
          },
          // DR: COGS (expense for products sold)
          {
            accountId: cogsAccount.id,
            debit: costOfGoodsSold,
            credit: 0,
            description: 'Cost of goods sold'
          },
          // CR: Inventory (reduce inventory value)
          {
            accountId: inventoryAccount.id,
            debit: 0,
            credit: costOfGoodsSold,
            description: 'Inventory reduction'
          }
        ]
      }
    },
    include: { lines: true }
  })

  // Update account balances
  await updateAccountBalance(cashAccount.id, totalAmount, 0) // Cash increases
  await updateAccountBalance(revenueAccount.id, 0, totalAmount) // Revenue increases
  await updateAccountBalance(cogsAccount.id, costOfGoodsSold, 0) // COGS increases
  await updateAccountBalance(inventoryAccount.id, 0, costOfGoodsSold) // Inventory decreases

  return entry
}

/**
 * Create journal entry for a CREDIT SALE (Charge Invoice)
 *
 * WHAT HAPPENS:
 * - Accounts Receivable increases (customer owes you money)
 * - Sales Revenue increases (you made a sale)
 * - COGS increases (expense for products sold)
 * - Inventory decreases (products left the store)
 *
 * DIFFERENCE FROM CASH SALE:
 * Instead of receiving Cash, you record Accounts Receivable
 * (customer promises to pay later)
 */
export async function recordCreditSale(params: {
  businessId: number
  userId: number
  saleId: number
  saleDate: Date
  totalAmount: number
  costOfGoodsSold: number
  invoiceNumber: string
  customerId?: number
}) {
  const { businessId, userId, saleId, saleDate, totalAmount, costOfGoodsSold, invoiceNumber } = params

  // Get accounts
  const arAccount = await getAccountByCode(businessId, '1100') // Accounts Receivable
  const revenueAccount = await getAccountByCode(businessId, '4000') // Sales Revenue
  const cogsAccount = await getAccountByCode(businessId, '5000') // COGS
  const inventoryAccount = await getAccountByCode(businessId, '1200') // Inventory

  if (!arAccount || !revenueAccount || !cogsAccount || !inventoryAccount) {
    throw new Error('Required accounts not found. Please initialize Chart of Accounts first.')
  }

  // Create journal entry
  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      entryDate: saleDate,
      description: `Credit Sale - Invoice ${invoiceNumber}`,
      referenceNumber: invoiceNumber,
      sourceType: 'sale',
      sourceId: saleId,
      status: 'posted',
      balanced: true,
      createdBy: userId,
      lines: {
        create: [
          // DR: Accounts Receivable (customer owes us)
          {
            accountId: arAccount.id,
            debit: totalAmount,
            credit: 0,
            description: 'Amount owed by customer'
          },
          // CR: Sales Revenue (record sale)
          {
            accountId: revenueAccount.id,
            debit: 0,
            credit: totalAmount,
            description: 'Sales revenue'
          },
          // DR: COGS (expense for products sold)
          {
            accountId: cogsAccount.id,
            debit: costOfGoodsSold,
            credit: 0,
            description: 'Cost of goods sold'
          },
          // CR: Inventory (reduce inventory value)
          {
            accountId: inventoryAccount.id,
            debit: 0,
            credit: costOfGoodsSold,
            description: 'Inventory reduction'
          }
        ]
      }
    },
    include: { lines: true }
  })

  // Update account balances
  await updateAccountBalance(arAccount.id, totalAmount, 0) // AR increases
  await updateAccountBalance(revenueAccount.id, 0, totalAmount) // Revenue increases
  await updateAccountBalance(cogsAccount.id, costOfGoodsSold, 0) // COGS increases
  await updateAccountBalance(inventoryAccount.id, 0, costOfGoodsSold) // Inventory decreases

  return entry
}

/**
 * Record PAYMENT RECEIVED from customer
 *
 * WHAT HAPPENS:
 * - Cash increases (you received money)
 * - Accounts Receivable decreases (customer no longer owes you)
 *
 * USE WHEN:
 * Customer pays an outstanding invoice (credit sale)
 */
export async function recordCustomerPayment(params: {
  businessId: number
  userId: number
  paymentId: number
  paymentDate: Date
  amount: number
  referenceNumber?: string
  customerId?: number
}) {
  const { businessId, userId, paymentId, paymentDate, amount, referenceNumber } = params

  // Get accounts
  const cashAccount = await getAccountByCode(businessId, '1000') // Cash
  const arAccount = await getAccountByCode(businessId, '1100') // Accounts Receivable

  if (!cashAccount || !arAccount) {
    throw new Error('Required accounts not found.')
  }

  // Create journal entry
  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      entryDate: paymentDate,
      description: `Payment Received${referenceNumber ? ` - ${referenceNumber}` : ''}`,
      referenceNumber: referenceNumber || null,
      sourceType: 'payment_received',
      sourceId: paymentId,
      status: 'posted',
      balanced: true,
      createdBy: userId,
      lines: {
        create: [
          // DR: Cash (receive money)
          {
            accountId: cashAccount.id,
            debit: amount,
            credit: 0,
            description: 'Cash received from customer'
          },
          // CR: Accounts Receivable (customer owes less)
          {
            accountId: arAccount.id,
            debit: 0,
            credit: amount,
            description: 'Customer payment applied'
          }
        ]
      }
    },
    include: { lines: true }
  })

  // Update account balances
  await updateAccountBalance(cashAccount.id, amount, 0) // Cash increases
  await updateAccountBalance(arAccount.id, 0, amount) // AR decreases

  return entry
}

/**
 * Record PURCHASE from supplier
 *
 * WHAT HAPPENS:
 * - Inventory increases (you received products)
 * - Accounts Payable increases (you owe supplier money)
 *
 * USE WHEN:
 * You receive inventory from a supplier on credit
 * (you'll pay them later)
 */
export async function recordPurchase(params: {
  businessId: number
  userId: number
  purchaseId: number
  purchaseDate: Date
  totalCost: number
  referenceNumber?: string
  supplierId?: number
}) {
  const { businessId, userId, purchaseId, purchaseDate, totalCost, referenceNumber } = params

  // Get accounts
  const inventoryAccount = await getAccountByCode(businessId, '1200') // Inventory
  const apAccount = await getAccountByCode(businessId, '2000') // Accounts Payable

  if (!inventoryAccount || !apAccount) {
    throw new Error('Required accounts not found.')
  }

  // Create journal entry
  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      entryDate: purchaseDate,
      description: `Purchase from Supplier${referenceNumber ? ` - ${referenceNumber}` : ''}`,
      referenceNumber: referenceNumber || null,
      sourceType: 'purchase',
      sourceId: purchaseId,
      status: 'posted',
      balanced: true,
      createdBy: userId,
      lines: {
        create: [
          // DR: Inventory (receive products)
          {
            accountId: inventoryAccount.id,
            debit: totalCost,
            credit: 0,
            description: 'Inventory received'
          },
          // CR: Accounts Payable (owe supplier)
          {
            accountId: apAccount.id,
            debit: 0,
            credit: totalCost,
            description: 'Amount owed to supplier'
          }
        ]
      }
    },
    include: { lines: true }
  })

  // Update account balances
  await updateAccountBalance(inventoryAccount.id, totalCost, 0) // Inventory increases
  await updateAccountBalance(apAccount.id, 0, totalCost) // AP increases

  return entry
}

/**
 * Record PAYMENT to supplier
 *
 * WHAT HAPPENS:
 * - Accounts Payable decreases (you owe less)
 * - Cash decreases (you paid money)
 *
 * USE WHEN:
 * You pay a supplier for inventory purchased on credit
 */
export async function recordSupplierPayment(params: {
  businessId: number
  userId: number
  paymentId: number
  paymentDate: Date
  amount: number
  referenceNumber?: string
  supplierId?: number
}) {
  const { businessId, userId, paymentId, paymentDate, amount, referenceNumber } = params

  // Get accounts
  const apAccount = await getAccountByCode(businessId, '2000') // Accounts Payable
  const cashAccount = await getAccountByCode(businessId, '1000') // Cash

  if (!apAccount || !cashAccount) {
    throw new Error('Required accounts not found.')
  }

  // Create journal entry
  const entry = await prisma.journalEntry.create({
    data: {
      businessId,
      entryDate: paymentDate,
      description: `Payment to Supplier${referenceNumber ? ` - ${referenceNumber}` : ''}`,
      referenceNumber: referenceNumber || null,
      sourceType: 'payment_made',
      sourceId: paymentId,
      status: 'posted',
      balanced: true,
      createdBy: userId,
      lines: {
        create: [
          // DR: Accounts Payable (reduce amount owed)
          {
            accountId: apAccount.id,
            debit: amount,
            credit: 0,
            description: 'Payment to supplier'
          },
          // CR: Cash (pay money)
          {
            accountId: cashAccount.id,
            debit: 0,
            credit: amount,
            description: 'Cash paid'
          }
        ]
      }
    },
    include: { lines: true }
  })

  // Update account balances
  await updateAccountBalance(apAccount.id, amount, 0) // AP decreases
  await updateAccountBalance(cashAccount.id, 0, amount) // Cash decreases

  return entry
}

/**
 * Helper function to update account balances
 */
async function updateAccountBalance(accountId: number, debitAmount: number, creditAmount: number) {
  const account = await prisma.chartOfAccounts.findUnique({
    where: { id: accountId }
  })

  if (!account) return

  // Calculate balance change based on account type
  let balanceChange = 0
  if (account.normalBalance === 'debit') {
    // For debit accounts (Assets, Expenses): Debit increases, Credit decreases
    balanceChange = debitAmount - creditAmount
  } else {
    // For credit accounts (Liabilities, Equity, Revenue): Credit increases, Debit decreases
    balanceChange = creditAmount - debitAmount
  }

  // Update account
  await prisma.chartOfAccounts.update({
    where: { id: accountId },
    data: {
      currentBalance: { increment: balanceChange },
      ytdDebit: { increment: debitAmount },
      ytdCredit: { increment: creditAmount }
    }
  })
}

/**
 * Check if accounting is enabled for a business
 */
export async function isAccountingEnabled(businessId: number): Promise<boolean> {
  const accountCount = await prisma.chartOfAccounts.count({
    where: { businessId }
  })
  return accountCount > 0
}

/**
 * Get accounting summary for a transaction
 * (for displaying to user what accounting entries will be created)
 */
export function getAccountingPreview(type: 'cash_sale' | 'credit_sale' | 'purchase' | 'payment_received' | 'payment_made', params: {
  amount: number
  cogs?: number
}) {
  const previews = {
    cash_sale: [
      { account: 'Cash', debit: params.amount, credit: 0, explanation: 'Money received' },
      { account: 'Sales Revenue', debit: 0, credit: params.amount, explanation: 'Sale recorded' },
      { account: 'COGS', debit: params.cogs || 0, credit: 0, explanation: 'Product cost' },
      { account: 'Inventory', debit: 0, credit: params.cogs || 0, explanation: 'Inventory reduced' }
    ],
    credit_sale: [
      { account: 'Accounts Receivable', debit: params.amount, credit: 0, explanation: 'Customer owes' },
      { account: 'Sales Revenue', debit: 0, credit: params.amount, explanation: 'Sale recorded' },
      { account: 'COGS', debit: params.cogs || 0, credit: 0, explanation: 'Product cost' },
      { account: 'Inventory', debit: 0, credit: params.cogs || 0, explanation: 'Inventory reduced' }
    ],
    purchase: [
      { account: 'Inventory', debit: params.amount, credit: 0, explanation: 'Products received' },
      { account: 'Accounts Payable', debit: 0, credit: params.amount, explanation: 'Owe supplier' }
    ],
    payment_received: [
      { account: 'Cash', debit: params.amount, credit: 0, explanation: 'Money received' },
      { account: 'Accounts Receivable', debit: 0, credit: params.amount, explanation: 'Customer paid' }
    ],
    payment_made: [
      { account: 'Accounts Payable', debit: params.amount, credit: 0, explanation: 'Reduce debt' },
      { account: 'Cash', debit: 0, credit: params.amount, explanation: 'Money paid' }
    ]
  }

  return previews[type] || []
}
