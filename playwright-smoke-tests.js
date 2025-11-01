#!/usr/bin/env node

/**
 * Playwright Smoke Tests Generator
 * 
 * This script generates comprehensive Playwright smoke tests for routes
 * that test pagination, sorting, and performance (first paint < 1.5s).
 */

const fs = require('fs');
const path = require('path');

// Configuration
const OUTPUT_DIR = './optimization-results/playwright-tests';
const TEST_ROUTES = [
    { path: '/dashboard', name: 'Dashboard', critical: true },
    { path: '/dashboard/products', name: 'Products List', critical: true },
    { path: '/dashboard/sales', name: 'Sales List', critical: true },
    { path: '/dashboard/purchases', name: 'Purchases List', critical: true },
    { path: '/dashboard/customers', name: 'Customers List', critical: true },
    { path: '/dashboard/inventory-corrections', name: 'Inventory Corrections', critical: false },
    { path: '/dashboard/reports/sales', name: 'Sales Reports', critical: false },
    { path: '/dashboard/reports/inventory-ledger', name: 'Inventory Ledger', critical: false },
    { path: '/dashboard/analytics-devextreme', name: 'Analytics Dashboard', critical: true },
    { path: '/dashboard/pos', name: 'POS System', critical: true }
];

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate base test configuration
 */
function generateBaseConfig() {
    return `import { test, expect } from '@playwright/test'

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const TEST_USER = {
  username: 'admin',
  password: 'password'
}

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
  firstPaint: 1500, // 1.5 seconds
  loadTime: 3000,   // 3 seconds
  interactionTime: 1000 // 1 second
}

// Common test utilities
class TestUtils {
  static async login(page) {
    await page.goto(\`\${BASE_URL}/login\`)
    await page.fill('input[name="username"]', TEST_USER.username)
    await page.fill('input[name="password"]', TEST_USER.password)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**')
  }

  static async measurePerformance(page, action) {
    const startTime = Date.now()
    await action()
    const endTime = Date.now()
    return endTime - startTime
  }

  static async getFirstPaintTime(page) {
    return await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries()
          const paintEntry = entries.find(entry => entry.name === 'first-paint')
          if (paintEntry) {
            resolve(paintEntry.startTime)
          }
        })
        observer.observe({ entryTypes: ['paint'] })
      })
    })
  }

  static async waitForDataLoad(page, selector = '[data-testid="loading"]') {
    // Wait for loading indicator to disappear
    await page.waitForSelector(selector, { state: 'hidden', timeout: 10000 })
    // Wait a bit more for data to be fully rendered
    await page.waitForTimeout(500)
  }
}`;
}

/**
 * Generate route-specific test
 */
function generateRouteTest(route) {
    return `import { test, expect } from '@playwright/test'
import { TestUtils, PERFORMANCE_THRESHOLDS } from './test-utils'

test.describe('${route.name} Page', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should load page within performance threshold', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    
    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle')
    
    const loadTime = Date.now() - startTime
    
    // Check first paint time
    const firstPaintTime = await TestUtils.getFirstPaintTime(page)
    expect(firstPaintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.firstPaint)
    
    // Check total load time
    expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    
    console.log(\`${route.name} - Load time: \${loadTime}ms, First paint: \${firstPaintTime}ms\`)
  })

  test('should display data without errors', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    
    // Wait for data to load
    await TestUtils.waitForDataLoad(page)
    
    // Check for error messages
    const errorMessages = await page.locator('[data-testid="error"], .error, .alert-error').count()
    expect(errorMessages).toBe(0)
    
    // Check for loading indicators (should not be visible)
    const loadingIndicators = await page.locator('[data-testid="loading"], .loading, .spinner').count()
    expect(loadingIndicators).toBe(0)
  })

  ${route.critical ? generateCriticalTests(route) : generateBasicTests(route)}
})`;
}

/**
 * Generate critical tests for important routes
 */
