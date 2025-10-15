import { test, expect } from '@playwright/test';

test.describe('Historical Inventory Report', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the login page
    await page.goto('http://localhost:3000/login');

    // Fill in login credentials (assuming seeded data)
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Wait for dashboard to load
    await page.waitForURL('**/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should navigate to historical inventory report page', async ({ page }) => {
    // Navigate to Historical Inventory Report via sidebar
    await page.click('text=Reports');
    await page.click('text=Historical Inventory Report');

    // Verify we're on the correct page
    await expect(page).toHaveURL('**/dashboard/reports/historical-inventory');
    await expect(page.locator('h1')).toContainText('Historical Inventory Report');
    await expect(page.locator('text=View inventory levels as of a specific date')).toBeVisible();
  });

  test('should display all filter controls with proper styling', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Check page title
    await expect(page.locator('h1')).toContainText('Historical Inventory Report');

    // Check filter card
    await expect(page.locator('text=Report Filters')).toBeVisible();

    // Check form controls
    await expect(page.locator('label:has-text("Target Date")')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();

    await expect(page.locator('label:has-text("Location")')).toBeVisible();
    await expect(page.locator('button:has-text("All Locations")')).toBeVisible();

    await expect(page.locator('label:has-text("Search Products")')).toBeVisible();
    await expect(page.locator('input[placeholder*="Name, SKU or barcode"]')).toBeVisible();
    await expect(page.locator('button:has-text("Search")')).toBeVisible();

    // Check Generate Report button styling
    const generateButton = page.locator('button:has-text("Generate Report")');
    await expect(generateButton).toBeVisible();
    await expect(generateButton).toHaveClass(/font-medium/);
    await expect(generateButton).toHaveClass(/h-10/);

    // Check button has proper icon
    await expect(generateButton.locator('svg')).toBeVisible();
  });

  test('should show loading state when generating report', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Fill in required fields
    await page.fill('input[type="date"]', '2025-10-13');

    // Click generate button
    await page.click('button:has-text("Generate Report")');

    // Check for loading spinner
    await expect(page.locator('.animate-spin')).toBeVisible();
    await expect(page.locator('text=Generating...')).toBeVisible();
  });

  test('should handle search functionality', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Test search input
    const searchInput = page.locator('input[placeholder*="Name, SKU or barcode"]');
    await expect(searchInput).toBeVisible();

    // Test search by product name
    await searchInput.fill('test');
    await page.keyboard.press('Enter');

    // Test search by SKU
    await searchInput.fill('SKU001');
    await page.click('button:has-text("Search")');

    // Test search by barcode
    await searchInput.fill('123456789');
    await page.click('button:has-text("Search")');
  });

  test('should handle date selection properly', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    const dateInput = page.locator('input[type="date"]');

    // Check default date is today
    const today = new Date().toISOString().split('T')[0];
    await expect(dateInput).toHaveValue(today);

    // Check max date is today (no future dates)
    const maxDate = await dateInput.getAttribute('max');
    expect(maxDate).toBe(today);

    // Test date change
    await dateInput.fill('2025-10-13');
    await expect(dateInput).toHaveValue('2025-10-13');
  });

  test('should show error states appropriately', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Clear date to test validation
    await page.fill('input[type="date"]', '');

    // Generate button should be disabled without date
    const generateButton = page.locator('button:has-text("Generate Report")');
    await expect(generateButton).toBeDisabled();

    // Fill invalid date
    await page.fill('input[type="date"]', 'invalid-date');

    // Try to generate (this should show API error)
    await generateButton.click();

    // Wait for potential error response
    await page.waitForTimeout(2000);

    // Check for console errors or error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
  });

  test('should show proper empty state', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Before generating report, summary cards should not be visible
    await expect(page.locator('text=Total Products')).not.toBeVisible();
    await expect(page.locator('text=Total Quantity')).not.toBeVisible();
    await expect(page.locator('text=Total Value')).not.toBeVisible();

    // Export button should not be visible without data
    await expect(page.locator('button:has-text("Export CSV")')).not.toBeVisible();
  });

  test('should be responsive on mobile devices', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Check elements are properly displayed on mobile
    await expect(page.locator('h1')).toBeVisible();

    // Filter inputs should stack vertically on mobile
    const filterGrid = page.locator('.grid');
    await expect(filterGrid).toHaveClass(/grid-cols-1/);

    // Generate button should be full width on mobile
    const generateButton = page.locator('button:has-text("Generate Report")');
    await expect(generateButton).toHaveClass(/w-full/);
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Tab through form fields
    await page.keyboard.press('Tab');
    await expect(page.locator('input[type="date"]')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('button:has-text("All Locations")')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('input[placeholder*="Name, SKU or barcode"]')).toBeFocused();

    // Test Enter key on search input
    await page.fill('input[placeholder*="Name, SKU or barcode"]', 'test');
    await page.keyboard.press('Enter');

    // Should trigger search or report generation
    await page.waitForTimeout(1000);
  });

  test('should show proper accessibility attributes', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Check proper labels are associated with inputs
    await expect(page.locator('label[for="date"]')).toBeVisible();
    await expect(page.locator('label[for="location"]')).toBeVisible();
    await expect(page.locator('label[for="search"]')).toBeVisible();

    // Check buttons have proper ARIA attributes
    const generateButton = page.locator('button:has-text("Generate Report")');
    await expect(generateButton).toHaveAttribute('type', 'button');

    const searchButton = page.locator('button:has-text("Search")');
    await expect(searchButton).toHaveAttribute('type', 'button');
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Try to generate report
    await page.fill('input[type="date"]', '2025-10-13');
    await page.click('button:has-text("Generate Report")');

    // Wait for API response
    await page.waitForTimeout(3000);

    // Check if any errors occurred and log them
    if (consoleErrors.length > 0) {
      console.log('Console errors detected:', consoleErrors);
    }
  });
});

test.describe('Historical Inventory Report - Data Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  });

  test('should validate API response structure', async ({ page }) => {
    await page.goto('http://localhost:3000/dashboard/reports/historical-inventory');

    // Intercept API call to check response structure
    let apiResponse: any = null;
    page.on('response', async (response) => {
      if (response.url().includes('/api/reports/historical-inventory')) {
        apiResponse = await response.json();
      }
    });

    await page.fill('input[type="date"]', '2025-10-13');
    await page.click('button:has-text("Generate Report")');

    // Wait for API call
    await page.waitForTimeout(2000);

    if (apiResponse) {
      console.log('API Response Structure:', JSON.stringify(apiResponse, null, 2));

      // Validate response structure
      expect(apiResponse).toHaveProperty('success');
      expect(apiResponse).toHaveProperty('data');

      if (apiResponse.data) {
        expect(apiResponse.data).toHaveProperty('inventory');
        expect(apiResponse.data).toHaveProperty('summary');
        expect(apiResponse.data).toHaveProperty('pagination');
        expect(apiResponse.data).toHaveProperty('reportInfo');

        // Validate summary structure
        if (apiResponse.data.summary) {
          expect(apiResponse.data.summary).toHaveProperty('totalProducts');
          expect(apiResponse.data.summary).toHaveProperty('totalQuantity');
          expect(apiResponse.data.summary).toHaveProperty('totalValue');
          expect(apiResponse.data.summary).toHaveProperty('currency');
        }
      }
    }
  });
});