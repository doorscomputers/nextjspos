import { test, expect } from '@playwright/test'
import path from 'path'

/**
 * Purchase-to-Pay UI Testing Suite
 *
 * This test suite comprehensively tests all purchase-to-pay related pages:
 * 1. Purchases List Page
 * 2. Accounts Payable Page
 * 3. Payments Page
 * 4. Payment Form Page
 * 5. Post-Dated Cheques Page
 *
 * Test Strategy:
 * - Login once before all tests
 * - Navigate to each page
 * - Check for runtime errors
 * - Verify page loads without crashing
 * - Test UI elements display correctly
 * - Capture screenshots of any errors
 * - Log all console errors
 */

test.describe('Purchase-to-Pay UI Tests', () => {
  const screenshotDir = path.join(process.cwd(), 'screenshots', 'purchase-to-pay')
  const errors: Array<{
    page: string
    url: string
    error: string
    screenshot?: string
    timestamp: string
  }> = []

  // Capture console errors
  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`Console Error: ${msg.text()}`)
      }
    })

    page.on('pageerror', (error) => {
      console.error(`Page Error: ${error.message}`)
      errors.push({
        page: page.url(),
        url: page.url(),
        error: error.message,
        timestamp: new Date().toISOString()
      })
    })
  })

  test.beforeAll(async ({ browser }) => {
    // Login once and verify session
    const context = await browser.newContext()
    const page = await context.newPage()

    console.log('Logging in as admin...')
    await page.goto('http://localhost:3001/login')
    await page.waitForLoadState('networkidle')

    // Fill login form
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')

    // Submit and wait for navigation
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    console.log('Login successful')
    await context.close()
  })

  test('1. Purchases List Page - Load and Display', async ({ page }) => {
    console.log('\n=== Testing Purchases List Page ===')

    // Login first
    await page.goto('http://localhost:3001/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    try {
      // Navigate to purchases page
      await page.goto('http://localhost:3001/dashboard/purchases', {
        waitUntil: 'networkidle',
        timeout: 15000
      })

      // Take initial screenshot
      await page.screenshot({
        path: path.join(screenshotDir, '1-purchases-list-loaded.png'),
        fullPage: true
      })

      // Check for page title or header
      const pageTitle = await page.textContent('h1, h2, [role="heading"]').catch(() => null)
      console.log(`Page Title: ${pageTitle}`)

      // Verify page loaded without crash
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText).not.toContain('Application error')
      expect(bodyText).not.toContain('Unhandled Runtime Error')

      // Check for table or data display
      const hasTable = await page.locator('table').count()
      const hasCards = await page.locator('[class*="card"]').count()
      console.log(`Has table: ${hasTable > 0}, Has cards: ${hasCards > 0}`)

      // Test filters if present
      const filterButtons = await page.locator('button').filter({ hasText: /filter|search/i }).count()
      console.log(`Filter buttons found: ${filterButtons}`)

      console.log('✓ Purchases List Page loaded successfully')
    } catch (error: any) {
      await page.screenshot({
        path: path.join(screenshotDir, '1-purchases-list-ERROR.png'),
        fullPage: true
      })
      errors.push({
        page: 'Purchases List Page',
        url: 'http://localhost:3001/dashboard/purchases',
        error: error.message,
        screenshot: '1-purchases-list-ERROR.png',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  })

  test('2. Accounts Payable Page - Load and Display', async ({ page }) => {
    console.log('\n=== Testing Accounts Payable Page ===')

    // Login
    await page.goto('http://localhost:3001/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    try {
      // Navigate to accounts payable page
      await page.goto('http://localhost:3001/dashboard/accounts-payable', {
        waitUntil: 'networkidle',
        timeout: 15000
      })

      // Take screenshot
      await page.screenshot({
        path: path.join(screenshotDir, '2-accounts-payable-loaded.png'),
        fullPage: true
      })

      // Verify page loaded
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText).not.toContain('Application error')
      expect(bodyText).not.toContain('Unhandled Runtime Error')

      // Check for aging cards
      const agingCards = await page.locator('[class*="card"]').count()
      console.log(`Aging cards found: ${agingCards}`)

      // Check for table
      const hasTable = await page.locator('table').count()
      console.log(`Has table: ${hasTable > 0}`)

      // Check for filters
      const hasFilters = await page.locator('button, input[type="search"]').count()
      console.log(`Filter elements found: ${hasFilters}`)

      console.log('✓ Accounts Payable Page loaded successfully')
    } catch (error: any) {
      await page.screenshot({
        path: path.join(screenshotDir, '2-accounts-payable-ERROR.png'),
        fullPage: true
      })
      errors.push({
        page: 'Accounts Payable Page',
        url: 'http://localhost:3001/dashboard/accounts-payable',
        error: error.message,
        screenshot: '2-accounts-payable-ERROR.png',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  })

  test('3. Payments Page - Load and Display', async ({ page }) => {
    console.log('\n=== Testing Payments Page ===')

    // Login
    await page.goto('http://localhost:3001/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    try {
      // Navigate to payments page
      await page.goto('http://localhost:3001/dashboard/payments', {
        waitUntil: 'networkidle',
        timeout: 15000
      })

      // Take screenshot
      await page.screenshot({
        path: path.join(screenshotDir, '3-payments-list-loaded.png'),
        fullPage: true
      })

      // Verify page loaded
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText).not.toContain('Application error')
      expect(bodyText).not.toContain('Unhandled Runtime Error')

      // Check for table or list
      const hasTable = await page.locator('table').count()
      const hasCards = await page.locator('[class*="card"]').count()
      console.log(`Has table: ${hasTable > 0}, Has cards: ${hasCards > 0}`)

      // Check for "New Payment" button
      const newPaymentButton = await page.locator('button, a').filter({ hasText: /new payment|add payment/i }).count()
      console.log(`New Payment button found: ${newPaymentButton > 0}`)

      console.log('✓ Payments Page loaded successfully')
    } catch (error: any) {
      await page.screenshot({
        path: path.join(screenshotDir, '3-payments-list-ERROR.png'),
        fullPage: true
      })
      errors.push({
        page: 'Payments Page',
        url: 'http://localhost:3001/dashboard/payments',
        error: error.message,
        screenshot: '3-payments-list-ERROR.png',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  })

  test('4. Payment Form Page - Load and Display', async ({ page }) => {
    console.log('\n=== Testing Payment Form Page ===')

    // Login
    await page.goto('http://localhost:3001/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    try {
      // Navigate to new payment form
      await page.goto('http://localhost:3001/dashboard/payments/new', {
        waitUntil: 'networkidle',
        timeout: 15000
      })

      // Take screenshot
      await page.screenshot({
        path: path.join(screenshotDir, '4-payment-form-loaded.png'),
        fullPage: true
      })

      // Verify page loaded
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText).not.toContain('Application error')
      expect(bodyText).not.toContain('Unhandled Runtime Error')

      // Check for form elements
      const formInputs = await page.locator('input, select, textarea').count()
      console.log(`Form inputs found: ${formInputs}`)

      // Check for submit button
      const submitButton = await page.locator('button[type="submit"], button').filter({ hasText: /save|submit|create/i }).count()
      console.log(`Submit button found: ${submitButton > 0}`)

      // Check for supplier/vendor field
      const hasSupplierField = await page.locator('input, select').filter({ hasText: /supplier|vendor/i }).count()
      console.log(`Supplier field found: ${hasSupplierField > 0}`)

      console.log('✓ Payment Form Page loaded successfully')
    } catch (error: any) {
      await page.screenshot({
        path: path.join(screenshotDir, '4-payment-form-ERROR.png'),
        fullPage: true
      })
      errors.push({
        page: 'Payment Form Page',
        url: 'http://localhost:3001/dashboard/payments/new',
        error: error.message,
        screenshot: '4-payment-form-ERROR.png',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  })

  test('5. Post-Dated Cheques Page - Load and Display', async ({ page }) => {
    console.log('\n=== Testing Post-Dated Cheques Page ===')

    // Login
    await page.goto('http://localhost:3001/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    try {
      // Navigate to post-dated cheques page
      await page.goto('http://localhost:3001/dashboard/post-dated-cheques', {
        waitUntil: 'networkidle',
        timeout: 15000
      })

      // Take screenshot
      await page.screenshot({
        path: path.join(screenshotDir, '5-post-dated-cheques-loaded.png'),
        fullPage: true
      })

      // Verify page loaded
      const bodyText = await page.textContent('body')
      expect(bodyText).toBeTruthy()
      expect(bodyText).not.toContain('Application error')
      expect(bodyText).not.toContain('Unhandled Runtime Error')

      // Check for table or list
      const hasTable = await page.locator('table').count()
      const hasCards = await page.locator('[class*="card"]').count()
      console.log(`Has table: ${hasTable > 0}, Has cards: ${hasCards > 0}`)

      // Check for filters
      const hasFilters = await page.locator('button, input[type="search"]').count()
      console.log(`Filter elements found: ${hasFilters}`)

      console.log('✓ Post-Dated Cheques Page loaded successfully')
    } catch (error: any) {
      await page.screenshot({
        path: path.join(screenshotDir, '5-post-dated-cheques-ERROR.png'),
        fullPage: true
      })
      errors.push({
        page: 'Post-Dated Cheques Page',
        url: 'http://localhost:3001/dashboard/post-dated-cheques',
        error: error.message,
        screenshot: '5-post-dated-cheques-ERROR.png',
        timestamp: new Date().toISOString()
      })
      throw error
    }
  })

  test.afterAll(async () => {
    // Generate error report
    if (errors.length > 0) {
      console.log('\n\n=== ERROR REPORT ===')
      console.log(`Total Errors Found: ${errors.length}\n`)

      errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.page}`)
        console.log(`   URL: ${error.url}`)
        console.log(`   Error: ${error.error}`)
        if (error.screenshot) {
          console.log(`   Screenshot: ${error.screenshot}`)
        }
        console.log(`   Timestamp: ${error.timestamp}`)
        console.log('')
      })
    } else {
      console.log('\n\n=== TEST SUMMARY ===')
      console.log('✓ All pages loaded successfully')
      console.log('✓ No runtime errors detected')
    }
  })
})
