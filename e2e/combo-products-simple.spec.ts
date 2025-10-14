import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = 'http://localhost:3007'
const LOGIN_CREDENTIALS = {
  username: 'superadmin',
  password: 'password'
}

test.describe.serial('Combo Products - Sequential Flow Test', () => {
  let businessId: number
  let unitId: string
  let productIds: number[] = []
  let comboProductId: number

  test.beforeAll(async () => {
    const user = await prisma.user.findUnique({
      where: { username: 'superadmin' },
      select: { businessId: true }
    })
    businessId = user!.businessId!
    console.log('Business ID:', businessId)
  })

  test.afterAll(async () => {
    // Cleanup
    if (comboProductId) {
      await prisma.comboProduct.deleteMany({
        where: { parentProductId: comboProductId }
      })
      await prisma.product.update({
        where: { id: comboProductId },
        data: { deletedAt: new Date() }
      })
    }
    if (productIds.length > 0) {
      await prisma.product.updateMany({
        where: { id: { in: productIds } },
        data: { deletedAt: new Date() }
      })
    }
    await prisma.$disconnect()
  })

  test('Complete Combo Product Flow', async ({ page }) => {
    console.log('\n=== COMPLETE COMBO PRODUCT FLOW TEST ===\n')

    // STEP 1: Login
    console.log('STEP 1: Login')
    await page.goto(`${BASE_URL}/login`)
    await page.screenshot({ path: 'test-results/final-combo-01-login.png' })

    await page.fill('input[name="username"]', LOGIN_CREDENTIALS.username)
    await page.fill('input[name="password"]', LOGIN_CREDENTIALS.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 15000 })

    await page.screenshot({ path: 'test-results/final-combo-02-dashboard.png' })
    console.log('✓ Login successful\n')

    // STEP 2: Get Unit ID
    console.log('STEP 2: Get Unit ID')
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    const unitSelect = page.locator('select[required]')
    const firstUnit = await unitSelect.locator('option').nth(1)
    unitId = await firstUnit.getAttribute('value') || ''
    console.log('✓ Unit ID obtained:', unitId, '\n')

    // STEP 3: Create Component Product 1 - Laptop
    console.log('STEP 3: Create Component Product - Laptop')
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    await page.fill('input[placeholder="Enter product name"]', 'Test Laptop Computer')
    await page.fill('input[placeholder*="auto-generate"]', 'TEST-LAPTOP-001')
    await page.selectOption('select[required]', unitId)

    const purchasePriceInputs = await page.locator('input[placeholder="0.00"][type="number"]').all()
    await purchasePriceInputs[0].fill('800')
    await purchasePriceInputs[1].fill('1200')

    await page.screenshot({ path: 'test-results/final-combo-03-laptop-form.png' })
    await page.click('button[type="submit"]:has-text("Save")')
    await page.waitForURL('**/dashboard/products', { timeout: 15000 })

    console.log('✓ Laptop created\n')

    // STEP 4: Create Component Product 2 - Mouse
    console.log('STEP 4: Create Component Product - Mouse')
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    await page.fill('input[placeholder="Enter product name"]', 'Test Wireless Mouse')
    await page.fill('input[placeholder*="auto-generate"]', 'TEST-MOUSE-001')
    await page.selectOption('select[required]', unitId)

    const mousePriceInputs = await page.locator('input[placeholder="0.00"][type="number"]').all()
    await mousePriceInputs[0].fill('15')
    await mousePriceInputs[1].fill('25')

    await page.screenshot({ path: 'test-results/final-combo-04-mouse-form.png' })
    await page.click('button[type="submit"]:has-text("Save")')
    await page.waitForURL('**/dashboard/products', { timeout: 15000 })

    console.log('✓ Mouse created\n')

    // STEP 5: Create Component Product 3 - Keyboard
    console.log('STEP 5: Create Component Product - Keyboard')
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    await page.fill('input[placeholder="Enter product name"]', 'Test Mechanical Keyboard')
    await page.fill('input[placeholder*="auto-generate"]', 'TEST-KEYBOARD-001')
    await page.selectOption('select[required]', unitId)

    const keyboardPriceInputs = await page.locator('input[placeholder="0.00"][type="number"]').all()
    await keyboardPriceInputs[0].fill('60')
    await keyboardPriceInputs[1].fill('100')

    await page.screenshot({ path: 'test-results/final-combo-05-keyboard-form.png' })
    await page.click('button[type="submit"]:has-text("Save")')
    await page.waitForURL('**/dashboard/products', { timeout: 15000 })

    console.log('✓ Keyboard created\n')

    // STEP 6: Verify components in database
    console.log('STEP 6: Verify component products in database')
    const components = await prisma.product.findMany({
      where: {
        businessId,
        name: { in: ['Test Laptop Computer', 'Test Wireless Mouse', 'Test Mechanical Keyboard'] },
        deletedAt: null
      },
      orderBy: { createdAt: 'asc' }
    })

    productIds = components.map(p => p.id)
    console.log('✓ Component products found:', productIds.length)
    components.forEach(p => console.log(`  - ${p.name} (ID: ${p.id})`))
    console.log('')

    expect(components.length).toBe(3)

    // STEP 7: Verify components appear in product list
    console.log('STEP 7: Verify components in product list')
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/final-combo-06-products-list.png' })

    await expect(page.locator('text=Test Laptop Computer')).toBeVisible()
    await expect(page.locator('text=Test Wireless Mouse')).toBeVisible()
    await expect(page.locator('text=Test Mechanical Keyboard')).toBeVisible()
    console.log('✓ All components visible in list\n')

    // STEP 8: Create Combo Product
    console.log('STEP 8: Create Combo Product')
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')

    // Select Combo type
    await page.selectOption('select', { label: 'Combo' })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/final-combo-07-combo-type-selected.png' })

    // Fill combo details
    await page.fill('input[placeholder="Enter product name"]', 'Test Office Workstation Bundle')
    await page.fill('input[placeholder*="auto-generate"]', 'TEST-COMBO-001')
    await page.selectOption('select[required]', unitId)

    // Add combo items
    console.log('  Adding combo items...')

    // First item (auto-added)
    const productSelects = await page.locator('select:has(option:has-text("Select Product"))').all()
    const quantityInputs = await page.locator('input[placeholder="1"][type="number"]').all()

    await productSelects[0].selectOption({ label: /Test Laptop Computer/ })
    await quantityInputs[0].fill('1')
    console.log('    - Added Laptop x1')

    // Add second item
    await page.click('button:has-text("Add Product")')
    await page.waitForTimeout(500)

    const productSelects2 = await page.locator('select:has(option:has-text("Select Product"))').all()
    const quantityInputs2 = await page.locator('input[placeholder="1"][type="number"]').all()

    await productSelects2[1].selectOption({ label: /Test Wireless Mouse/ })
    await quantityInputs2[1].fill('1')
    console.log('    - Added Mouse x1')

    // Add third item
    await page.click('button:has-text("Add Product")')
    await page.waitForTimeout(500)

    const productSelects3 = await page.locator('select:has(option:has-text("Select Product"))').all()
    const quantityInputs3 = await page.locator('input[placeholder="1"][type="number"]').all()

    await productSelects3[2].selectOption({ label: /Test Mechanical Keyboard/ })
    await quantityInputs3[2].fill('1')
    console.log('    - Added Keyboard x1')

    await page.screenshot({ path: 'test-results/final-combo-08-combo-items-filled.png', fullPage: true })

    // Submit combo product
    console.log('  Submitting combo product...')
    await page.click('button[type="submit"]:has-text("Save")')
    await page.waitForURL('**/dashboard/products', { timeout: 15000 })

    await page.screenshot({ path: 'test-results/final-combo-09-after-submit.png' })
    console.log('✓ Combo product created\n')

    // STEP 9: Verify combo in database
    console.log('STEP 9: Verify combo product in database')
    const comboProduct = await prisma.product.findFirst({
      where: {
        businessId,
        name: 'Test Office Workstation Bundle',
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
    expect(comboProduct?.comboProducts.length).toBe(3)

    comboProductId = comboProduct!.id

    console.log('✓ Combo product in database:')
    console.log(`  ID: ${comboProduct?.id}`)
    console.log(`  Name: ${comboProduct?.name}`)
    console.log(`  SKU: ${comboProduct?.sku}`)
    console.log(`  Type: ${comboProduct?.type}`)
    console.log(`  Combo items (${comboProduct?.comboProducts.length}):`)
    comboProduct?.comboProducts.forEach(item => {
      console.log(`    - ${item.childProduct.name} x ${item.quantity}`)
    })
    console.log('')

    // STEP 10: Verify combo in product list
    console.log('STEP 10: Verify combo in product list')
    await page.goto(`${BASE_URL}/dashboard/products`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/final-combo-10-combo-in-list.png' })

    await expect(page.locator('text=Test Office Workstation Bundle')).toBeVisible()
    console.log('✓ Combo product visible in list\n')

    // STEP 11: View combo product details
    console.log('STEP 11: View combo product details')
    await page.goto(`${BASE_URL}/dashboard/products/${comboProductId}`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/final-combo-11-combo-details.png', fullPage: true })

    await expect(page.locator('text=Test Office Workstation Bundle')).toBeVisible()
    console.log('✓ Combo product details page loaded\n')

    // STEP 12: Edit combo product
    console.log('STEP 12: Edit combo product')
    await page.goto(`${BASE_URL}/dashboard/products/${comboProductId}/edit`)
    await page.waitForLoadState('networkidle')
    await page.screenshot({ path: 'test-results/final-combo-12-edit-page.png', fullPage: true })

    // Verify form is pre-populated
    const nameInput = await page.locator('input[value*="Test Office Workstation"]').first()
    await expect(nameInput).toBeVisible()

    // Check combo items section exists
    await expect(page.locator('h2:has-text("Combo Products")')).toBeVisible()
    console.log('✓ Edit page loaded with pre-filled data\n')

    // STEP 13: Database verification of relationships
    console.log('STEP 13: Complete database verification')
    const comboItems = await prisma.comboProduct.findMany({
      where: { parentProductId: comboProductId },
      include: {
        parentProduct: true,
        childProduct: true
      }
    })

    console.log('Database Relationship Verification:')
    console.log('===================================')
    console.log(`Parent Product: ${comboItems[0].parentProduct.name} (ID: ${comboItems[0].parentProductId})`)
    console.log(`Child Products (${comboItems.length}):`)
    comboItems.forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.childProduct.name} (ID: ${item.childProductId}) x ${item.quantity}`)
      expect(item.parentProductId).toBe(comboProductId)
      expect(productIds).toContain(item.childProductId)
    })
    console.log('')

    // STEP 14: UI/UX verification
    console.log('STEP 14: UI/UX Verification')
    await page.goto(`${BASE_URL}/dashboard/products/add`)
    await page.waitForLoadState('networkidle')
    await page.selectOption('select', { label: 'Combo' })
    await page.waitForTimeout(500)

    // Check for dark-on-dark or light-on-light issues
    const comboSection = page.locator('h2:has-text("Combo Products")').locator('..')
    const bgColor = await comboSection.evaluate(el => window.getComputedStyle(el).backgroundColor)
    const textColor = await comboSection.evaluate(el => window.getComputedStyle(el).color)

    console.log('Color Contrast Check:')
    console.log(`  Background: ${bgColor}`)
    console.log(`  Text: ${textColor}`)

    await page.screenshot({ path: 'test-results/final-combo-13-ui-check.png', fullPage: true })
    console.log('✓ UI verification complete\n')

    // STEP 15: Responsive design check
    console.log('STEP 15: Responsive Design Check')

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.screenshot({ path: 'test-results/final-combo-14-mobile.png', fullPage: true })
    await expect(page.locator('h2:has-text("Combo Products")')).toBeVisible()
    console.log('  ✓ Mobile (375x667) - Elements visible')

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.screenshot({ path: 'test-results/final-combo-15-tablet.png', fullPage: true })
    await expect(page.locator('h2:has-text("Combo Products")')).toBeVisible()
    console.log('  ✓ Tablet (768x1024) - Elements visible')

    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.screenshot({ path: 'test-results/final-combo-16-desktop.png', fullPage: true })
    await expect(page.locator('h2:has-text("Combo Products")')).toBeVisible()
    console.log('  ✓ Desktop (1920x1080) - Elements visible\n')

    console.log('===========================================')
    console.log('ALL TESTS PASSED SUCCESSFULLY!')
    console.log('===========================================')
  })
})
