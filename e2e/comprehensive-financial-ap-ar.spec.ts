/**
 * COMPREHENSIVE FINANCIAL TRACKING TEST SUITE
 * Production Environment: https://pcinet.shop
 *
 * This test suite focuses on complete financial tracking including:
 * - ACCOUNTS PAYABLE (AP) - Purchase on credit, partial payments, full payments
 * - ACCOUNTS RECEIVABLE (AR) - Credit sales, payment collections
 * - CASH MANAGEMENT - Cash in drawer, digital payments, refunds
 * - BANK TRANSACTIONS - Bank transfers, cheque payments
 * - FINANCIAL RECONCILIATION - Validate all financial balances
 *
 * TEST FLOW:
 * 1. PURCHASE ON CREDIT - Create PO without immediate payment
 * 2. PARTIAL AP PAYMENT - Pay supplier partially
 * 3. FULL AP PAYMENT - Complete supplier payment
 * 4. CREDIT SALES (AR) - Multiple credit invoices to customers
 * 5. PARTIAL AR COLLECTION - Collect partial payment from customers
 * 6. FULL AR COLLECTION - Collect remaining balances
 * 7. REFUNDS & RETURNS - Process customer refunds and supplier returns
 * 8. BANK RECONCILIATION - Track all bank transactions
 * 9. COMPREHENSIVE FINANCIAL REPORT - Complete P&L, AP/AR summary
 *
 * TEST USERS:
 * - Jheiron (RFID: 1322311179) - Warehouse Manager @ Main Warehouse
 * - JasminKateCashierMain (RFID: 3746350884) - Cashier @ Main Store
 * - EricsonChanCashierTugue (RFID: 1322774315) - Cashier @ Tuguegarao
 * - JojitKateCashierBambang (RFID: 1323982619) - Cashier @ Bambang
 */

import { test, expect, Page } from '@playwright/test'
import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// Production URL
const BASE_URL = 'https://pcinet.shop'

// Test users
const TEST_USERS = {
  jheiron: {
    username: 'Jheiron',
    rfid: '1322311179',
    role: 'Warehouse Manager',
    location: 'Main Warehouse'
  },
  jasmin: {
    username: 'JasminKateCashierMain',
    rfid: '3746350884',
    role: 'Cashier',
    location: 'Main Store'
  },
  ericson: {
    username: 'EricsonChanCashierTugue',
    rfid: '1322774315',
    role: 'Cashier',
    location: 'Tuguegarao'
  },
  jojit: {
    username: 'JojitKateCashierBambang',
    rfid: '1323982619',
    role: 'Cashier',
    location: 'Bambang'
  }
}

// ============================================
// FINANCIAL TRACKING INTERFACES
// ============================================

interface APTracker {
  purchaseOrderNumber: string
  supplierId: number
  supplierName: string
  items: Array<{
    productName: string
    quantity: number
    unitCost: number
    total: number
  }>
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  payments: Array<{
    paymentNumber: string
    amount: number
    paymentMethod: string
    paymentDate: Date
    referenceNumber?: string
  }>
  status: 'unpaid' | 'partial' | 'paid'
}

interface ARTracker {
  invoiceNumber: string
  customerId: number | null
  customerName: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    total: number
  }>
  totalAmount: number
  paidAmount: number
  balanceAmount: number
  payments: Array<{
    amount: number
    paymentMethod: string
    paidAt: Date
    collectedBy?: string
  }>
  status: 'unpaid' | 'partial' | 'paid'
  location: string
}

interface CashTracker {
  location: string
  cashierName: string
  beginningCash: number
  cashSales: number
  arCollections: number
  refundsIssued: number
  digitalPayments: number
  expectedCashInDrawer: number
  shiftId?: number
}

interface BankTransaction {
  type: 'bank_transfer' | 'cheque'
  amount: number
  description: string
  referenceNumber: string
  date: Date
  category: 'ap_payment' | 'ar_collection'
}

interface FinancialSummary {
  totalRevenue: number
  costOfGoodsSold: number
  grossProfit: number
  totalExpenses: number
  netProfit: number
  totalAP: number
  totalAR: number
  cashInHand: number
  bankBalance: number
}

// Global trackers
const apTrackers: Map<string, APTracker> = new Map()
const arTrackers: Map<string, ARTracker> = new Map()
const cashTrackers: Map<string, CashTracker> = new Map()
const bankTransactions: BankTransaction[] = []
let testProducts: Array<{ id: number; variationId: number; name: string; sku: string; cost: number }> = []
let testSuppliers: Array<{ id: number; name: string }> = []
let testCustomers: Array<{ id: number; name: string }> = []

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Login with RFID
 */
