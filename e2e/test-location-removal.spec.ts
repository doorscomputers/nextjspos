import { test, expect } from '@playwright/test'

test.describe('Product Location Removal - Complete Flow', () => {
  test('Complete workflow: Add → Verify → Remove → Verify Deletion', async ({ page }) => {
    // 1. Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForTimeout(2000)

    // 2. Navigate to products
    await page.goto('http://localhost:3000/dashboard/products')
    await page.waitForTimeout(2000)

    console.log('✓ Logged in and navigated to products page')

    // 3. ADD TO LOCATION
    console.log('\n=== STEP 1: Adding product to Bambang ===')

    // Select Generic Mouse 1
    const checkbox = page.locator('tr:has-text("Generic Mouse 1") input[type="checkbox"]').first()
    await checkbox.check()
    await page.waitForTimeout(500)

    // Select Bambang location
    await page.selectOption('select', { label: /Bambang/i })
    await page.waitForTimeout(500)

    // Click Add to Location
    await page.click('button:has-text("Add to Location")')
    await page.waitForTimeout(1000)

    // Confirm in modal
    const confirmButton = page.locator('button:has-text("Add to Location")').last()
    await confirmButton.click()
    await page.waitForTimeout(2000)

    console.log('✓ Product added to Bambang')

    // 4. VERIFY IT EXISTS IN OPENING STOCK
    console.log('\n=== STEP 2: Verifying product exists in Bambang ===')

    await page.reload()
    await page.waitForTimeout(2000)

    // Open actions menu
    const actionsButton = page.locator('tr:has-text("Generic Mouse 1") button').first()
    await actionsButton.click()
    await page.waitForTimeout(500)

    // Click Set Opening Stock
    await page.click('text="Set Opening Stock"')
    await page.waitForTimeout(1000)

    // Check if Bambang exists
    const bambangBeforeRemoval = await page.locator('text=/Bambang/i').count()
    console.log(`Bambang locations found in opening stock modal: ${bambangBeforeRemoval}`)

    if (bambangBeforeRemoval === 0) {
      console.error('❌ FAILED: Bambang not found after adding!')
      await page.screenshot({ path: 'test-results/bambang-not-added.png' })
    } else {
      console.log('✓ Bambang location confirmed in opening stock modal')
    }

    // Close modal
    await page.press('body', 'Escape')
    await page.waitForTimeout(500)

    // 5. REMOVE FROM LOCATION
    console.log('\n=== STEP 3: Removing product from Bambang ===')

    // Re-select the product
    await checkbox.check()
    await page.waitForTimeout(500)

    // Re-select Bambang
    await page.selectOption('select', { label: /Bambang/i })
    await page.waitForTimeout(500)

    // Click Remove from Location
    await page.click('button:has-text("Remove from Location")')
    await page.waitForTimeout(1000)

    // Enter password
    await page.fill('input[type="password"]', 'password')
    await page.waitForTimeout(300)

    // Confirm removal
    await page.click('button:has-text("Confirm Removal")')
    await page.waitForTimeout(3000)

    console.log('✓ Removal operation completed')

    // 6. VERIFY IT'S GONE FROM OPENING STOCK
    console.log('\n=== STEP 4: Verifying product removed from Bambang ===')

    await page.reload()
    await page.waitForTimeout(2000)

    // Open actions menu again
    const actionsButton2 = page.locator('tr:has-text("Generic Mouse 1") button').first()
    await actionsButton2.click()
    await page.waitForTimeout(500)

    // Click Set Opening Stock
    await page.click('text="Set Opening Stock"')
    await page.waitForTimeout(1000)

    // Check if Bambang is gone
    const bambangAfterRemoval = await page.locator('text=/Bambang/i').count()
    console.log(`Bambang locations found after removal: ${bambangAfterRemoval}`)

    if (bambangAfterRemoval > 0) {
      console.error('❌ FAILED: Bambang still exists after removal!')
      await page.screenshot({ path: 'test-results/bambang-not-removed.png' })

      // Take a screenshot of the modal
      const modalContent = await page.locator('[role="dialog"]').textContent()
      console.log('Modal content:', modalContent)
    } else {
      console.log('✅ SUCCESS: Bambang successfully removed from opening stock!')
    }

    // Close modal
    await page.press('body', 'Escape')
    await page.waitForTimeout(500)

    // 7. VERIFY ERROR WHEN TRYING TO REMOVE AGAIN
    console.log('\n=== STEP 5: Verifying cannot remove twice ===')

    // Try to remove again
    await checkbox.check()
    await page.waitForTimeout(500)

    await page.selectOption('select', { label: /Bambang/i })
    await page.waitForTimeout(500)

    await page.click('button:has-text("Remove from Location")')
    await page.waitForTimeout(1000)

    await page.fill('input[type="password"]', 'password')
    await page.waitForTimeout(300)

    await page.click('button:has-text("Confirm Removal")')
    await page.waitForTimeout(2000)

    // Should show error
    const errorExists = await page.locator('text=/do not exist at location/i').count()

    if (errorExists > 0) {
      console.log('✅ SUCCESS: Correct error shown for double removal')
    } else {
      console.error('❌ FAILED: No error shown for double removal')
    }

    // Final assertions
    expect(bambangBeforeRemoval).toBeGreaterThan(0)
    expect(bambangAfterRemoval).toBe(0)
    expect(errorExists).toBeGreaterThan(0)

    console.log('\n=== TEST COMPLETE ===')
    console.log(`Before removal: ${bambangBeforeRemoval} Bambang location(s)`)
    console.log(`After removal: ${bambangAfterRemoval} Bambang location(s)`)
    console.log('Result: PASSED ✅')
  })
})
