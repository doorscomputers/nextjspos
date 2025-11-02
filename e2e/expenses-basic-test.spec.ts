import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

test.describe('Expense Management - Basic CRUD Test', () => {
  let businessId: number
  let testCategoryId: number
  let testLocationId: number
  let createdExpenseId: number

  test.beforeAll(async () => {
    // Get business ID
    const business = await prisma.business.findFirst({
      where: { isActive: true }
    })
    businessId = business!.id

    // Ensure test category exists
    let category = await prisma.expenseCategory.findFirst({
      where: {
        businessId,
        name: 'Playwright Test Category',
        isActive: true
      }
    })

    if (!category) {
      category = await prisma.expenseCategory.create({
        data: {
          businessId,
          name: 'Playwright Test Category',
          description: 'Test category for automation',
          isActive: true
        }
      })
    }
    testCategoryId = category.id

    // Get first active location
    const location = await prisma.businessLocation.findFirst({
      where: {
        businessId,
        isActive: true
      }
    })
    testLocationId = location!.id
  })

  test.afterAll(async () => {
    // Cleanup test data
    await prisma.expense.deleteMany({
      where: {
        businessId,
        description: {
          contains: 'Playwright Test'
        }
      }
    })
    await prisma.$disconnect()
  })

  test('1. CREATE - Add New Expense', async ({ page }) => {
    console.log('🔹 Test 1: CREATE - Add New Expense')

    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Navigate to expenses
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-01-list.png', fullPage: true })

    // Click Add Expense
    await page.click('button:has-text("Add Expense")')
    await page.waitForTimeout(1000)

    // Fill form
    const testData = {
      amount: '1500.00',
      payeeName: 'Playwright Test Supplier',
      description: 'Playwright Test - Office supplies expense'
    }

    // Category
    const categoryButton = page.locator('button:has-text("Select category")')
    await categoryButton.click()
    await page.waitForTimeout(500)
    await page.click('text=Playwright Test Category')
    await page.waitForTimeout(500)

    // Location
    const locationButton = page.locator('button').filter({ hasText: /Select location/ }).first()
    await locationButton.click()
    await page.waitForTimeout(500)
    const firstLocation = page.locator('[role="option"]').first()
    await firstLocation.click()
    await page.waitForTimeout(500)

    // Amount
    await page.fill('input[id="amount"]', testData.amount)

    // Payment Method
    const paymentButton = page.locator('button').filter({ hasText: /Select payment method|Cash/ }).first()
    await paymentButton.click()
    await page.waitForTimeout(500)
    await page.click('text=Cash')
    await page.waitForTimeout(500)

    // Payee Name
    await page.fill('input[id="payeeName"]', testData.payeeName)

    // Description
    await page.fill('textarea[id="description"]', testData.description)

    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/expense-basic-02-form-filled.png', fullPage: true })

    // Submit
    await page.click('button:has-text("Create Expense")')

    // Wait for success message
    await page.waitForSelector('text=Expense created successfully', { timeout: 10000 })

    // Take screenshot after creation
    await page.screenshot({ path: 'test-results/expense-basic-03-created.png', fullPage: true })

    // Verify in database
    const expense = await prisma.expense.findFirst({
      where: {
        businessId,
        payeeName: testData.payeeName,
        description: testData.description
      }
    })

    expect(expense).toBeTruthy()
    expect(expense?.amount.toString()).toBe(testData.amount)
    expect(expense?.status).toBe('draft')

    createdExpenseId = expense!.id

    console.log(`✅ Expense created: ID ${createdExpenseId}, Ref ${expense?.referenceNumber}`)
  })

  test('2. READ - View Expense in Grid', async ({ page }) => {
    console.log('🔹 Test 2: READ - View Expense in Grid')

    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Navigate to expenses
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Wait for grid
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-04-grid-view.png', fullPage: true })

    // Verify columns
    const columns = ['Reference #', 'Date', 'Category', 'Location', 'Amount', 'Payee', 'Status']
    for (const col of columns) {
      const header = page.locator(`.dx-header-row`).locator(`text=${col}`)
      await expect(header).toBeVisible()
    }

    console.log('✅ All grid columns verified')
  })

  test('3. UPDATE - Edit Expense', async ({ page }) => {
    console.log('🔹 Test 3: UPDATE - Edit Expense')

    // Create test expense
    const expense = await prisma.expense.create({
      data: {
        businessId,
        categoryId: testCategoryId,
        locationId: testLocationId,
        referenceNumber: `EXP-EDIT-${Date.now()}`,
        expenseDate: new Date(),
        amount: 500.00,
        paymentMethod: 'cash',
        payeeName: 'Edit Test Original',
        description: 'Playwright Test - Original description',
        status: 'draft',
        createdBy: 1
      }
    })

    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Navigate to expenses
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find and click Edit
    const row = page.locator(`tr:has-text("${expense.referenceNumber}")`)
    await row.waitFor({ timeout: 5000 })
    await row.locator('button:has-text("Edit")').click()
    await page.waitForTimeout(1000)

    // Update fields
    await page.fill('input[id="amount"]', '2000.00')
    await page.fill('input[id="payeeName"]', 'Edit Test Updated')
    await page.fill('textarea[id="description"]', 'Playwright Test - Updated description')

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-05-edit-form.png', fullPage: true })

    // Submit
    await page.click('button:has-text("Update Expense")')
    await page.waitForSelector('text=Expense updated successfully', { timeout: 10000 })

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-06-updated.png', fullPage: true })

    // Verify in DB
    const updated = await prisma.expense.findUnique({
      where: { id: expense.id }
    })

    expect(updated?.amount.toString()).toBe('2000.00')
    expect(updated?.payeeName).toBe('Edit Test Updated')

    console.log('✅ Expense updated successfully')
  })

  test('4. VOID - Void Posted Expense', async ({ page }) => {
    console.log('🔹 Test 4: VOID - Void Expense')

    // Create posted expense
    const expense = await prisma.expense.create({
      data: {
        businessId,
        categoryId: testCategoryId,
        locationId: testLocationId,
        referenceNumber: `EXP-VOID-${Date.now()}`,
        expenseDate: new Date(),
        amount: 1000.00,
        paymentMethod: 'cash',
        payeeName: 'Void Test',
        description: 'Playwright Test - Void testing',
        status: 'posted',
        createdBy: 1,
        approvedBy: 1,
        approvedAt: new Date()
      }
    })

    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Navigate to expenses
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Find and click Void
    const row = page.locator(`tr:has-text("${expense.referenceNumber}")`)
    await row.waitFor({ timeout: 5000 })
    await row.locator('button:has-text("Void")').click()
    await page.waitForTimeout(1000)

    // Fill void reason
    await page.fill('textarea[id="voidReason"]', 'Playwright Test - Testing void functionality')

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-07-void-dialog.png', fullPage: true })

    // Submit
    await page.click('button:has-text("Void Expense")')
    await page.waitForSelector('text=Expense voided successfully', { timeout: 10000 })

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-08-voided.png', fullPage: true })

    // Verify in DB
    const voided = await prisma.expense.findUnique({
      where: { id: expense.id }
    })

    expect(voided?.status).toBe('void')
    expect(voided?.voidedBy).toBeTruthy()

    console.log('✅ Expense voided successfully')
  })

  test('5. VALIDATION - Form Validation', async ({ page }) => {
    console.log('🔹 Test 5: VALIDATION - Form Validation')

    // Login
    await page.goto('/login')
    await page.fill('input[name="username"]', 'admin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('/dashboard', { timeout: 15000 })

    // Navigate to expenses
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Click Add Expense
    await page.click('button:has-text("Add Expense")')
    await page.waitForTimeout(1000)

    // Try to submit empty form
    await page.click('button:has-text("Create Expense")')
    await page.waitForTimeout(500)

    // Should show validation error
    await page.waitForSelector('text=Category is required', { timeout: 5000 })

    // Take screenshot
    await page.screenshot({ path: 'test-results/expense-basic-09-validation.png', fullPage: true })

    console.log('✅ Form validation working')
  })
})
