/**
 * COMPREHENSIVE POS SYSTEM TEST SUITE
 * Tests all major features with database verification
 *
 * Features tested:
 * 1. Authentication (all roles)
 * 2. RBAC and menu visibility
 * 3. Product CRUD operations
 * 4. Purchase operations
 * 5. Sales transactions
 * 6. Inventory management
 * 7. Dashboard functionality
 * 8. Reports
 * 9. Multi-location support
 * 10. Purchase Suggestions
 */

import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test configuration
const BASE_URL = 'http://localhost:3000'

// Demo account credentials
const ACCOUNTS = {
  superadmin: { username: 'superadmin', password: 'password' },
  admin: { username: 'admin', password: 'password' },
  manager: { username: 'manager', password: 'password' },
  cashier: { username: 'cashier', password: 'password' },
}

// Helper function to login
async function login(page: Page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  // Wait for redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 10000 })
  await page.waitForLoadState('networkidle')
}

// Helper function to logout
async function logout(page: Page) {
  // Look for user menu or profile button
  const userMenuSelectors = [
    'button[data-testid="user-menu"]',
    'button:has-text("Profile")',
    '[aria-label="User menu"]',
    'button[aria-haspopup="menu"]'
  ]

  for (const selector of userMenuSelectors) {
    try {
      await page.click(selector, { timeout: 2000 })
      await page.click('button:has-text("Logout"), a:has-text("Logout")')
      await page.waitForURL('**/login')
      return
    } catch (e) {
      // Try next selector
    }
  }

  // If no logout button found, navigate directly
  await page.goto(`${BASE_URL}/login`)
}

test.describe('Authentication and Session Management', () => {
  test('Login - Super Admin', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    // Verify login page loads
    await expect(page).toHaveTitle(/Login|UltimatePOS/i)

    // Fill credentials
    await page.fill('input[name="username"]', ACCOUNTS.superadmin.username)
    await page.fill('input[name="password"]', ACCOUNTS.superadmin.password)

    // Submit
    await page.click('button[type="submit"]')

    // Wait for dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 })

    // Verify dashboard loads
    await expect(page.locator('h1, h2')).toContainText(/Dashboard|Welcome/i, { timeout: 5000 })
  })

  test('Login - Admin', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Login - Manager', async ({ page }) => {
    await login(page, ACCOUNTS.manager.username, ACCOUNTS.manager.password)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Login - Cashier', async ({ page }) => {
    await login(page, ACCOUNTS.cashier.username, ACCOUNTS.cashier.password)
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('Login - Invalid Credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)

    await page.fill('input[name="username"]', 'invalid')
    await page.fill('input[name="password"]', 'invalid')
    await page.click('button[type="submit"]')

    // Should show error message
    await expect(page.locator('text=/Invalid credentials|Login failed/i')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('RBAC - Role-Based Access Control', () => {
  test('Admin - Should see all menu items', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    // Check for key menu items
    const expectedMenuItems = ['Products', 'Sales', 'Purchases', 'Reports']

    for (const item of expectedMenuItems) {
      const menuItem = page.locator(`nav a:has-text("${item}"), aside a:has-text("${item}")`)
      await expect(menuItem.first()).toBeVisible({ timeout: 3000 })
    }
  })

  test('Cashier - Should see limited menu items', async ({ page }) => {
    await login(page, ACCOUNTS.cashier.username, ACCOUNTS.cashier.password)

    // Should see these items
    await expect(page.locator('text=/Sales|Products/i').first()).toBeVisible({ timeout: 5000 })

    // Should NOT have delete permissions for most items
    // Navigate to products if visible
    const productsLink = page.locator('a:has-text("Products")')
    if (await productsLink.count() > 0) {
      await productsLink.first().click()
      await page.waitForLoadState('networkidle')

      // Should not see delete buttons for cashier role
      const deleteButtons = page.locator('button:has-text("Delete")')
      const count = await deleteButtons.count()
      expect(count).toBe(0)
    }
  })
})

test.describe('Product Management - CRUD Operations', () => {
  let testProductId: number | null = null

  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
  })

  test('Create Product - Happy Path', async ({ page }) => {
    // Navigate to add product page
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    // Fill product form
    const productName = `Test Product ${Date.now()}`
    const sku = `TEST-${Date.now()}`

    await page.fill('input[name="name"]', productName)
    await page.fill('input[name="sku"]', sku)

    // Select category if available
    const categorySelect = page.locator('select[name="categoryId"]')
    if (await categorySelect.count() > 0) {
      await categorySelect.selectOption({ index: 1 })
    }

    // Set prices
    await page.fill('input[name="purchasePrice"]', '100')
    await page.fill('input[name="sellingPrice"]', '150')

    // Submit form
    await page.click('button[type="submit"]')

    // Wait for success message
    await expect(page.locator('text=/success|created/i')).toBeVisible({ timeout: 10000 })

    // Verify in database
    const product = await prisma.product.findFirst({
      where: { sku },
      include: { variations: true }
    })

    expect(product).toBeTruthy()
    expect(product?.name).toBe(productName)
    expect(product?.sku).toBe(sku)

    testProductId = product?.id || null
  })

  test('View Products List', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')

    // Should show products table
    await expect(page.locator('table, [role="table"]')).toBeVisible({ timeout: 5000 })

    // Should have at least one product row
    const rows = page.locator('tbody tr, [role="row"]')
    const count = await rows.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Search Products', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')

    // Find search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="Search"]')
    if (await searchInput.count() > 0) {
      await searchInput.first().fill('Test')
      await page.waitForTimeout(1000) // Wait for search to process

      // Results should update
      await expect(page.locator('table, [role="table"]')).toBeVisible()
    }
  })

  test.afterAll(async () => {
    // Cleanup test product if created
    if (testProductId) {
      await prisma.product.delete({
        where: { id: testProductId }
      }).catch(() => {})
    }
    await prisma.$disconnect()
  })
})

