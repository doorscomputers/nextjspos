# Customer Return Replacement Issuance Tests - Quick Start Guide

## Overview

This directory contains comprehensive automated tests for the Customer Return Replacement Issuance feature. The tests verify the complete workflow from creating a return to issuing replacement items.

## Test Files

### 1. `customer-return-replacement-api-only.spec.ts` (Recommended)

**Description:** API and database layer tests that don't require the Next.js server to be running.

**What it tests:**
- ✅ Creating customer returns with replacement items
- ✅ Approving returns and verifying stock restoration
- ✅ Issuing replacements and verifying all database changes
- ✅ Stock transaction history
- ✅ Product history records
- ✅ Audit trail completeness

**Advantages:**
- No server required
- Faster execution
- Direct database verification
- Easier to debug

**Run command:**
```bash
npx playwright test e2e/customer-return-replacement-api-only.spec.ts --reporter=list
```

### 2. `customer-return-replacement-issuance.spec.ts`

**Description:** Full E2E tests with browser automation and UI testing.

**What it tests:**
- All API/database tests PLUS:
- UI interactions
- Button visibility logic
- Success/error message display
- Page navigation

**Requires:**
- Next.js server running on `http://localhost:3000`
- Start server: `npm run dev`

**Run command:**
```bash
# In terminal 1
npm run dev

# In terminal 2
npx playwright test e2e/customer-return-replacement-issuance.spec.ts --reporter=list
```

## Prerequisites

### 1. Database Setup

Ensure you have a database with at least:
- A superadmin user (username: `superadmin`, password: `password`)
- At least one business location
- Product categories and units can be created automatically by tests

**Quick setup:**
```bash
# If starting fresh
npm run db:push
npm run db:seed
```

### 2. Environment Variables

Ensure `.env` contains:
```env
DATABASE_URL="your-database-connection-string"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

### 3. Node Modules

```bash
npm install
```

### 4. Playwright Browsers

```bash
npx playwright install chromium
```

## Running the Tests

### Quick Test (Recommended)

```bash
npx playwright test e2e/customer-return-replacement-api-only.spec.ts
```

**Expected output:**
```
Running 3 tests using 1 worker

✓ Step 1: Create Customer Return with Replacement Items (815ms)
✓ Step 2: Approve Customer Return and Verify Stock Restoration (1.9s)
✓ Step 3: Issue Replacement via Direct Stock Operations (2.4s)

3 passed (9.2s)
```

### Full E2E Test (Requires Server)

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npx playwright test e2e/customer-return-replacement-issuance.spec.ts
```

### Run with UI Mode (Debug)

```bash
npx playwright test e2e/customer-return-replacement-api-only.spec.ts --ui
```

### Run with Headed Browser

```bash
npx playwright test e2e/customer-return-replacement-issuance.spec.ts --headed
```

### Generate HTML Report

```bash
npx playwright test e2e/customer-return-replacement-api-only.spec.ts --reporter=html
npx playwright show-report
```

## Test Configuration

### Timeouts

Default timeout: 60 seconds per test
Can be overridden with:
```bash
npx playwright test --timeout=120000
```

### Workers

Tests run sequentially (1 worker) to avoid race conditions:
```bash
npx playwright test --workers=1
```

### Retries

No retries by default. To enable:
```bash
npx playwright test --retries=2
```

## What the Tests Verify

### Database Changes

1. **customer_returns table:**
   - ✅ `replacementIssued` flag set to true
   - ✅ `replacementIssuedAt` timestamp set
   - ✅ `replacementIssuedBy` user ID set
   - ✅ `replacementSaleId` linked to replacement sale

2. **sales table:**
   - ✅ New sale created with `saleType = 'replacement'`
   - ✅ `totalAmount = 0` (no customer charge)
   - ✅ Correct location and customer linkage

3. **variation_location_details table:**
   - ✅ Stock deducted from correct location
   - ✅ Quantity reduced by replacement amount

