import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Product Bulk Actions - Minimal Test', () => {
  let businessId: number
  let testProductIds: number[] = []

  test.beforeAll(async () => {
    // Get business ID
    const user = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { businessId: true }
    })
    businessId = user!.businessId!
  })

  test.afterAll(async () => {
    // Cleanup
    if (testProductIds.length > 0) {
      await prisma.productVariation.deleteMany({
        where: { productId: { in: testProductIds } }
      })
      await prisma.product.deleteMany({
        where: { id: { in: testProductIds } }
      })
    }
    await prisma.$disconnect()
  })

  test('Manual Products Page Test', async ({ page }) => {
    // Step 1: Navigate to login page manually
    console.log('Step 1: Navigating to login...')
    await page.goto('http://localhost:3000/login')
    await page.screenshot({ path: 'test-step1-login-page.png', fullPage: true })

    // Step 2: Wait for page to be fully loaded
    console.log('Step 2: Waiting for page load...')
    await page.waitForSelector('#username', { timeout: 10000 })
    await page.waitForTimeout(2000) // Extra wait for React hydration

    // Step 3: Fill form
    console.log('Step 3: Filling login form...')
    await page.locator('#username').fill('admin')
    await page.locator('#password').fill('password')
    await page.screenshot({ path: 'test-step3-filled-form.png', fullPage: true })

    // Step 4: Submit by pressing Enter (more reliable than clicking button)
    console.log('Step 4: Submitting form...')
    await page.locator('#password').press('Enter')

    // Step 5: Wait and check for redirect
    console.log('Step 5: Waiting for redirect...')
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-step5-after-submit.png', fullPage: true })

    const currentUrl = page.url()
    console.log(`Current URL after login attempt: ${currentUrl}`)

    // If still on login page, try clicking the button instead
    if (currentUrl.includes('/login')) {
      console.log('Still on login page, trying button click...')
      const button = page.locator('button[type="submit"]')
      await button.click()
      await page.waitForTimeout(3000)
      await page.screenshot({ path: 'test-step5b-after-button-click.png', fullPage: true })
    }

    // Step 6: Navigate to products page
    console.log('Step 6: Navigating to products page...')
    await page.goto('http://localhost:3000/dashboard/products', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-step6-products-page.png', fullPage: true })

    // Step 7: Check what's on the page
    console.log('Step 7: Checking page content...')
    const pageTitle = await page.locator('h1').first().textContent()
    console.log(`Page title: ${pageTitle}`)

    // Create test products
    console.log('Step 8: Creating test products...')
    for (let i = 1; i <= 3; i++) {
      const timestamp = Date.now()
      const product = await prisma.product.create({
        data: {
          businessId: businessId,
          name: `Bulk Test ${timestamp}-${i}`,
          type: 'variable',
          sku: `BULK-${timestamp}-${i}`,
          enableStock: true,
          isActive: true
        }
      })

      await prisma.productVariation.create({
        data: {
          productId: product.id,
          name: 'Default',
          sku: `${product.sku}-VAR`,
          purchasePrice: 10,
          sellingPrice: 20,
          isDefault: true
        }
      })

      testProductIds.push(product.id)
    }

    console.log(`Created ${testProductIds.length} test products`)

    // Step 9: Reload products page
    console.log('Step 9: Reloading products page...')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-step9-after-reload.png', fullPage: true })

    // Step 10: Try to find checkboxes
    console.log('Step 10: Looking for checkboxes...')
    const checkboxCount = await page.locator('input[type="checkbox"]').count()
    console.log(`Found ${checkboxCount} checkboxes`)

    if (checkboxCount > 0) {
      // Try to check one
      await page.locator('tbody tr input[type="checkbox"]').first().check()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-step10-checkbox-checked.png', fullPage: true })

      // Check if bulk actions appeared
      const bulkActionsText = await page.locator('text=/product\\(s\\) selected/').count()
      console.log(`Bulk actions visible: ${bulkActionsText > 0}`)
    }

    // Final screenshot
    await page.screenshot({ path: 'test-final.png', fullPage: true })

    // Basic assertion
    expect(checkboxCount).toBeGreaterThan(0)
  })
})
