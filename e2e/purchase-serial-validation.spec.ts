import { test, expect } from '@playwright/test'

test.describe('Purchase GRN Serial Number Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('http://localhost:3006/login')
    await page.waitForLoadState('networkidle')

    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')

    await page.click('button:has-text("Login")')
    await page.waitForURL('**/dashboard', { timeout: 15000 })
    await page.waitForLoadState('networkidle')
  })

  test('should prevent duplicate serial numbers from database', async ({ page }) => {
    console.log('Step 1: Navigate to Purchase Orders')
    await page.goto('http://localhost:3006/dashboard/purchases')
    await page.waitForLoadState('networkidle')

    console.log('Step 2: Click on PO-202510-0003')
    await page.click('text=PO-202510-0003')
    await page.waitForLoadState('networkidle')

    console.log('Step 3: Click Receive Goods (GRN)')
    await page.click('text=Receive Goods')
    await page.waitForLoadState('networkidle')

    console.log('Step 4: Verify we are on the receive page')
    await expect(page.locator('h1')).toContainText('Receive Goods - Create GRN')

    console.log('Step 5: Ensure Scan 1 by 1 mode is active')
    const scanButton = page.locator('button:has-text("Scan 1 by 1")')
    await scanButton.click()
    await page.waitForTimeout(500)

    console.log('Step 6: Try to add serial number "1" (which already exists in database)')
    const serialInput = page.locator('input[placeholder*="Scan or type serial number"]')
    await serialInput.fill('1')
    await page.waitForTimeout(500)

    console.log('Step 7: Click Add button')
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(2000)

    console.log('Step 8: Verify error message appears')
    const errorToast = page.locator('text=already exists')
    await expect(errorToast).toBeVisible({ timeout: 5000 })

    console.log('Step 9: Verify the serial was NOT added to the list')
    const serialList = page.locator('text=Entered Serial Numbers')
    const hasSerials = await serialList.isVisible()

    if (hasSerials) {
      const serialItems = page.locator('[class*="font-mono"]').filter({ hasText: '1' })
      const count = await serialItems.count()
      expect(count).toBe(0)
      console.log('✓ Serial "1" was correctly rejected')
    } else {
      console.log('✓ No serials added (correct behavior)')
    }

    console.log('Step 10: Try a unique serial number')
    await serialInput.fill('UNIQUE-TEST-' + Date.now())
    await page.click('button:has-text("Add")')
    await page.waitForTimeout(2000)

    console.log('Step 11: Verify success message')
    const successToast = page.locator('text=Serial added')
    await expect(successToast).toBeVisible({ timeout: 5000 })

    console.log('✅ Test passed: Duplicate serial validation works correctly!')
  })

  test('should validate serials from different suppliers', async ({ page }) => {
    console.log('Test: Ensure serials from Sample Supplier2 are rejected')

    await page.goto('http://localhost:3006/dashboard/purchases')
    await page.waitForLoadState('networkidle')

    await page.click('text=PO-202510-0003')
    await page.waitForLoadState('networkidle')

    await page.click('text=Receive Goods')
    await page.waitForLoadState('networkidle')

    const scanButton = page.locator('button:has-text("Scan 1 by 1")')
    await scanButton.click()

    // Try serials 1-10 which belong to Sample Supplier2
    for (let i = 1; i <= 3; i++) {
      console.log(`Testing serial: ${i}`)
      const serialInput = page.locator('input[placeholder*="Scan or type serial number"]')
      await serialInput.fill(String(i))
      await page.click('button:has-text("Add")')
      await page.waitForTimeout(1500)

      const errorToast = page.locator('text=already exists')
      await expect(errorToast).toBeVisible({ timeout: 3000 })
      console.log(`✓ Serial ${i} correctly rejected`)
    }

    console.log('✅ All existing serials were correctly rejected!')
  })

  test('should handle bulk import with duplicate detection', async ({ page }) => {
    console.log('Test: Bulk import with duplicates')

    await page.goto('http://localhost:3006/dashboard/purchases')
    await page.waitForLoadState('networkidle')

    await page.click('text=PO-202510-0003')
    await page.waitForLoadState('networkidle')

    await page.click('text=Receive Goods')
    await page.waitForLoadState('networkidle')

    console.log('Step 1: Switch to Bulk Import mode')
    const bulkButton = page.locator('button:has-text("Bulk Import")')
    await bulkButton.click()
    await page.waitForTimeout(500)

    console.log('Step 2: Verify Download Template button is visible')
    const downloadButton = page.locator('button:has-text("Download Template")')
    await expect(downloadButton).toBeVisible()

    console.log('Step 3: Paste serials including duplicates')
    const textarea = page.locator('textarea[placeholder*="Paste serial numbers"]')
    const serialsToPaste = `
1
2
3
UNIQUE-1-${Date.now()}
UNIQUE-2-${Date.now()}
UNIQUE-3-${Date.now()}
`.trim()

    await textarea.fill(serialsToPaste)
    await page.waitForTimeout(500)

    console.log('Step 4: Click Import Serials')
    await page.click('button:has-text("Import Serials")')

    console.log('Step 5: Wait for validation to complete')
    await page.waitForTimeout(5000)

    console.log('Step 6: Verify summary message')
    const summaryToast = page.locator('text=Successfully added')
    await expect(summaryToast).toBeVisible({ timeout: 10000 })

    const skippedToast = page.locator('text=Ignored').first()
    await expect(skippedToast).toBeVisible({ timeout: 5000 })

    console.log('✅ Bulk import correctly handled duplicates!')
  })

  test('should only accept max quantity needed', async ({ page }) => {
    console.log('Test: Bulk import should only accept max quantity')

    await page.goto('http://localhost:3006/dashboard/purchases')
    await page.waitForLoadState('networkidle')

    await page.click('text=PO-202510-0003')
    await page.waitForLoadState('networkidle')

    await page.click('text=Receive Goods')
    await page.waitForLoadState('networkidle')

    const bulkButton = page.locator('button:has-text("Bulk Import")')
    await bulkButton.click()
    await page.waitForTimeout(500)

    console.log('Generating 50 unique serials (need only 30)')
    const serials = []
    for (let i = 1; i <= 50; i++) {
      serials.push(`BULK-TEST-${Date.now()}-${i}`)
    }

    const textarea = page.locator('textarea[placeholder*="Paste serial numbers"]')
    await textarea.fill(serials.join('\n'))

    await page.click('button:has-text("Import Serials")')
    await page.waitForTimeout(6000)

    console.log('Verify only 30 were accepted')
    const excessToast = page.locator('text=Ignored 20 excess')
    await expect(excessToast).toBeVisible({ timeout: 5000 })

    console.log('✅ Bulk import correctly limited to max quantity!')
  })
})