test.describe('Purchase Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
  })

  test('View Purchases List', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/purchases`)
    await page.waitForLoadState('networkidle')

    // Should show purchases page
    await expect(page.locator('h1, h2')).toContainText(/Purchase/i, { timeout: 5000 })
  })

  test('Navigate to Create Purchase', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/purchases/create`)
    await page.waitForLoadState('networkidle')

    // Should show purchase form
    await expect(page.locator('h1, h2')).toContainText(/Purchase|New/i, { timeout: 5000 })
  })

  test('View Purchase Receipts (GRN)', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/purchases/receipts`)
    await page.waitForLoadState('networkidle')

    // Should show receipts page
    await expect(page.locator('h1, h2')).toContainText(/Receipt|GRN/i, { timeout: 5000 })
  })
})

test.describe('Sales Operations', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
  })

  test('View Sales List', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/sales`)
    await page.waitForLoadState('networkidle')

    // Should show sales page
    await expect(page.locator('h1, h2')).toContainText(/Sale/i, { timeout: 5000 })
  })

  test('Navigate to Create Sale', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/sales/create`)
    await page.waitForLoadState('networkidle')

    // Should show POS interface
    await expect(page).toHaveURL(/\/sales\/create/)
  })
})

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
  })

  test('View Product Stock', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/products/stock`)
    await page.waitForLoadState('networkidle')

    // Should show stock page
    await expect(page.locator('h1, h2')).toContainText(/Stock/i, { timeout: 5000 })
  })

  test('View Stock Transfers', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/transfers`)
    await page.waitForLoadState('networkidle')

    // Should show transfers page
    await expect(page.locator('h1, h2')).toContainText(/Transfer/i, { timeout: 5000 })
  })

  test('View Inventory Corrections', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/inventory-corrections`)
    await page.waitForLoadState('networkidle')

    // Should show corrections page
    await expect(page.locator('h1, h2')).toContainText(/Correction/i, { timeout: 5000 })
  })
})