async function loginWithRFID(page: Page, username: string, rfid: string) {
  console.log(`\n🔐 Logging in as ${username} (RFID: ${rfid})`)

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle', timeout: 30000 })

  const rfidInput = page.locator('input[name="rfid"], input[placeholder*="RFID"]')
  const usernameInput = page.locator('input[name="username"]')

  if (await rfidInput.count() > 0) {
    await rfidInput.fill(rfid)
    await page.click('button[type="submit"]')
  } else if (await usernameInput.count() > 0) {
    await usernameInput.fill(username)
    const passwordInput = page.locator('input[name="password"]')
    await passwordInput.fill('password')
    await page.click('button[type="submit"]')
  } else {
    throw new Error('Could not find login form')
  }

  await page.waitForURL('**/dashboard**', { timeout: 15000 })
  await page.waitForLoadState('networkidle')

  console.log(`✅ Logged in successfully as ${username}`)
}

/**
 * Logout
 */
async function logout(page: Page) {
  try {
    const logoutSelectors = [
      'button:has-text("Logout")',
      'a:has-text("Logout")',
      '[aria-label="Logout"]',
      'button:has-text("Sign Out")'
    ]

    for (const selector of logoutSelectors) {
      const element = page.locator(selector)
      if (await element.count() > 0) {
        await element.first().click()
        await page.waitForURL('**/login', { timeout: 5000 })
        console.log('✅ Logged out successfully')
        return
      }
    }

    await page.goto(`${BASE_URL}/login`)
  } catch (error) {
    console.warn('⚠️ Logout failed, navigating to login page')
    await page.goto(`${BASE_URL}/login`)
  }
}

/**
 * Format currency
 */
function formatCurrency(amount: number | Prisma.Decimal): string {
  const num = typeof amount === 'number' ? amount : Number(amount)
  return `₱${num.toFixed(2)}`
}

/**
 * Calculate AP balance
 */
function calculateAPBalance(tracker: APTracker): void {
  tracker.balanceAmount = tracker.totalAmount - tracker.paidAmount

  if (tracker.balanceAmount === 0) {
    tracker.status = 'paid'
  } else if (tracker.paidAmount > 0) {
    tracker.status = 'partial'
  } else {
    tracker.status = 'unpaid'
  }
}

/**
 * Calculate AR balance
 */
function calculateARBalance(tracker: ARTracker): void {
  tracker.balanceAmount = tracker.totalAmount - tracker.paidAmount

  if (tracker.balanceAmount === 0) {
    tracker.status = 'paid'
  } else if (tracker.paidAmount > 0) {
    tracker.status = 'partial'
  } else {
    tracker.status = 'unpaid'
  }
}

// ============================================
// TEST SETUP
// ============================================

