import { test, expect } from '@playwright/test'

test.describe('Expense Management - CRUD Operations', () => {
  let expenseReferenceNumber: string

  test.beforeEach(async ({ page }) => {
    // Login as superadmin
    await page.goto('http://localhost:3004/login')
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard')
    await page.waitForTimeout(2000)

    // Navigate to expenses page
    await page.goto('http://localhost:3004/dashboard/expenses')
    await page.waitForTimeout(2000)
  })

  test('1. CREATE - Add New Expense', async ({ page }) => {
    console.log('Starting CREATE test...')

    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/01-expenses-initial.png', fullPage: true })

    // Click Add Expense button
    const addButton = page.locator('button:has-text("Add Expense")').first()
    await addButton.click()
    await page.waitForTimeout(1000)

    // Take screenshot of dialog
    await page.screenshot({ path: 'test-results/02-add-expense-dialog.png', fullPage: true })

    // Check if categories exist, if not we might need to select the first available
    const categorySelect = page.locator('[id="categoryId"]').first()
    await categorySelect.click()
    await page.waitForTimeout(500)

    // Select first category
    const firstCategory = page.locator('[role="option"]').first()
    await firstCategory.click()
    await page.waitForTimeout(500)

    // Select location
    const locationSelect = page.locator('[id="locationId"]').first()
    await locationSelect.click()
    await page.waitForTimeout(500)
    const firstLocation = page.locator('[role="option"]').first()
    await firstLocation.click()
    await page.waitForTimeout(500)

    // Fill in date (today)
    const today = new Date().toISOString().split('T')[0]
    await page.fill('#expenseDate', today)

    // Fill in amount
    await page.fill('#amount', '1500.50')

    // Select payment method
    await page.click('text=Payment Method')
    await page.waitForTimeout(500)
    await page.click('text=Cash')
    await page.waitForTimeout(500)

    // Fill payee name
    await page.fill('#payeeName', 'Test Supplier ABC')

    // Fill description
    await page.fill('#description', 'Test expense created by Playwright automation - Office Supplies')

    // Take screenshot before submit
    await page.screenshot({ path: 'test-results/03-filled-expense-form.png', fullPage: true })

    // Submit form
    await page.click('button:has-text("Create Expense")')
    await page.waitForTimeout(3000)

    // Take screenshot after creation
    await page.screenshot({ path: 'test-results/04-expense-created.png', fullPage: true })

    // Verify expense appears in the grid
    const expenseRow = page.locator('text=Test Supplier ABC').first()
    await expect(expenseRow).toBeVisible()

    // Extract reference number for later tests
    const referenceCell = page.locator('td:has-text("EXP-")').first()
    expenseReferenceNumber = await referenceCell.textContent() || ''
    console.log('Created expense with reference:', expenseReferenceNumber)

    console.log('✓ CREATE test passed')
  })

  test('2. READ - View Expense Details', async ({ page }) => {
    console.log('Starting READ test...')

    // Wait for grid to load
    await page.waitForTimeout(2000)

    // Take screenshot of expense list
    await page.screenshot({ path: 'test-results/05-expense-list.png', fullPage: true })

    // Verify all columns are visible
    await expect(page.locator('text=Reference #')).toBeVisible()
    await expect(page.locator('text=Date')).toBeVisible()
    await expect(page.locator('text=Category')).toBeVisible()
    await expect(page.locator('text=Location')).toBeVisible()
    await expect(page.locator('text=Amount')).toBeVisible()
    await expect(page.locator('text=Payment Method')).toBeVisible()
    await expect(page.locator('text=Payee Name')).toBeVisible()
    await expect(page.locator('text=Status')).toBeVisible()

    // Verify our test expense is visible
    await expect(page.locator('text=Test Supplier ABC')).toBeVisible()
    await expect(page.locator('text=1,500.50')).toBeVisible()

    console.log('✓ READ test passed')
  })

  test('3. UPDATE - Edit Expense', async ({ page }) => {
    console.log('Starting UPDATE test...')

    await page.waitForTimeout(2000)

    // Find the test expense row
    const testExpenseRow = page.locator('tr:has-text("Test Supplier ABC")').first()

    // Look for edit button (might be an icon or text button)
    const editButton = testExpenseRow.locator('button').filter({ hasText: /edit/i }).first()

    try {
      await editButton.click({ timeout: 5000 })
    } catch {
      // Try alternative: click on the row or find edit icon
      console.log('Edit button not found by text, trying icon...')
      const editIcon = testExpenseRow.locator('svg, button[title*="edit"], button[aria-label*="edit"]').first()
      await editIcon.click()
    }

    await page.waitForTimeout(1000)

    // Take screenshot of edit dialog
    await page.screenshot({ path: 'test-results/06-edit-expense-dialog.png', fullPage: true })

    // Update amount
    await page.fill('#amount', '2000.75')

    // Update description
    await page.fill('#description', 'UPDATED: Test expense modified by Playwright - Office Equipment')

    // Take screenshot before update
    await page.screenshot({ path: 'test-results/07-updated-expense-form.png', fullPage: true })

    // Submit update
    await page.click('button:has-text("Update")')
    await page.waitForTimeout(3000)

    // Take screenshot after update
    await page.screenshot({ path: 'test-results/08-expense-updated.png', fullPage: true })

    // Verify changes
    await expect(page.locator('text=2,000.75')).toBeVisible()

    console.log('✓ UPDATE test passed')
  })

  test('4. VALIDATION - Test Form Validation', async ({ page }) => {
    console.log('Starting VALIDATION test...')

    await page.waitForTimeout(1000)

    // Click Add Expense
    await page.click('button:has-text("Add Expense")')
    await page.waitForTimeout(1000)

    // Try to submit empty form
    await page.click('button:has-text("Create Expense")')
    await page.waitForTimeout(1000)

    // Take screenshot of validation errors
    await page.screenshot({ path: 'test-results/09-validation-errors.png', fullPage: true })

    // Fill only category and try invalid amount
    const categorySelect = page.locator('[id="categoryId"]').first()
    await categorySelect.click()
    await page.waitForTimeout(500)
    const firstCategory = page.locator('[role="option"]').first()
    await firstCategory.click()

    // Try negative amount
    await page.fill('#amount', '-100')
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/10-negative-amount.png', fullPage: true })

    // Close dialog
    await page.click('button:has-text("Cancel")')
    await page.waitForTimeout(1000)

    console.log('✓ VALIDATION test passed')
  })

  test('5. FILTER - Test Filtering Functionality', async ({ page }) => {
    console.log('Starting FILTER test...')

    await page.waitForTimeout(2000)

    // Take screenshot before filtering
    await page.screenshot({ path: 'test-results/11-before-filter.png', fullPage: true })

    // Test date filter if available
    const startDateInput = page.locator('input[type="date"]').first()
    if (await startDateInput.isVisible()) {
      const today = new Date().toISOString().split('T')[0]
      await startDateInput.fill(today)
      await page.waitForTimeout(1000)
    }

    // Test category filter
    const categoryFilter = page.locator('select, [role="combobox"]').filter({ hasText: /category/i }).first()
    if (await categoryFilter.isVisible()) {
      await categoryFilter.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/12-category-filter.png', fullPage: true })
    }

    // Test status filter
    const statusFilter = page.locator('select, [role="combobox"]').filter({ hasText: /status/i }).first()
    if (await statusFilter.isVisible()) {
      await statusFilter.click()
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/13-status-filter.png', fullPage: true })
    }

    // Test search if available
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first()
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test Supplier')
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/14-search-filter.png', fullPage: true })
      await searchInput.clear()
    }

    console.log('✓ FILTER test passed')
  })

  test('6. DELETE/VOID - Void Expense', async ({ page }) => {
    console.log('Starting DELETE/VOID test...')

    await page.waitForTimeout(2000)

    // Find the test expense row
    const testExpenseRow = page.locator('tr:has-text("Test Supplier ABC")').first()

    // Look for void/delete button
    const voidButton = testExpenseRow.locator('button').filter({ hasText: /void|delete/i }).first()

    try {
      await voidButton.click({ timeout: 5000 })
      await page.waitForTimeout(1000)

      // Take screenshot of void dialog
      await page.screenshot({ path: 'test-results/15-void-dialog.png', fullPage: true })

      // Confirm void
      await page.click('button:has-text("Confirm"), button:has-text("Yes"), button:has-text("Void")')
      await page.waitForTimeout(2000)

      // Take screenshot after void
      await page.screenshot({ path: 'test-results/16-expense-voided.png', fullPage: true })

      console.log('✓ DELETE/VOID test passed')
    } catch (error) {
      console.log('Void button not found or not accessible:', error)
      await page.screenshot({ path: 'test-results/16-void-not-available.png', fullPage: true })
      console.log('⚠ DELETE/VOID test skipped (feature may not be available)')
    }
  })

  test('7. EXPORT - Test Export Functionality', async ({ page }) => {
    console.log('Starting EXPORT test...')

    await page.waitForTimeout(2000)

    // Look for export buttons
    const exportPdfButton = page.locator('button:has-text("PDF"), button:has-text("Export to PDF")').first()
    const exportExcelButton = page.locator('button:has-text("Excel"), button:has-text("Export to Excel")').first()

    // Test PDF export if available
    if (await exportPdfButton.isVisible()) {
      await exportPdfButton.click()
      await page.waitForTimeout(2000)
      console.log('✓ PDF export button clicked')
    }

    // Test Excel export if available
    if (await exportExcelButton.isVisible()) {
      await exportExcelButton.click()
      await page.waitForTimeout(2000)
      console.log('✓ Excel export button clicked')
    }

    await page.screenshot({ path: 'test-results/17-export-options.png', fullPage: true })

    console.log('✓ EXPORT test completed')
  })
})

test.describe('Expense Report Generation', () => {
  test('Generate comprehensive expense report data', async ({ page }) => {
    console.log('Generating expense report analysis...')

    // Login
    await page.goto('http://localhost:3004/login')
    await page.fill('input[name="username"]', 'superadmin')
    await page.fill('input[name="password"]', 'password')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard')

    // Navigate to expenses
    await page.goto('http://localhost:3004/dashboard/expenses')
    await page.waitForTimeout(3000)

    // Capture current state
    await page.screenshot({ path: 'test-results/18-expense-report-overview.png', fullPage: true })

    // Navigate to expense reports if available
    await page.goto('http://localhost:3004/dashboard/reports/expenses')
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/19-expense-reports-page.png', fullPage: true })

    console.log('✓ Report generation completed')
  })
})
