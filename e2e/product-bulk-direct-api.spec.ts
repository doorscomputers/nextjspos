/**
 * Product Bulk Actions Test - Using Direct API Authentication
 *
 * This test bypasses the login UI and uses direct API calls to authenticate,
 * then tests bulk actions on the Products page.
 */

import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Helper to create auth session via API
async function loginViaAPI(page: any) {
  // Use the browser context to execute login via JavaScript
  await page.goto('http://localhost:3000/login')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000) // Wait for React to hydrate

  // Execute login using the NextAuth signIn function directly in browser
  const loginResult = await page.evaluate(async () => {
    // @ts-ignore - NextAuth is available globally
    const { signIn } = await import('next-auth/react')
    const result = await signIn('credentials', {
      username: 'admin',
      password: 'password',
      redirect: false
    })
    return result
  })

  console.log('Login result:', loginResult)

  // Navigate to dashboard
  await page.goto('http://localhost:3000/dashboard')
  await page.waitForLoadState('networkidle')

  // Verify we're logged in
  const url = page.url()
  if (!url.includes('/dashboard')) {
    throw new Error(`Login failed. Current URL: ${url}`)
  }

  console.log('Successfully logged in!')
}

test.describe('Product Bulk Actions - Direct API Tests', () => {
  let businessId: number
  let testProductIds: number[] = []
  let locationId: number | null = null

  test.beforeAll(async () => {
    // Get business ID and location
    const user = await prisma.user.findUnique({
      where: { username: 'admin' },
      select: { businessId: true }
    })
    businessId = user!.businessId!

    const location = await prisma.businessLocation.findFirst({
      where: { businessId, deletedAt: null },
      select: { id: true }
    })
    locationId = location?.id || null

    console.log(`Business ID: ${businessId}, Location ID: ${locationId}`)
  })

  test.afterAll(async () => {
    // Cleanup test products
    if (testProductIds.length > 0) {
      await prisma.variationLocationDetails.deleteMany({
        where: {
          productVariation: {
            productId: { in: testProductIds }
          }
        }
      })

      await prisma.productVariation.deleteMany({
        where: { productId: { in: testProductIds } }
      })

      await prisma.product.deleteMany({
        where: { id: { in: testProductIds } }
      })

      console.log(`Cleaned up ${testProductIds.length} test products`)
    }
    await prisma.$disconnect()
  })

  test('Complete Bulk Actions Workflow', async ({ page }) => {
    // Login
    console.log('\n=== STEP 1: Login ===')
    await loginViaAPI(page)

    // Create test products via database
    console.log('\n=== STEP 2: Creating Test Products ===')
    const timestamp = Date.now()
    for (let i = 1; i <= 5; i++) {
      const product = await prisma.product.create({
        data: {
          businessId,
          name: `Bulk Test Product ${timestamp}-${i}`,
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

    // Navigate to products page
    console.log('\n=== STEP 3: Navigate to Products Page ===')
    await page.goto('http://localhost:3000/dashboard/products')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Take screenshot
    await page.screenshot({ path: 'bulk-test-products-page.png', fullPage: true })

    // Verify page loaded
    const pageTitle = await page.locator('h1').textContent()
    console.log(`Page title: ${pageTitle}`)
    expect(pageTitle).toContain('Products')

    // TEST 1: Select individual products
    console.log('\n=== TEST 1: Individual Selection ===')
    const firstCheckbox = page.locator('tbody tr input[type="checkbox"]').first()
    await firstCheckbox.check()
    await page.waitForTimeout(500)

    // Verify selection indicator appears
    const selectionText = await page.locator('text=/\\d+ product\\(s\\) selected/').textContent()
    console.log(`Selection text: ${selectionText}`)
    expect(selectionText).toContain('selected')

    await page.screenshot({ path: 'bulk-test-1-selected.png', fullPage: true })

    // TEST 2: Select all
    console.log('\n=== TEST 2: Select All ===')
    const selectAllCheckbox = page.locator('thead input[type="checkbox"]').first()
    await selectAllCheckbox.check()
    await page.waitForTimeout(500)

    const allSelectedText = await page.locator('text=/\\d+ product\\(s\\) selected/').textContent()
    console.log(`All selected text: ${allSelectedText}`)

    await page.screenshot({ path: 'bulk-test-2-select-all.png', fullPage: true })

    // Clear selection
    await selectAllCheckbox.uncheck()
    await page.waitForTimeout(500)

    // TEST 3: Bulk Deactivate
    console.log('\n=== TEST 3: Bulk Deactivate ===')
    // Select first 3 products
    const checkboxes = await page.locator('tbody tr input[type="checkbox"]').all()
    for (let i = 0; i < Math.min(3, checkboxes.length); i++) {
      await checkboxes[i].check()
    }
    await page.waitForTimeout(500)

    // Click Deactivate Selected
    const deactivateBtn = page.locator('button:has-text("Deactivate Selected")')
    await deactivateBtn.click()

    // Wait for toast/success message
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'bulk-test-3-deactivated.png', fullPage: true })

    // Verify in database
    const deactivatedProducts = await prisma.product.findMany({
      where: {
        id: { in: testProductIds.slice(0, 3) }
      },
      select: { id: true, isActive: true }
    })

    const deactivatedCount = deactivatedProducts.filter(p => !p.isActive).length
    console.log(`Deactivated ${deactivatedCount} products in database`)
    expect(deactivatedCount).toBeGreaterThan(0)

    // TEST 4: Bulk Activate
    console.log('\n=== TEST 4: Bulk Activate ===')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Select the deactivated products
    const checkboxes2 = await page.locator('tbody tr input[type="checkbox"]').all()
    for (let i = 0; i < Math.min(3, checkboxes2.length); i++) {
      await checkboxes2[i].check()
    }
    await page.waitForTimeout(500)

    // Click Activate Selected
    const activateBtn = page.locator('button:has-text("Activate Selected")')
    await activateBtn.click()

    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'bulk-test-4-activated.png', fullPage: true })

    // Verify in database
    const activatedProducts = await prisma.product.findMany({
      where: {
        id: { in: testProductIds.slice(0, 3) }
      },
      select: { id: true, isActive: true }
    })

    const activatedCount = activatedProducts.filter(p => p.isActive).length
    console.log(`Activated ${activatedCount} products in database`)
    expect(activatedCount).toBe(3)

    // TEST 5: Bulk Delete
    console.log('\n=== TEST 5: Bulk Delete ===')
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Select first 2 products
    const checkboxes3 = await page.locator('tbody tr input[type="checkbox"]').all()
    for (let i = 0; i < Math.min(2, checkboxes3.length); i++) {
      await checkboxes3[i].check()
    }
    await page.waitForTimeout(500)

    // Set up dialog handler
    page.on('dialog', async dialog => {
      console.log(`Dialog: ${dialog.message()}`)
      await dialog.accept()
    })

    // Click Delete Selected
    const deleteBtn = page.locator('button:has-text("Delete Selected")')
    await deleteBtn.click()

    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'bulk-test-5-deleted.png', fullPage: true })

    // Verify in database (soft delete)
    const deletedProducts = await prisma.product.findMany({
      where: {
        id: { in: testProductIds.slice(0, 2) }
      },
      select: { id: true, deletedAt: true }
    })

    const deletedCount = deletedProducts.filter(p => p.deletedAt !== null).length
    console.log(`Soft deleted ${deletedCount} products in database`)

    console.log('\n=== ALL TESTS COMPLETED ===')
  })
})
