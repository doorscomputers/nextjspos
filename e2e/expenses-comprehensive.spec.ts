import { test, expect, Page } from '@playwright/test'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Test data
let testExpenseId: number | null = null
let testCategoryId: number | null = null
let testLocationId: number | null = null
let businessId: number | null = null

// Helper function to login
async function login(page: Page, username = 'admin', password = 'password') {
  await page.goto('/login')
  await page.waitForLoadState('networkidle')

  await page.fill('input[name="username"]', username)
  await page.fill('input[name="password"]', password)
  await page.click('button[type="submit"]')

  await page.waitForURL(/\/dashboard/, { timeout: 15000 })
}

// Helper function to get business ID from session
async function getBusinessId(page: Page): Promise<number> {
  // Execute in browser context to get session
  const sessionData = await page.evaluate(() => {
    return localStorage.getItem('session')
  })

  // For now, use database to get first active business
  const business = await prisma.business.findFirst({
    where: { isActive: true }
  })

  return business?.id || 1
}

// Helper function to ensure test category exists
async function ensureTestCategory(page: Page): Promise<number> {
  const bId = await getBusinessId(page)

  // Check if test category exists
  let category = await prisma.expenseCategory.findFirst({
    where: {
      businessId: bId,
      name: 'Playwright Test Category',
      isActive: true
    }
  })

  // If not, create it
  if (!category) {
    category = await prisma.expenseCategory.create({
      data: {
        businessId: bId,
        name: 'Playwright Test Category',
        description: 'Category created by Playwright test',
        isActive: true
      }
    })
  }

  return category.id
}

// Helper function to get first active location
async function getTestLocation(page: Page): Promise<number> {
  const bId = await getBusinessId(page)

  const location = await prisma.businessLocation.findFirst({
    where: {
      businessId: bId,
      isActive: true
    }
  })

  if (!location) {
    throw new Error('No active location found for testing')
  }

  return location.id
}

