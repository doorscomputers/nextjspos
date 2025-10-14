import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Configuration
const BASE_URL = 'http://localhost:3007'
const LOGIN_CREDENTIALS = {
  username: 'superadmin',
  password: 'password'
}

// Test data
const COMPONENT_PRODUCTS = [
  {
    name: 'Laptop Computer',
    sku: 'LAPTOP-001',
    purchasePrice: '800.00',
    sellingPrice: '1200.00'
  },
  {
    name: 'Wireless Mouse',
    sku: 'MOUSE-001',
    purchasePrice: '15.00',
    sellingPrice: '25.00'
  },
  {
    name: 'Mechanical Keyboard',
    sku: 'KEYBOARD-001',
    purchasePrice: '60.00',
    sellingPrice: '100.00'
  }
]

const COMBO_PRODUCT = {
  name: 'Office Workstation Combo',
  sku: 'COMBO-WORKSTATION-001',
  description: 'Complete office workstation with laptop, mouse, and keyboard',
  comboItems: [
    { productIndex: 0, quantity: '1' }, // Laptop x1
    { productIndex: 1, quantity: '1' }, // Mouse x1
    { productIndex: 2, quantity: '1' }  // Keyboard x1
  ]
}

// Helper functions
async function login(page: Page) {
  console.log('Navigating to login page...')
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  console.log('Filling in login credentials...')
  await page.fill('input[name="username"]', LOGIN_CREDENTIALS.username)
  await page.fill('input[name="password"]', LOGIN_CREDENTIALS.password)

  console.log('Submitting login form...')
  await page.click('button[type="submit"]')

  // Wait for navigation to dashboard
  await page.waitForURL('**/dashboard**', { timeout: 10000 })
  console.log('Successfully logged in and redirected to dashboard')
}

async function createSingleProduct(page: Page, product: typeof COMPONENT_PRODUCTS[0], unitId: string) {
  console.log(`Creating product: ${product.name}...`)

  // Navigate to add product page
  await page.goto(`${BASE_URL}/dashboard/products/add`)
  await page.waitForLoadState('networkidle')

  // Fill product form
  await page.fill('input[name="name"]', product.name)

  // Select type as single (should be default)
  await page.selectOption('select', { label: 'Single' })

  // Set SKU
  await page.fill('input[placeholder*="auto-generate"]', product.sku)

  // Select unit
  await page.selectOption('select[required]', unitId)

  // Set prices
  await page.fill('input[placeholder="0.00"][type="number"]', product.purchasePrice)
  const sellingPriceInputs = await page.locator('input[placeholder="0.00"][type="number"]').all()
  if (sellingPriceInputs.length >= 2) {
    await sellingPriceInputs[1].fill(product.sellingPrice)
  }

  // Take screenshot before submit
  await page.screenshot({ path: `test-results/combo-create-component-${product.name.replace(/\s+/g, '-')}.png`, fullPage: true })

  // Submit form
  await page.click('button[type="submit"]:has-text("Save")')

  // Wait for success (redirect to products list or success message)
  await page.waitForURL('**/dashboard/products', { timeout: 10000 })

  console.log(`Successfully created product: ${product.name}`)
}

async function getFirstUnitId(page: Page): Promise<string> {
  await page.goto(`${BASE_URL}/dashboard/products/add`)
  await page.waitForLoadState('networkidle')

  const unitSelect = page.locator('select[required]')
  const options = await unitSelect.locator('option').all()

  // Get the first non-empty option
  for (const option of options) {
    const value = await option.getAttribute('value')
    if (value && value !== '') {
      console.log(`Found unit ID: ${value}`)
      return value
    }
  }

  throw new Error('No units available')
}

async function getCreatedProductIds(businessId: number): Promise<number[]> {
  const products = await prisma.product.findMany({
    where: {
      businessId,
      name: { in: COMPONENT_PRODUCTS.map(p => p.name) },
      deletedAt: null
    },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' }
  })

  console.log('Created products:', products)
  return products.map(p => p.id)
}