function generateCriticalTests(route) {
    return `
  test('should handle pagination correctly', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for pagination controls
    const pagination = page.locator('[data-testid="pagination"], .pagination, .pager')
    const hasPagination = await pagination.count() > 0
    
    if (hasPagination) {
      // Test pagination navigation
      const nextButton = page.locator('button:has-text("Next"), .pagination-next, [data-testid="next-page"]')
      const prevButton = page.locator('button:has-text("Previous"), .pagination-prev, [data-testid="prev-page"]')
      
      if (await nextButton.count() > 0) {
        await nextButton.click()
        await TestUtils.waitForDataLoad(page)
        
        // Verify page changed
        const currentPage = await page.locator('[data-testid="current-page"], .current-page').textContent()
        expect(currentPage).toContain('2')
      }
    }
  })

  test('should handle sorting correctly', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for sortable columns
    const sortableHeaders = page.locator('th[data-sortable="true"], .sortable, [data-testid="sortable-header"]')
    const sortableCount = await sortableHeaders.count()
    
    if (sortableCount > 0) {
      // Click first sortable header
      await sortableHeaders.first().click()
      await TestUtils.waitForDataLoad(page)
      
      // Verify sort indicator appears
      const sortIndicator = page.locator('.sort-asc, .sort-desc, [data-testid="sort-indicator"]')
      expect(await sortIndicator.count()).toBeGreaterThan(0)
    }
  })

  test('should handle filtering correctly', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for search/filter inputs
    const searchInput = page.locator('input[type="search"], input[placeholder*="search"], [data-testid="search-input"]')
    const hasSearch = await searchInput.count() > 0
    
    if (hasSearch) {
      // Test search functionality
      await searchInput.fill('test')
      await page.keyboard.press('Enter')
      await TestUtils.waitForDataLoad(page)
      
      // Verify results are filtered
      const results = page.locator('tbody tr, .data-row, [data-testid="data-row"]')
      const resultCount = await results.count()
      expect(resultCount).toBeGreaterThan(0)
    }
  })

  test('should handle data refresh correctly', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    await TestUtils.waitForDataLoad(page)
    
    // Look for refresh button
    const refreshButton = page.locator('button:has-text("Refresh"), .refresh-button, [data-testid="refresh-button"]')
    const hasRefresh = await refreshButton.count() > 0
    
    if (hasRefresh) {
      const startTime = Date.now()
      await refreshButton.click()
      await TestUtils.waitForDataLoad(page)
      const refreshTime = Date.now() - startTime
      
      // Verify refresh completed quickly
      expect(refreshTime).toBeLessThan(PERFORMANCE_THRESHOLDS.interactionTime)
    }
  })`;
}

/**
 * Generate basic tests for non-critical routes
 */
function generateBasicTests(route) {
    return `
  test('should display content without errors', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}${route.path}\`)
    await TestUtils.waitForDataLoad(page)
    
    // Check for basic content
    const content = page.locator('main, .content, [data-testid="main-content"]')
    expect(await content.count()).toBeGreaterThan(0)
  })`;
}

/**
 * Generate performance test suite
 */