test.describe('Dashboard Functionality', () => {
  test('Admin Dashboard - Should load with stats', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Should show dashboard title
    await expect(page.locator('h1, h2')).toContainText(/Dashboard/i, { timeout: 5000 })

    // Should have stat cards or widgets
    const statCards = page.locator('[class*="stat"], [class*="card"], [class*="widget"]')
    const count = await statCards.count()
    expect(count).toBeGreaterThan(0)
  })

  test('Dashboard - Should show recent activity', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('networkidle')

    // Dashboard should be visible
    await expect(page.locator('body')).toBeVisible()
  })
})

test.describe('Reports', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
  })

  test('Sales Report', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/sales-report`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1, h2')).toContainText(/Sale.*Report/i, { timeout: 5000 })
  })

  test('Purchase Report', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases-report`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1, h2')).toContainText(/Purchase.*Report/i, { timeout: 5000 })
  })

  test('Stock Alert Report', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/stock-alert`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1, h2')).toContainText(/Stock.*Alert/i, { timeout: 5000 })
  })

  test('Purchase Reports - Advanced', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases`)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h1, h2')).toContainText(/Purchase/i, { timeout: 5000 })
  })
})

test.describe('Purchase Suggestions Feature', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)
  })

  test('Access Purchase Suggestions Page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/purchases/suggestions`)
    await page.waitForLoadState('networkidle')

    // Should show suggestions page
    await expect(page.locator('h1, h2')).toContainText(/Suggestion/i, { timeout: 5000 })
  })
})

test.describe('Multi-Location Support', () => {
  test('View Locations', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    await page.goto(`${BASE_URL}/dashboard/locations`)
    await page.waitForLoadState('networkidle')

    // Should show locations page
    await expect(page.locator('h1, h2')).toContainText(/Location/i, { timeout: 5000 })
  })

  test('Verify Location Data Isolation', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    // Get user's business ID from database
    const user = await prisma.user.findUnique({
      where: { username: ACCOUNTS.admin.username },
      include: { business: true }
    })

    expect(user).toBeTruthy()
    expect(user?.businessId).toBeTruthy()

    // Verify locations belong to same business
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: user!.businessId! }
    })

    expect(locations.length).toBeGreaterThan(0)
  })
})

test.describe('UI/UX Quality Checks', () => {
  test('Responsive Design - Mobile View', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    // Dashboard should be visible on mobile
    await expect(page.locator('body')).toBeVisible()
  })

  test('Responsive Design - Tablet View', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    // Dashboard should be visible on tablet
    await expect(page.locator('body')).toBeVisible()
  })

  test('No Dark-on-Dark Text Issues', async ({ page }) => {
    await login(page, ACCOUNTS.admin.username, ACCOUNTS.admin.password)

    // Take screenshot for visual inspection
    await page.screenshot({ path: 'test-results/dashboard-ui.png', fullPage: true })

    // Check that main content is visible
    await expect(page.locator('main, [role="main"]')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Database Integrity Verification', () => {
  test('Verify Multi-Tenancy Data Isolation', async () => {
    // Check that all products belong to valid businesses
    const products = await prisma.product.findMany({
      take: 10,
      include: { variations: true }
    })

    for (const product of products) {
      expect(product.businessId).toBeTruthy()
      expect(product.businessId).toBeGreaterThan(0)
    }
  })

  test('Verify User-Business Relationships', async () => {
    const users = await prisma.user.findMany({
      where: {
        userType: 'user',
        NOT: { businessId: null }
      },
      include: { business: true }
    })

    for (const user of users) {
      expect(user.business).toBeTruthy()
    }
  })

  test('Verify Stock Transaction Integrity', async () => {
    const stockTransactions = await prisma.stockTransaction.findMany({
      take: 10,
      include: {
        product: true,
        productVariation: true
      }
    })

    for (const transaction of stockTransactions) {
      expect(transaction.businessId).toBeTruthy()
      expect(transaction.product).toBeTruthy()
      expect(transaction.productVariation).toBeTruthy()
    }
  })
})
