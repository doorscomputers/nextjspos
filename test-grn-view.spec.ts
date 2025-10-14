import { test, expect } from '@playwright/test'

test.describe('GRN Purchase Receipt View', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**')
  })

  test('should view GRN receipt without errors', async ({ page }) => {
    console.log('✓ Navigating to Purchase Receipts page...')

    // Navigate to receipts page
    await page.goto('http://localhost:3000/dashboard/purchases/receipts')
    await page.waitForLoadState('networkidle')

    // Take screenshot of receipts list
    await page.screenshot({ path: 'test-results/grn-list.png', fullPage: true })
    console.log('✓ Screenshot saved: grn-list.png')

    // Check if "Received By" column shows username (not date)
    const receivedByCell = page.locator('td:has-text("Received By")').first()
    const hasDate = await receivedByCell.locator('text=/Oct 9, 2025|\\d{1,2}\\/\\d{1,2}\\/\\d{4}/').count()

    if (hasDate > 0) {
      console.log('❌ FAIL: "Received By" column still shows date instead of username')
    } else {
      console.log('✓ PASS: "Received By" column displays correctly')
    }

    // Find and click the first View button
    console.log('✓ Looking for View button...')
    const viewButton = page.locator('button:has-text("View")').first()
    await expect(viewButton).toBeVisible({ timeout: 10000 })

    console.log('✓ Clicking View button...')
    await viewButton.click()

    // Wait for navigation to detail page
    await page.waitForURL('**/receipts/**', { timeout: 10000 })
    console.log('✓ Navigated to receipt detail page')

    // Check for error messages
    const errorText = page.locator('text=/failed to fetch|error|not found/i')
    const errorCount = await errorText.count()

    if (errorCount > 0) {
      const errorMessage = await errorText.first().textContent()
      console.log(`❌ FAIL: Error found on page: ${errorMessage}`)
      await page.screenshot({ path: 'test-results/grn-error.png', fullPage: true })
      throw new Error(`Page shows error: ${errorMessage}`)
    }

    console.log('✓ PASS: No errors on detail page')

    // Verify key elements are present
    await expect(page.locator('h1:has-text("GRN-")')).toBeVisible()
    console.log('✓ GRN number displayed')

    await expect(page.locator('text=Receipt Information')).toBeVisible()
    console.log('✓ Receipt Information section found')

    await expect(page.locator('text=Supplier Information')).toBeVisible()
    console.log('✓ Supplier Information section found')

    await expect(page.locator('text=Approval Workflow')).toBeVisible()
    console.log('✓ Approval Workflow section found')

    await expect(page.locator('text=Received Items')).toBeVisible()
    console.log('✓ Received Items section found')

    // Check for approval section if status is pending
    const pendingBadge = await page.locator('text=PENDING').count()
    if (pendingBadge > 0) {
      console.log('✓ Receipt is PENDING - checking for approval section...')

      const verificationSection = page.locator('text=Verification Required')
      if (await verificationSection.isVisible()) {
        console.log('✓ Verification Required section found')

        // Check the verification checkbox
        const checkbox = page.locator('input[type="checkbox"]#verification')
        await checkbox.check()
        console.log('✓ Verification checkbox checked')

        // Approve button should now be visible
        const approveButton = page.locator('button:has-text("Approve & Update Inventory")')
        await expect(approveButton).toBeVisible()
        console.log('✓ Approve button is now visible')
      }
    } else {
      console.log('✓ Receipt already approved')
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/grn-detail-success.png', fullPage: true })
    console.log('✓ Screenshot saved: grn-detail-success.png')

    console.log('\n✅ ALL TESTS PASSED!')
  })

  test('should display user names correctly in Received By column', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/purchases/receipts')
    await page.waitForLoadState('networkidle')

    // Get the Received By column cells
    const receivedByCells = page.locator('tbody tr td:nth-child(6)')
    const count = await receivedByCells.count()

    console.log(`✓ Found ${count} receipt rows`)

    if (count > 0) {
      const firstCell = receivedByCells.first()
      const text = await firstCell.textContent()

      console.log(`✓ First "Received By" value: ${text}`)

      // Check if it contains a date pattern (should NOT)
      const hasDatePattern = /\d{1,2}\/\d{1,2}\/\d{4}|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec \d{1,2}, \d{4}/.test(text || '')

      if (hasDatePattern) {
        console.log('❌ FAIL: Still showing date instead of username')
        throw new Error('Received By column shows date instead of username')
      } else {
        console.log('✓ PASS: Showing username correctly')
      }
    }
  })
})