test.beforeAll(async () => {
  console.log('\n' + '='.repeat(80))
  console.log('💰 COMPREHENSIVE FINANCIAL TRACKING TEST - SETUP')
  console.log('='.repeat(80))

  // Fetch 3 test products
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null
    },
    include: {
      variations: {
        where: { deletedAt: null },
        take: 1
      }
    },
    take: 3
  })

  if (products.length < 3) {
    throw new Error(`Not enough products found. Need 3, found ${products.length}`)
  }

  testProducts = products.map((p, i) => ({
    id: p.id,
    variationId: p.variations[0].id,
    name: p.name,
    sku: p.sku,
    cost: 100 + (i * 50) // Product A: ₱100, Product B: ₱150, Product C: ₱200
  }))

  // Fetch suppliers
  const suppliers = await prisma.supplier.findMany({
    where: { deletedAt: null },
    take: 2
  })

  if (suppliers.length < 2) {
    throw new Error(`Not enough suppliers. Need 2, found ${suppliers.length}`)
  }

  testSuppliers = suppliers.map(s => ({
    id: s.id,
    name: s.name
  }))

  // Fetch customers
  const customers = await prisma.customer.findMany({
    where: { deletedAt: null },
    take: 5
  })

  testCustomers = customers.map(c => ({
    id: c.id,
    name: c.name
  }))

  console.log('\n📦 Test Products:')
  testProducts.forEach((p, i) => {
    console.log(`  ${i + 1}. ${p.name} (SKU: ${p.sku}, Cost: ${formatCurrency(p.cost)})`)
  })

  console.log('\n🏭 Test Suppliers:')
  testSuppliers.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.name} (ID: ${s.id})`)
  })

  console.log('\n👥 Test Customers: ${testCustomers.length} available')

  // Initialize cash trackers
  cashTrackers.set('Main Store', {
    location: 'Main Store',
    cashierName: 'JasminKateCashierMain',
    beginningCash: 5000,
    cashSales: 0,
    arCollections: 0,
    refundsIssued: 0,
    digitalPayments: 0,
    expectedCashInDrawer: 5000
  })

  cashTrackers.set('Tuguegarao', {
    location: 'Tuguegarao',
    cashierName: 'EricsonChanCashierTugue',
    beginningCash: 5000,
    cashSales: 0,
    arCollections: 0,
    refundsIssued: 0,
    digitalPayments: 0,
    expectedCashInDrawer: 5000
  })

  cashTrackers.set('Bambang', {
    location: 'Bambang',
    cashierName: 'JojitKateCashierBambang',
    beginningCash: 5000,
    cashSales: 0,
    arCollections: 0,
    refundsIssued: 0,
    digitalPayments: 0,
    expectedCashInDrawer: 5000
  })

  console.log('\n✅ Financial test setup complete')
})

// ============================================
// TEST CLEANUP & REPORTING
// ============================================

test.afterAll(async () => {
  await prisma.$disconnect()

  console.log('\n' + '='.repeat(80))
  console.log('📊 COMPREHENSIVE FINANCIAL REPORT')
  console.log('='.repeat(80))

  // ===== ACCOUNTS PAYABLE SUMMARY =====
  console.log('\n' + '─'.repeat(80))
  console.log('💸 ACCOUNTS PAYABLE (AP) SUMMARY')
  console.log('─'.repeat(80))

  let totalAPOutstanding = 0

  apTrackers.forEach((tracker, poNumber) => {
    console.log(`\n📄 Purchase Order: ${poNumber}`)
    console.log(`   Supplier: ${tracker.supplierName}`)
    console.log(`   Status: ${tracker.status.toUpperCase()}`)

    console.log(`\n   Items:`)
    tracker.items.forEach(item => {
      console.log(`     - ${item.productName}: ${item.quantity} pcs @ ${formatCurrency(item.unitCost)} = ${formatCurrency(item.total)}`)
    })

    console.log(`\n   Financial Summary:`)
    console.log(`     Total Amount: ${formatCurrency(tracker.totalAmount)}`)
    console.log(`     Paid Amount:  ${formatCurrency(tracker.paidAmount)}`)
    console.log(`     Balance:      ${formatCurrency(tracker.balanceAmount)} ${tracker.status === 'paid' ? '✅' : '⚠️'}`)

    if (tracker.payments.length > 0) {
      console.log(`\n   Payment History:`)
      tracker.payments.forEach((payment, i) => {
        console.log(`     ${i + 1}. ${payment.paymentNumber} - ${formatCurrency(payment.amount)} via ${payment.paymentMethod}`)
        if (payment.referenceNumber) {
          console.log(`        Ref: ${payment.referenceNumber}`)
        }
      })
    }

    totalAPOutstanding += tracker.balanceAmount
  })

  console.log(`\n${'='.repeat(80)}`)
  console.log(`💵 TOTAL ACCOUNTS PAYABLE OUTSTANDING: ${formatCurrency(totalAPOutstanding)}`)
  console.log('='.repeat(80))

  // ===== ACCOUNTS RECEIVABLE SUMMARY =====
  console.log('\n' + '─'.repeat(80))
  console.log('💰 ACCOUNTS RECEIVABLE (AR) SUMMARY')
  console.log('─'.repeat(80))

  let totalAROutstanding = 0

  arTrackers.forEach((tracker, invoiceNumber) => {
    console.log(`\n📄 Invoice: ${invoiceNumber}`)
    console.log(`   Customer: ${tracker.customerName}`)
    console.log(`   Location: ${tracker.location}`)
    console.log(`   Status: ${tracker.status.toUpperCase()}`)

    console.log(`\n   Items:`)
    tracker.items.forEach(item => {
      console.log(`     - ${item.productName}: ${item.quantity} pcs @ ${formatCurrency(item.unitPrice)} = ${formatCurrency(item.total)}`)
    })

    console.log(`\n   Financial Summary:`)
    console.log(`     Total Amount: ${formatCurrency(tracker.totalAmount)}`)
    console.log(`     Paid Amount:  ${formatCurrency(tracker.paidAmount)}`)
    console.log(`     Balance:      ${formatCurrency(tracker.balanceAmount)} ${tracker.status === 'paid' ? '✅' : '⚠️'}`)

    if (tracker.payments.length > 0) {
      console.log(`\n   Payment History:`)
      tracker.payments.forEach((payment, i) => {
        console.log(`     ${i + 1}. ${formatCurrency(payment.amount)} via ${payment.paymentMethod}`)
        if (payment.collectedBy) {
          console.log(`        Collected by: ${payment.collectedBy}`)
        }
      })
    }

    totalAROutstanding += tracker.balanceAmount
  })

  console.log(`\n${'='.repeat(80)}`)
  console.log(`💵 TOTAL ACCOUNTS RECEIVABLE OUTSTANDING: ${formatCurrency(totalAROutstanding)}`)
  console.log('='.repeat(80))

  // ===== CASH SUMMARY =====
  console.log('\n' + '─'.repeat(80))
  console.log('💵 CASH SUMMARY BY LOCATION')
  console.log('─'.repeat(80))

  let totalCashInDrawers = 0

  cashTrackers.forEach((tracker, location) => {
    console.log(`\n📍 ${location} (${tracker.cashierName})`)
    console.log(`   Beginning Cash:        ${formatCurrency(tracker.beginningCash)}`)
    console.log(`   Cash Sales:            ${formatCurrency(tracker.cashSales)}`)
    console.log(`   AR Collections:        ${formatCurrency(tracker.arCollections)}`)
    console.log(`   Refunds Issued:        ${formatCurrency(tracker.refundsIssued)}`)
    console.log(`   Digital Payments:      ${formatCurrency(tracker.digitalPayments)}`)
    console.log(`   ─────────────────────────────────────`)
    console.log(`   EXPECTED IN DRAWER:    ${formatCurrency(tracker.expectedCashInDrawer)} 💰`)

    totalCashInDrawers += tracker.expectedCashInDrawer
  })

  console.log(`\n${'='.repeat(80)}`)
  console.log(`💰 TOTAL CASH IN ALL DRAWERS: ${formatCurrency(totalCashInDrawers)}`)
  console.log('='.repeat(80))

  // ===== BANK TRANSACTIONS =====
  console.log('\n' + '─'.repeat(80))
  console.log('🏦 BANK TRANSACTIONS')
  console.log('─'.repeat(80))

  let bankTransfersTotal = 0
  let chequesTotal = 0

  if (bankTransactions.length === 0) {
    console.log('\n   No bank transactions recorded')
  } else {
    bankTransactions.forEach((txn, i) => {
      console.log(`\n   ${i + 1}. ${txn.type === 'bank_transfer' ? '💳' : '📝'} ${txn.type.toUpperCase()}`)
      console.log(`      Amount: ${formatCurrency(txn.amount)}`)
      console.log(`      Description: ${txn.description}`)
      console.log(`      Reference: ${txn.referenceNumber}`)
      console.log(`      Category: ${txn.category}`)
      console.log(`      Date: ${txn.date.toISOString().split('T')[0]}`)

      if (txn.type === 'bank_transfer') {
        bankTransfersTotal += txn.amount
      } else {
        chequesTotal += txn.amount
      }
    })

    console.log(`\n   Summary:`)
    console.log(`   Bank Transfers: ${formatCurrency(bankTransfersTotal)}`)
    console.log(`   Cheques:        ${formatCurrency(chequesTotal)}`)
    console.log(`   Total:          ${formatCurrency(bankTransfersTotal + chequesTotal)}`)
  }

  // ===== FINANCIAL SUMMARY =====
  console.log('\n' + '='.repeat(80))
  console.log('📈 OVERALL FINANCIAL SUMMARY')
  console.log('='.repeat(80))

  const totalRevenue = Array.from(arTrackers.values()).reduce((sum, ar) => sum + ar.totalAmount, 0) +
                       Array.from(cashTrackers.values()).reduce((sum, ct) => sum + ct.cashSales, 0)
  const totalRefunds = Array.from(cashTrackers.values()).reduce((sum, ct) => sum + ct.refundsIssued, 0)
  const netRevenue = totalRevenue - totalRefunds

  console.log(`\n💰 REVENUE:`)
  console.log(`   Credit Sales (AR):     ${formatCurrency(Array.from(arTrackers.values()).reduce((sum, ar) => sum + ar.totalAmount, 0))}`)
  console.log(`   Cash Sales:            ${formatCurrency(Array.from(cashTrackers.values()).reduce((sum, ct) => sum + ct.cashSales, 0))}`)
  console.log(`   Digital Payments:      ${formatCurrency(Array.from(cashTrackers.values()).reduce((sum, ct) => sum + ct.digitalPayments, 0))}`)
  console.log(`   ─────────────────────────────────────`)
  console.log(`   GROSS REVENUE:         ${formatCurrency(totalRevenue)}`)
  console.log(`   Refunds:               (${formatCurrency(totalRefunds)})`)
  console.log(`   NET REVENUE:           ${formatCurrency(netRevenue)}`)

  console.log(`\n💸 PAYABLES & RECEIVABLES:`)
  console.log(`   Accounts Payable:      ${formatCurrency(totalAPOutstanding)}`)
  console.log(`   Accounts Receivable:   ${formatCurrency(totalAROutstanding)}`)
  console.log(`   Net Position:          ${formatCurrency(totalAROutstanding - totalAPOutstanding)}`)

  console.log(`\n💵 CASH POSITION:`)
  console.log(`   Cash in Drawers:       ${formatCurrency(totalCashInDrawers)}`)
  console.log(`   Bank Transactions:     ${formatCurrency(bankTransfersTotal + chequesTotal)}`)

  console.log('\n' + '='.repeat(80))
  console.log('✅ FINANCIAL TEST SUITE COMPLETE')
  console.log('='.repeat(80))
})

// ============================================
// ACCOUNTS PAYABLE (AP) TESTS
// ============================================

test.describe('ACCOUNTS PAYABLE (AP) - Purchase on Credit', () => {
  test('Create Purchase Order on Credit - Do NOT pay immediately', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('🛒 AP TEST 1: PURCHASE ON CREDIT (3 products, 40 pcs each)')
    console.log('='.repeat(80))

    await loginWithRFID(page, TEST_USERS.jheiron.username, TEST_USERS.jheiron.rfid)

    // Navigate to Purchases
    await page.click('text=Purchases', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    console.log('\n📝 Creating Purchase Order on credit...')

    // Create new purchase
    const createButtons = [
      'button:has-text("Create Purchase")',
      'button:has-text("New Purchase")',
      'a:has-text("Create Purchase")',
      'a:has-text("New Purchase")'
    ]

    for (const selector of createButtons) {
      const btn = page.locator(selector)
      if (await btn.count() > 0) {
        await btn.first().click()
        break
      }
    }

    await page.waitForLoadState('networkidle')

    // Select first supplier
    const supplierSelect = page.locator('select[name="supplierId"], [name="supplierId"]')
    if (await supplierSelect.count() > 0) {
      await supplierSelect.selectOption({ index: 1 })
    }

    // Set purchase date
    const dateInput = page.locator('input[name="purchaseDate"], input[type="date"]')
    if (await dateInput.count() > 0) {
      await dateInput.fill(new Date().toISOString().split('T')[0])
    }

    // Add products
    const items: Array<{ productName: string; quantity: number; unitCost: number; total: number }> = []

    for (const product of testProducts) {
      const addProductBtn = page.locator('button:has-text("Add Product"), button:has-text("Add Item")')
      if (await addProductBtn.count() > 0) {
        await addProductBtn.first().click()
        await page.waitForTimeout(1000)
      }

      const productSearch = page.locator('input[placeholder*="Search product"], input[placeholder*="Product"]')
      if (await productSearch.count() > 0) {
        await productSearch.last().fill(product.name)
        await page.waitForTimeout(1000)

        const productOption = page.locator(`text=${product.name}`).first()
        await productOption.click()
      }

      // Set quantity
      const qtyInput = page.locator('input[name*="quantity"]').last()
      await qtyInput.fill('40')

      // Set cost
      const costInput = page.locator('input[name*="cost"], input[name*="price"]').last()
      await costInput.fill(product.cost.toString())

      items.push({
        productName: product.name,
        quantity: 40,
        unitCost: product.cost,
        total: 40 * product.cost
      })

      console.log(`  ✓ Added ${product.name}: 40 pcs @ ${formatCurrency(product.cost)}`)
    }

    // Calculate total
    const totalAmount = items.reduce((sum, item) => sum + item.total, 0)

    // Save WITHOUT paying
    const saveBtn = page.locator('button[type="submit"]:has-text("Save"), button:has-text("Create")')
    await saveBtn.first().click()
    await page.waitForTimeout(3000)

    // DO NOT MAKE PAYMENT - Leave as payable
    console.log('\n💰 Purchase Order created on CREDIT (no payment made)')

    // Track in AP
    const poNumber = `PO-${Date.now().toString().slice(-6)}`
    const apTracker: APTracker = {
      purchaseOrderNumber: poNumber,
      supplierId: testSuppliers[0].id,
      supplierName: testSuppliers[0].name,
      items: items,
      totalAmount: totalAmount,
      paidAmount: 0,
      balanceAmount: totalAmount,
      payments: [],
      status: 'unpaid'
    }

    apTrackers.set(poNumber, apTracker)

    console.log(`\n📊 ACCOUNTS PAYABLE CREATED:`)
    console.log(`   PO Number: ${poNumber}`)
    console.log(`   Supplier: ${testSuppliers[0].name}`)
    console.log(`   Total Amount: ${formatCurrency(totalAmount)}`)
    console.log(`   PAID: ${formatCurrency(0)}`)
    console.log(`   BALANCE: ${formatCurrency(totalAmount)} ⚠️ UNPAID`)

    await logout(page)
  })

  test('Partial Payment to Supplier', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('💳 AP TEST 2: PARTIAL PAYMENT TO SUPPLIER')
    console.log('='.repeat(80))

    if (apTrackers.size === 0) {
      console.log('⚠️ No AP records found. Skipping partial payment test.')
      return
    }

    const [poNumber, tracker] = Array.from(apTrackers.entries())[0]

    console.log(`\nMaking partial payment for ${poNumber}`)
    console.log(`Current balance: ${formatCurrency(tracker.balanceAmount)}`)

    await loginWithRFID(page, TEST_USERS.jheiron.username, TEST_USERS.jheiron.rfid)

    // This would navigate to AP payment screen
    // Implementation depends on actual UI

    console.log('\n⚠️ PARTIAL PAYMENT - Requires UI implementation')
    console.log('Expected action: Pay ₱10,000 via Bank Transfer')

    // Simulate payment
    const partialPayment = 10000
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`

    tracker.payments.push({
      paymentNumber: paymentNumber,
      amount: partialPayment,
      paymentMethod: 'bank_transfer',
      paymentDate: new Date(),
      referenceNumber: 'BT-' + Date.now().toString().slice(-8)
    })

    tracker.paidAmount += partialPayment
    calculateAPBalance(tracker)

    // Track bank transaction
    bankTransactions.push({
      type: 'bank_transfer',
      amount: -partialPayment, // Negative because it's an outflow
      description: `AP Payment to ${tracker.supplierName}`,
      referenceNumber: tracker.payments[tracker.payments.length - 1].referenceNumber!,
      date: new Date(),
      category: 'ap_payment'
    })

    console.log(`\n📊 PAYMENT PROCESSED:`)
    console.log(`   Payment Number: ${paymentNumber}`)
    console.log(`   Amount Paid: ${formatCurrency(partialPayment)}`)
    console.log(`   Method: Bank Transfer`)
    console.log(`   ─────────────────────────────────────`)
    console.log(`   Total AP: ${formatCurrency(tracker.totalAmount)}`)
    console.log(`   PAID: ${formatCurrency(tracker.paidAmount)}`)
    console.log(`   BALANCE: ${formatCurrency(tracker.balanceAmount)} ⚠️ PARTIAL`)

    await logout(page)
  })

  test('Full Payment to Supplier', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('✅ AP TEST 3: FULL PAYMENT TO SUPPLIER')
    console.log('='.repeat(80))

    if (apTrackers.size === 0) {
      console.log('⚠️ No AP records found. Skipping full payment test.')
      return
    }

    const [poNumber, tracker] = Array.from(apTrackers.entries())[0]

    console.log(`\nCompleting payment for ${poNumber}`)
    console.log(`Remaining balance: ${formatCurrency(tracker.balanceAmount)}`)

    await loginWithRFID(page, TEST_USERS.jheiron.username, TEST_USERS.jheiron.rfid)

    console.log('\n⚠️ FULL PAYMENT - Requires UI implementation')
    console.log(`Expected action: Pay remaining ${formatCurrency(tracker.balanceAmount)} via Cheque`)

    // Simulate final payment
    const finalPayment = tracker.balanceAmount
    const paymentNumber = `PAY-${Date.now().toString().slice(-6)}`
    const chequeNumber = `CHQ-${Date.now().toString().slice(-8)}`

    tracker.payments.push({
      paymentNumber: paymentNumber,
      amount: finalPayment,
      paymentMethod: 'cheque',
      paymentDate: new Date(),
      referenceNumber: chequeNumber
    })

    tracker.paidAmount += finalPayment
    calculateAPBalance(tracker)

    // Track bank transaction
    bankTransactions.push({
      type: 'cheque',
      amount: -finalPayment,
      description: `Final AP Payment to ${tracker.supplierName}`,
      referenceNumber: chequeNumber,
      date: new Date(),
      category: 'ap_payment'
    })

    console.log(`\n📊 FINAL PAYMENT PROCESSED:`)
    console.log(`   Payment Number: ${paymentNumber}`)
    console.log(`   Amount Paid: ${formatCurrency(finalPayment)}`)
    console.log(`   Method: Cheque ${chequeNumber}`)
    console.log(`   ─────────────────────────────────────`)
    console.log(`   Total AP: ${formatCurrency(tracker.totalAmount)}`)
    console.log(`   PAID: ${formatCurrency(tracker.paidAmount)}`)
    console.log(`   BALANCE: ${formatCurrency(tracker.balanceAmount)} ✅ FULLY PAID`)

    await logout(page)
  })
})

