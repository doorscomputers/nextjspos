# Inventory Transfer E2E Tests - Quick Start Guide

## Overview

This directory contains comprehensive end-to-end tests for the inventory transfer functionality. The tests verify the complete workflow from creation to completion, including database integrity, audit trails, and edge cases.

## Test Files

### Main Test Suite
**File:** `transfers-complete-e2e.spec.ts`
**Tests:** 18 comprehensive test cases
**Coverage:**
- Transfer request creation and validation
- Complete 9-stage approval workflow
- Inventory adjustments (stock deduction & addition)
- Audit trail verification
- Edge cases (insufficient stock, concurrent transfers, etc.)
- Multi-tenant isolation
- Transfer reports

### Existing Test Suites
- `transfers-comprehensive.spec.ts` - Workflow comprehensive tests
- `transfers-workflow.spec.ts` - Workflow validation
- `transfer-auto-select.spec.ts` - Auto-selection features

## Prerequisites

Before running the tests, ensure:

1. **Database Setup**
   ```bash
   npm run db:seed
   ```

2. **Verify Demo Data**
   - At least 2 business locations (Main Warehouse + Branch)
   - Products with stock available at source location
   - Demo users: admin (password: password)

3. **Development Server**
   ```bash
   npm run dev
   ```
   Server should be running at http://localhost:3000

## Running Tests

### Run All Transfer Tests
```bash
npx playwright test e2e/transfers-complete-e2e.spec.ts
```

### Run with UI Mode (Recommended for Debugging)
```bash
npx playwright test e2e/transfers-complete-e2e.spec.ts --ui
```

### Run Specific Test Category
```bash
# Transfer creation tests
npx playwright test e2e/transfers-complete-e2e.spec.ts -g "Transfer Request Creation"

# Workflow tests
npx playwright test e2e/transfers-complete-e2e.spec.ts -g "Transfer Approval Workflow"

# Edge case tests
npx playwright test e2e/transfers-complete-e2e.spec.ts -g "Edge Cases"

# Report tests
npx playwright test e2e/transfers-complete-e2e.spec.ts -g "Transfer Reports"
```

### Run Single Test
```bash
npx playwright test e2e/transfers-complete-e2e.spec.ts -g "Should create transfer request with valid data"
```

### Generate HTML Report
```bash
npx playwright test e2e/transfers-complete-e2e.spec.ts
npx playwright show-report
```

### Run in Debug Mode
```bash
npx playwright test e2e/transfers-complete-e2e.spec.ts --debug
```

### Run with Specific Browser
```bash
# Chromium (default)
npx playwright test e2e/transfers-complete-e2e.spec.ts --project=chromium

# Firefox
npx playwright test e2e/transfers-complete-e2e.spec.ts --project=firefox

# WebKit (Safari)
npx playwright test e2e/transfers-complete-e2e.spec.ts --project=webkit
```

## Test Structure

### Test Organization

```
transfers-complete-e2e.spec.ts
│
├── 1. Transfer Request Creation
│   ├── 1.1 Should create transfer request with valid data
│   ├── 1.2 Should validate required fields
│   └── 1.3 Should prevent transfer to same location
│
├── 2. Transfer Approval Workflow
│   ├── 2.1 Should submit transfer for checking
│   ├── 2.2 Should approve transfer (check)
│   ├── 2.3 Should send transfer (stock deduction) [CRITICAL]
│   ├── 2.4 Should mark transfer as arrived
│   ├── 2.5 Should start verification
│   ├── 2.6 Should verify all items
│   └── 2.7 Should complete transfer (stock addition) [CRITICAL]
│
├── 3. Audit Trail & History
│   ├── 3.1 Should record audit logs for all actions
│   └── 3.2 Should show stock movements in history
│
├── 4. Edge Cases
│   ├── 4.1 Should prevent transfer with insufficient stock
│   ├── 4.2 Should prevent canceling completed transfer
│   └── 4.3 Should enforce multi-tenant isolation
│
└── 5. Transfer Reports
    ├── 5.1 Should display transfers in list view
    ├── 5.2 Should filter transfers by status
    └── 5.3 Should export transfers to Excel
```

