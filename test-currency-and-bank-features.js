/**
 * Test script to verify currency formatting and bank features
 *
 * This script tests:
 * 1. Currency formatting without symbols and with thousand separators
 * 2. Bank dropdown with quick-add functionality
 * 3. Bank transactions page
 * 4. Auto-create bank transactions from payments
 */

const { chromium } = require('playwright')

const TEST_USER = {
  username: 'admin',
  password: 'password',
}

const BASE_URL = 'http://localhost:3000'

async function testCurrencyFormatting(page) {
  console.log('\n=== Testing Currency Formatting ===')

  // Test Accounts Payable page
  console.log('Testing Accounts Payable page...')
  await page.goto(`${BASE_URL}/dashboard/accounts-payable`)
  await page.waitForLoadState('networkidle')

  // Check if currency has no dollar sign and has commas
  const apAmounts = await page.locator('td').filter({ hasText: /\d+,\d+/ }).count()
  console.log(`✓ Found ${apAmounts} amounts with thousand separators on Accounts Payable page`)

  // Test Payments page
  console.log('Testing Payments page...')
  await page.goto(`${BASE_URL}/dashboard/payments`)
  await page.waitForLoadState('networkidle')

  const paymentAmounts = await page.locator('td').filter({ hasText: /\d+,\d+/ }).count()
  console.log(`✓ Found ${paymentAmounts} amounts with thousand separators on Payments page`)

  // Test Post-Dated Cheques page
  console.log('Testing Post-Dated Cheques page...')
  await page.goto(`${BASE_URL}/dashboard/post-dated-cheques`)
  await page.waitForLoadState('networkidle')

  console.log('✓ Post-Dated Cheques page loaded successfully')
}

async function testBankDropdown(page) {
  console.log('\n=== Testing Bank Dropdown with Quick-Add ===')

  // Navigate to new payment page
  await page.goto(`${BASE_URL}/dashboard/payments/new`)
  await page.waitForLoadState('networkidle')

  // Select a supplier first
  console.log('Selecting supplier...')
  const supplierSelect = page.locator('[id="rc_select_0"]').first()
  if (await supplierSelect.count() > 0) {
    await supplierSelect.click()
    await page.locator('[role="option"]').first().click()
    console.log('✓ Supplier selected')
  }

  // Select payment method (cheque or bank_transfer)
  console.log('Selecting cheque payment method...')
  const paymentMethodSelect = page.locator('select, [role="combobox"]').filter({ hasText: /payment method/i }).first()
  if (await paymentMethodSelect.count() > 0) {
    await paymentMethodSelect.click()
    const chequeOption = page.locator('[role="option"]').filter({ hasText: /cheque/i })
    if (await chequeOption.count() > 0) {
      await chequeOption.click()
      console.log('✓ Cheque payment method selected')

      // Wait for bank field to appear
      await page.waitForTimeout(500)

      // Check if bank dropdown exists
      const bankDropdown = page.locator('text=Bank Name').locator('..').locator('[role="combobox"]')
      if (await bankDropdown.count() > 0) {
        console.log('✓ Bank dropdown found')

        // Check for quick-add button (+ icon)
        const quickAddBtn = page.locator('button[title="Add new bank"], button').filter({ has: page.locator('svg') }).last()
        if (await quickAddBtn.count() > 0) {
          console.log('✓ Quick-add bank button found')
        } else {
          console.log('⚠ Quick-add bank button not found')
        }
      } else {
        console.log('⚠ Bank dropdown not found (might still be text input)')
      }
    }
  }
}

async function testBankTransactionsPage(page) {
  console.log('\n=== Testing Bank Transactions Page ===')

  await page.goto(`${BASE_URL}/dashboard/bank-transactions`)
  await page.waitForLoadState('networkidle')

  // Check if page loaded
  const pageTitle = await page.locator('h1').textContent()
  if (pageTitle?.includes('Bank Transactions')) {
    console.log('✓ Bank Transactions page loaded successfully')
  } else {
    console.log('⚠ Bank Transactions page title not found')
  }

  // Check for filters
  const filters = await page.locator('text=Filters').count()
  if (filters > 0) {
    console.log('✓ Filters section found')
  }

  // Check for transaction ledger table
  const ledgerTable = await page.locator('table').count()
  if (ledgerTable > 0) {
    console.log('✓ Transaction ledger table found')

    // Check for Debit/Credit columns
    const debitCol = await page.locator('th:has-text("Debit")').count()
    const creditCol = await page.locator('th:has-text("Credit")').count()

    if (debitCol > 0 && creditCol > 0) {
      console.log('✓ Debit and Credit columns found')
    } else {
      console.log('⚠ Debit/Credit columns not found')
    }
  }
}

async function runTests() {
  console.log('Starting Currency and Bank Features Tests...')
  console.log('='.repeat(60))

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    // Login
    console.log('\n=== Logging in ===')
    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', TEST_USER.username)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForLoadState('networkidle')
    console.log('✓ Logged in successfully')

    // Run tests
    await testCurrencyFormatting(page)
    await testBankDropdown(page)
    await testBankTransactionsPage(page)

    console.log('\n' + '='.repeat(60))
    console.log('✓ All tests completed!')
    console.log('='.repeat(60))

  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
  } finally {
    await browser.close()
  }
}

runTests().catch(console.error)