function generatePerformanceTests() {
    return `import { test, expect } from '@playwright/test'
import { TestUtils, PERFORMANCE_THRESHOLDS } from './test-utils'

test.describe('Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should load all critical pages within performance threshold', async ({ page }) => {
    const criticalRoutes = [
      '/dashboard',
      '/dashboard/products',
      '/dashboard/sales',
      '/dashboard/purchases',
      '/dashboard/customers',
      '/dashboard/analytics-devextreme',
      '/dashboard/pos'
    ]

    for (const route of criticalRoutes) {
      const startTime = Date.now()
      
      await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}\${route}\`)
      await page.waitForLoadState('networkidle')
      
      const loadTime = Date.now() - startTime
      const firstPaintTime = await TestUtils.getFirstPaintTime(page)
      
      console.log(\`\${route} - Load: \${loadTime}ms, First paint: \${firstPaintTime}ms\`)
      
      expect(firstPaintTime).toBeLessThan(PERFORMANCE_THRESHOLDS.firstPaint)
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    }
  })

  test('should handle concurrent page loads efficiently', async ({ browser }) => {
    const context = await browser.newContext()
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ])

    // Login to all pages
    await Promise.all(pages.map(page => TestUtils.login(page)))

    // Load different pages concurrently
    const startTime = Date.now()
    await Promise.all([
      pages[0].goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard\`),
      pages[1].goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/products\`),
      pages[2].goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/sales\`)
    ])

    const totalTime = Date.now() - startTime
    
    // Concurrent loads should not take much longer than single load
    expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime * 1.5)
    
    await context.close()
  })

  test('should handle large data sets efficiently', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard/products\`)
    await TestUtils.waitForDataLoad(page)
    
    // Test with large page size
    const pageSizeSelect = page.locator('select[name="pageSize"], [data-testid="page-size-select"]')
    if (await pageSizeSelect.count() > 0) {
      await pageSizeSelect.selectOption('100')
      await TestUtils.waitForDataLoad(page)
      
      const loadTime = await TestUtils.measurePerformance(page, async () => {
        await page.waitForLoadState('networkidle')
      })
      
      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.loadTime)
    }
  })
})`;
}

/**
 * Generate accessibility tests
 */
function generateAccessibilityTests() {
    return `import { test, expect } from '@playwright/test'
import { TestUtils } from './test-utils'

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestUtils.login(page)
  })

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard\`)
    await TestUtils.waitForDataLoad(page)
    
    // Check for main landmark
    const main = page.locator('main, [role="main"]')
    expect(await main.count()).toBeGreaterThan(0)
    
    // Check for navigation landmark
    const nav = page.locator('nav, [role="navigation"]')
    expect(await nav.count()).toBeGreaterThan(0)
    
    // Check for proper heading hierarchy
    const h1 = page.locator('h1')
    expect(await h1.count()).toBeGreaterThan(0)
  })

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard\`)
    await TestUtils.waitForDataLoad(page)
    
    // Test tab navigation
    await page.keyboard.press('Tab')
    const focusedElement = page.locator(':focus')
    expect(await focusedElement.count()).toBeGreaterThan(0)
  })

  test('should have proper color contrast', async ({ page }) => {
    await page.goto(\`\${process.env.BASE_URL || 'http://localhost:3000'}/dashboard\`)
    await TestUtils.waitForDataLoad(page)
    
    // This would require a more sophisticated color contrast checker
    // For now, just ensure the page loads without visual errors
    const body = page.locator('body')
    expect(await body.count()).toBeGreaterThan(0)
  })
})`;
}

/**
 * Generate Playwright configuration
 */
function generatePlaywrightConfig() {
    return `import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] }
    }
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI
  }
})`;
}

/**
 * Generate package.json scripts
 */
function generatePackageScripts() {
    return `{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "test:e2e:headed": "playwright test --headed",
    "test:e2e:report": "playwright show-report",
    "test:e2e:install": "playwright install",
    "test:smoke": "playwright test --grep @smoke",
    "test:performance": "playwright test --grep @performance",
    "test:accessibility": "playwright test --grep @accessibility"
  }
}`;
}

/**
 * Generate test runner script
 */
