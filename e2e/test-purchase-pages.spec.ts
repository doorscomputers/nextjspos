import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * STANDALONE Purchase-to-Pay UI Testing Suite
 * Tests all 5 purchase-to-pay pages for errors
 */

const BASE_URL = 'http://localhost:3001'
const SCREENSHOT_DIR = path.join(process.cwd(), 'screenshots', 'purchase-to-pay-tests')

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const errorLog: Array<{
  page: string
  url: string
  error: string
  screenshot?: string
  lineNumber?: string
}> = []

test.describe('Purchase-to-Pay Pages - Error Detection', () => {
  // Login helper
  async function login(page: any) {
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })
  }

  test.beforeEach(async ({ page }) => {
    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        console.error(`[Console Error] ${msg.text()}`)
      }
    })

    // Capture page errors (runtime errors)
    page.on('pageerror', (error) => {
      console.error(`[Page Error] ${error.message}`)
      console.error(`[Stack] ${error.stack}`)
    })
  })

  test('Test 1: Purchases List Page', async ({ page }) => {
    const pageName = 'Purchases List Page'
    const pageUrl = `${BASE_URL}/dashboard/purchases`

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${pageName}`)
    console.log(`URL: ${pageUrl}`)
    console.log('='.repeat(60))

    try {
      await login(page)

      // Navigate to page
      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 20000 })

      // Wait a bit for any lazy-loaded errors
      await page.waitForTimeout(2000)

      // Take screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '1-purchases-list.png'),
        fullPage: true
      })

      // Check for error messages in the page
      const bodyText = await page.textContent('body')

      if (bodyText?.includes('Application error') ||
          bodyText?.includes('Unhandled Runtime Error') ||
          bodyText?.includes('Error:') ||
          bodyText?.includes('TypeError') ||
          bodyText?.includes('ReferenceError')) {

        const errorMatch = bodyText.match(/(Error|TypeError|ReferenceError)[:\s]+([^\n]+)/i)
        const errorMsg = errorMatch ? errorMatch[0] : 'Unknown error detected in page content'

        errorLog.push({
          page: pageName,
          url: pageUrl,
          error: errorMsg,
          screenshot: '1-purchases-list.png'
        })

        console.log(`❌ ERROR FOUND: ${errorMsg}`)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '1-purchases-list-ERROR.png'),
          fullPage: true
        })
      } else {
        console.log(`✓ Page loaded successfully - No visible errors`)
      }

    } catch (error: any) {
      errorLog.push({
        page: pageName,
        url: pageUrl,
        error: error.message,
        screenshot: '1-purchases-list-ERROR.png'
      })
      console.log(`❌ EXCEPTION: ${error.message}`)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '1-purchases-list-ERROR.png'),
        fullPage: true
      })
    }
  })

  test('Test 2: Accounts Payable Page', async ({ page }) => {
    const pageName = 'Accounts Payable Page'
    const pageUrl = `${BASE_URL}/dashboard/accounts-payable`

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${pageName}`)
    console.log(`URL: ${pageUrl}`)
    console.log('='.repeat(60))

    try {
      await login(page)

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '2-accounts-payable.png'),
        fullPage: true
      })

      const bodyText = await page.textContent('body')

      if (bodyText?.includes('Application error') ||
          bodyText?.includes('Unhandled Runtime Error') ||
          bodyText?.includes('Error:') ||
          bodyText?.includes('TypeError') ||
          bodyText?.includes('ReferenceError')) {

        const errorMatch = bodyText.match(/(Error|TypeError|ReferenceError)[:\s]+([^\n]+)/i)
        const errorMsg = errorMatch ? errorMatch[0] : 'Unknown error detected in page content'

        errorLog.push({
          page: pageName,
          url: pageUrl,
          error: errorMsg,
          screenshot: '2-accounts-payable.png'
        })

        console.log(`❌ ERROR FOUND: ${errorMsg}`)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '2-accounts-payable-ERROR.png'),
          fullPage: true
        })
      } else {
        console.log(`✓ Page loaded successfully - No visible errors`)
      }

    } catch (error: any) {
      errorLog.push({
        page: pageName,
        url: pageUrl,
        error: error.message,
        screenshot: '2-accounts-payable-ERROR.png'
      })
      console.log(`❌ EXCEPTION: ${error.message}`)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '2-accounts-payable-ERROR.png'),
        fullPage: true
      })
    }
  })

  test('Test 3: Payments List Page', async ({ page }) => {
    const pageName = 'Payments List Page'
    const pageUrl = `${BASE_URL}/dashboard/payments`

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${pageName}`)
    console.log(`URL: ${pageUrl}`)
    console.log('='.repeat(60))

    try {
      await login(page)

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '3-payments-list.png'),
        fullPage: true
      })

      const bodyText = await page.textContent('body')

      if (bodyText?.includes('Application error') ||
          bodyText?.includes('Unhandled Runtime Error') ||
          bodyText?.includes('Error:') ||
          bodyText?.includes('TypeError') ||
          bodyText?.includes('ReferenceError')) {

        const errorMatch = bodyText.match(/(Error|TypeError|ReferenceError)[:\s]+([^\n]+)/i)
        const errorMsg = errorMatch ? errorMatch[0] : 'Unknown error detected in page content'

        errorLog.push({
          page: pageName,
          url: pageUrl,
          error: errorMsg,
          screenshot: '3-payments-list.png'
        })

        console.log(`❌ ERROR FOUND: ${errorMsg}`)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '3-payments-list-ERROR.png'),
          fullPage: true
        })
      } else {
        console.log(`✓ Page loaded successfully - No visible errors`)
      }

    } catch (error: any) {
      errorLog.push({
        page: pageName,
        url: pageUrl,
        error: error.message,
        screenshot: '3-payments-list-ERROR.png'
      })
      console.log(`❌ EXCEPTION: ${error.message}`)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '3-payments-list-ERROR.png'),
        fullPage: true
      })
    }
  })

  test('Test 4: Payment Form Page', async ({ page }) => {
    const pageName = 'Payment Form Page'
    const pageUrl = `${BASE_URL}/dashboard/payments/new`

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${pageName}`)
    console.log(`URL: ${pageUrl}`)
    console.log('='.repeat(60))

    try {
      await login(page)

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '4-payment-form.png'),
        fullPage: true
      })

      const bodyText = await page.textContent('body')

      if (bodyText?.includes('Application error') ||
          bodyText?.includes('Unhandled Runtime Error') ||
          bodyText?.includes('Error:') ||
          bodyText?.includes('TypeError') ||
          bodyText?.includes('ReferenceError')) {

        const errorMatch = bodyText.match(/(Error|TypeError|ReferenceError)[:\s]+([^\n]+)/i)
        const errorMsg = errorMatch ? errorMatch[0] : 'Unknown error detected in page content'

        errorLog.push({
          page: pageName,
          url: pageUrl,
          error: errorMsg,
          screenshot: '4-payment-form.png'
        })

        console.log(`❌ ERROR FOUND: ${errorMsg}`)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '4-payment-form-ERROR.png'),
          fullPage: true
        })
      } else {
        console.log(`✓ Page loaded successfully - No visible errors`)
      }

    } catch (error: any) {
      errorLog.push({
        page: pageName,
        url: pageUrl,
        error: error.message,
        screenshot: '4-payment-form-ERROR.png'
      })
      console.log(`❌ EXCEPTION: ${error.message}`)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '4-payment-form-ERROR.png'),
        fullPage: true
      })
    }
  })

  test('Test 5: Post-Dated Cheques Page', async ({ page }) => {
    const pageName = 'Post-Dated Cheques Page'
    const pageUrl = `${BASE_URL}/dashboard/post-dated-cheques`

    console.log(`\n${'='.repeat(60)}`)
    console.log(`Testing: ${pageName}`)
    console.log(`URL: ${pageUrl}`)
    console.log('='.repeat(60))

    try {
      await login(page)

      await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 20000 })
      await page.waitForTimeout(2000)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '5-post-dated-cheques.png'),
        fullPage: true
      })

      const bodyText = await page.textContent('body')

      if (bodyText?.includes('Application error') ||
          bodyText?.includes('Unhandled Runtime Error') ||
          bodyText?.includes('Error:') ||
          bodyText?.includes('TypeError') ||
          bodyText?.includes('ReferenceError')) {

        const errorMatch = bodyText.match(/(Error|TypeError|ReferenceError)[:\s]+([^\n]+)/i)
        const errorMsg = errorMatch ? errorMatch[0] : 'Unknown error detected in page content'

        errorLog.push({
          page: pageName,
          url: pageUrl,
          error: errorMsg,
          screenshot: '5-post-dated-cheques.png'
        })

        console.log(`❌ ERROR FOUND: ${errorMsg}`)
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '5-post-dated-cheques-ERROR.png'),
          fullPage: true
        })
      } else {
        console.log(`✓ Page loaded successfully - No visible errors`)
      }

    } catch (error: any) {
      errorLog.push({
        page: pageName,
        url: pageUrl,
        error: error.message,
        screenshot: '5-post-dated-cheques-ERROR.png'
      })
      console.log(`❌ EXCEPTION: ${error.message}`)
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '5-post-dated-cheques-ERROR.png'),
        fullPage: true
      })
    }
  })

  test.afterAll(async () => {
    console.log(`\n\n${'='.repeat(80)}`)
    console.log('FINAL ERROR REPORT - Purchase-to-Pay UI Testing')
    console.log('='.repeat(80))

    if (errorLog.length === 0) {
      console.log('\n✓✓✓ SUCCESS: All 5 pages loaded without errors! ✓✓✓\n')
    } else {
      console.log(`\n❌ TOTAL ERRORS FOUND: ${errorLog.length}\n`)

      errorLog.forEach((err, index) => {
        console.log(`\nError ${index + 1}:`)
        console.log(`  Page: ${err.page}`)
        console.log(`  URL: ${err.url}`)
        console.log(`  Error: ${err.error}`)
        if (err.screenshot) {
          console.log(`  Screenshot: ${path.join(SCREENSHOT_DIR, err.screenshot)}`)
        }
        if (err.lineNumber) {
          console.log(`  Line: ${err.lineNumber}`)
        }
      })

      console.log(`\n${'='.repeat(80)}\n`)

      // Write errors to file
      const reportPath = path.join(SCREENSHOT_DIR, 'ERROR-REPORT.txt')
      let report = 'PURCHASE-TO-PAY UI ERROR REPORT\n'
      report += '='.repeat(80) + '\n\n'
      report += `Total Errors: ${errorLog.length}\n\n`

      errorLog.forEach((err, index) => {
        report += `Error ${index + 1}:\n`
        report += `  Page: ${err.page}\n`
        report += `  URL: ${err.url}\n`
        report += `  Error: ${err.error}\n`
        if (err.screenshot) {
          report += `  Screenshot: ${err.screenshot}\n`
        }
        report += '\n'
      })

      fs.writeFileSync(reportPath, report)
      console.log(`Full report saved to: ${reportPath}`)
    }
  })
})