4. **stock_transactions table:**
   - ✅ Transaction type = 'replacement_issued'
   - ✅ Negative quantity (deduction)
   - ✅ Proper reference to customer return

5. **product_history table:**
   - ✅ Complete audit trail
   - ✅ Transaction type and references
   - ✅ User information

### Business Logic

- ✅ Only approved returns can have replacements issued
- ✅ Only items marked as 'replacement' are processed
- ✅ Stock availability is checked before issuance
- ✅ Duplicate issuance is prevented
- ✅ All operations are atomic (transaction-wrapped)
- ✅ Location-based inventory is respected

## Troubleshooting

### Issue: "Admin user not found"

**Solution:**
```bash
npm run db:seed
```

This creates the superadmin user needed for tests.

### Issue: "net::ERR_CONNECTION_REFUSED at http://localhost:3000"

**Solution:**
Either:
1. Start the Next.js server: `npm run dev`
2. OR run API-only tests: `npx playwright test e2e/customer-return-replacement-api-only.spec.ts`

### Issue: "Insufficient stock" error

**Solution:**
The tests automatically set up sufficient stock (20 units). If this fails:
1. Check database connection
2. Verify product and location exist
3. Check `variation_location_details` table

### Issue: Tests pass but no data visible

**Solution:**
Tests clean up after themselves. To keep test data:
1. Comment out the `test.afterAll` cleanup block
2. Run tests again
3. Check database manually

### Issue: Prisma validation errors

**Solution:**
```bash
npx prisma generate
npx prisma db push
```

This regenerates Prisma Client and updates the schema.

## Test Data

### Automatic Test Setup

The tests create:
- Test customer: "Test Customer - Replacement"
- Test product: "Test Product - Replacement Flow"
- Test category: "Test Category"
- Test unit: "Piece"
- Initial stock: 20 units
- Original sale: 2 units sold
- Customer return: 1 unit returned for replacement

### Cleanup

All test data is automatically cleaned up after test execution:
- Customer returns deleted
- Sales deleted
- Products, customers, categories, and units are retained for reuse

## Viewing Test Results

### Console Output

Standard reporter shows:
- Test name
- Duration
- Pass/fail status
- Error messages (if any)

### HTML Report

Generate with:
```bash
npx playwright test --reporter=html
npx playwright show-report
```

Shows:
- Visual test results
- Screenshots (if failures)
- Detailed logs
- Trace viewer (with `--trace on`)

### JSON Report

```bash
npx playwright test --reporter=json > test-results.json
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Customer Return Replacement Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npx playwright install chromium
      - run: npx playwright test e2e/customer-return-replacement-api-only.spec.ts
```

## Performance Benchmarks

**Expected execution times:**
- Test 1 (Create Return): ~800ms
- Test 2 (Approve Return): ~2s
- Test 3 (Issue Replacement): ~2.5s
- **Total:** ~9 seconds

If tests take significantly longer:
1. Check database connection speed
2. Verify no network latency issues
3. Check system resources

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use descriptive test names
3. Add comprehensive database verification
4. Include cleanup in `afterAll` hooks
5. Update this README with new test descriptions

## Support

For issues or questions:
1. Check the main test report: `CUSTOMER-RETURN-REPLACEMENT-TEST-REPORT.md`
2. Review implementation: `src/app/api/customer-returns/[id]/issue-replacement/route.ts`
3. Check stock operations: `src/lib/stockOperations.ts`
4. Review UI component: `src/app/dashboard/customer-returns/[id]/page.tsx`

## Test Maintenance

### When to Update Tests

Update these tests when:
- Database schema changes (customer_returns, sales, stock_transactions)
- API endpoint changes (request/response format)
- Business logic changes (validation rules, authorization)
- Stock operation logic changes

### Keeping Tests Current

```bash
# Regenerate Prisma Client after schema changes
npx prisma generate

# Update test snapshots if needed
npx playwright test --update-snapshots

# Verify tests still pass
npx playwright test e2e/customer-return-replacement-api-only.spec.ts
```

## License

Part of the UltimatePOS Modern project.