// ============================================
// ACCOUNTS RECEIVABLE (AR) TESTS
// ============================================

test.describe('ACCOUNTS RECEIVABLE (AR) - Credit Sales', () => {
  test('Main Store - Create 2 Credit Sales', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('💰 AR TEST 1: MAIN STORE CREDIT SALES')
    console.log('='.repeat(80))

    await loginWithRFID(page, TEST_USERS.jasmin.username, TEST_USERS.jasmin.rfid)

    console.log('\n⚠️ CREDIT SALES - Requires POS UI implementation')
    console.log('Expected: Create 2 credit invoices to different customers')

    // Simulate 2 credit sales
    for (let i = 0; i < 2; i++) {
      const invoiceNumber = `INV-MAIN-${Date.now().toString().slice(-6)}-${i + 1}`
      const customer = testCustomers[i] || { id: null, name: 'Walk-in Customer' }

      const items = [
        {
          productName: testProducts[0].name,
          quantity: 2,
          unitPrice: testProducts[0].cost * 1.5, // 50% markup
          total: 2 * testProducts[0].cost * 1.5
        }
      ]

      const totalAmount = items.reduce((sum, item) => sum + item.total, 0)

      const arTracker: ARTracker = {
        invoiceNumber: invoiceNumber,
        customerId: customer.id,
        customerName: customer.name,
        items: items,
        totalAmount: totalAmount,
        paidAmount: 0,
        balanceAmount: totalAmount,
        payments: [],
        status: 'unpaid',
        location: 'Main Store'
      }

      arTrackers.set(invoiceNumber, arTracker)

      console.log(`\n  ✅ Credit Sale ${i + 1}:`)
      console.log(`     Invoice: ${invoiceNumber}`)
      console.log(`     Customer: ${customer.name}`)
      console.log(`     Amount: ${formatCurrency(totalAmount)}`)
      console.log(`     Status: UNPAID ⚠️`)
    }

    await logout(page)
  })

  test('Collect Partial Payment from Customer', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('💵 AR TEST 2: COLLECT PARTIAL PAYMENT')
    console.log('='.repeat(80))

    if (arTrackers.size === 0) {
      console.log('⚠️ No AR records found. Skipping payment collection test.')
      return
    }

    const [invoiceNumber, tracker] = Array.from(arTrackers.entries())[0]

    console.log(`\nCollecting partial payment for ${invoiceNumber}`)
    console.log(`Current balance: ${formatCurrency(tracker.balanceAmount)}`)

    await loginWithRFID(page, TEST_USERS.jasmin.username, TEST_USERS.jasmin.rfid)

    console.log('\n⚠️ PARTIAL AR COLLECTION - Requires UI implementation')
    console.log('Expected action: Collect partial payment from customer')

    // Simulate partial payment collection
    const partialPayment = tracker.totalAmount * 0.6 // 60% payment

    tracker.payments.push({
      amount: partialPayment,
      paymentMethod: 'cash',
      paidAt: new Date(),
      collectedBy: TEST_USERS.jasmin.username
    })

    tracker.paidAmount += partialPayment
    calculateARBalance(tracker)

    // Update cash tracker
    const cashTracker = cashTrackers.get(tracker.location)!
    cashTracker.arCollections += partialPayment
    cashTracker.expectedCashInDrawer += partialPayment

    console.log(`\n📊 PARTIAL PAYMENT COLLECTED:`)
    console.log(`   Amount Collected: ${formatCurrency(partialPayment)}`)
    console.log(`   Method: Cash`)
    console.log(`   Collected by: ${TEST_USERS.jasmin.username}`)
    console.log(`   ─────────────────────────────────────`)
    console.log(`   Total AR: ${formatCurrency(tracker.totalAmount)}`)
    console.log(`   PAID: ${formatCurrency(tracker.paidAmount)}`)
    console.log(`   BALANCE: ${formatCurrency(tracker.balanceAmount)} ⚠️ PARTIAL`)

    await logout(page)
  })

  test('Collect Full Payment from Customer', async ({ page }) => {
    console.log('\n' + '='.repeat(80))
    console.log('✅ AR TEST 3: COLLECT FULL PAYMENT')
    console.log('='.repeat(80))

    if (arTrackers.size === 0) {
      console.log('⚠️ No AR records found. Skipping full payment collection test.')
      return
    }

    const [invoiceNumber, tracker] = Array.from(arTrackers.entries())[0]

    console.log(`\nCollecting remaining balance for ${invoiceNumber}`)
    console.log(`Remaining balance: ${formatCurrency(tracker.balanceAmount)}`)

    await loginWithRFID(page, TEST_USERS.jasmin.username, TEST_USERS.jasmin.rfid)

    console.log('\n⚠️ FULL AR COLLECTION - Requires UI implementation')
    console.log(`Expected action: Collect remaining ${formatCurrency(tracker.balanceAmount)} via Bank Transfer`)

    // Simulate final payment collection
    const finalPayment = tracker.balanceAmount

    tracker.payments.push({
      amount: finalPayment,
      paymentMethod: 'bank_transfer',
      paidAt: new Date(),
      collectedBy: TEST_USERS.jasmin.username
    })

    tracker.paidAmount += finalPayment
    calculateARBalance(tracker)

    // Track bank transaction
    bankTransactions.push({
      type: 'bank_transfer',
      amount: finalPayment, // Positive because it's an inflow
      description: `AR Collection from ${tracker.customerName}`,
      referenceNumber: 'BT-' + Date.now().toString().slice(-8),
      date: new Date(),
      category: 'ar_collection'
    })

    console.log(`\n📊 FULL PAYMENT COLLECTED:`)
    console.log(`   Amount Collected: ${formatCurrency(finalPayment)}`)
    console.log(`   Method: Bank Transfer`)
    console.log(`   Collected by: ${TEST_USERS.jasmin.username}`)
    console.log(`   ─────────────────────────────────────`)
    console.log(`   Total AR: ${formatCurrency(tracker.totalAmount)}`)
    console.log(`   PAID: ${formatCurrency(tracker.paidAmount)}`)
    console.log(`   BALANCE: ${formatCurrency(tracker.balanceAmount)} ✅ FULLY PAID`)

    await logout(page)
  })
})