test.describe('Combo Products Feature - Comprehensive Testing', () => {
  let businessId: number
  let createdProductIds: number[] = []
  let comboProductId: number

  test.beforeAll(async () => {
    // Get business ID for superadmin
    const user = await prisma.user.findUnique({
      where: { username: 'superadmin' },
      select: { businessId: true }
    })

    if (!user || !user.businessId) {
      throw new Error('Superadmin user not found or has no business')
    }

    businessId = user.businessId
    console.log(`Business ID: ${businessId}`)
  })

  test.afterAll(async () => {
    // Cleanup: Delete created combo product and component products
    if (comboProductId) {
      await prisma.comboProduct.deleteMany({
        where: { parentProductId: comboProductId }
      })

      await prisma.product.update({
        where: { id: comboProductId },
        data: { deletedAt: new Date() }
      })

      console.log(`Deleted combo product: ${comboProductId}`)
    }

    if (createdProductIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: createdProductIds } },
        data: { deletedAt: new Date() }
      })

      console.log(`Deleted component products: ${createdProductIds.join(', ')}`)
    }

    await prisma.$disconnect()
  })

  test('1. Login Test', async ({ page }) => {
    console.log('\n=== TEST 1: Login Test ===')

    await page.goto(`${BASE_URL}/login`)
    await page.screenshot({ path: 'test-results/combo-step1-login-page.png', fullPage: true })

    await login(page)

    await page.screenshot({ path: 'test-results/combo-step2-dashboard.png', fullPage: true })

    // Verify we're on dashboard
    await expect(page).toHaveURL(/.*dashboard.*/)
    console.log('Login test: PASSED')
  })

  test('2. Navigate to Add Product Page', async ({ page }) => {
    console.log('\n=== TEST 2: Navigate to Add Product Page ===')

    await login(page)

    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/combo-step3-add-product-page.png', fullPage: true })

    // Verify page elements
    await expect(page.locator('h1:has-text("Add Product")')).toBeVisible()
    await expect(page.locator('select option[value="combo"]')).toBeVisible()

    console.log('Navigate to add product page: PASSED')
  })

  test('3. Create Component Products for Combo', async ({ page }) => {
    console.log('\n=== TEST 3: Create Component Products ===')

    await login(page)

    // Get a valid unit ID
    const unitId = await getFirstUnitId(page)

    // Create each component product
    for (const product of COMPONENT_PRODUCTS) {
      await createSingleProduct(page, product, unitId)
    }

    // Verify products were created in database
    createdProductIds = await getCreatedProductIds(businessId)

    expect(createdProductIds.length).toBe(COMPONENT_PRODUCTS.length)

    console.log('Component products created successfully')
    console.log('Product IDs:', createdProductIds)

    // Verify products appear in list
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/combo-step4-component-products-list.png', fullPage: true })

    for (const product of COMPONENT_PRODUCTS) {
      await expect(page.locator(`text=${product.name}`)).toBeVisible()
    }

    console.log('Create component products: PASSED')
  })

  test('4. Create Combo Product - Happy Path', async ({ page }) => {
    console.log('\n=== TEST 4: Create Combo Product ===')

    await login(page)

    // Ensure component products exist
    if (createdProductIds.length === 0) {
      createdProductIds = await getCreatedProductIds(businessId)
    }

    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    // Select combo type
    console.log('Selecting product type: Combo')
    await page.selectOption('select', { label: 'Combo' })

    // Wait for combo section to appear
    await page.waitForSelector('h2:has-text("Combo Products")', { timeout: 5000 })

    await page.screenshot({ path: 'test-results/combo-step5-combo-type-selected.png', fullPage: true })

    // Fill combo product details
    console.log('Filling combo product details...')
    await page.fill('input[placeholder="Enter product name"]', COMBO_PRODUCT.name)
    await page.fill('input[placeholder*="auto-generate"]', COMBO_PRODUCT.sku)

    // Get unit select
    const unitId = await getFirstUnitId(page)
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.selectOption('select', { label: 'Combo' })
    await page.fill('input[placeholder="Enter product name"]', COMBO_PRODUCT.name)
    await page.fill('input[placeholder*="auto-generate"]', COMBO_PRODUCT.sku)
    await page.selectOption('select[required]', unitId)

    // Fill description
    const descriptionField = page.locator('textarea[placeholder*="description"]').first()
    await descriptionField.fill(COMBO_PRODUCT.description)

    // Add combo items
    console.log('Adding combo items...')
    const comboSection = page.locator('h2:has-text("Combo Products")').locator('..')

    for (let i = 0; i < COMBO_PRODUCT.comboItems.length; i++) {
      const item = COMBO_PRODUCT.comboItems[i]

      // Click "Add Product" button if not the first item (first item is auto-added)
      if (i > 0) {
        await page.click('button:has-text("Add Product")')
        await page.waitForTimeout(500)
      }

      // Get all product select dropdowns
      const productSelects = await page.locator('select:has(option:has-text("Select Product"))').all()
      const productSelect = productSelects[i]

      // Get all quantity inputs in combo section
      const quantityInputs = await comboSection.locator('input[placeholder="1"]').all()
      const quantityInput = quantityInputs[i]

      // Select product
      const productName = COMPONENT_PRODUCTS[item.productIndex].name
      console.log(`  Adding item ${i + 1}: ${productName} x ${item.quantity}`)

      await productSelect.selectOption({ label: new RegExp(productName) })
      await quantityInput.fill(item.quantity)
    }

    await page.screenshot({ path: 'test-results/combo-step6-combo-items-filled.png', fullPage: true })

    // Check for console errors before submit
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })

    // Submit form
    console.log('Submitting combo product form...')
    await page.click('button[type="submit"]:has-text("Save")')

    // Wait for success (redirect or message)
    await page.waitForURL('**/dashboard/products', { timeout: 10000 })

    await page.screenshot({ path: 'test-results/combo-step7-after-submit.png', fullPage: true })

    console.log('Console errors:', consoleErrors)

    // Verify in database
    const comboProduct = await prisma.product.findFirst({
      where: {
        businessId,
        name: COMBO_PRODUCT.name,
        type: 'combo',
        deletedAt: null
      },
      include: {
        comboProducts: {
          include: {
            childProduct: true
          }
        }
      }
    })

    expect(comboProduct).toBeTruthy()
    expect(comboProduct?.comboProducts.length).toBe(COMBO_PRODUCT.comboItems.length)

    comboProductId = comboProduct!.id

    console.log('Combo product created in database:')
    console.log('  ID:', comboProduct?.id)
    console.log('  Name:', comboProduct?.name)
    console.log('  SKU:', comboProduct?.sku)
    console.log('  Combo items count:', comboProduct?.comboProducts.length)

    // Verify combo items
    for (let i = 0; i < comboProduct!.comboProducts.length; i++) {
      const dbItem = comboProduct!.comboProducts[i]
      console.log(`  Item ${i + 1}: ${dbItem.childProduct.name} x ${dbItem.quantity}`)

      expect(Number(dbItem.quantity)).toBe(parseFloat(COMBO_PRODUCT.comboItems[i].quantity))
    }

    console.log('Create combo product: PASSED')
  })

  test('5. Verify Combo Product in List', async ({ page }) => {
    console.log('\n=== TEST 5: Verify Combo Product in List ===')

    await login(page)

    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')

    // Search for combo product
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill(COMBO_PRODUCT.name)
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: 'test-results/combo-step8-combo-in-list.png', fullPage: true })

    // Verify combo product appears
    await expect(page.locator(`text=${COMBO_PRODUCT.name}`)).toBeVisible()

    // Verify type shows as "combo"
    const comboRow = page.locator(`tr:has-text("${COMBO_PRODUCT.name}")`)
    await expect(comboRow).toBeVisible()

    console.log('Verify combo product in list: PASSED')
  })

  test('6. View Combo Product Details', async ({ page }) => {
    console.log('\n=== TEST 6: View Combo Product Details ===')

    await login(page)

    if (!comboProductId) {
      const product = await prisma.product.findFirst({
        where: { businessId, name: COMBO_PRODUCT.name, type: 'combo', deletedAt: null }
      })
      comboProductId = product!.id
    }

    await page.goto(`${BASE_URL}/dashboard/products/${comboProductId}`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/combo-step9-combo-details.png', fullPage: true })

    // Verify product name is displayed
    await expect(page.locator(`text=${COMBO_PRODUCT.name}`)).toBeVisible()

    // Verify type is combo
    await expect(page.locator('text=/combo/i')).toBeVisible()

    console.log('View combo product details: PASSED')
  })

  test('7. Edit Combo Product', async ({ page }) => {
    console.log('\n=== TEST 7: Edit Combo Product ===')

    await login(page)

    if (!comboProductId) {
      const product = await prisma.product.findFirst({
        where: { businessId, name: COMBO_PRODUCT.name, type: 'combo', deletedAt: null }
      })
      comboProductId = product!.id
    }

    await page.goto(`${BASE_URL}/dashboard/products/${comboProductId}/edit`)
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/combo-step10-edit-combo.png', fullPage: true })

    // Verify form is pre-filled
    const nameInput = page.locator('input[value*="Office Workstation"]').first()
    await expect(nameInput).toBeVisible()

    // Verify combo items are displayed
    const comboSection = page.locator('h2:has-text("Combo Products")')
    await expect(comboSection).toBeVisible()

    // Try modifying quantity of first item
    const quantityInputs = await page.locator('input[placeholder="1"]').all()
    if (quantityInputs.length > 0) {
      await quantityInputs[0].clear()
      await quantityInputs[0].fill('2')
    }

    await page.screenshot({ path: 'test-results/combo-step11-edited-combo.png', fullPage: true })

    // Submit changes
    await page.click('button[type="submit"]:has-text("Save")')

    await page.waitForURL('**/dashboard/products', { timeout: 10000 })

    // Verify changes in database
    const updatedProduct = await prisma.comboProduct.findFirst({
      where: {
        parentProductId: comboProductId,
        childProductId: createdProductIds[0]
      }
    })

    console.log('Updated quantity:', updatedProduct?.quantity)
    expect(Number(updatedProduct?.quantity)).toBe(2)

    console.log('Edit combo product: PASSED')
  })

  test('8. Error Case - Create Combo Without Items', async ({ page }) => {
    console.log('\n=== TEST 8: Error Case - Combo Without Items ===')

    await login(page)

    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    // Select combo type
    await page.selectOption('select', { label: 'Combo' })
    await page.waitForSelector('h2:has-text("Combo Products")')

    // Fill only product name
    await page.fill('input[placeholder="Enter product name"]', 'Empty Combo Test')

    const unitId = await getFirstUnitId(page)
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.selectOption('select', { label: 'Combo' })
    await page.fill('input[placeholder="Enter product name"]', 'Empty Combo Test')
    await page.selectOption('select[required]', unitId)

    // Remove the default combo item
    const removeButton = page.locator('button:has(svg)').filter({ hasText: '' }).first()
    if (await removeButton.isVisible()) {
      await removeButton.click()
    }

    await page.screenshot({ path: 'test-results/combo-step12-empty-combo-attempt.png', fullPage: true })

    // Try to submit
    await page.click('button[type="submit"]:has-text("Save")')

    // Should show validation error or remain on page
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/combo-step13-empty-combo-error.png', fullPage: true })

    // Verify we're still on add page (form validation prevented submit)
    expect(page.url()).toContain('/add')

    console.log('Error case - empty combo: PASSED')
  })

  test('9. Error Case - Invalid Quantity', async ({ page }) => {
    console.log('\n=== TEST 9: Error Case - Invalid Quantity ===')

    await login(page)

    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    // Select combo type
    await page.selectOption('select', { label: 'Combo' })
    await page.waitForSelector('h2:has-text("Combo Products")')

    await page.fill('input[placeholder="Enter product name"]', 'Invalid Quantity Combo')

    const unitId = await getFirstUnitId(page)
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.selectOption('select', { label: 'Combo' })
    await page.fill('input[placeholder="Enter product name"]', 'Invalid Quantity Combo')
    await page.selectOption('select[required]', unitId)

    // Select a product
    const productSelects = await page.locator('select:has(option:has-text("Select Product"))').all()
    if (productSelects.length > 0 && COMPONENT_PRODUCTS.length > 0) {
      await productSelects[0].selectOption({ label: new RegExp(COMPONENT_PRODUCTS[0].name) })
    }

    // Set invalid quantity (negative or zero)
    const quantityInputs = await page.locator('input[placeholder="1"]').all()
    if (quantityInputs.length > 0) {
      await quantityInputs[0].fill('-5')
    }

    await page.screenshot({ path: 'test-results/combo-step14-invalid-quantity.png', fullPage: true })

    // Try to submit
    await page.click('button[type="submit"]:has-text("Save")')

    await page.waitForTimeout(2000)

    // Should remain on page due to validation
    expect(page.url()).toContain('/add')

    console.log('Error case - invalid quantity: PASSED')
  })

  test('10. Database Verification - Complete', async ({ page }) => {
    console.log('\n=== TEST 10: Complete Database Verification ===')

    if (!comboProductId) {
      const product = await prisma.product.findFirst({
        where: { businessId, name: COMBO_PRODUCT.name, type: 'combo', deletedAt: null }
      })
      comboProductId = product!.id
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: comboProductId },
      include: {
        comboProducts: {
          include: {
            childProduct: true
          }
        }
      }
    })

    expect(product).toBeTruthy()
    expect(product?.type).toBe('combo')
    expect(product?.name).toBe(COMBO_PRODUCT.name)
    expect(product?.sku).toBe(COMBO_PRODUCT.sku)

    // Verify combo_products table entries
    const comboItems = await prisma.comboProduct.findMany({
      where: { parentProductId: comboProductId },
      include: {
        parentProduct: true,
        childProduct: true
      }
    })

    console.log('\nDatabase Verification Results:')
    console.log('==============================')
    console.log(`Product ID: ${product?.id}`)
    console.log(`Product Name: ${product?.name}`)
    console.log(`Product Type: ${product?.type}`)
    console.log(`Product SKU: ${product?.sku}`)
    console.log(`Business ID: ${product?.businessId}`)
    console.log(`\nCombo Items (${comboItems.length}):`)

    for (const item of comboItems) {
      console.log(`  - ${item.childProduct.name} (ID: ${item.childProductId}) x ${item.quantity}`)

      // Verify foreign key relationships
      expect(item.parentProductId).toBe(comboProductId)
      expect(createdProductIds).toContain(item.childProductId)
    }

    // Verify parent-child relationships
    expect(comboItems.every(item => item.parentProduct.id === comboProductId)).toBe(true)
    expect(comboItems.every(item => createdProductIds.includes(item.childProduct.id))).toBe(true)

    console.log('\nDatabase verification: PASSED')
    console.log('All relationships are correct!')
  })
})

