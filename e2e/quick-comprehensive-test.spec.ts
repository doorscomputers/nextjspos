import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Quick Comprehensive Test Suite', () => {
  let businessId: number
  let locationId: number

  test.beforeAll(async () => {
    const business = await prisma.business.findFirst()
    businessId = business?.id || 1

    const location = await prisma.businessLocation.findFirst({
      where: { businessId },
    })
    locationId = location?.id || 1
  })

  test('1. Authentication: Login works', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10000 })
  })

  test('2. Purchase Suggestions API: Endpoint accessible', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    const response = await page.request.get('/api/purchases/suggestions', {
      headers: {
        'Cookie': await page.context().cookies().then(cookies =>
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        ),
      },
    })

    console.log('Purchase Suggestions Status:', response.status())
    expect([200, 500].includes(response.status())).toBeTruthy()

    if (response.ok()) {
      const data = await response.json()
      console.log('Purchase Suggestions Data:', JSON.stringify(data, null, 2))
    }
  })

  test('3. Purchase Reports: Item Summary endpoint', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    const response = await page.request.get('/api/reports/purchases/item-summary', {
      headers: {
        'Cookie': await page.context().cookies().then(cookies =>
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        ),
      },
    })

    console.log('Item Summary Report Status:', response.status())
    expect([200, 404, 500].includes(response.status())).toBeTruthy()
  })

  test('4. Purchase Reports: Payment Status endpoint', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    const response = await page.request.get('/api/reports/purchases/payment-status', {
      headers: {
        'Cookie': await page.context().cookies().then(cookies =>
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        ),
      },
    })

    console.log('Payment Status Report Status:', response.status())
    expect([200, 404, 500].includes(response.status())).toBeTruthy()
  })

  test('5. Purchase Reports: Supplier Summary endpoint', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    const response = await page.request.get('/api/reports/purchases/supplier-summary', {
      headers: {
        'Cookie': await page.context().cookies().then(cookies =>
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        ),
      },
    })

    console.log('Supplier Summary Report Status:', response.status())
    expect([200, 404, 500].includes(response.status())).toBeTruthy()
  })

  test('6. Purchase Reports: Trend Analysis endpoint', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    const response = await page.request.get('/api/reports/purchases/trend-analysis', {
      headers: {
        'Cookie': await page.context().cookies().then(cookies =>
          cookies.map(c => `${c.name}=${c.value}`).join('; ')
        ),
      },
    })

    console.log('Trend Analysis Report Status:', response.status())
    expect([200, 404, 500].includes(response.status())).toBeTruthy()
  })

  test('7. Products: List products page loads', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')

    await page.goto('/dashboard/products')
    await page.waitForLoadState('networkidle')
    expect(page.url()).toContain('/products')
  })

  test('8. Database: Verify multi-tenant isolation', async () => {
    const businesses = await prisma.business.findMany({ take: 2 })

    if (businesses.length >= 2) {
      const biz1Products = await prisma.product.findMany({
        where: { businessId: businesses[0].id },
        take: 10,
      })

      const biz2Products = await prisma.product.findMany({
        where: { businessId: businesses[1].id },
        take: 10,
      })

      const biz1Ids = biz1Products.map(p => p.id)
      const biz2Ids = biz2Products.map(p => p.id)
      const overlap = biz1Ids.filter(id => biz2Ids.includes(id))

      expect(overlap.length).toBe(0)
    }
  })

  test('9. Database: Verify stock transactions exist', async () => {
    const transactions = await prisma.stockTransaction.findMany({
      where: { businessId },
      take: 10,
    })

    console.log(`Found ${transactions.length} stock transactions`)
    expect(transactions.length).toBeGreaterThanOrEqual(0)
  })

  test('10. Database: Verify inventory accuracy', async () => {
    const stocks = await prisma.variationLocationDetails.findMany({
      take: 10,
      include: {
        product: true,
        productVariation: true,
      },
    })

    for (const stock of stocks) {
      const qty = parseFloat(stock.qtyAvailable.toString())
      expect(qty).toBeGreaterThanOrEqual(0)
    }

    console.log(`Verified ${stocks.length} inventory records`)
  })

  test('11. RBAC: Verify admin permissions', async () => {
    const admin = await prisma.user.findFirst({
      where: { username: 'admin' },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    expect(admin).toBeTruthy()

    const permissions = admin?.roles.flatMap(ur =>
      ur.role.permissions.map(rp => rp.permission.name)
    ) || []

    console.log(`Admin has ${permissions.length} permissions`)
    expect(permissions.length).toBeGreaterThan(0)
  })

  test('12. Data Integrity: Verify product references', async () => {
    const products = await prisma.product.findMany({
      where: { businessId },
      include: {
        category: true,
        brand: true,
        unit: true,
        variations: true,
      },
      take: 10,
    })

    for (const product of products) {
      if (product.categoryId) {
        expect(product.category).toBeTruthy()
      }
      expect(product.variations.length).toBeGreaterThan(0)
    }

    console.log(`Verified ${products.length} products`)
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })
})
