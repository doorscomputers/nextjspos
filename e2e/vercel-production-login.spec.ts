import { test, expect } from '@playwright/test'

test.describe('Vercel Production Login Test', () => {
  test('Login functionality after Next.js 15 fixes', async ({ page }) => {
    const productionUrl = 'https://nextjspos-six.vercel.app'

    // Capture console logs and errors
    const consoleLogs: string[] = []
    const consoleErrors: string[] = []
    page.on('console', msg => {
      const text = msg.text()
      consoleLogs.push(`[${msg.type()}] ${text}`)
      if (msg.type() === 'error') {
        consoleErrors.push(text)
      }
    })

    // Capture network requests and responses
    const networkLogs: Array<{
      url: string
      method: string
      status: number | null
      statusText: string
    }> = []

    page.on('response', response => {
      const url = response.url()
      // Focus on auth-related and API calls
      if (url.includes('/api/auth') || url.includes('/api/')) {
        networkLogs.push({
          url,
          method: response.request().method(),
          status: response.status(),
          statusText: response.statusText()
        })
      }
    })

    console.log('=== STEP 1: Navigate to production URL ===')
    try {
      await page.goto(productionUrl, {
        waitUntil: 'networkidle',
        timeout: 30000
      })
      console.log('✓ Page loaded successfully')
    } catch (error) {
      console.error('✗ Failed to load page:', error)
      throw error
    }

    // Take screenshot of initial page
    await page.screenshot({
      path: 'test-results/vercel-01-initial-page.png',
      fullPage: true
    })
    console.log('✓ Screenshot taken: vercel-01-initial-page.png')

    console.log('\n=== STEP 2: Wait for page to load completely ===')
    const currentUrl = page.url()
    console.log(`Current URL: ${currentUrl}`)

    // Check if we're on login page or already redirected
    if (!currentUrl.includes('/login')) {
      console.log(`⚠ Not on login page. Current URL: ${currentUrl}`)
    }

    // Wait for login form elements
    console.log('\n=== STEP 3: Locate login form elements ===')
    try {
      await page.waitForSelector('input[name="username"]', { timeout: 10000 })
      console.log('✓ Username field found')

      await page.waitForSelector('input[name="password"]', { timeout: 10000 })
      console.log('✓ Password field found')

      await page.waitForSelector('button[type="submit"]', { timeout: 10000 })
      console.log('✓ Login button found')
    } catch (error) {
      console.error('✗ Failed to find login form elements:', error)
      await page.screenshot({
        path: 'test-results/vercel-02-form-not-found.png',
        fullPage: true
      })
      throw error
    }

    console.log('\n=== STEP 4: Fill in username ===')
    await page.fill('input[name="username"]', 'superadmin')
    console.log('✓ Username filled: superadmin')

    console.log('\n=== STEP 5: Fill in password ===')
    await page.fill('input[name="password"]', 'password')
    console.log('✓ Password filled')

    // Take screenshot before login
    await page.screenshot({
      path: 'test-results/vercel-03-before-login.png',
      fullPage: true
    })
    console.log('✓ Screenshot taken: vercel-03-before-login.png')

    console.log('\n=== STEP 6: Click LOGIN button ===')

    // Clear previous network logs to focus on login request
    networkLogs.length = 0

    // Click login and wait for navigation or error
    await page.click('button[type="submit"]')
    console.log('✓ Login button clicked')

    console.log('\n=== STEP 7: Wait for response (up to 10 seconds) ===')
    try {
      // Wait for either navigation to dashboard or error message
      await Promise.race([
        page.waitForURL('**/dashboard**', { timeout: 10000 }),
        page.waitForSelector('.error, [role="alert"], .alert-error', { timeout: 10000 })
      ])
    } catch (error) {
      console.log('⚠ No navigation or error message detected within timeout')
    }

    // Wait a bit more for any async operations
    await page.waitForTimeout(2000)

    const finalUrl = page.url()
    console.log(`\nFinal URL: ${finalUrl}`)

    // Take screenshot after login attempt
    await page.screenshot({
      path: 'test-results/vercel-04-after-login.png',
      fullPage: true
    })
    console.log('✓ Screenshot taken: vercel-04-after-login.png')

    console.log('\n=== STEP 8: Analyze Results ===')

    // Check if we're on dashboard
    const isOnDashboard = finalUrl.includes('/dashboard')
    console.log(`\nLogin Success: ${isOnDashboard ? 'YES ✓' : 'NO ✗'}`)

    if (isOnDashboard) {
      console.log('✓✓✓ LOGIN SUCCESSFUL - Now on dashboard page')
    } else {
      console.log('✗✗✗ LOGIN FAILED - Still on login page or error occurred')
    }

    // Print network logs
    console.log('\n=== NETWORK LOGS (API Calls) ===')
    if (networkLogs.length === 0) {
      console.log('No API calls captured')
    } else {
      networkLogs.forEach(log => {
        const emoji = log.status === 200 ? '✓' : log.status === 307 ? '⚠' : '✗'
        console.log(`${emoji} [${log.status}] ${log.method} ${log.url}`)
      })
    }

    // Check for specific issues mentioned
    console.log('\n=== SPECIFIC CHECKS ===')

    const sessionCalls = networkLogs.filter(log => log.url.includes('/api/auth/session'))
    console.log(`\n1. /api/auth/session calls:`)
    if (sessionCalls.length === 0) {
      console.log('   ⚠ No session calls detected')
    } else {
      sessionCalls.forEach(call => {
        const status = call.status === 200 ? '✓ 200 OK' :
                       call.status === 307 ? '⚠ 307 REDIRECT (should be 200)' :
                       `✗ ${call.status} ERROR`
        console.log(`   ${status} - ${call.method}`)
      })
    }

    const logCalls = networkLogs.filter(log => log.url.includes('/api/auth/_log'))
    console.log(`\n2. /api/auth/_log calls:`)
    if (logCalls.length === 0) {
      console.log('   ✓ No _log calls (good)')
    } else {
      logCalls.forEach(call => {
        const status = call.status === 405 ? '✗ 405 METHOD NOT ALLOWED (ERROR)' :
                       `${call.status} ${call.statusText}`
        console.log(`   ${status} - ${call.method}`)
      })
    }

    const callbackCalls = networkLogs.filter(log =>
      log.url.includes('/api/auth/callback') ||
      log.url.includes('/api/auth/signin')
    )
    console.log(`\n3. Login callback/signin:`)
    if (callbackCalls.length === 0) {
      console.log('   ⚠ No callback/signin calls detected')
    } else {
      callbackCalls.forEach(call => {
        console.log(`   ${call.status} - ${call.method} ${call.url}`)
      })
    }

    // Check console errors
    console.log('\n=== CONSOLE ERRORS ===')
    if (consoleErrors.length === 0) {
      console.log('✓ No console errors')
    } else {
      consoleErrors.forEach(err => {
        console.log(`✗ ${err}`)
      })
    }

    // Check for CLIENT_FETCH_ERROR
    const clientFetchErrors = consoleLogs.filter(log =>
      log.includes('CLIENT_FETCH_ERROR')
    )
    console.log(`\n4. CLIENT_FETCH_ERROR messages:`)
    if (clientFetchErrors.length === 0) {
      console.log('   ✓ No CLIENT_FETCH_ERROR detected')
    } else {
      clientFetchErrors.forEach(err => {
        console.log(`   ✗ ${err}`)
      })
    }

    // Check for session cookie
    console.log(`\n5. Session Cookie Check:`)
    const cookies = await page.context().cookies()
    const authCookies = cookies.filter(c =>
      c.name.includes('next-auth') ||
      c.name.includes('session')
    )
    if (authCookies.length === 0) {
      console.log('   ✗ No session cookies found')
    } else {
      authCookies.forEach(cookie => {
        console.log(`   ✓ ${cookie.name} = ${cookie.value.substring(0, 20)}...`)
      })
    }

    // Print all console logs for debugging
    console.log('\n=== ALL CONSOLE LOGS ===')
    consoleLogs.forEach(log => console.log(log))

    // Final assertion
    console.log('\n=== FINAL VERDICT ===')
    if (isOnDashboard) {
      console.log('✓✓✓ TEST PASSED: Successfully logged in and redirected to dashboard')
      expect(finalUrl).toContain('/dashboard')
    } else {
      console.log('✗✗✗ TEST FAILED: Login did not redirect to dashboard')
      console.log(`Expected URL to contain: /dashboard`)
      console.log(`Actual URL: ${finalUrl}`)

      // Check for error messages on page
      const errorElements = await page.locator('.error, [role="alert"], .alert-error').all()
      if (errorElements.length > 0) {
        console.log('\nError messages found on page:')
        for (const element of errorElements) {
          const text = await element.textContent()
          console.log(`  - ${text}`)
        }
      }

      expect(finalUrl, 'Should be redirected to dashboard after login').toContain('/dashboard')
    }
  })
})
