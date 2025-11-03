import { test, expect } from '@playwright/test'

test.describe('Vercel Production Login Test', () => {
  const PRODUCTION_URL = 'https://nextjspos-six.vercel.app'

  test('Login with superadmin credentials and capture all details', async ({ page }) => {
    // Array to store console messages
    const consoleMessages: string[] = []
    const networkErrors: string[] = []
    const apiCalls: Array<{ url: string; status: number; method: string; response?: any }> = []

    // Listen to console events
    page.on('console', msg => {
      const text = `[${msg.type().toUpperCase()}] ${msg.text()}`
      consoleMessages.push(text)
      console.log(text)
    })

    // Listen to page errors
    page.on('pageerror', error => {
      const errorMsg = `[PAGE ERROR] ${error.message}`
      consoleMessages.push(errorMsg)
      console.error(errorMsg)
    })

    // Monitor network requests
    page.on('response', async response => {
      const url = response.url()
      const status = response.status()
      const method = response.request().method()

      // Log all API calls
      if (url.includes('/api/')) {
        let responseBody = null
        try {
          // Try to get response body
          const contentType = response.headers()['content-type'] || ''
          if (contentType.includes('application/json')) {
            responseBody = await response.json()
          } else {
            responseBody = await response.text()
          }
        } catch (e) {
          responseBody = '[Unable to parse response]'
        }

        const apiCall = {
          url,
          status,
          method,
          response: responseBody
        }
        apiCalls.push(apiCall)

        console.log(`\n[API CALL] ${method} ${url}`)
        console.log(`[STATUS] ${status}`)
        console.log(`[RESPONSE]`, responseBody)

        // Track errors
        if (status >= 400) {
          networkErrors.push(`${method} ${url} returned ${status}: ${JSON.stringify(responseBody)}`)
        }
      }
    })

    console.log('\n========================================')
    console.log('STEP 1: Navigating to production URL')
    console.log('========================================')

    try {
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle', timeout: 30000 })
      await page.screenshot({ path: 'test-results/vercel-01-initial-page.png', fullPage: true })
      console.log('✓ Successfully loaded initial page')
      console.log(`Current URL: ${page.url()}`)
    } catch (error) {
      console.error('✗ Failed to load initial page:', error)
      throw error
    }

    console.log('\n========================================')
    console.log('STEP 2: Checking for login form elements')
    console.log('========================================')

    // Wait for login form to be visible
    try {
      await page.waitForSelector('input[name="username"], input[id="username"], input[type="text"]', { timeout: 10000 })
      console.log('✓ Found username input field')
    } catch (error) {
      console.error('✗ Username input field not found')
      await page.screenshot({ path: 'test-results/vercel-02-no-username-field.png', fullPage: true })
      throw error
    }

    try {
      await page.waitForSelector('input[name="password"], input[id="password"], input[type="password"]', { timeout: 10000 })
      console.log('✓ Found password input field')
    } catch (error) {
      console.error('✗ Password input field not found')
      await page.screenshot({ path: 'test-results/vercel-02-no-password-field.png', fullPage: true })
      throw error
    }

    try {
      await page.waitForSelector('button[type="submit"], button:has-text("LOGIN"), button:has-text("Sign in")', { timeout: 10000 })
      console.log('✓ Found login button')
    } catch (error) {
      console.error('✗ Login button not found')
      await page.screenshot({ path: 'test-results/vercel-02-no-login-button.png', fullPage: true })
      throw error
    }

    await page.screenshot({ path: 'test-results/vercel-02-login-form-ready.png', fullPage: true })

    console.log('\n========================================')
    console.log('STEP 3: Filling in username (superadmin)')
    console.log('========================================')

    // Try different selectors for username field
    const usernameSelectors = [
      'input[name="username"]',
      'input[id="username"]',
      'input[type="text"]',
      'input[placeholder*="username" i]',
      'input[placeholder*="user" i]'
    ]

    let usernameField = null
    for (const selector of usernameSelectors) {
      usernameField = await page.$(selector)
      if (usernameField) {
        console.log(`✓ Found username field with selector: ${selector}`)
        await page.fill(selector, 'superadmin')
        break
      }
    }

    if (!usernameField) {
      console.error('✗ Could not find username field with any selector')
      throw new Error('Username field not found')
    }

    await page.screenshot({ path: 'test-results/vercel-03-username-filled.png', fullPage: true })

    console.log('\n========================================')
    console.log('STEP 4: Filling in password')
    console.log('========================================')

    const passwordSelectors = [
      'input[name="password"]',
      'input[id="password"]',
      'input[type="password"]'
    ]

    let passwordField = null
    for (const selector of passwordSelectors) {
      passwordField = await page.$(selector)
      if (passwordField) {
        console.log(`✓ Found password field with selector: ${selector}`)
        await page.fill(selector, 'password')
        break
      }
    }

    if (!passwordField) {
      console.error('✗ Could not find password field with any selector')
      throw new Error('Password field not found')
    }

    await page.screenshot({ path: 'test-results/vercel-04-password-filled.png', fullPage: true })

    console.log('\n========================================')
    console.log('STEP 5: Clicking LOGIN button')
    console.log('========================================')

    const loginButtonSelectors = [
      'button[type="submit"]',
      'button:has-text("LOGIN")',
      'button:has-text("Sign in")',
      'button:has-text("Log in")'
    ]

    let loginButton = null
    for (const selector of loginButtonSelectors) {
      loginButton = await page.$(selector)
      if (loginButton) {
        console.log(`✓ Found login button with selector: ${selector}`)
        await page.click(selector)
        break
      }
    }

    if (!loginButton) {
      console.error('✗ Could not find login button with any selector')
      throw new Error('Login button not found')
    }

    // Wait a moment for the request to be initiated
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/vercel-05-login-clicked.png', fullPage: true })

    console.log('\n========================================')
    console.log('STEP 6: Waiting for navigation and checking result')
    console.log('========================================')

    try {
      // Wait for either dashboard or login page
      await page.waitForURL(/\/(dashboard|login)/, { timeout: 15000 })

      const currentUrl = page.url()
      console.log(`Current URL after login attempt: ${currentUrl}`)

      await page.waitForTimeout(2000) // Wait for any redirects
      await page.screenshot({ path: 'test-results/vercel-06-after-login.png', fullPage: true })

      if (currentUrl.includes('/dashboard')) {
        console.log('✓ SUCCESS: Redirected to dashboard')

        // Check for dashboard content
        try {
          await page.waitForSelector('h1, h2, [role="main"]', { timeout: 5000 })
          console.log('✓ Dashboard content is visible')
        } catch (error) {
          console.log('⚠ Dashboard URL reached but content not fully loaded')
        }
      } else if (currentUrl.includes('/login')) {
        console.error('✗ FAILED: Redirected back to login page (login failed)')

        // Check for error messages
        const errorSelectors = [
          '[role="alert"]',
          '.error',
          '.alert-error',
          '[class*="error"]',
          'text=Invalid',
          'text=Error'
        ]

        for (const selector of errorSelectors) {
          const errorElement = await page.$(selector)
          if (errorElement) {
            const errorText = await errorElement.textContent()
            console.error(`Error message found: ${errorText}`)
          }
        }
      } else {
        console.log(`⚠ Unexpected URL: ${currentUrl}`)
      }
    } catch (error) {
      console.error('✗ Navigation timeout or error:', error)
      await page.screenshot({ path: 'test-results/vercel-06-navigation-error.png', fullPage: true })
    }

    console.log('\n========================================')
    console.log('STEP 7: Generating summary report')
    console.log('========================================')

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      finalUrl: page.url(),
      loginSuccessful: page.url().includes('/dashboard'),
      consoleMessages,
      networkErrors,
      apiCalls: apiCalls.filter(call => call.url.includes('/api/auth') || call.status >= 400),
      allApiCalls: apiCalls
    }

    console.log('\n========================================')
    console.log('FINAL REPORT')
    console.log('========================================')
    console.log(`Final URL: ${report.finalUrl}`)
    console.log(`Login Successful: ${report.loginSuccessful ? '✓ YES' : '✗ NO'}`)
    console.log(`\nTotal Console Messages: ${consoleMessages.length}`)
    console.log(`Network Errors: ${networkErrors.length}`)
    console.log(`API Calls: ${apiCalls.length}`)

    if (networkErrors.length > 0) {
      console.log('\n❌ NETWORK ERRORS DETECTED:')
      networkErrors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }

    if (report.apiCalls.length > 0) {
      console.log('\n📡 AUTH API CALLS AND ERROR RESPONSES:')
      report.apiCalls.forEach((call, index) => {
        console.log(`\n${index + 1}. ${call.method} ${call.url}`)
        console.log(`   Status: ${call.status}`)
        console.log(`   Response:`, JSON.stringify(call.response, null, 2))
      })
    }

    // Save detailed report to file
    const reportPath = 'test-results/vercel-login-report.json'
    const fs = require('fs')
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`\n📄 Detailed report saved to: ${reportPath}`)

    // Final assertion
    expect(report.loginSuccessful, 'Login should redirect to dashboard').toBe(true)
  })
})
