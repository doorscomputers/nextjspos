import { test, expect, type Page } from '@playwright/test'

/**
 * Production Login Verification Test
 * Tests login functionality on Vercel deployment at https://nextjspos-six.vercel.app
 *
 * This test verifies:
 * - Page load and rendering
 * - Form interaction
 * - API calls (/api/auth/session, /api/auth/callback/credentials)
 * - Session cookie handling
 * - Successful navigation to /dashboard
 * - Error handling and console logs
 */

test.describe('Production Login Functionality (Vercel)', () => {
  const PRODUCTION_URL = 'https://nextjspos-six.vercel.app'
  const LOGIN_TIMEOUT = 10000 // 10 seconds max wait

  let consoleMessages: string[] = []
  let networkRequests: Array<{ url: string; method: string; status: number; response?: any }> = []
  let pageErrors: string[] = []

  test.beforeEach(async ({ page }) => {
    // Capture console logs
    page.on('console', msg => {
      const type = msg.type()
      const text = msg.text()
      consoleMessages.push(`[${type.toUpperCase()}] ${text}`)
    })

    // Capture page errors
    page.on('pageerror', error => {
      pageErrors.push(`Page Error: ${error.message}`)
    })

    // Capture network activity
    page.on('response', async response => {
      const url = response.url()
      const method = response.request().method()
      const status = response.status()

      let responseData = null
      try {
        // Only capture auth-related API calls
        if (url.includes('/api/auth')) {
          const contentType = response.headers()['content-type'] || ''
          if (contentType.includes('application/json')) {
            responseData = await response.json()
          } else {
            responseData = `Content-Type: ${contentType}`
          }
        }
      } catch (e) {
        responseData = 'Could not parse response'
      }

      networkRequests.push({
        url,
        method,
        status,
        response: responseData
      })
    })
  })

  test('Verify login with superadmin on production deployment', async ({ page }) => {
    console.log('\n========================================')
    console.log('PRODUCTION LOGIN TEST - STARTING')
    console.log('========================================\n')

    // Step 1: Navigate to production URL
    console.log('Step 1: Navigating to production URL...')
    const navigationStart = Date.now()

    try {
      await page.goto(PRODUCTION_URL, {
        waitUntil: 'networkidle',
        timeout: 30000
      })
      console.log(`✓ Page loaded in ${Date.now() - navigationStart}ms`)
      console.log(`✓ Current URL: ${page.url()}`)
    } catch (error) {
      console.error(`✗ Navigation failed: ${error}`)
      throw error
    }

    // Take initial screenshot
    await page.screenshot({
      path: 'test-results/production-01-initial-page.png',
      fullPage: true
    })

    // Step 2: Wait for page to be fully loaded
    console.log('\nStep 2: Waiting for login form...')

    try {
      // Wait for login form elements
      await page.waitForSelector('input[name="username"]', { timeout: 10000 })
      await page.waitForSelector('input[name="password"]', { timeout: 10000 })
      await page.waitForSelector('button[type="submit"]', { timeout: 10000 })
      console.log('✓ Login form elements found')
    } catch (error) {
      console.error('✗ Login form not found')
      await page.screenshot({
        path: 'test-results/production-02-form-not-found.png',
        fullPage: true
      })
      throw error
    }

    // Step 3: Fill in credentials
    console.log('\nStep 3: Filling in credentials...')

    try {
      await page.fill('input[name="username"]', 'superadmin')
      console.log('✓ Username filled: superadmin')

      await page.fill('input[name="password"]', 'password')
      console.log('✓ Password filled: ********')

      await page.screenshot({
        path: 'test-results/production-03-form-filled.png',
        fullPage: true
      })
    } catch (error) {
      console.error(`✗ Form fill failed: ${error}`)
      throw error
    }

    // Step 4: Clear RFID field and blur it (it has autofocus)
    console.log('\nStep 4: Handling RFID field...')

    try {
      // Clear the RFID field and blur it to prevent autofocus issues
      const rfidField = page.locator('input[name="rfid"]')
      await rfidField.clear()
      await rfidField.blur()
      console.log('✓ RFID field cleared and blurred (admin can skip)')
    } catch (error) {
      console.warn('⚠ RFID field handling failed (may not be required)')
    }

    // Step 5: Submit the form
    console.log('\nStep 5: Submitting login form...')
    const loginStart = Date.now()

    // Clear previous network requests to focus on login flow
    networkRequests = []

    try {
      // Press Enter on the password field instead of clicking button
      // This avoids the RFID field autofocus issue
      const passwordField = page.locator('input[name="password"]')
      await passwordField.press('Enter')
      console.log('✓ Form submitted via Enter key on password field')

      await page.screenshot({
        path: 'test-results/production-04-form-submitted.png',
        fullPage: true
      })

      // Wait briefly for form to start processing
      await page.waitForTimeout(1000)

    } catch (error) {
      console.error(`✗ Form submission failed: ${error}`)
      throw error
    }

    // Step 6: Check for immediate errors or wait for auth callback
    console.log('\nStep 6: Monitoring authentication...')

    // Check if error appeared immediately
    const errorAlert = page.locator('[role="alert"]')
    const errorVisible = await errorAlert.isVisible().catch(() => false)

    if (errorVisible) {
      const errorText = await errorAlert.textContent()
      console.error(`✗ Immediate error shown: "${errorText}"`)

      await page.screenshot({
        path: 'test-results/production-05-immediate-error.png',
        fullPage: true
      })

      // Capture console logs
      console.log('\nConsole messages so far:')
      consoleMessages.forEach(msg => console.log(msg))

      throw new Error(`Login failed immediately: ${errorText || 'Empty error message'}`)
    }

    // Wait for the credentials callback to complete
    try {
      const authResponse = await page.waitForResponse(
        response => response.url().includes('/api/auth/callback/credentials'),
        { timeout: LOGIN_TIMEOUT }
      )

      const authStatus = authResponse.status()
      console.log(`Auth callback response: ${authStatus}`)

      if (authStatus === 200) {
        console.log('✓ Authentication successful (200 OK)')

        // Try to get response body
        try {
          const authBody = await authResponse.text()
          console.log(`Auth response body: ${authBody.substring(0, 200)}...`)
        } catch (e) {
          console.log('Could not read auth response body')
        }
      } else {
        console.error(`✗ Authentication returned ${authStatus}`)
      }

      // Wait for client-side processing
      await page.waitForTimeout(1000)

    } catch (error) {
      console.error(`✗ Auth callback timeout: ${error}`)
      console.error('No /api/auth/callback/credentials request detected!')

      // Take screenshot of current state
      await page.screenshot({
        path: 'test-results/production-06-no-auth-callback.png',
        fullPage: true
      })

      // Show all network requests made
      console.log('\nAll network requests:')
      networkRequests.forEach(req => {
        console.log(`${req.method} ${req.url} -> ${req.status}`)
      })

      // Show console logs
      console.log('\nConsole messages:')
      consoleMessages.forEach(msg => console.log(msg))

      throw new Error('No authentication request was made - form did not submit')
    }

    // Step 7: Wait for navigation to dashboard
    console.log('\nStep 7: Waiting for dashboard navigation...')

    try {
      // Wait for URL to change to dashboard (with window.location.href redirect)
      // The code uses window.location.href = "/dashboard" so wait for that
      await page.waitForFunction(
        () => window.location.pathname.includes('/dashboard'),
        { timeout: LOGIN_TIMEOUT }
      )

      const loginDuration = Date.now() - loginStart
      console.log(`✓ Successfully navigated to dashboard in ${loginDuration}ms`)
      console.log(`✓ Final URL: ${page.url()}`)

      await page.screenshot({
        path: 'test-results/production-07-dashboard-success.png',
        fullPage: true
      })

      // Verify we're actually on the dashboard
      expect(page.url()).toContain('/dashboard')

    } catch (error) {
      console.error(`✗ Navigation to dashboard failed: ${error}`)
      console.error(`✗ Current URL: ${page.url()}`)

      // Check for error alert again
      const errorAlert = page.locator('[role="alert"]')
      const errorVisible = await errorAlert.isVisible().catch(() => false)

      if (errorVisible) {
        const errorText = await errorAlert.textContent()
        console.error(`✗ Error message: "${errorText}"`)
      }

      await page.screenshot({
        path: 'test-results/production-08-navigation-failed.png',
        fullPage: true
      })

      throw error
    }

    // Step 8: Verify session is established
    console.log('\nStep 8: Verifying session...')

    try {
      // Check for session cookie
      const cookies = await page.context().cookies()
      const sessionCookie = cookies.find(c =>
        c.name.includes('next-auth') || c.name.includes('session')
      )

      if (sessionCookie) {
        console.log(`✓ Session cookie found: ${sessionCookie.name}`)
        console.log(`  Domain: ${sessionCookie.domain}`)
        console.log(`  Secure: ${sessionCookie.secure}`)
        console.log(`  HttpOnly: ${sessionCookie.httpOnly}`)
      } else {
        console.warn('⚠ No session cookie found')
      }
    } catch (error) {
      console.error(`✗ Session verification failed: ${error}`)
    }

    // Step 9: Analyze network activity
    console.log('\n========================================')
    console.log('NETWORK ACTIVITY ANALYSIS')
    console.log('========================================\n')

    // Filter auth-related requests
    const authRequests = networkRequests.filter(req =>
      req.url.includes('/api/auth')
    )

    console.log(`Total network requests: ${networkRequests.length}`)
    console.log(`Auth-related requests: ${authRequests.length}\n`)

    authRequests.forEach((req, index) => {
      const urlPath = new URL(req.url).pathname
      console.log(`[${index + 1}] ${req.method} ${urlPath}`)
      console.log(`    Status: ${req.status}`)

      if (req.response) {
        if (typeof req.response === 'string') {
          console.log(`    Response: ${req.response}`)
        } else {
          console.log(`    Response: ${JSON.stringify(req.response, null, 2)}`)
        }
      }
      console.log()
    })

    // Critical checks
    console.log('========================================')
    console.log('CRITICAL CHECKS')
    console.log('========================================\n')

    // Check 1: /api/auth/session calls
    const sessionCalls = authRequests.filter(req =>
      req.url.includes('/api/auth/session')
    )
    console.log(`✓ Session API calls: ${sessionCalls.length}`)

    const non200Sessions = sessionCalls.filter(req => req.status !== 200)
    if (non200Sessions.length > 0) {
      console.warn(`⚠ Non-200 session responses:`)
      non200Sessions.forEach(req => {
        console.warn(`  ${req.status} - ${req.url}`)
      })
    }

    const redirect307 = sessionCalls.filter(req => req.status === 307)
    if (redirect307.length > 0) {
      console.error(`✗ Found 307 redirects on session calls (SHOULD BE 200 JSON):`)
      redirect307.forEach(req => {
        console.error(`  ${req.url}`)
      })
    }

    // Check 2: 405 Method Not Allowed errors
    const method405 = networkRequests.filter(req => req.status === 405)
    if (method405.length > 0) {
      console.error(`✗ Found 405 Method Not Allowed errors:`)
      method405.forEach(req => {
        console.error(`  ${req.method} ${req.url}`)
      })
    } else {
      console.log(`✓ No 405 errors found`)
    }

    // Check 3: CLIENT_FETCH_ERROR messages
    const fetchErrors = consoleMessages.filter(msg =>
      msg.includes('CLIENT_FETCH_ERROR')
    )
    if (fetchErrors.length > 0) {
      console.error(`✗ Found CLIENT_FETCH_ERROR messages:`)
      fetchErrors.forEach(msg => console.error(`  ${msg}`))
    } else {
      console.log(`✓ No CLIENT_FETCH_ERROR messages`)
    }

    // Step 8: Console logs and errors
    console.log('\n========================================')
    console.log('CONSOLE LOGS')
    console.log('========================================\n')

    if (consoleMessages.length > 0) {
      console.log(`Total console messages: ${consoleMessages.length}`)
      consoleMessages.forEach(msg => console.log(msg))
    } else {
      console.log('No console messages captured')
    }

    if (pageErrors.length > 0) {
      console.log('\n========================================')
      console.log('PAGE ERRORS')
      console.log('========================================\n')
      pageErrors.forEach(err => console.error(err))
    }

    // Final assertions
    console.log('\n========================================')
    console.log('TEST RESULT')
    console.log('========================================\n')

    expect(page.url()).toContain('/dashboard')
    expect(redirect307.length).toBe(0) // Should not have 307 redirects
    expect(method405.length).toBe(0) // Should not have 405 errors
    expect(fetchErrors.length).toBe(0) // Should not have fetch errors

    console.log('✓ ALL CHECKS PASSED - LOGIN SUCCESSFUL')
    console.log('\n========================================\n')
  })

  test.afterEach(async () => {
    // Reset captured data
    consoleMessages = []
    networkRequests = []
    pageErrors = []
  })
})