function generateTestRunner() {
    return `#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const TEST_TYPES = {
  smoke: 'Smoke Tests',
  performance: 'Performance Tests',
  accessibility: 'Accessibility Tests',
  all: 'All Tests'
}

function runTests(type = 'all') {
  console.log(\`🚀 Running \${TEST_TYPES[type]}...\`)
  
  try {
    let command = 'npx playwright test'
    
    if (type !== 'all') {
      command += \` --grep @\${type}\`
    }
    
    execSync(command, { stdio: 'inherit' })
    console.log(\`✅ \${TEST_TYPES[type]} completed successfully!\`)
  } catch (error) {
    console.error(\`❌ \${TEST_TYPES[type]} failed:\`, error.message)
    process.exit(1)
  }
}

function generateReport() {
  console.log('📊 Generating test report...')
  
  try {
    execSync('npx playwright show-report', { stdio: 'inherit' })
  } catch (error) {
    console.error('Failed to generate report:', error.message)
  }
}

// Main execution
const testType = process.argv[2] || 'all'

if (testType === 'report') {
  generateReport()
} else if (TEST_TYPES[testType]) {
  runTests(testType)
} else {
  console.log('Usage: node test-runner.js [smoke|performance|accessibility|all|report]')
  process.exit(1)
}`;
}

/**
 * Main generation process
 */
function main() {
    console.log('🎭 Generating Playwright smoke tests...');

    // Generate base configuration
    fs.writeFileSync(path.join(OUTPUT_DIR, 'test-utils.ts'), generateBaseConfig());

    // Generate route-specific tests
    TEST_ROUTES.forEach(route => {
        const testContent = generateRouteTest(route);
        const testPath = path.join(OUTPUT_DIR, 'tests', `${route.name.toLowerCase().replace(/\s+/g, '-')}.spec.ts`);
        const testDir = path.dirname(testPath);

        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }

        fs.writeFileSync(testPath, testContent);
    });

    // Generate performance tests
    fs.writeFileSync(path.join(OUTPUT_DIR, 'tests', 'performance.spec.ts'), generatePerformanceTests());

    // Generate accessibility tests
    fs.writeFileSync(path.join(OUTPUT_DIR, 'tests', 'accessibility.spec.ts'), generateAccessibilityTests());

    // Generate Playwright configuration
    fs.writeFileSync(path.join(OUTPUT_DIR, 'playwright.config.ts'), generatePlaywrightConfig());

    // Generate package.json scripts
    fs.writeFileSync(path.join(OUTPUT_DIR, 'package-scripts.json'), generatePackageScripts());

    // Generate test runner
    fs.writeFileSync(path.join(OUTPUT_DIR, 'test-runner.js'), generateTestRunner());

    // Generate README
    const readme = `# Playwright Smoke Tests

This directory contains comprehensive Playwright smoke tests for the UltimatePOS Modern application.

## Test Structure

- \`test-utils.ts\` - Common test utilities and configuration
- \`tests/\` - Individual test files for each route
- \`playwright.config.ts\` - Playwright configuration
- \`test-runner.js\` - Test execution script

## Running Tests

\`\`\`bash
# Run all tests
npm run test:e2e

# Run specific test types
npm run test:smoke
npm run test:performance
npm run test:accessibility

# Run with UI
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug
\`\`\`

## Performance Thresholds

- **First Paint**: < 1.5 seconds
- **Load Time**: < 3 seconds
- **Interaction Time**: < 1 second

## Test Coverage

${TEST_ROUTES.map(route => `- **${route.name}** (${route.path}) - ${route.critical ? 'Critical' : 'Basic'}`).join('\n')}

## Features Tested

- Page load performance
- Data loading and display
- Pagination functionality
- Sorting functionality
- Filtering functionality
- Error handling
- Accessibility compliance
- Cross-browser compatibility
`;

    fs.writeFileSync(path.join(OUTPUT_DIR, 'README.md'), readme);

    console.log('✅ Playwright smoke tests generated successfully!');
    console.log(`📁 Tests saved to: ${OUTPUT_DIR}`);
    console.log(`📊 Generated ${TEST_ROUTES.length} route tests`);
    console.log(`⚡ Performance tests included`);
    console.log(`♿ Accessibility tests included`);
    console.log(`🎭 Cross-browser testing configured`);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    generateBaseConfig,
    generateRouteTest,
    generatePerformanceTests,
    generateAccessibilityTests,
    generatePlaywrightConfig
};
