import { test, expect } from '@playwright/test'

test.describe('Cash In/Out and Quotation Delete Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login as cashier
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="username"]', 'cashiermain')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**')
  })

  test('Test Cash In - Check for errors', async ({ page }) => {
    console.log('\n=== Testing Cash In ===')

    // Go to POS
    await page.goto('http://localhost:3000/dashboard/pos-v2')
    await page.waitForTimeout(2000)

    // Open Cash In dialog
    console.log('Opening Cash In dialog...')
    await page.click('button:has-text("Cash In")')
    await page.waitForTimeout(1000)

    // Fill in amount
    console.log('Filling in amount: 100')
    const amountInput = page.locator('input[placeholder*="Enter amount"]').first()
    await amountInput.click()
    await page.waitForTimeout(500)

    // Use numeric keypad to enter 100
    await page.click('button:has-text("1")')
    await page.click('button:has-text("0")')
    await page.click('button:has-text("0")')
    await page.click('button:has-text("OK")')
    await page.waitForTimeout(500)

    // Fill in remarks
    console.log('Filling in remarks...')
    await page.fill('textarea[placeholder*="reason for cash in"]', 'Test cash in remarks')

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER ERROR:', msg.text())
      }
    })

    // Intercept the API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/cash/in') && response.request().method() === 'POST'
    )

    // Click Record Cash In
    console.log('Clicking Record Cash In...')
    await page.click('button:has-text("Record Cash In")')

    // Wait for response
    const response = await responsePromise
    const status = response.status()
    console.log(`API Response Status: ${status}`)

    if (status !== 200) {
      const responseBody = await response.json().catch(() => ({}))
      console.log('ERROR Response Body:', JSON.stringify(responseBody, null, 2))

      // Also check what error appears on screen
      await page.waitForTimeout(1000)
      const errorText = await page.locator('text=/error|failed/i').allTextContents()
      console.log('Error messages on screen:', errorText)
    } else {
      console.log('✅ Cash In successful')
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/cash-in-result.png', fullPage: true })
  })

  test('Test Cash Out - Check for errors', async ({ page }) => {
    console.log('\n=== Testing Cash Out ===')

    // Go to POS
    await page.goto('http://localhost:3000/dashboard/pos-v2')
    await page.waitForTimeout(2000)

    // Open Cash Out dialog
    console.log('Opening Cash Out dialog...')
    await page.click('button:has-text("Cash Out")')
    await page.waitForTimeout(1000)

    // Fill in amount
    console.log('Filling in amount: 200')
    const amountInput = page.locator('input[placeholder*="Enter amount"]').first()
    await amountInput.click()
    await page.waitForTimeout(500)

    // Use numeric keypad
    await page.click('button:has-text("2")')
    await page.click('button:has-text("0")')
    await page.click('button:has-text("0")')
    await page.click('button:has-text("OK")')
    await page.waitForTimeout(500)

    // Fill in remarks (required for cash out)
    console.log('Filling in remarks...')
    await page.fill('textarea[placeholder*="reason for cash out"]', 'Test cash out remarks')

    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('BROWSER ERROR:', msg.text())
      }
    })

    // Intercept the API call
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/cash/out') && response.request().method() === 'POST'
    )

    // Click Record Cash Out
    console.log('Clicking Record Cash Out...')
    await page.click('button:has-text("Record Cash Out")')

    // Wait for response
    const response = await responsePromise
    const status = response.status()
    console.log(`API Response Status: ${status}`)

    if (status !== 200) {
      const responseBody = await response.json().catch(() => ({}))
      console.log('ERROR Response Body:', JSON.stringify(responseBody, null, 2))

      // Check screen errors
      await page.waitForTimeout(1000)
      const errorText = await page.locator('text=/error|failed/i').allTextContents()
      console.log('Error messages on screen:', errorText)
    } else {
      console.log('✅ Cash Out successful')
    }

    // Take screenshot
    await page.screenshot({ path: 'test-results/cash-out-result.png', fullPage: true })
  })

  test('Test Quotation Delete', async ({ page }) => {
    console.log('\n=== Testing Quotation Delete ===')

    // First, create a quotation
    await page.goto('http://localhost:3000/dashboard/pos-v2')
    await page.waitForTimeout(2000)

    // Add a product to cart
    console.log('Adding product to cart...')
    const firstProduct = page.locator('button:has-text("+ Add")').first()
    await firstProduct.click()
    await page.waitForTimeout(500)

    // Open Save Quotation dialog
    console.log('Opening Save Quotation dialog...')
    await page.click('button:has-text("Save")')
    await page.waitForTimeout(1000)

    // Fill quotation details
    console.log('Filling quotation details...')
    await page.fill('input[placeholder*="customer name"]', 'Test Customer for Delete')
    await page.fill('textarea[placeholder*="notes"]', 'Test quotation to be deleted')

    // Intercept quotation creation
    const createResponsePromise = page.waitForResponse(
      response => response.url().includes('/api/quotations') && response.request().method() === 'POST'
    )

    // Save quotation
    console.log('Saving quotation...')
    await page.click('button:has-text("Save Quotation")')

    const createResponse = await createResponsePromise
    console.log(`Create Quotation Status: ${createResponse.status()}`)

    if (createResponse.status() === 200) {
      const createData = await createResponse.json()
      console.log('Quotation created:', createData.quotation?.quotationNumber)

      await page.waitForTimeout(1000)

      // Now try to delete it
      console.log('\nTrying to delete quotation...')

      // Open Load Quotations dialog
      await page.click('button:has-text("Load")')
      await page.waitForTimeout(1000)

      // Find and click delete button for the first quotation
      const deleteButton = page.locator('button:has-text("Delete")').first()

      // Listen for console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('BROWSER ERROR:', msg.text())
        }
      })

      // Intercept delete API call
      const deleteResponsePromise = page.waitForResponse(
        response => response.url().includes('/api/quotations/') && response.request().method() === 'DELETE'
      )

      // Click delete
      await deleteButton.click()

      // Handle confirmation dialog
      page.on('dialog', async dialog => {
        console.log('Confirm dialog:', dialog.message())
        await dialog.accept()
      })

      // Wait for delete response
      const deleteResponse = await deleteResponsePromise
      const deleteStatus = deleteResponse.status()
      console.log(`Delete Response Status: ${deleteStatus}`)

      if (deleteStatus !== 200) {
        const deleteBody = await deleteResponse.json().catch(() => ({}))
        console.log('DELETE ERROR Response:', JSON.stringify(deleteBody, null, 2))
      } else {
        console.log('✅ Quotation deleted successfully')
      }

      // Take screenshot
      await page.screenshot({ path: 'test-results/quotation-delete-result.png', fullPage: true })
    } else {
      console.log('❌ Failed to create quotation, cannot test delete')
    }
  })

  test('Debug - Check current shift and user permissions', async ({ page }) => {
    console.log('\n=== Debugging Current Shift and Permissions ===')

    await page.goto('http://localhost:3000/dashboard/pos-v2')

    // Check if shift is loaded
    await page.waitForTimeout(2000)

    // Check session storage or local storage
    const sessionData = await page.evaluate(() => {
      return {
        localStorage: { ...localStorage },
        sessionStorage: { ...sessionStorage }
      }
    })
    console.log('Session Data:', JSON.stringify(sessionData, null, 2))

    // Check what's in the page
    const shiftText = await page.locator('text=/Shift:/i').textContent().catch(() => 'Not found')
    console.log('Shift Display:', shiftText)

    // Check for any error messages
    const errors = await page.locator('[role="alert"], .text-red-500, .text-destructive').allTextContents()
    if (errors.length > 0) {
      console.log('Errors on page:', errors)
    }

    await page.screenshot({ path: 'test-results/debug-pos-page.png', fullPage: true })
  })
})
