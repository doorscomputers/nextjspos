import { test, expect } from '@playwright/test';

test.describe('UI Improvements Testing', () => {
  test('Login page has new gradient design', async ({ page }) => {
    await page.goto('http://localhost:3001/login');

    // Check for gradient background
    const mainDiv = page.locator('div').first();
    await expect(mainDiv).toHaveCSS('background', /gradient/);

    // Check for Welcome Back title
    await expect(page.locator('text=Welcome Back')).toBeVisible();

    // Check for password visibility toggle
    const passwordToggle = page.locator('button[type="button"]').filter({ hasText: '' }).first();
    await expect(passwordToggle).toBeVisible();

    // Check for Remember Me checkbox
    await expect(page.locator('text=Remember Me')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/new-login-page.png', fullPage: true });
  });

  test('Can login with new UI', async ({ page }) => {
    await page.goto('http://localhost:3001/login');

    // Fill in credentials
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');

    // Test password visibility toggle
    const passwordInput = page.locator('input[name="password"]');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleButton = page.locator('button[type="button"]').filter({ has: page.locator('svg') }).first();
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');

    // Toggle back
    await toggleButton.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Submit login
    await page.click('button[type="submit"]');

    // Wait for redirect to dashboard
    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Verify we're on dashboard
    await expect(page.locator('text=Dashboard Overview')).toBeVisible({ timeout: 10000 });

    // Take screenshot
    await page.screenshot({ path: 'test-results/after-login-dashboard.png', fullPage: true });
  });

  test('Dashboard displays correctly', async ({ page }) => {
    // Login first
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Check for metric cards
    await expect(page.locator('text=Total Sales')).toBeVisible();
    await expect(page.locator('text=Net Amount')).toBeVisible();

    // Check for location filter
    await expect(page.locator('text=Location:')).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/dashboard-metrics.png', fullPage: true });
  });

  test('Import Products page is accessible', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to import products
    await page.goto('http://localhost:3003/dashboard/products/import');

    // Check page title
    await expect(page.locator('text=Import Products')).toBeVisible();

    // Check for instructions table
    await expect(page.locator('text=Instructions')).toBeVisible();
    await expect(page.locator('text=Column Number')).toBeVisible();
    await expect(page.locator('text=Column Name')).toBeVisible();

    // Check for file upload section
    await expect(page.locator('text=File To Import')).toBeVisible();
    await expect(page.locator('text=Browse...')).toBeVisible();

    // Check for download template button
    const downloadButton = page.locator('button:has-text("Download template file")');
    await expect(downloadButton).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: 'test-results/import-products-page.png', fullPage: true });
  });

  test('Download template file works', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to import products
    await page.goto('http://localhost:3003/dashboard/products/import');

    // Set up download listener
    const downloadPromise = page.waitForEvent('download');

    // Click download template button
    await page.click('button:has-text("Download template file")');

    // Wait for download
    const download = await downloadPromise;

    // Verify filename
    expect(download.suggestedFilename()).toBe('product_import_template.csv');

    console.log('✓ Template file downloaded successfully');
  });

  test('Mobile responsiveness - Login page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('http://localhost:3001/login');

    // Check that elements are visible on mobile
    await expect(page.locator('text=Welcome Back')).toBeVisible();
    await expect(page.locator('input[name="username"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/mobile-login-page.png', fullPage: true });
  });

  test('Mobile responsiveness - Import Products page', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Login
    await page.goto('http://localhost:3001/login');
    await page.fill('input[name="username"]', 'superadmin');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard', { timeout: 10000 });

    // Navigate to import products
    await page.goto('http://localhost:3003/dashboard/products/import');

    // Check responsive elements
    await expect(page.locator('text=Import Products')).toBeVisible();
    await expect(page.locator('text=Instructions')).toBeVisible();

    // Take mobile screenshot
    await page.screenshot({ path: 'test-results/mobile-import-products.png', fullPage: true });
  });
});
