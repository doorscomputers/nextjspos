import { test, expect } from '@playwright/test'

test.describe('Product Location Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as superadmin
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    // Navigate to products page
    await page.goto('http://localhost:3000/dashboard/products')
    await page.waitForLoadState('networkidle')
  })

  test('should add product to location and verify it exists', async ({ page }) => {
    console.log('=== TEST: Add Product to Location ===')

    // Select a product (Generic Mouse 1)
    const productCheckbox = page.locator('tbody tr').filter({ hasText: 'Generic Mouse 1' }).locator('input[type="checkbox"]').first()
    await productCheckbox.check()

    // Wait for bulk actions to appear
    await page.waitForSelector('button:has-text("Add to Location")', { timeout: 5000 })

    // Select a location (Bambang)
    await page.locator('select').filter({ hasText: 'Select location' }).selectOption({ label: /Bambang/i })

    // Click Add to Location
    await page.click('button:has-text("Add to Location")')

    // Wait for confirmation modal
    await page.waitForSelector('text=Add Products to Location', { timeout: 5000 })

    // Confirm in modal
    await page.click('button:has-text("Add to Location")')

    // Wait for success toast
    await page.waitForSelector('text=/Successfully added.*to location/i', { timeout: 10000 })

    console.log('✅ Product added to location successfully')

    // Now verify the product exists at this location by checking opening stock
    // Click on the product actions dropdown
    await page.locator('tbody tr').filter({ hasText: 'Generic Mouse 1' }).locator('button').first().click()

    // Click "Set Opening Stock"
    await page.click('text=Set Opening Stock')

    // Wait for opening stock modal
    await page.waitForSelector('text=Set Opening Stock', { timeout: 5000 })

    // Check if Bambang location exists in the modal
    const bambangLocationExists = await page.locator('text=Bambang').count()

    expect(bambangLocationExists).toBeGreaterThan(0)
    console.log('✅ Bambang location found in opening stock modal')

    // Close the modal
    await page.click('button:has-text("Cancel")')
  })

  test('should remove product from location and verify deletion', async ({ page }) => {
    console.log('=== TEST: Remove Product from Location ===')

    // First, ensure product is at the location by adding it
    const productCheckbox = page.locator('tbody tr').filter({ hasText: 'Generic Mouse 1' }).locator('input[type="checkbox"]').first()
    await productCheckbox.check()

    await page.waitForSelector('button:has-text("Add to Location")', { timeout: 5000 })

    // Select Bambang location
    const locationSelect = page.locator('.bg-white.text-gray-900.border-gray-300').first()
    await locationSelect.click()
    await page.click('text=Bambang')

    // Click Add to Location
    await page.click('button:has-text("Add to Location"):visible')

    // Confirm in modal if it appears
    const modalButton = page.locator('button:has-text("Add to Location")').last()
    if (await modalButton.isVisible()) {
      await modalButton.click()
    }

    // Wait a bit for the operation to complete
    await page.waitForTimeout(2000)

    // Now remove it
    console.log('Now removing product from location...')

    // Re-select the product
    await productCheckbox.check()
    await page.waitForTimeout(500)

    // Select Bambang location again
    await locationSelect.click()
    await page.click('text=Bambang')

    // Click Remove from Location
    await page.click('button:has-text("Remove from Location")')

    // Wait for password modal
    await page.waitForSelector('text=Remove Products from Location', { timeout: 5000 })

    // Enter password
    await page.fill('input[type="password"]', 'password')

    // Click Confirm Removal
    await page.click('button:has-text("Confirm Removal")')

    // Wait for success message
    await page.waitForSelector('text=/Successfully removed.*from location/i', { timeout: 10000 })

    console.log('✅ Product removed from location (message shown)')

    // Wait for modal to close
    await page.waitForTimeout(1000)

    // NOW VERIFY: Check if it's actually deleted
    console.log('Verifying deletion by checking opening stock modal...')

    // Refresh the page to ensure we have fresh data
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Click on the product actions dropdown
    const actionsButton = page.locator('tbody tr').filter({ hasText: 'Generic Mouse 1' }).locator('button[aria-haspopup="menu"]').first()
    await actionsButton.click()

    // Wait for dropdown to appear
    await page.waitForTimeout(500)

    // Click "Set Opening Stock"
    await page.click('text=Set Opening Stock')

    // Wait for opening stock modal
    await page.waitForSelector('text=Set Opening Stock', { timeout: 5000 })

    // Check if Bambang location is still there (IT SHOULD NOT BE)
    const bambangStillExists = await page.locator('text=Bambang').count()

    if (bambangStillExists > 0) {
      console.error('❌ FAILED: Bambang location still exists after deletion!')
      console.log('Taking screenshot...')
      await page.screenshot({ path: 'test-results/deletion-failed.png' })

      // Get all location names in the modal
      const locationNames = await page.locator('[role="dialog"] text=/^[A-Z].*$/').allTextContents()
      console.log('Locations found in modal:', locationNames)
    } else {
      console.log('✅ PASSED: Bambang location successfully removed!')
    }

    expect(bambangStillExists).toBe(0)
  })

  test('should show error for invalid password', async ({ page }) => {
    console.log('=== TEST: Invalid Password ===')

    // Select a product
    const productCheckbox = page.locator('tbody tr').filter({ hasText: 'Generic Mouse 1' }).locator('input[type="checkbox"]').first()
    await productCheckbox.check()

    await page.waitForSelector('button:has-text("Remove from Location")', { timeout: 5000 })

    // Select a location
    const locationSelect = page.locator('.bg-white.text-gray-900.border-gray-300').first()
    await locationSelect.click()
    await page.click('text=Bambang')

    // Click Remove from Location
    await page.click('button:has-text("Remove from Location")')

    // Wait for password modal
    await page.waitForSelector('text=Remove Products from Location', { timeout: 5000 })

    // Enter WRONG password
    await page.fill('input[type="password"]', 'wrongpassword')

    // Click Confirm Removal
    await page.click('button:has-text("Confirm Removal")')

    // Wait for error message
    const errorMessage = await page.waitForSelector('text=/Invalid password/i', { timeout: 10000 })

    expect(errorMessage).toBeTruthy()
    console.log('✅ Invalid password error shown correctly')
  })

  test('should prevent removing product not at location', async ({ page }) => {
    console.log('=== TEST: Remove Product Not at Location ===')

    // Select a product that doesn't exist at a location
    const productCheckbox = page.locator('tbody tr').filter({ hasText: 'Dell' }).locator('input[type="checkbox"]').first()
    await productCheckbox.check()

    await page.waitForSelector('button:has-text("Remove from Location")', { timeout: 5000 })

    // Select a location
    const locationSelect = page.locator('.bg-white.text-gray-900.border-gray-300').first()
    await locationSelect.click()
    await page.click('text=Downtown')

    // Click Remove from Location
    await page.click('button:has-text("Remove from Location")')

    // Wait for password modal
    await page.waitForSelector('text=Remove Products from Location', { timeout: 5000 })

    // Enter password
    await page.fill('input[type="password"]', 'password')

    // Click Confirm Removal
    await page.click('button:has-text("Confirm Removal")')

    // Should show error that product doesn't exist at location
    const errorMessage = await page.waitForSelector('text=/do not exist at location/i', { timeout: 10000 })

    expect(errorMessage).toBeTruthy()
    console.log('✅ Correct error shown for product not at location')
  })
})
