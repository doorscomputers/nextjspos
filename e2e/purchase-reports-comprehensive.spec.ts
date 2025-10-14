import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Purchase Reports Feature - Comprehensive Tests', () => {
  let businessId: number
  let testLocationId: number
  let testSupplierId: number
  let testPurchaseId: number

  test.beforeAll(async () => {
    // Get demo business
    const business = await prisma.business.findFirst({
      where: { name: { contains: 'Demo' } },
    })
    businessId = business?.id || 1

    // Get test location
    const location = await prisma.businessLocation.findFirst({
      where: { businessId },
    })
    testLocationId = location?.id || 1

    // Get test supplier
    const supplier = await prisma.supplier.findFirst({
      where: { businessId },
    })
    testSupplierId = supplier?.id || 1

    // Get a test purchase for testing
    const purchase = await prisma.purchase.findFirst({
      where: { businessId },
    })
    testPurchaseId = purchase?.id || 0
  })

  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test.describe('1. Purchase Item Summary Report', () => {
    test('1.1 Access Purchase Item Summary endpoint', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/item-summary', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      console.log('Item Summary Report:', JSON.stringify(data, null, 2))

      // Verify response structure
      expect(data).toBeTruthy()
      if (data.success !== false) {
        expect(Array.isArray(data) || data.data).toBeTruthy()
      }
    })

    test('1.2 Filter by date range', async ({ page }) => {
      const startDate = '2025-01-01'
      const endDate = '2025-12-31'

      const response = await page.request.get(
        `/api/reports/purchases/item-summary?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Item Summary with Date Filter:', JSON.stringify(data, null, 2))
    })

    test('1.3 Filter by supplier', async ({ page }) => {
      const response = await page.request.get(
        `/api/reports/purchases/item-summary?supplierId=${testSupplierId}`,
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Item Summary by Supplier:', JSON.stringify(data, null, 2))
    })

    test('1.4 Filter by location', async ({ page }) => {
      const response = await page.request.get(
        `/api/reports/purchases/item-summary?locationId=${testLocationId}`,
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Item Summary by Location:', JSON.stringify(data, null, 2))
    })

    test('1.5 Verify data accuracy', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/item-summary', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        // Verify each item has required fields
        data.forEach((item: any) => {
          expect(item).toHaveProperty('productName')
          expect(item).toHaveProperty('totalQuantity')
          expect(item).toHaveProperty('totalCost')
        })
      }
    })
  })

  test.describe('2. Purchase Payment Status Report', () => {
    test('2.1 Access Payment Status endpoint', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/payment-status', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      console.log('Payment Status Report:', JSON.stringify(data, null, 2))

      expect(data).toBeTruthy()
    })

    test('2.2 Filter by payment status', async ({ page }) => {
      const statuses = ['paid', 'partial', 'unpaid', 'overdue']

      for (const status of statuses) {
        const response = await page.request.get(
          `/api/reports/purchases/payment-status?status=${status}`,
          {
            headers: {
              'Cookie': await page.context().cookies().then(cookies =>
                cookies.map(c => `${c.name}=${c.value}`).join('; ')
              ),
            },
          }
        )

        expect(response.ok()).toBeTruthy()
        const data = await response.json()

        console.log(`Payment Status (${status}):`, JSON.stringify(data, null, 2))
      }
    })

    test('2.3 Filter overdue payments', async ({ page }) => {
      const response = await page.request.get(
        '/api/reports/purchases/payment-status?overdue=true',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Overdue Payments:', JSON.stringify(data, null, 2))

      if (Array.isArray(data) && data.length > 0) {
        // Verify all returned items are actually overdue
        data.forEach((item: any) => {
          if (item.dueDate) {
            const dueDate = new Date(item.dueDate)
            const today = new Date()
            expect(dueDate < today).toBeTruthy()
          }
        })
      }
    })

    test('2.4 Verify balance calculations', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/payment-status', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        data.forEach((item: any) => {
          if (item.totalAmount && item.paidAmount !== undefined) {
            const expectedBalance = item.totalAmount - item.paidAmount
            if (item.balanceAmount !== undefined) {
              expect(item.balanceAmount).toBeCloseTo(expectedBalance, 2)
            }
          }
        })
      }
    })
  })

  test.describe('3. Purchase Supplier Summary Report', () => {
    test('3.1 Access Supplier Summary endpoint', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/supplier-summary', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      console.log('Supplier Summary Report:', JSON.stringify(data, null, 2))

      expect(data).toBeTruthy()
    })

    test('3.2 Filter by date range', async ({ page }) => {
      const startDate = '2025-01-01'
      const endDate = '2025-12-31'

      const response = await page.request.get(
        `/api/reports/purchases/supplier-summary?startDate=${startDate}&endDate=${endDate}`,
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Supplier Summary with Date Filter:', JSON.stringify(data, null, 2))
    })

    test('3.3 Filter by specific supplier', async ({ page }) => {
      const response = await page.request.get(
        `/api/reports/purchases/supplier-summary?supplierId=${testSupplierId}`,
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Specific Supplier Summary:', JSON.stringify(data, null, 2))

      if (Array.isArray(data) && data.length > 0) {
        // Should only contain the specified supplier
        data.forEach((item: any) => {
          if (item.supplierId) {
            expect(item.supplierId).toBe(testSupplierId)
          }
        })
      }
    })

    test('3.4 Verify aggregation accuracy', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/supplier-summary', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        // Verify each supplier summary has required fields
        data.forEach((supplier: any) => {
          expect(supplier).toHaveProperty('supplierName')
          expect(supplier).toHaveProperty('totalPurchases')
          expect(supplier).toHaveProperty('totalAmount')

          // Total amount should be non-negative
          if (supplier.totalAmount !== undefined) {
            expect(supplier.totalAmount).toBeGreaterThanOrEqual(0)
          }
        })
      }
    })

    test('3.5 Sort by purchase volume', async ({ page }) => {
      const response = await page.request.get(
        '/api/reports/purchases/supplier-summary?sortBy=totalAmount&order=desc',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      if (Array.isArray(data) && data.length > 1) {
        // Verify descending order
        for (let i = 0; i < data.length - 1; i++) {
          if (data[i].totalAmount !== undefined && data[i + 1].totalAmount !== undefined) {
            expect(data[i].totalAmount).toBeGreaterThanOrEqual(data[i + 1].totalAmount)
          }
        }
      }
    })
  })

  test.describe('4. Purchase Trend Analysis Report', () => {
    test('4.1 Access Trend Analysis endpoint', async ({ page }) => {
      const response = await page.request.get('/api/reports/purchases/trend-analysis', {
        headers: {
          'Cookie': await page.context().cookies().then(cookies =>
            cookies.map(c => `${c.name}=${c.value}`).join('; ')
          ),
        },
      })

      expect(response.ok()).toBeTruthy()
      const data = await response.json()
      console.log('Trend Analysis Report:', JSON.stringify(data, null, 2))

      expect(data).toBeTruthy()
    })

    test('4.2 Group by month', async ({ page }) => {
      const response = await page.request.get(
        '/api/reports/purchases/trend-analysis?groupBy=month',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Monthly Trend:', JSON.stringify(data, null, 2))

      if (Array.isArray(data) && data.length > 0) {
        // Verify monthly grouping format
        data.forEach((item: any) => {
          expect(item).toHaveProperty('period')
          expect(item).toHaveProperty('totalPurchases')
          expect(item).toHaveProperty('totalAmount')
        })
      }
    })

    test('4.3 Group by quarter', async ({ page }) => {
      const response = await page.request.get(
        '/api/reports/purchases/trend-analysis?groupBy=quarter',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Quarterly Trend:', JSON.stringify(data, null, 2))
    })

    test('4.4 Group by year', async ({ page }) => {
      const response = await page.request.get(
        '/api/reports/purchases/trend-analysis?groupBy=year',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Yearly Trend:', JSON.stringify(data, null, 2))
    })

    test('4.5 Filter by date range for trends', async ({ page }) => {
      const startDate = '2025-01-01'
      const endDate = '2025-12-31'

      const response = await page.request.get(
        `/api/reports/purchases/trend-analysis?startDate=${startDate}&endDate=${endDate}&groupBy=month`,
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      expect(response.ok()).toBeTruthy()
      const data = await response.json()

      console.log('Trend Analysis with Date Range:', JSON.stringify(data, null, 2))
    })

    test('4.6 Verify trend calculations', async ({ page }) => {
      const response = await page.request.get(
        '/api/reports/purchases/trend-analysis?groupBy=month',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      const data = await response.json()

      if (Array.isArray(data) && data.length > 0) {
        // Verify each period has valid data
        data.forEach((period: any) => {
          expect(period.totalPurchases).toBeGreaterThanOrEqual(0)
          expect(period.totalAmount).toBeGreaterThanOrEqual(0)

          // If there's average calculation
          if (period.averagePurchaseValue !== undefined && period.totalPurchases > 0) {
            const calculated = period.totalAmount / period.totalPurchases
            expect(period.averagePurchaseValue).toBeCloseTo(calculated, 2)
          }
        })
      }
    })
  })

  test.describe('5. Purchase Reports UI Tests', () => {
    test('5.1 Navigate to Purchase Reports page', async ({ page }) => {
      await page.goto('/dashboard/reports/purchases')
      await page.waitForLoadState('networkidle')

      // Verify page loaded
      const title = await page.title()
      expect(title).toBeTruthy()

      // Check for report tabs or sections
      const bodyText = await page.locator('body').textContent()
      expect(bodyText).toBeTruthy()
    })

    test('5.2 Test date range picker', async ({ page }) => {
      await page.goto('/dashboard/reports/purchases')
      await page.waitForLoadState('networkidle')

      // Try to find and interact with date inputs
      const dateInputs = await page.locator('input[type="date"]').count()
      if (dateInputs >= 2) {
        await page.locator('input[type="date"]').first().fill('2025-01-01')
        await page.locator('input[type="date"]').nth(1).fill('2025-12-31')

        // Look for apply/filter button
        const filterButton = page.locator('button:has-text("Filter"), button:has-text("Apply")')
        if (await filterButton.count() > 0) {
          await filterButton.first().click()
          await page.waitForLoadState('networkidle')
        }
      }
    })

    test('5.3 Test export functionality', async ({ page }) => {
      await page.goto('/dashboard/reports/purchases')
      await page.waitForLoadState('networkidle')

      // Look for export buttons (PDF, Excel, CSV)
      const exportButtons = await page.locator('button:has-text("Export"), button:has-text("Download"), button:has-text("PDF"), button:has-text("Excel")').count()

      if (exportButtons > 0) {
        console.log(`Found ${exportButtons} export buttons`)
      }
    })
  })

  test.describe('6. Multi-tenant Isolation Tests', () => {
    test('6.1 Verify business isolation in reports', async ({ page }) => {
      const endpoints = [
        '/api/reports/purchases/item-summary',
        '/api/reports/purchases/payment-status',
        '/api/reports/purchases/supplier-summary',
        '/api/reports/purchases/trend-analysis',
      ]

      for (const endpoint of endpoints) {
        const response = await page.request.get(endpoint, {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        })

        if (response.ok()) {
          const data = await response.json()

          // If we get purchase IDs from the response, verify they belong to correct business
          if (Array.isArray(data) && data.length > 0) {
            const firstItem = data[0]
            if (firstItem.purchaseId) {
              const purchase = await prisma.purchase.findUnique({
                where: { id: firstItem.purchaseId },
              })
              expect(purchase?.businessId).toBe(businessId)
            }
          }
        }
      }
    })
  })

  test.describe('7. Performance Tests', () => {
    test('7.1 Response time for large datasets', async ({ page }) => {
      const startTime = Date.now()

      const response = await page.request.get(
        '/api/reports/purchases/item-summary?startDate=2020-01-01&endDate=2025-12-31',
        {
          headers: {
            'Cookie': await page.context().cookies().then(cookies =>
              cookies.map(c => `${c.name}=${c.value}`).join('; ')
            ),
          },
        }
      )

      const endTime = Date.now()
      const duration = endTime - startTime

      console.log(`Response time: ${duration}ms`)
      expect(response.ok()).toBeTruthy()

      // Should respond within reasonable time (10 seconds max)
      expect(duration).toBeLessThan(10000)
    })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })
})
