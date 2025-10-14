/**
 * MANUAL FUNCTIONAL TESTING - UltimatePOS Modern
 * Comprehensive feature testing with proper wait states
 */

import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'http://localhost:3000'

// Helper to login
async function loginAs(page, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('domcontentloaded')

  const usernameInput = page.locator('input[name="username"]')
  const passwordInput = page.locator('input[name="password"]')
  const submitButton = page.locator('button[type="submit"]')

  await usernameInput.waitFor({ state: 'visible', timeout: 10000 })
  await usernameInput.fill(username)
  await passwordInput.fill(password)
  await submitButton.click()

  // Wait a bit for auth processing
  await page.waitForTimeout(2000)
}

test.describe('Authentication Tests', () => {
  test('Super Admin can login', async ({ page }) => {
    await loginAs(page, 'superadmin', 'password')

    // Should redirect to dashboard or show dashboard content
    await page.waitForTimeout(3000)

    // Check URL contains dashboard
    const url = page.url()
    expect(url).toContain('dashboard')

    // Take screenshot
    await page.screenshot({ path: 'test-results/superadmin-dashboard.png', fullPage: true })
  })

  test('Admin can login', async ({ page }) => {
    await loginAs(page, 'admin', 'password')
    await page.waitForTimeout(3000)

    const url = page.url()
    expect(url).toContain('dashboard')

    await page.screenshot({ path: 'test-results/admin-dashboard.png', fullPage: true })
  })

  test('Invalid credentials show error', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`)
    await page.waitForLoadState('domcontentloaded')

    await page.locator('input[name="username"]').fill('invaliduser')
    await page.locator('input[name="password"]').fill('wrongpassword')
    await page.locator('button[type="submit"]').click()

    await page.waitForTimeout(2000)

    // Should still be on login page or show error
    const url = page.url()
    expect(url).toContain('login')
  })
})

test.describe('Dashboard and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin', 'password')
    await page.waitForTimeout(3000)
  })

  test('Dashboard page loads', async ({ page }) => {
    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    // Check URL
    expect(page.url()).toContain('dashboard')

    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-view.png', fullPage: true })
  })

  test('Products page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('products')
    await page.screenshot({ path: 'test-results/products-page.png', fullPage: true })
  })

  test('Purchases page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/purchases`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('purchases')
    await page.screenshot({ path: 'test-results/purchases-page.png', fullPage: true })
  })

  test('Sales page is accessible', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/sales`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    expect(page.url()).toContain('sales')
    await page.screenshot({ path: 'test-results/sales-page.png', fullPage: true })
  })

  test('Reports - Sales Report', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/sales-report`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/sales-report.png', fullPage: true })
  })

  test('Reports - Purchase Report', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases-report`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/purchase-report.png', fullPage: true })
  })

  test('Reports - Stock Alert', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/stock-alert`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/stock-alert-report.png', fullPage: true })
  })

  test('Purchase Suggestions page', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/purchases/suggestions`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/purchase-suggestions.png', fullPage: true })
  })

  test('Purchase Reports Advanced', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/reports/purchases`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/purchase-reports-advanced.png', fullPage: true })
  })

  test('Inventory Corrections', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/inventory-corrections`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/inventory-corrections.png', fullPage: true })
  })

  test('Stock Transfers', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/transfers`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/stock-transfers.png', fullPage: true })
  })

  test('Locations Management', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard/locations`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/locations.png', fullPage: true })
  })
})

test.describe('Database Verification', () => {
  test('Database has users', async () => {
    const users = await prisma.user.findMany({
      where: { userType: 'user' },
      take: 5
    })

    expect(users.length).toBeGreaterThan(0)
    console.log(`Found ${users.length} users in database`)
  })

  test('Database has products', async () => {
    const products = await prisma.product.findMany({
      take: 5,
      include: { variations: true }
    })

    expect(products.length).toBeGreaterThan(0)
    console.log(`Found ${products.length} products in database`)
  })

  test('Database has business locations', async () => {
    const locations = await prisma.businessLocation.findMany({
      take: 5
    })

    expect(locations.length).toBeGreaterThan(0)
    console.log(`Found ${locations.length} locations in database`)
  })

  test('Multi-tenancy - Products belong to businesses', async () => {
    const products = await prisma.product.findMany({
      take: 10,
      include: { variations: true }
    })

    for (const product of products) {
      expect(product.businessId).toBeTruthy()
      expect(product.businessId).toBeGreaterThan(0)
    }

    console.log(`Verified ${products.length} products have valid businessId`)
  })

  test('Stock transactions exist and are valid', async () => {
    const transactions = await prisma.stockTransaction.findMany({
      take: 10,
      include: {
        product: true,
        productVariation: true
      }
    })

    for (const txn of transactions) {
      expect(txn.businessId).toBeTruthy()
      expect(txn.product).toBeTruthy()
      expect(txn.productVariation).toBeTruthy()
    }

    console.log(`Verified ${transactions.length} stock transactions`)
  })
})

test.describe('UI Quality Checks', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'admin', 'password')
    await page.waitForTimeout(3000)
  })

  test('Mobile responsiveness - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/mobile-dashboard.png', fullPage: true })
  })

  test('Tablet responsiveness - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/tablet-dashboard.png', fullPage: true })
  })

  test('Desktop responsiveness - Dashboard', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto(`${BASE_URL}/dashboard`)
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/desktop-dashboard.png', fullPage: true })
  })
})

test.afterAll(async () => {
  await prisma.$disconnect()
})
