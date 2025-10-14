import { test, expect } from '@playwright/test'

test.describe('Product Activation/Deactivation', () => {
  // Login before each test
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test('should display active badge for active products', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // Check if there's at least one active badge
    const activeBadge = await page.locator('text=Active').first()
    await expect(activeBadge).toBeVisible()
  })

  test('should toggle product from active to inactive', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // Get the first product row with active status
    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    const productName = await firstActiveRow.locator('td').first().textContent()

    // Click the switch to deactivate
    await firstActiveRow.locator('[role="switch"]').click()

    // Wait for the toast notification
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Verify the badge changed to Inactive
    await expect(firstActiveRow.locator('text=Inactive')).toBeVisible()

    // Verify row has gray background
    await expect(firstActiveRow).toHaveClass(/bg-gray-50/)
  })

  test('should toggle product from inactive to active', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // First deactivate a product
    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Now reactivate it
    const inactiveRow = await page.locator('tr:has(text("Inactive"))').first()
    await inactiveRow.locator('[role="switch"]').click()

    // Wait for the toast notification
    await expect(page.locator('text=activated successfully')).toBeVisible({ timeout: 5000 })

    // Verify the badge changed to Active
    await expect(inactiveRow.locator('text=Active')).toBeVisible()
  })

  test('should filter products by active status', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // Open filter dropdown
    await page.click('button:has-text("All Products")')

    // Select "Active Only"
    await page.click('text=Active Only')

    // Wait for the request to complete
    await page.waitForTimeout(1000)

    // All visible products should have Active badge
    const inactiveBadges = await page.locator('text=Inactive').count()
    expect(inactiveBadges).toBe(0)
  })

  test('should filter products by inactive status', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // First, deactivate at least one product
    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Open filter dropdown
    await page.click('button:has-text("All Products")')

    // Select "Inactive Only"
    await page.click('text=Inactive Only')

    // Wait for the request to complete
    await page.waitForTimeout(1000)

    // All visible products should have Inactive badge
    const activeBadges = await page.locator('text=Active').count()
    expect(activeBadges).toBe(0)
  })

  test('should show all products when filter is set to "All Products"', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // Deactivate one product to ensure we have both active and inactive
    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Set filter to Inactive Only first
    await page.click('button:has-text("All Products")')
    await page.click('text=Inactive Only')
    await page.waitForTimeout(500)

    // Now switch back to All Products
    await page.click('button:has-text("Inactive Only")')
    await page.click('text=All Products')
    await page.waitForTimeout(1000)

    // Should see both Active and Inactive badges
    const activeBadges = await page.locator('text=Active').count()
    const inactiveBadges = await page.locator('text=Inactive').count()

    expect(activeBadges).toBeGreaterThan(0)
    expect(inactiveBadges).toBeGreaterThan(0)
  })

  test('inactive products should have grayed out text', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // Deactivate a product
    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    const productNameCell = firstActiveRow.locator('td').first()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Check that product name has gray text color
    await expect(productNameCell.locator('div.text-sm')).toHaveClass(/text-gray-500/)
  })

  test('only users with product.update permission can see toggle switch', async ({ page }) => {
    // This test assumes you're logged in as admin who has PRODUCT_UPDATE permission
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // The switch should be visible
    const switches = await page.locator('[role="switch"]').count()
    expect(switches).toBeGreaterThan(0)

    // TODO: Add test with cashier role (no PRODUCT_UPDATE permission)
    // The test would verify that switches are NOT visible for cashier
  })

  test('should persist product activation status across page refreshes', async ({ page }) => {
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    // Deactivate a product
    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    const productName = await firstActiveRow.locator('td').first().textContent()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Refresh the page
    await page.reload()
    await page.waitForSelector('table')

    // Find the same product and verify it's still inactive
    const productRow = await page.locator(`tr:has-text("${productName?.trim()}")`).first()
    await expect(productRow.locator('text=Inactive')).toBeVisible()
  })

  test('API should return only active products when forTransaction=true', async ({ page }) => {
    // First, ensure we have at least one inactive product
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Make API request with forTransaction parameter
    const response = await page.request.get('/api/products?forTransaction=true')
    const data = await response.json()

    // All returned products should have isActive: true
    const allActive = data.products.every((product: any) => product.isActive === true)
    expect(allActive).toBe(true)
  })

  test('default state for new products should be active', async ({ page }) => {
    await page.goto('/dashboard/products/add')

    // Fill in minimal required fields
    await page.fill('input[name="name"]', 'Test Active Product')
    await page.selectOption('select[name="type"]', 'single')
    await page.fill('input[name="purchasePrice"]', '10')
    await page.fill('input[name="sellingPrice"]', '15')

    // Submit the form
    await page.click('button[type="submit"]')

    // Wait for success and redirect
    await page.waitForURL('/dashboard/products', { timeout: 10000 })

    // Search for the newly created product
    await page.fill('input[placeholder*="Search"]', 'Test Active Product')
    await page.waitForTimeout(500)

    // Verify it has Active badge
    const newProductRow = await page.locator('tr:has-text("Test Active Product")').first()
    await expect(newProductRow.locator('text=Active')).toBeVisible()
  })
})

test.describe('Transaction Forms - Inactive Product Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  // Note: These tests assume transaction forms exist
  // If they don't exist yet, these tests will be skipped

  test.skip('inactive products should not appear in sales form', async ({ page }) => {
    // Deactivate a product first
    await page.goto('/dashboard/products')
    await page.waitForSelector('table')

    const firstActiveRow = await page.locator('tr:has(text("Active"))').first()
    const productName = await firstActiveRow.locator('td').first().textContent()
    await firstActiveRow.locator('[role="switch"]').click()
    await expect(page.locator('text=deactivated successfully')).toBeVisible({ timeout: 5000 })

    // Go to sales form
    await page.goto('/dashboard/sales/create')

    // Open product dropdown
    await page.click('select[name="product"]') // or appropriate selector

    // Verify the inactive product is NOT in the list
    const productOption = await page.locator(`option:has-text("${productName?.trim()}")`).count()
    expect(productOption).toBe(0)
  })

  test.skip('inactive products should not appear in purchase form', async ({ page }) => {
    // Similar to sales form test
    await page.goto('/dashboard/purchases/create')
    // Test implementation...
  })

  test.skip('inactive products should not appear in transfer form', async ({ page }) => {
    // Similar to sales form test
    await page.goto('/dashboard/transfers/create')
    // Test implementation...
  })
})