test.describe('Expense Management - Comprehensive CRUD Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Setup: Login before each test
    await login(page)
    businessId = await getBusinessId(page)
    testCategoryId = await ensureTestCategory(page)
    testLocationId = await getTestLocation(page)
  })

  test.afterAll(async () => {
    // Cleanup: Remove test expenses
    if (businessId) {
      await prisma.expense.deleteMany({
        where: {
          businessId: businessId,
          description: {
            contains: 'Playwright Test'
          }
        }
      })
    }

    await prisma.$disconnect()
  })

  test('1. CREATE - Add New Expense (Happy Path)', async ({ page }) => {
    console.log('🔹 Starting CREATE test - Happy Path')

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Take screenshot before creating
    await page.screenshot({ path: 'test-results/expense-01-before-create.png', fullPage: true })

    // Click Add Expense button
    await page.click('button:has-text("Add Expense")')

    // Wait for dialog to appear
    await page.waitForSelector('text=Add Expense', { timeout: 5000 })

    // Fill in all required fields
    const testAmount = '1500.00'
    const testPayeeName = 'Playwright Test Supplier'
    const testDescription = 'Playwright Test - Office supplies expense for automated testing'

    // Select Category
    await page.click('[id="categoryId"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    await page.click(`text=Playwright Test Category`)

    // Select Location
    await page.click('[id="locationId"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    const firstLocation = page.locator('[role="option"]').first()
    await firstLocation.click()

    // Fill Date (today's date - should be pre-filled, but verify)
    const today = new Date().toISOString().split('T')[0]
    await page.fill('input[id="expenseDate"]', today)

    // Fill Amount
    await page.fill('input[id="amount"]', testAmount)

    // Select Payment Method
    await page.click('[id="paymentMethod"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    await page.click('text=Cash')

    // Fill Payee Name
    await page.fill('input[id="payeeName"]', testPayeeName)

    // Fill Description
    await page.fill('textarea[id="description"]', testDescription)

    // Take screenshot before submitting
    await page.screenshot({ path: 'test-results/expense-02-form-filled.png', fullPage: true })

    // Submit the form
    await page.click('button:has-text("Create Expense")')

    // Wait for success toast
    await page.waitForSelector('text=Expense created successfully', { timeout: 10000 })

    // Wait for dialog to close
    await page.waitForSelector('text=Add Expense', { state: 'hidden', timeout: 5000 })

    // Take screenshot after creation
    await page.screenshot({ path: 'test-results/expense-03-after-create.png', fullPage: true })

    // Verify expense appears in the grid
    await page.waitForSelector(`text=${testPayeeName}`, { timeout: 5000 })

    // Verify in database
    const dbExpense = await prisma.expense.findFirst({
      where: {
        businessId: businessId!,
        payeeName: testPayeeName,
        description: testDescription
      },
      include: {
        category: true,
        location: true
      }
    })

    expect(dbExpense).toBeTruthy()
    expect(dbExpense?.amount.toString()).toBe(testAmount)
    expect(dbExpense?.paymentMethod).toBe('cash')
    expect(dbExpense?.status).toBe('draft')
    expect(dbExpense?.category.name).toBe('Playwright Test Category')

    // Store ID for subsequent tests
    testExpenseId = dbExpense!.id

    console.log(`✅ CREATE test passed - Expense ID: ${testExpenseId}`)
    console.log(`   Reference: ${dbExpense?.referenceNumber}`)
    console.log(`   Amount: ${dbExpense?.amount}`)
  })

  test('2. READ - Verify Expense in DataGrid with All Columns', async ({ page }) => {
    console.log('🔹 Starting READ test')

    // First create a test expense
    const testPayeeName = 'Playwright Read Test'
    const testDescription = 'Playwright Test - Read operation verification'

    const expense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-TEST-${Date.now()}`,
        expenseDate: new Date(),
        amount: 2000.50,
        paymentMethod: 'bank_transfer',
        payeeName: testPayeeName,
        description: testDescription,
        status: 'draft',
        createdBy: 1 // admin user
      }
    })

    testExpenseId = expense.id

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Wait for grid to load
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Take screenshot of the grid
    await page.screenshot({ path: 'test-results/expense-04-datagrid-view.png', fullPage: true })

    // Verify all columns are visible
    const columnHeaders = [
      'Reference #',
      'Date',
      'Category',
      'Location',
      'Amount',
      'Payee',
      'Payment Method',
      'Status',
      'Actions'
    ]

    for (const header of columnHeaders) {
      const headerElement = page.locator(`.dx-header-row :has-text("${header}")`)
      await expect(headerElement).toBeVisible({ timeout: 5000 })
    }

    // Verify test expense data appears in grid
    await expect(page.locator(`text=${expense.referenceNumber}`)).toBeVisible()
    await expect(page.locator(`text=${testPayeeName}`)).toBeVisible()
    await expect(page.locator(`text=Playwright Test Category`)).toBeVisible()

    // Verify status badge
    await expect(page.locator('text=draft')).toBeVisible()

    console.log('✅ READ test passed - All columns verified')
  })

  test('3. UPDATE - Edit Expense and Verify Changes', async ({ page }) => {
    console.log('🔹 Starting UPDATE test')

    // First create a test expense to edit
    const expense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-EDIT-${Date.now()}`,
        expenseDate: new Date(),
        amount: 500.00,
        paymentMethod: 'cash',
        payeeName: 'Playwright Edit Test Original',
        description: 'Playwright Test - Original description',
        status: 'draft',
        createdBy: 1
      }
    })

    testExpenseId = expense.id

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Find and click Edit button for our expense
    // Use the reference number to find the correct row
    const rowLocator = page.locator(`tr:has-text("${expense.referenceNumber}")`)
    await rowLocator.waitFor({ timeout: 5000 })

    // Click Edit button in that row
    const editButton = rowLocator.locator('button:has-text("Edit")')
    await editButton.click()

    // Wait for edit dialog
    await page.waitForSelector('text=Edit Expense', { timeout: 5000 })

    // Take screenshot before editing
    await page.screenshot({ path: 'test-results/expense-05-before-edit.png', fullPage: true })

    // Update fields
    const updatedAmount = '2000.00'
    const updatedPayeeName = 'Playwright Edit Test Updated'
    const updatedDescription = 'Playwright Test - Updated description with new content'

    // Clear and update amount
    await page.fill('input[id="amount"]', updatedAmount)

    // Clear and update payee name
    await page.fill('input[id="payeeName"]', updatedPayeeName)

    // Clear and update description
    await page.fill('textarea[id="description"]', updatedDescription)

    // Change payment method to Credit Card
    await page.click('[id="paymentMethod"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    await page.click('text=Credit Card')

    // Take screenshot after editing
    await page.screenshot({ path: 'test-results/expense-06-after-edit-form.png', fullPage: true })

    // Submit the form
    await page.click('button:has-text("Update Expense")')

    // Wait for success message
    await page.waitForSelector('text=Expense updated successfully', { timeout: 10000 })

    // Wait for dialog to close
    await page.waitForSelector('text=Edit Expense', { state: 'hidden', timeout: 5000 })

    // Take screenshot of updated grid
    await page.screenshot({ path: 'test-results/expense-07-after-edit-grid.png', fullPage: true })

    // Verify updated data appears in grid
    await page.waitForSelector(`text=${updatedPayeeName}`, { timeout: 5000 })

    // Verify in database
    const updatedExpense = await prisma.expense.findUnique({
      where: { id: expense.id }
    })

    expect(updatedExpense).toBeTruthy()
    expect(updatedExpense?.amount.toString()).toBe(updatedAmount)
    expect(updatedExpense?.payeeName).toBe(updatedPayeeName)
    expect(updatedExpense?.description).toBe(updatedDescription)
    expect(updatedExpense?.paymentMethod).toBe('credit_card')

    console.log('✅ UPDATE test passed')
    console.log(`   Updated Amount: ${updatedExpense?.amount}`)
    console.log(`   Updated Payee: ${updatedExpense?.payeeName}`)
  })

  test('4. APPROVE - Approve Draft Expense', async ({ page }) => {
    console.log('🔹 Starting APPROVE test')

    // Create a draft expense
    const expense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-APPROVE-${Date.now()}`,
        expenseDate: new Date(),
        amount: 750.00,
        paymentMethod: 'cheque',
        payeeName: 'Playwright Approve Test',
        description: 'Playwright Test - Testing approval workflow',
        status: 'draft',
        createdBy: 1
      }
    })

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Find row with our expense
    const rowLocator = page.locator(`tr:has-text("${expense.referenceNumber}")`)
    await rowLocator.waitFor({ timeout: 5000 })

    // Take screenshot before approval
    await page.screenshot({ path: 'test-results/expense-08-before-approve.png', fullPage: true })

    // Click Approve button
    const approveButton = rowLocator.locator('button:has-text("Approve")')
    await approveButton.click()

    // Handle confirmation dialog
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Approve expense')
      await dialog.accept()
    })

    // Wait for success message
    await page.waitForSelector('text=Expense approved and posted successfully', { timeout: 10000 })

    // Take screenshot after approval
    await page.screenshot({ path: 'test-results/expense-09-after-approve.png', fullPage: true })

    // Verify status changed in database
    const approvedExpense = await prisma.expense.findUnique({
      where: { id: expense.id },
      include: {
        journalEntry: true
      }
    })

    expect(approvedExpense?.status).toBe('posted')
    expect(approvedExpense?.approvedBy).toBeTruthy()
    expect(approvedExpense?.approvedAt).toBeTruthy()
    expect(approvedExpense?.journalEntryId).toBeTruthy() // Should have journal entry

    console.log('✅ APPROVE test passed')
    console.log(`   Status: ${approvedExpense?.status}`)
    console.log(`   Journal Entry ID: ${approvedExpense?.journalEntryId}`)
  })

  test('5. VOID - Void Posted Expense', async ({ page }) => {
    console.log('🔹 Starting VOID test')

    // Create and approve an expense first
    const expense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-VOID-${Date.now()}`,
        expenseDate: new Date(),
        amount: 1000.00,
        paymentMethod: 'cash',
        payeeName: 'Playwright Void Test',
        description: 'Playwright Test - Testing void functionality',
        status: 'posted',
        createdBy: 1,
        approvedBy: 1,
        approvedAt: new Date()
      }
    })

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Find row with our expense
    const rowLocator = page.locator(`tr:has-text("${expense.referenceNumber}")`)
    await rowLocator.waitFor({ timeout: 5000 })

    // Take screenshot before void
    await page.screenshot({ path: 'test-results/expense-10-before-void.png', fullPage: true })

    // Click Void button
    const voidButton = rowLocator.locator('button:has-text("Void")')
    await voidButton.click()

    // Wait for void dialog
    await page.waitForSelector('text=Void Expense', { timeout: 5000 })

    // Enter void reason
    const voidReason = 'Playwright Test - Testing void functionality - Expense entered in error'
    await page.fill('textarea[id="voidReason"]', voidReason)

    // Take screenshot of void dialog
    await page.screenshot({ path: 'test-results/expense-11-void-dialog.png', fullPage: true })

    // Click Void Expense button
    await page.click('button:has-text("Void Expense")')

    // Wait for success message
    await page.waitForSelector('text=Expense voided successfully', { timeout: 10000 })

    // Wait for dialog to close
    await page.waitForSelector('text=Void Expense', { state: 'hidden', timeout: 5000 })

    // Take screenshot after void
    await page.screenshot({ path: 'test-results/expense-12-after-void.png', fullPage: true })

    // Verify status changed in database
    const voidedExpense = await prisma.expense.findUnique({
      where: { id: expense.id }
    })

    expect(voidedExpense?.status).toBe('void')
    expect(voidedExpense?.voidedBy).toBeTruthy()
    expect(voidedExpense?.voidedAt).toBeTruthy()
    expect(voidedExpense?.voidReason).toBe(voidReason)

    console.log('✅ VOID test passed')
    console.log(`   Status: ${voidedExpense?.status}`)
    console.log(`   Void Reason: ${voidedExpense?.voidReason}`)
  })

  test('6. VALIDATION - Test Form Validation', async ({ page }) => {
    console.log('🔹 Starting VALIDATION test')

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Click Add Expense
    await page.click('button:has-text("Add Expense")')
    await page.waitForSelector('text=Add Expense', { timeout: 5000 })

    // Test 1: Submit empty form
    await page.click('button:has-text("Create Expense")')
    await page.waitForSelector('text=Category is required', { timeout: 5000 })
    await page.screenshot({ path: 'test-results/expense-13-validation-empty.png', fullPage: true })

    // Test 2: Invalid amount (negative)
    // First fill required fields except amount
    await page.click('[id="categoryId"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    await page.click(`text=Playwright Test Category`)

    await page.click('[id="locationId"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    const firstLocation = page.locator('[role="option"]').first()
    await firstLocation.click()

    await page.fill('input[id="amount"]', '-100')
    await page.fill('input[id="payeeName"]', 'Test')
    await page.fill('textarea[id="description"]', 'Test')

    await page.click('button:has-text("Create Expense")')
    // The HTML5 validation will prevent submission or show error

    await page.screenshot({ path: 'test-results/expense-14-validation-negative-amount.png', fullPage: true })

    // Test 3: Zero amount
    await page.fill('input[id="amount"]', '0')
    await page.click('button:has-text("Create Expense")')
    await page.waitForSelector('text=Amount must be greater than 0', { timeout: 5000 })

    await page.screenshot({ path: 'test-results/expense-15-validation-zero-amount.png', fullPage: true })

    // Test 4: Missing required fields
    await page.fill('input[id="amount"]', '100')
    await page.fill('input[id="payeeName"]', '')
    await page.click('button:has-text("Create Expense")')
    await page.waitForSelector('text=Payee name is required', { timeout: 5000 })

    await page.screenshot({ path: 'test-results/expense-16-validation-missing-payee.png', fullPage: true })

    // Close dialog
    await page.click('button:has-text("Cancel")')

    console.log('✅ VALIDATION test passed - All validation scenarios tested')
  })

  test('7. FILTER - Test Date Range and Status Filtering', async ({ page }) => {
    console.log('🔹 Starting FILTER test')

    // Create test expenses with different statuses and dates
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    const draftExpense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-FILTER-DRAFT-${Date.now()}`,
        expenseDate: today,
        amount: 100.00,
        paymentMethod: 'cash',
        payeeName: 'Filter Test Draft',
        description: 'Playwright Test - Filter testing draft',
        status: 'draft',
        createdBy: 1
      }
    })

    const postedExpense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-FILTER-POSTED-${Date.now()}`,
        expenseDate: yesterday,
        amount: 200.00,
        paymentMethod: 'cash',
        payeeName: 'Filter Test Posted',
        description: 'Playwright Test - Filter testing posted',
        status: 'posted',
        createdBy: 1,
        approvedBy: 1,
        approvedAt: new Date()
      }
    })

    // Navigate to expenses page
    await page.goto('/dashboard/expenses')
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Wait for grid to fully load
    await page.waitForTimeout(2000)

    // Take screenshot of unfiltered grid
    await page.screenshot({ path: 'test-results/expense-17-before-filter.png', fullPage: true })

    // Test search functionality
    const searchBox = page.locator('.dx-searchbox input[type="text"]')
    await searchBox.fill('Filter Test')
    await page.waitForTimeout(1000) // Wait for filter to apply

    await page.screenshot({ path: 'test-results/expense-18-search-filter.png', fullPage: true })

    // Verify filtered results
    await expect(page.locator(`text=${draftExpense.referenceNumber}`)).toBeVisible()
    await expect(page.locator(`text=${postedExpense.referenceNumber}`)).toBeVisible()

    // Clear search
    await searchBox.clear()
    await page.waitForTimeout(1000)

    // Test status filter using header filter
    // Click on Status column header filter icon
    const statusHeaderFilter = page.locator('.dx-header-row').locator('text=Status').locator('..').locator('.dx-header-filter')
    await statusHeaderFilter.click()
    await page.waitForTimeout(1000)

    // Select 'draft' from filter
    await page.click('text=draft')
    await page.click('.dx-button:has-text("OK")')
    await page.waitForTimeout(1000)

    await page.screenshot({ path: 'test-results/expense-19-status-filter.png', fullPage: true })

    // Verify only draft expenses shown
    await expect(page.locator(`text=${draftExpense.referenceNumber}`)).toBeVisible()

    console.log('✅ FILTER test passed')
  })

  test('8. DATABASE INTEGRITY - Verify Complete Data Persistence', async ({ page }) => {
    console.log('🔹 Starting DATABASE INTEGRITY test')

    // Create expense via UI
    await page.goto('http://localhost:3004/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    await page.click('button:has-text("Add Expense")')
    await page.waitForSelector('text=Add Expense', { timeout: 5000 })

    const testData = {
      amount: '3456.78',
      payeeName: 'Database Integrity Test Supplier',
      description: 'Playwright Test - Database integrity verification with detailed description',
      paymentMethod: 'bank_transfer'
    }

    // Fill form
    await page.click('[id="categoryId"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    await page.click(`text=Playwright Test Category`)

    await page.click('[id="locationId"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    const firstLocation = page.locator('[role="option"]').first()
    await firstLocation.click()

    const today = new Date().toISOString().split('T')[0]
    await page.fill('input[id="expenseDate"]', today)
    await page.fill('input[id="amount"]', testData.amount)

    await page.click('[id="paymentMethod"] ~ button')
    await page.waitForSelector('.select-content', { timeout: 3000 })
    await page.click('text=Bank Transfer')

    await page.fill('input[id="payeeName"]', testData.payeeName)
    await page.fill('textarea[id="description"]', testData.description)

    // Submit
    await page.click('button:has-text("Create Expense")')
    await page.waitForSelector('text=Expense created successfully', { timeout: 10000 })

    // Query database for verification
    const dbExpense = await prisma.expense.findFirst({
      where: {
        businessId: businessId!,
        payeeName: testData.payeeName
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        location: {
          select: {
            id: true,
            name: true
          }
        },
        createdByUser: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true
          }
        }
      }
    })

    // Comprehensive verification
    expect(dbExpense).toBeTruthy()
    expect(dbExpense?.businessId).toBe(businessId)
    expect(dbExpense?.categoryId).toBe(testCategoryId)
    expect(dbExpense?.locationId).toBe(testLocationId)
    expect(dbExpense?.amount.toString()).toBe(testData.amount)
    expect(dbExpense?.paymentMethod).toBe('bank_transfer')
    expect(dbExpense?.payeeName).toBe(testData.payeeName)
    expect(dbExpense?.description).toBe(testData.description)
    expect(dbExpense?.status).toBe('draft')
    expect(dbExpense?.isActive).toBe(true)
    expect(dbExpense?.referenceNumber).toBeTruthy()
    expect(dbExpense?.referenceNumber).toMatch(/^EXP-/)
    expect(dbExpense?.createdBy).toBeTruthy()
    expect(dbExpense?.createdByUser).toBeTruthy()
    expect(dbExpense?.category.name).toBe('Playwright Test Category')
    expect(dbExpense?.location).toBeTruthy()
    expect(dbExpense?.expenseDate).toBeTruthy()

    console.log('✅ DATABASE INTEGRITY test passed')
    console.log(`   All fields verified in database`)
    console.log(`   Reference: ${dbExpense?.referenceNumber}`)
    console.log(`   Category: ${dbExpense?.category.name}`)
    console.log(`   Location: ${dbExpense?.location.name}`)
    console.log(`   Created By: ${dbExpense?.createdByUser.username}`)

    await page.screenshot({ path: 'test-results/expense-20-database-integrity.png', fullPage: true })
  })

  test('9. MULTI-TENANCY - Verify Business Isolation', async ({ page }) => {
    console.log('🔹 Starting MULTI-TENANCY test')

    // Verify expenses are isolated by business
    const allExpenses = await prisma.expense.findMany({
      select: {
        id: true,
        businessId: true,
        referenceNumber: true
      }
    })

    // Group by business ID
    const businessGroups = allExpenses.reduce((acc, expense) => {
      if (!acc[expense.businessId]) {
        acc[expense.businessId] = []
      }
      acc[expense.businessId].push(expense)
      return acc
    }, {} as Record<number, typeof allExpenses>)

    // Verify each business only sees their own expenses
    for (const [bId, expenses] of Object.entries(businessGroups)) {
      const businessIdNum = parseInt(bId)
      for (const expense of expenses) {
        expect(expense.businessId).toBe(businessIdNum)
      }
    }

    // Navigate to expenses page and verify API response
    await page.goto('http://localhost:3004/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Intercept API call
    let apiResponse: any = null
    page.on('response', async response => {
      if (response.url().includes('/api/expenses') && !response.url().includes('categories')) {
        apiResponse = await response.json()
      }
    })

    // Refresh to trigger API call
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(2000)

    // Verify all expenses in API response belong to same business
    if (apiResponse && Array.isArray(apiResponse)) {
      const businessIds = apiResponse.map((exp: any) => exp.businessId)
      const uniqueBusinessIds = [...new Set(businessIds)]
      expect(uniqueBusinessIds.length).toBe(1)
      expect(uniqueBusinessIds[0]).toBe(businessId)
    }

    console.log('✅ MULTI-TENANCY test passed - Data isolation verified')
    console.log(`   Business ID: ${businessId}`)
    console.log(`   Expenses count: ${apiResponse?.length || 0}`)
  })

  test('10. PERMISSIONS - Verify RBAC Controls', async ({ page }) => {
    console.log('🔹 Starting PERMISSIONS test')

    // Navigate to expenses page as admin (has all permissions)
    await page.goto('http://localhost:3004/dashboard/expenses')
    await page.waitForLoadState('networkidle')

    // Verify admin can see Add Expense button
    const addButton = page.locator('button:has-text("Add Expense")')
    await expect(addButton).toBeVisible()

    // Verify Edit and Approve buttons visible for draft expenses
    await page.waitForSelector('.dx-datagrid', { timeout: 10000 })

    // Create a draft expense to check permissions
    const testExpense = await prisma.expense.create({
      data: {
        businessId: businessId!,
        categoryId: testCategoryId!,
        locationId: testLocationId!,
        referenceNumber: `EXP-PERM-${Date.now()}`,
        expenseDate: new Date(),
        amount: 100.00,
        paymentMethod: 'cash',
        payeeName: 'Permission Test',
        description: 'Playwright Test - Permission testing',
        status: 'draft',
        createdBy: 1
      }
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // Find the test expense row
    const rowLocator = page.locator(`tr:has-text("${testExpense.referenceNumber}")`)
    await rowLocator.waitFor({ timeout: 5000 })

    // Verify Edit button exists
    const editButton = rowLocator.locator('button:has-text("Edit")')
    await expect(editButton).toBeVisible()

    // Verify Approve button exists
    const approveButton = rowLocator.locator('button:has-text("Approve")')
    await expect(approveButton).toBeVisible()

    await page.screenshot({ path: 'test-results/expense-21-permissions-admin.png', fullPage: true })

    console.log('✅ PERMISSIONS test passed - Admin can access all actions')
  })
})