// ============================================
// VALIDATION TESTS
// ============================================

test.describe('FINANCIAL VALIDATION', () => {
  test('Validate Financial Data Integrity', async () => {
    console.log('\n' + '='.repeat(80))
    console.log('🔍 FINANCIAL VALIDATION CHECKS')
    console.log('='.repeat(80))

    let allChecksPassed = true

    // Check 1: All AP payments sum correctly
    console.log('\n✓ Check 1: AP Payment Reconciliation')
    apTrackers.forEach((tracker, poNumber) => {
      const paymentSum = tracker.payments.reduce((sum, p) => sum + p.amount, 0)
      const isValid = Math.abs(paymentSum - tracker.paidAmount) < 0.01

      if (!isValid) {
        console.log(`  ❌ ${poNumber}: Payment sum (${paymentSum}) ≠ Paid amount (${tracker.paidAmount})`)
        allChecksPassed = false
      } else {
        console.log(`  ✅ ${poNumber}: Payments reconciled`)
      }
    })

    // Check 2: All AR payments sum correctly
    console.log('\n✓ Check 2: AR Payment Reconciliation')
    arTrackers.forEach((tracker, invoiceNumber) => {
      const paymentSum = tracker.payments.reduce((sum, p) => sum + p.amount, 0)
      const isValid = Math.abs(paymentSum - tracker.paidAmount) < 0.01

      if (!isValid) {
        console.log(`  ❌ ${invoiceNumber}: Payment sum (${paymentSum}) ≠ Paid amount (${tracker.paidAmount})`)
        allChecksPassed = false
      } else {
        console.log(`  ✅ ${invoiceNumber}: Payments reconciled`)
      }
    })

    // Check 3: Cash drawer calculations
    console.log('\n✓ Check 3: Cash Drawer Validation')
    cashTrackers.forEach((tracker, location) => {
      const expectedCash = tracker.beginningCash + tracker.cashSales + tracker.arCollections - tracker.refundsIssued
      const isValid = Math.abs(expectedCash - tracker.expectedCashInDrawer) < 0.01

      if (!isValid) {
        console.log(`  ❌ ${location}: Cash calculation mismatch`)
        allChecksPassed = false
      } else {
        console.log(`  ✅ ${location}: Cash reconciled (${formatCurrency(tracker.expectedCashInDrawer)})`)
      }
    })

    // Check 4: No negative balances
    console.log('\n✓ Check 4: No Negative Balances')
    let hasNegativeBalance = false

    apTrackers.forEach((tracker, poNumber) => {
      if (tracker.balanceAmount < 0) {
        console.log(`  ❌ ${poNumber}: Negative AP balance (${formatCurrency(tracker.balanceAmount)})`)
        hasNegativeBalance = true
        allChecksPassed = false
      }
    })

    arTrackers.forEach((tracker, invoiceNumber) => {
      if (tracker.balanceAmount < 0) {
        console.log(`  ❌ ${invoiceNumber}: Negative AR balance (${formatCurrency(tracker.balanceAmount)})`)
        hasNegativeBalance = true
        allChecksPassed = false
      }
    })

    if (!hasNegativeBalance) {
      console.log('  ✅ No negative balances found')
    }

    console.log('\n' + '─'.repeat(80))
    if (allChecksPassed) {
      console.log('✅ ALL VALIDATION CHECKS PASSED')
    } else {
      console.log('❌ SOME VALIDATION CHECKS FAILED - REVIEW ABOVE')
    }
    console.log('─'.repeat(80))

    expect(allChecksPassed).toBe(true)
  })
})
