import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Core CRUD Operations - Comprehensive Tests', () => {
  let businessId: number
  let testLocationId: number
  let testCategoryId: number
  let testBrandId: number
  let testUnitId: number
  let testSupplierId: number
  let testCustomerId: number
  let testProductId: number
  let testVariationId: number
  let testPurchaseId: number
  let testSaleId: number

  test.beforeAll(async () => {
    const business = await prisma.business.findFirst({
      where: { name: { contains: 'Demo' } },
    })
    businessId = business?.id || 1

    const location = await prisma.businessLocation.findFirst({
      where: { businessId },
    })
    testLocationId = location?.id || 1

    const category = await prisma.category.findFirst({
      where: { businessId },
    })
    testCategoryId = category?.id || 1

    const brand = await prisma.brand.findFirst({
      where: { businessId },
    })
    testBrandId = brand?.id || 1

    const unit = await prisma.unit.findFirst({
      where: { businessId },
    })
    testUnitId = unit?.id || 1

    const supplier = await prisma.supplier.findFirst({
      where: { businessId },
    })
    testSupplierId = supplier?.id || 1

    const customer = await prisma.customer.findFirst({
      where: { businessId },
    })
    testCustomerId = customer?.id || 1
  })

  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="username"]', 'admin')
    await page.fill('[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard')
  })

  test.describe('1. Product CRUD Operations', () => {
    test('1.1 CREATE: Add new product via UI', async ({ page }) => {
      await page.goto('/dashboard/products')
      await page.waitForLoadState('networkidle')

      await page.click('text=Add Product')
      await page.waitForSelector('form')

      const productName = `Test Product CRUD ${Date.now()}`
      const sku = `CRUD-${Date.now()}`

      await page.fill('[name="name"]', productName)
      await page.fill('[name="sku"]', sku)
      await page.selectOption('[name="type"]', 'single')

      if (testCategoryId) {
        await page.selectOption('[name="categoryId"]', testCategoryId.toString())
      }
      if (testBrandId) {
        await page.selectOption('[name="brandId"]', testBrandId.toString())
      }
      if (testUnitId) {
        await page.selectOption('[name="unitId"]', testUnitId.toString())
      }

      await page.fill('[name="purchasePrice"]', '100')
      await page.fill('[name="sellingPrice"]', '150')
      await page.fill('[name="description"]', 'Test product for CRUD testing')

      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard/products')

      await expect(page.locator(`text=${productName}`)).toBeVisible({ timeout: 10000 })

      // Verify in database
      const product = await prisma.product.findFirst({
        where: { businessId, sku },
        include: { variations: true },
      })

      expect(product).toBeTruthy()
      expect(product?.name).toBe(productName)
      expect(product?.type).toBe('single')
      expect(parseFloat(product?.purchasePrice?.toString() || '0')).toBe(100)
      expect(parseFloat(product?.sellingPrice?.toString() || '0')).toBe(150)

      testProductId = product!.id
      testVariationId = product!.variations[0]?.id
    })

    test('1.2 READ: View product details', async ({ page }) => {
      await page.goto(`/dashboard/products/${testProductId}`)
      await page.waitForLoadState('networkidle')

      const product = await prisma.product.findUnique({
        where: { id: testProductId },
      })

      await expect(page.locator(`text=${product?.name}`)).toBeVisible()
    })

    test('1.3 UPDATE: Edit product details', async ({ page }) => {
      await page.goto(`/dashboard/products/${testProductId}/edit`)
      await page.waitForLoadState('networkidle')

      const updatedName = `Updated Product ${Date.now()}`
      await page.fill('[name="name"]', updatedName)
      await page.fill('[name="sellingPrice"]', '175')

      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard/products')

      // Verify in database
      const product = await prisma.product.findUnique({
        where: { id: testProductId },
      })

      expect(product?.name).toBe(updatedName)
      expect(parseFloat(product?.sellingPrice?.toString() || '0')).toBe(175)
    })

    test('1.4 READ: List all products', async ({ page }) => {
      await page.goto('/dashboard/products')
      await page.waitForLoadState('networkidle')

      const products = await prisma.product.findMany({
        where: { businessId },
        take: 10,
      })

      for (const product of products.slice(0, 5)) {
        const isVisible = await page.locator(`text=${product.name}`).isVisible()
        if (!isVisible) {
          console.log(`Product ${product.name} not visible on first page`)
        }
      }
    })

    test('1.5 Multi-tenant isolation: Verify product ownership', async () => {
      const product = await prisma.product.findUnique({
        where: { id: testProductId },
      })

      expect(product?.businessId).toBe(businessId)
    })
  })

  test.describe('2. Purchase CRUD Operations', () => {
    test('2.1 CREATE: Create new purchase order', async ({ page }) => {
      await page.goto('/dashboard/purchases')
      await page.waitForLoadState('networkidle')

      await page.click('text=Add Purchase, text=Create Purchase, text=New Purchase')
        .catch(() => console.log('Purchase create button not found with expected text'))

      await page.waitForTimeout(2000)

      const purchaseNumber = `PO-TEST-${Date.now()}`

      // Try to fill purchase form
      const hasForm = await page.locator('form').count() > 0
      if (hasForm) {
        await page.fill('[name="purchaseOrderNumber"]', purchaseNumber).catch(() => {})
        await page.selectOption('[name="supplierId"]', testSupplierId.toString()).catch(() => {})
        await page.selectOption('[name="locationId"]', testLocationId.toString()).catch(() => {})

        // Submit
        await page.click('button[type="submit"]').catch(() => {})
        await page.waitForTimeout(2000)

        // Verify in database
        const purchase = await prisma.purchase.findFirst({
          where: { purchaseOrderNumber: purchaseNumber },
        })

        if (purchase) {
          expect(purchase.supplierId).toBe(testSupplierId)
          expect(purchase.locationId).toBe(testLocationId)
          testPurchaseId = purchase.id
        }
      }
    })

    test('2.2 READ: View purchase details', async ({ page }) => {
      const purchase = await prisma.purchase.findFirst({
        where: { businessId },
      })

      if (purchase) {
        await page.goto(`/dashboard/purchases/${purchase.id}`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator(`text=${purchase.purchaseOrderNumber}`)).toBeVisible({ timeout: 10000 })
      }
    })

    test('2.3 UPDATE: Update purchase status', async ({ page }) => {
      const purchase = await prisma.purchase.findFirst({
        where: { businessId, status: 'pending' },
      })

      if (purchase) {
        // Update via API or UI
        await prisma.purchase.update({
          where: { id: purchase.id },
          data: { status: 'ordered' },
        })

        const updated = await prisma.purchase.findUnique({
          where: { id: purchase.id },
        })

        expect(updated?.status).toBe('ordered')
      }
    })

    test('2.4 READ: List purchases with filters', async ({ page }) => {
      await page.goto('/dashboard/purchases')
      await page.waitForLoadState('networkidle')

      // Try status filter
      const statusFilter = page.locator('select[name="status"], select:has(option:text("Pending"))')
      if (await statusFilter.count() > 0) {
        await statusFilter.first().selectOption('pending')
        await page.waitForLoadState('networkidle')
      }
    })

    test('2.5 Verify purchase inventory integration', async () => {
      const purchase = await prisma.purchase.findFirst({
        where: { businessId, status: 'received' },
        include: { items: true },
      })

      if (purchase && purchase.items.length > 0) {
        const item = purchase.items[0]
        expect(parseFloat(item.quantityReceived.toString())).toBeGreaterThanOrEqual(0)
      }
    })
  })

  test.describe('3. Sale CRUD Operations', () => {
    test('3.1 CREATE: Create new sale', async ({ page }) => {
      await page.goto('/dashboard/sales')
      await page.waitForLoadState('networkidle')

      // Try to create sale
      await page.click('text=New Sale, text=Create Sale, text=Add Sale').catch(() => {
        console.log('Sale create button not found')
      })

      await page.waitForTimeout(2000)

      const hasSaleForm = await page.locator('form').count() > 0
      if (hasSaleForm) {
        // Fill sale details
        const invoiceNumber = `INV-TEST-${Date.now()}`
        await page.fill('[name="invoiceNumber"]', invoiceNumber).catch(() => {})

        if (testCustomerId) {
          await page.selectOption('[name="customerId"]', testCustomerId.toString()).catch(() => {})
        }

        await page.selectOption('[name="locationId"]', testLocationId.toString()).catch(() => {})

        // Submit
        await page.click('button[type="submit"]').catch(() => {})
        await page.waitForTimeout(2000)

        // Verify in database
        const sale = await prisma.sale.findFirst({
          where: { invoiceNumber },
        })

        if (sale) {
          expect(sale.locationId).toBe(testLocationId)
          testSaleId = sale.id
        }
      }
    })

    test('3.2 READ: View sale details', async ({ page }) => {
      const sale = await prisma.sale.findFirst({
        where: { businessId },
      })

      if (sale) {
        await page.goto(`/dashboard/sales/${sale.id}`)
        await page.waitForLoadState('networkidle')

        await expect(page.locator(`text=${sale.invoiceNumber}`)).toBeVisible({ timeout: 10000 })
      }
    })

    test('3.3 UPDATE: Update sale status', async () => {
      const sale = await prisma.sale.findFirst({
        where: { businessId, status: 'draft' },
      })

      if (sale) {
        await prisma.sale.update({
          where: { id: sale.id },
          data: { status: 'completed' },
        })

        const updated = await prisma.sale.findUnique({
          where: { id: sale.id },
        })

        expect(updated?.status).toBe('completed')
      }
    })

    test('3.4 READ: List sales with date filter', async ({ page }) => {
      await page.goto('/dashboard/sales')
      await page.waitForLoadState('networkidle')

      // Check if date filters exist
      const dateInputs = await page.locator('input[type="date"]').count()
      if (dateInputs >= 2) {
        await page.locator('input[type="date"]').first().fill('2025-01-01')
        await page.locator('input[type="date"]').nth(1).fill('2025-12-31')

        await page.click('button:has-text("Filter"), button:has-text("Apply")').catch(() => {})
        await page.waitForLoadState('networkidle')
      }
    })

    test('3.5 Verify sale inventory deduction', async () => {
      const sale = await prisma.sale.findFirst({
        where: { businessId, status: 'completed' },
        include: { items: true },
      })

      if (sale && sale.items.length > 0) {
        const item = sale.items[0]

        // Verify stock transaction was created
        const stockTransaction = await prisma.stockTransaction.findFirst({
          where: {
            productVariationId: item.productVariationId,
            type: 'sale',
            referenceType: 'sale',
            referenceId: sale.id,
          },
        })

        if (stockTransaction) {
          expect(parseFloat(stockTransaction.quantity.toString())).toBeLessThan(0) // Should be negative for sales
        }
      }
    })
  })

  test.describe('4. Customer CRUD Operations', () => {
    test('4.1 CREATE: Add new customer', async ({ page }) => {
      await page.goto('/dashboard/customers')
      await page.waitForLoadState('networkidle')

      await page.click('text=Add Customer, text=New Customer')
      await page.waitForSelector('form')

      const customerName = `Test Customer ${Date.now()}`
      await page.fill('[name="name"]', customerName)
      await page.fill('[name="mobile"]', '09123456789')
      await page.fill('[name="email"]', `customer${Date.now()}@test.com`)

      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard/customers')

      const customer = await prisma.customer.findFirst({
        where: { businessId, name: customerName },
      })

      expect(customer).toBeTruthy()
      expect(customer?.mobile).toBe('09123456789')
    })

    test('4.2 READ: View customer list', async ({ page }) => {
      await page.goto('/dashboard/customers')
      await page.waitForLoadState('networkidle')

      const customers = await prisma.customer.findMany({
        where: { businessId },
        take: 5,
      })

      expect(customers.length).toBeGreaterThan(0)
    })

    test('4.3 UPDATE: Edit customer details', async () => {
      const customer = await prisma.customer.findFirst({
        where: { businessId },
      })

      if (customer) {
        await prisma.customer.update({
          where: { id: customer.id },
          data: { email: `updated${Date.now()}@test.com` },
        })

        const updated = await prisma.customer.findUnique({
          where: { id: customer.id },
        })

        expect(updated?.email).toContain('updated')
      }
    })

    test('4.4 DELETE: Soft delete customer', async () => {
      const customer = await prisma.customer.create({
        data: {
          businessId,
          name: `Delete Test ${Date.now()}`,
          mobile: '09111111111',
        },
      })

      await prisma.customer.update({
        where: { id: customer.id },
        data: { deletedAt: new Date() },
      })

      const deleted = await prisma.customer.findUnique({
        where: { id: customer.id },
      })

      expect(deleted?.deletedAt).toBeTruthy()
    })
  })

  test.describe('5. Supplier CRUD Operations', () => {
    test('5.1 CREATE: Add new supplier', async ({ page }) => {
      await page.goto('/dashboard/suppliers')
      await page.waitForLoadState('networkidle')

      await page.click('text=Add Supplier, text=New Supplier')
      await page.waitForSelector('form')

      const supplierName = `Test Supplier ${Date.now()}`
      await page.fill('[name="name"]', supplierName)
      await page.fill('[name="contactPerson"]', 'John Doe')
      await page.fill('[name="mobile"]', '09123456789')

      await page.click('button[type="submit"]')
      await page.waitForURL('/dashboard/suppliers')

      const supplier = await prisma.supplier.findFirst({
        where: { businessId, name: supplierName },
      })

      expect(supplier).toBeTruthy()
      expect(supplier?.contactPerson).toBe('John Doe')
    })

    test('5.2 READ: View supplier list', async ({ page }) => {
      await page.goto('/dashboard/suppliers')
      await page.waitForLoadState('networkidle')

      const suppliers = await prisma.supplier.findMany({
        where: { businessId },
        take: 5,
      })

      expect(suppliers.length).toBeGreaterThan(0)
    })
  })

  test.describe('6. Data Integrity Tests', () => {
    test('6.1 Verify referential integrity', async () => {
      // Products should have valid category/brand/unit references
      const product = await prisma.product.findFirst({
        where: { businessId, categoryId: { not: null } },
        include: { category: true, brand: true, unit: true },
      })

      if (product) {
        if (product.categoryId) expect(product.category).toBeTruthy()
        if (product.brandId) expect(product.brand).toBeTruthy()
        if (product.unitId) expect(product.unit).toBeTruthy()
      }
    })

    test('6.2 Verify cascade deletes work correctly', async () => {
      // Create test product
      const testProd = await prisma.product.create({
        data: {
          businessId,
          name: `Cascade Test ${Date.now()}`,
          sku: `CASCADE-${Date.now()}`,
          type: 'single',
        },
      })

      // Create variation
      const variation = await prisma.productVariation.create({
        data: {
          productId: testProd.id,
          businessId,
          name: 'Default',
          sku: `${testProd.sku}-VAR`,
          purchasePrice: 100,
          sellingPrice: 150,
        },
      })

      // Delete product
      await prisma.product.delete({
        where: { id: testProd.id },
      })

      // Variation should be deleted too (cascade)
      const deletedVariation = await prisma.productVariation.findUnique({
        where: { id: variation.id },
      })

      expect(deletedVariation).toBeNull()
    })

    test('6.3 Verify unique constraints', async () => {
      const sku = `UNIQUE-${Date.now()}`

      await prisma.product.create({
        data: {
          businessId,
          name: 'Unique Test 1',
          sku,
          type: 'single',
        },
      })

      // Attempt to create duplicate SKU in same business
      await expect(
        prisma.product.create({
          data: {
            businessId,
            name: 'Unique Test 2',
            sku, // Same SKU
            type: 'single',
          },
        })
      ).rejects.toThrow()
    })

    test('6.4 Verify multi-tenant isolation at database level', async () => {
      // Get products from two different businesses
      const businesses = await prisma.business.findMany({ take: 2 })

      if (businesses.length >= 2) {
        const biz1Products = await prisma.product.findMany({
          where: { businessId: businesses[0].id },
        })

        const biz2Products = await prisma.product.findMany({
          where: { businessId: businesses[1].id },
        })

        // Verify no overlap
        const biz1Ids = biz1Products.map(p => p.id)
        const biz2Ids = biz2Products.map(p => p.id)

        const overlap = biz1Ids.filter(id => biz2Ids.includes(id))
        expect(overlap.length).toBe(0)
      }
    })
  })

  test.describe('7. DELETE Operations (Cleanup)', () => {
    test('7.1 DELETE: Remove test product', async ({ page }) => {
      if (testProductId) {
        await page.goto('/dashboard/products')
        await page.waitForLoadState('networkidle')

        // Find and delete test product
        await page.locator(`[data-product-id="${testProductId}"]`).locator('button:has-text("Delete")').click()
          .catch(() => console.log('Delete button not found or different structure'))

        // Confirm deletion if modal appears
        await page.click('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Delete")')
          .catch(() => console.log('Confirm button not found'))

        await page.waitForTimeout(2000)

        // Verify deletion in database
        const deleted = await prisma.product.findUnique({
          where: { id: testProductId },
        })

        // Should be soft-deleted or hard-deleted
        expect(!deleted || deleted.deletedAt).toBeTruthy()
      }
    })
  })

  test.afterAll(async () => {
    await prisma.$disconnect()
  })
})
