/**
 * Manual Purchase-to-Pay Pages Testing Script
 *
 * This script uses Playwright to manually test all purchase-to-pay pages
 * and report errors found.
 */

const { chromium } = require('playwright')
const fs = require('fs')
const path = require('path')

const BASE_URL = 'http://localhost:3001'
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots', 'purchase-to-pay-manual')

// Create screenshot directory
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

const errorLog = []

async function testPages() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 500
  })

  const context = await browser.newContext()
  const page = await context.newPage()

  // Capture console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(`[Console Error] ${msg.text()}`)
    }
  })

  // Capture page errors
  page.on('pageerror', (error) => {
    console.error(`[Page Error] ${error.message}`)
    errorLog.push({
      type: 'JavaScript Error',
      error: error.message,
      stack: error.stack
    })
  })

  try {
    console.log('\n' + '='.repeat(80))
    console.log('PURCHASE-TO-PAY UI ERROR DETECTION TEST')
    console.log('='.repeat(80) + '\n')

    // Step 1: Login
    console.log('Step 1: Logging in...')
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '0-login-page.png'),
      fullPage: true
    })

    // Try to login - check if fields exist
    const usernameField = await page.locator('input[name="username"]').count()
    const passwordField = await page.locator('input[name="password"]').count()

    if (usernameField === 0 || passwordField === 0) {
      console.error('❌ Login form fields not found!')
      errorLog.push({
        page: 'Login',
        error: 'Login form fields not found',
        screenshot: '0-login-page.png'
      })
    } else {
      await page.fill('input[name="username"]', 'admin')
      await page.fill('input[name="password"]', 'password')

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '0-login-filled.png'),
        fullPage: true
      })

      // Click login and wait
      await page.click('button[type="submit"]')
      await page.waitForTimeout(3000)

      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '0-login-submitted.png'),
        fullPage: true
      })

      const currentUrl = page.url()
      console.log(`Current URL after login: ${currentUrl}`)

      if (!currentUrl.includes('/dashboard')) {
        console.error('❌ Login failed - not redirected to dashboard')
        const bodyText = await page.textContent('body')
        if (bodyText.includes('Invalid credentials')) {
          errorLog.push({
            page: 'Login',
            error: 'Invalid credentials - database may not be seeded',
            screenshot: '0-login-submitted.png'
          })
        }
      } else {
        console.log('✓ Login successful')
      }
    }

    // Test each page regardless of login status
    const pagesToTest = [
      {
        name: 'Purchases List',
        url: '/dashboard/purchases',
        screenshot: '1-purchases-list'
      },
      {
        name: 'Accounts Payable',
        url: '/dashboard/accounts-payable',
        screenshot: '2-accounts-payable'
      },
      {
        name: 'Payments List',
        url: '/dashboard/payments',
        screenshot: '3-payments-list'
      },
      {
        name: 'Payment Form',
        url: '/dashboard/payments/new',
        screenshot: '4-payment-form'
      },
      {
        name: 'Post-Dated Cheques',
        url: '/dashboard/post-dated-cheques',
        screenshot: '5-post-dated-cheques'
      }
    ]

    for (const testPage of pagesToTest) {
      console.log(`\n${'='.repeat(60)}`)
      console.log(`Testing: ${testPage.name}`)
      console.log(`URL: ${BASE_URL}${testPage.url}`)
      console.log('='.repeat(60))

      try {
        await page.goto(`${BASE_URL}${testPage.url}`, {
          waitUntil: 'networkidle',
          timeout: 20000
        })

        // Wait a bit for any lazy errors
        await page.waitForTimeout(2000)

        // Take screenshot
        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${testPage.screenshot}.png`),
          fullPage: true
        })

        // Check for visible errors
        const bodyText = await page.textContent('body')

        const errorPatterns = [
          'Application error',
          'Unhandled Runtime Error',
          'Error:',
          'TypeError',
          'ReferenceError',
          'SyntaxError',
          'is not defined',
          'Cannot read',
          'undefined'
        ]

        let errorFound = false
        for (const pattern of errorPatterns) {
          if (bodyText.includes(pattern)) {
            errorFound = true
            const errorMatch = bodyText.match(new RegExp(`(${pattern}[^\\n]{0,100})`, 'i'))
            const errorMsg = errorMatch ? errorMatch[0] : `Page contains: ${pattern}`

            console.log(`❌ ERROR FOUND: ${errorMsg}`)

            errorLog.push({
              page: testPage.name,
              url: `${BASE_URL}${testPage.url}`,
              error: errorMsg,
              screenshot: `${testPage.screenshot}.png`
            })

            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, `${testPage.screenshot}-ERROR.png`),
              fullPage: true
            })
            break
          }
        }

        if (!errorFound) {
          console.log('✓ No visible errors detected')
        }

        // Check if redirected to login (unauthorized)
        if (page.url().includes('/login')) {
          console.log('⚠ Page redirected to login (unauthorized/unauthenticated)')
          errorLog.push({
            page: testPage.name,
            url: `${BASE_URL}${testPage.url}`,
            error: 'Page redirected to login - authentication issue',
            screenshot: `${testPage.screenshot}.png`
          })
        }

      } catch (error) {
        console.log(`❌ EXCEPTION: ${error.message}`)
        errorLog.push({
          page: testPage.name,
          url: `${BASE_URL}${testPage.url}`,
          error: error.message,
          screenshot: `${testPage.screenshot}-ERROR.png`
        })

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, `${testPage.screenshot}-ERROR.png`),
          fullPage: true
        }).catch(() => {})
      }
    }

  } catch (error) {
    console.error(`\n❌ Fatal Error: ${error.message}`)
    errorLog.push({
      page: 'Test Script',
      error: error.message
    })
  } finally {
    await browser.close()
  }

  // Generate report
  console.log('\n\n' + '='.repeat(80))
  console.log('FINAL ERROR REPORT - Purchase-to-Pay UI Testing')
  console.log('='.repeat(80))

  if (errorLog.length === 0) {
    console.log('\n✓✓✓ SUCCESS: All 5 pages loaded without errors! ✓✓✓\n')
  } else {
    console.log(`\n❌ TOTAL ERRORS FOUND: ${errorLog.length}\n`)

    errorLog.forEach((err, index) => {
      console.log(`\nError ${index + 1}:`)
      if (err.page) console.log(`  Page: ${err.page}`)
      if (err.url) console.log(`  URL: ${err.url}`)
      if (err.type) console.log(`  Type: ${err.type}`)
      console.log(`  Error: ${err.error}`)
      if (err.screenshot) {
        console.log(`  Screenshot: ${path.join(SCREENSHOT_DIR, err.screenshot)}`)
      }
      if (err.stack) {
        console.log(`  Stack: ${err.stack.substring(0, 200)}...`)
      }
    })

    console.log(`\n${'='.repeat(80)}\n`)

    // Write errors to file
    const reportPath = path.join(SCREENSHOT_DIR, 'ERROR-REPORT.txt')
    let report = 'PURCHASE-TO-PAY UI ERROR REPORT\n'
    report += '='.repeat(80) + '\n\n'
    report += `Date: ${new Date().toISOString()}\n`
    report += `Total Errors: ${errorLog.length}\n\n`

    errorLog.forEach((err, index) => {
      report += `Error ${index + 1}:\n`
      if (err.page) report += `  Page: ${err.page}\n`
      if (err.url) report += `  URL: ${err.url}\n`
      if (err.type) report += `  Type: ${err.type}\n`
      report += `  Error: ${err.error}\n`
      if (err.screenshot) report += `  Screenshot: ${err.screenshot}\n`
      if (err.stack) report += `  Stack Trace:\n${err.stack}\n`
      report += '\n'
    })

    fs.writeFileSync(reportPath, report)
    console.log(`Full report saved to: ${reportPath}`)
  }

  console.log('\nScreenshots saved to:', SCREENSHOT_DIR)
}

// Run tests
testPages().catch(console.error)