## What Each Test Verifies

### Test 2.3: Send Transfer (CRITICAL)
This test verifies the critical stock deduction operation:
```typescript
// Before Send
stockBefore = 50 units

// After Send
stockAfter = 40 units (50 - 10)
transfer.status = 'in_transit'
transfer.stockDeducted = true
```

### Test 2.7: Complete Transfer (CRITICAL)
This test verifies the critical stock addition operation:
```typescript
// Before Complete
destinationStock = 100 units

// After Complete
destinationStock = 110 units (100 + 10)
transfer.status = 'completed'
```

## Database Verification

Every critical test includes database verification:

```typescript
// Example: Verify stock was deducted
const stockAfter = await prisma.variationLocationDetails.findFirst({
  where: {
    productVariationId: variationId,
    locationId: fromLocationId
  }
})

expect(stockAfter.qtyAvailable).toBe(stockBefore.qtyAvailable - transferQuantity)
```

This ensures the **actual database state** matches expected behavior.

## Troubleshooting

### Test Fails on Login
**Issue:** Login credentials invalid
**Solution:**
```bash
# Reseed database
npm run db:seed

# Verify admin user exists
# Username: admin
# Password: password
```

### No Products Available
**Issue:** No products with stock to transfer
**Solution:**
```bash
# Ensure database is seeded with demo products
npm run db:seed

# Or manually create products with stock via UI
```

### Transfer Not Created
**Issue:** Location assignment issues
**Solution:**
- Ensure user has assigned location (admin should have access to all)
- Check that at least 2 locations exist
- Verify location selection logic in create page

### Database Connection Error
**Issue:** Prisma cannot connect to database
**Solution:**
```bash
# Check DATABASE_URL in .env
# Verify PostgreSQL/MySQL is running
# Test connection:
npx prisma db pull
```

## Test Data Cleanup

Tests create real transfers in the database. To clean up:

```bash
# Option 1: Reseed database (deletes all data)
npm run db:seed

# Option 2: Manual cleanup via Prisma Studio
npm run db:studio
# Navigate to StockTransfer table and delete test records
```

## Continuous Integration

To run these tests in CI/CD:

```yaml
# .github/workflows/test.yml
- name: Run Transfer E2E Tests
  run: |
    npm run db:seed
    npm run dev &
    npx playwright test e2e/transfers-complete-e2e.spec.ts
```

## Performance Notes

- **Test Duration:** ~3-5 minutes for full suite
- **Individual Test:** ~10-30 seconds
- **Database Operations:** Uses real Prisma client (not mocked)
- **Network Calls:** Uses actual API endpoints (integration testing)

## Best Practices

1. **Run tests in sequence** (not parallel) to avoid data conflicts
2. **Use fresh database** for accurate results
3. **Check server logs** if tests fail unexpectedly
4. **Take screenshots** on failures (automatic)
5. **Review HTML report** for detailed failure analysis

## Additional Resources

- **Playwright Docs:** https://playwright.dev
- **Test Report:** `../TEST_REPORT_INVENTORY_TRANSFERS.md`
- **Summary:** `../TESTING_SUMMARY.md`
- **Codebase:** Check `/src/app/dashboard/transfers/` for UI
- **API Routes:** Check `/src/app/api/transfers/` for backend

## Support

If tests fail unexpectedly:
1. Check server is running (`npm run dev`)
2. Verify database is seeded (`npm run db:seed`)
3. Review screenshot in `test-results/` directory
4. Check error-context.md for detailed error info
5. Run single test in debug mode for investigation

---

**Happy Testing!** 🎉

These tests ensure the transfer system maintains data integrity, prevents fraud, and provides complete audit trails for production use.