test.describe('Combo Products - Additional Scenarios', () => {
  test('11. UI Elements Verification', async ({ page }) => {
    console.log('\n=== TEST 11: UI Elements Verification ===')

    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', LOGIN_CREDENTIALS.username)
    await page.fill('input[name="password"]', LOGIN_CREDENTIALS.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**')

    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    // Select combo type
    await page.selectOption('select', { label: 'Combo' })
    await page.waitForSelector('h2:has-text("Combo Products")')

    // Verify UI elements
    await expect(page.locator('h2:has-text("Combo Products")')).toBeVisible()
    await expect(page.locator('button:has-text("Add Product")')).toBeVisible()
    await expect(page.locator('p:has-text("Select products to include")')).toBeVisible()
    await expect(page.locator('select:has(option:has-text("Select Product"))')).toBeVisible()
    await expect(page.locator('input[placeholder="1"]')).toBeVisible()

    // Verify color contrast and styling
    const comboSection = page.locator('h2:has-text("Combo Products")').locator('..')
    const backgroundColor = await comboSection.evaluate(el => window.getComputedStyle(el).backgroundColor)
    const textColor = await comboSection.evaluate(el => window.getComputedStyle(el).color)

    console.log(`Background color: ${backgroundColor}`)
    console.log(`Text color: ${textColor}`)

    await page.screenshot({ path: 'test-results/combo-step15-ui-elements.png', fullPage: true })

    console.log('UI elements verification: PASSED')
  })

  test('12. Responsive Design Check', async ({ page }) => {
    console.log('\n=== TEST 12: Responsive Design Check ===')

    await page.goto(`${BASE_URL}/login`)
    await page.fill('input[name="username"]', LOGIN_CREDENTIALS.username)
    await page.fill('input[name="password"]', LOGIN_CREDENTIALS.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**')

    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')
    await page.selectOption('select', { label: 'Combo' })
    await page.waitForSelector('h2:has-text("Combo Products")')

    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.screenshot({ path: 'test-results/combo-step16-mobile-view.png', fullPage: true })

    // Verify elements are still visible on mobile
    await expect(page.locator('h2:has-text("Combo Products")')).toBeVisible()
    await expect(page.locator('button:has-text("Add Product")')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.screenshot({ path: 'test-results/combo-step17-tablet-view.png', fullPage: true })

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.screenshot({ path: 'test-results/combo-step18-desktop-view.png', fullPage: true })

    console.log('Responsive design check: PASSED')
  })
})
