# Playwright Smoke Tests

This directory contains comprehensive Playwright smoke tests for the UltimatePOS Modern application.

## Test Structure

- `test-utils.ts` - Common test utilities and configuration
- `tests/` - Individual test files for each route
- `playwright.config.ts` - Playwright configuration
- `test-runner.js` - Test execution script

## Running Tests

```bash
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
```

## Performance Thresholds

- **First Paint**: < 1.5 seconds
- **Load Time**: < 3 seconds
- **Interaction Time**: < 1 second

## Test Coverage

- **Dashboard** (/dashboard) - Critical
- **Products List** (/dashboard/products) - Critical
- **Sales List** (/dashboard/sales) - Critical
- **Purchases List** (/dashboard/purchases) - Critical
- **Customers List** (/dashboard/customers) - Critical
- **Inventory Corrections** (/dashboard/inventory-corrections) - Basic
- **Sales Reports** (/dashboard/reports/sales) - Basic
- **Inventory Ledger** (/dashboard/reports/inventory-ledger) - Basic
- **Analytics Dashboard** (/dashboard/analytics-devextreme) - Critical
- **POS System** (/dashboard/pos) - Critical

## Features Tested

- Page load performance
- Data loading and display
- Pagination functionality
- Sorting functionality
- Filtering functionality
- Error handling
- Accessibility compliance
- Cross-browser compatibility
