# Quick Start - Testing UltimatePOS Modern

## Prerequisites Checklist

Before running tests, ensure:
- [ ] Node.js installed (v18 or higher)
- [ ] Database running (PostgreSQL or MySQL)
- [ ] Database seeded with demo data
- [ ] Dependencies installed (`npm install`)
- [ ] Development server can start

---

## 1. First-Time Setup (5 minutes)

### Step 1: Install Dependencies
```bash
cd C:\xampp\htdocs\ultimatepos-modern
npm install
```

### Step 2: Setup Database
```bash
# If using PostgreSQL
# Create database: ultimatepos_modern

# If using MySQL (XAMPP)
# Ensure MySQL is running, create database

# Push schema to database
npm run db:push

# Seed demo data
npm run db:seed
```

**Demo Accounts Created:**
- Super Admin: `superadmin` / `password`
- Admin: `admin` / `password`
- Manager: `manager` / `password`
- Cashier: `cashier` / `password`

---

## 2. Run Branch Stock Pivot V2 Tests (10 minutes)

### Terminal 1: Start Dev Server
```bash
cd C:\xampp\htdocs\ultimatepos-modern
npm run dev
```

Wait for:
```
✓ Ready in 3.5s
○ Local:   http://localhost:3000
```

### Terminal 2: Run Tests
```bash
cd C:\xampp\htdocs\ultimatepos-modern

# Run Branch Stock Pivot V2 tests
npx playwright test e2e/branch-stock-pivot-v2.spec.ts --reporter=list

# Or with HTML report
npx playwright test e2e/branch-stock-pivot-v2.spec.ts --reporter=html

# View HTML report
npx playwright show-report
```

---

## 3. Manual Testing (30 minutes)

### Quick Manual Test
1. Open browser: `http://localhost:3000/login`
2. Login: `admin` / `password`
3. Navigate to: `/dashboard/products/branch-stock-pivot-v2`
4. Wait for page to load
5. Check:
   - ✅ Summary cards display numbers
   - ✅ Data grid shows products
   - ✅ Location columns appear
   - ✅ Search box works
   - ✅ Export button exists

### Full Manual Test
Follow the comprehensive checklist in:
- File: `BRANCH_STOCK_PIVOT_V2_TEST_REPORT.md`
- Section: "Manual Testing Guide"
- Time: ~60 minutes

---

## 4. Verify Database (5 minutes)

### Check Test Product Created
```sql
-- PostgreSQL/MySQL
SELECT p.*, pv.name as variation
FROM products p
LEFT JOIN product_variations pv ON p.id = pv.product_id
WHERE p.name LIKE '%E2E Test Product%'
ORDER BY p.created_at DESC
LIMIT 5;
```

### Check Stock Records
```sql
SELECT vld.*, bl.name as location_name
FROM variation_location_details vld
JOIN business_locations bl ON vld.location_id = bl.id
WHERE vld.product_id IN (
  SELECT id FROM products WHERE name LIKE '%E2E Test Product%'
)
ORDER BY vld.created_at DESC;
```

### Check Recent Stock History
```sql
SELECT sh.*, p.name, pv.name as variation
FROM stock_history sh
JOIN products p ON sh.product_id = p.id
JOIN product_variations pv ON sh.product_variation_id = pv.id
ORDER BY sh.created_at DESC
LIMIT 20;
```

---

## 5. Common Issues & Solutions

### Issue: Tests Timeout
**Cause:** Dev server not running
**Solution:**
```bash
# Terminal 1: Start server
npm run dev

# Wait for "Ready" message
# Terminal 2: Run tests
npx playwright test e2e/branch-stock-pivot-v2.spec.ts
```

### Issue: Database Error "Demo business not found"
**Cause:** Database not seeded
**Solution:**
```bash
npm run db:seed
```

### Issue: Port 3000 Already in Use
**Cause:** Another process using port 3000
**Solution:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID [PID_NUMBER] /F

# Then restart
npm run dev
```

### Issue: Prisma Client Error
**Cause:** Schema changed, client not regenerated
**Solution:**
```bash
npx prisma generate
npm run dev
```

### Issue: Login Fails in Tests
**Cause:** Session timeout or credentials wrong
**Solution:**
- Verify demo accounts exist: `npm run db:seed`
- Check username: `admin` (not `Administrator`)
- Check password: `password` (lowercase)

---

## 6. Running All Tests (30 minutes)

### Run All E2E Tests
```bash
# Run all tests
npx playwright test --reporter=html

# Run specific category
npx playwright test e2e/product*.spec.ts
npx playwright test e2e/sales*.spec.ts
npx playwright test e2e/purchases*.spec.ts
npx playwright test e2e/transfers*.spec.ts
npx playwright test e2e/inventory*.spec.ts
npx playwright test e2e/reports*.spec.ts
```

### View Test Report
```bash
npx playwright show-report
```

---

## 7. Test with Different User Roles

### Admin User (Full Access)
```bash
# Login as: admin / password
# Has all permissions
# Can access all pages
```

### Manager User (Limited Access)
```bash
# Login as: manager / password
# Cannot delete records
# Can approve transactions
```

### Cashier User (Basic Access)
```bash
# Login as: cashier / password
# Can create sales
# Cannot approve returns
# Cannot edit products
```

---

## 8. Database Cleanup (Optional)

### Clean Test Data
```bash
# Remove all E2E test products
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function cleanup() {
  await prisma.variationLocationDetails.deleteMany({
    where: { product: { name: { contains: 'E2E Test Product' } } }
  });
  await prisma.productVariation.deleteMany({
    where: { product: { name: { contains: 'E2E Test Product' } } }
  });
  await prisma.product.deleteMany({
    where: { name: { contains: 'E2E Test Product' } }
  });
  console.log('✅ Cleaned up E2E test products');
  await prisma.$disconnect();
}
cleanup();
"
```

### Reset Database (Nuclear Option)
```bash
# WARNING: Deletes all data!
npm run db:push -- --force-reset
npm run db:seed
```

---

## 9. Continuous Testing Workflow

### During Development
```bash
# Terminal 1: Dev server with auto-reload
npm run dev

# Terminal 2: Watch mode tests
npx playwright test --ui

# Or headed mode (see browser)
npx playwright test --headed --project=chromium
```

### Before Committing Code
```bash
# Run linting
npm run lint

# Run all tests
npx playwright test

# Check for failures
# Fix any issues before commit
```

---

## 10. Performance Testing

### Check Page Load Time
```bash
# Run performance test
npx playwright test e2e/branch-stock-pivot-v2.spec.ts --grep "Performance"

# Should complete in <15 seconds
```

### Monitor API Response Time
```bash
# Open browser dev tools
# Network tab
# Filter: XHR
# Check /api/products/branch-stock-pivot
# Should respond in <3 seconds for 1,000 products
```

---

## Quick Reference Commands

```bash
# Start dev server
npm run dev

# Run single test file
npx playwright test e2e/branch-stock-pivot-v2.spec.ts

# Run all tests
npx playwright test

# Run tests in UI mode
npx playwright test --ui

# Run tests in headed mode (visible browser)
npx playwright test --headed

# Run specific test by name
npx playwright test --grep "API Data Fetching"

# Debug specific test
npx playwright test --debug

# View last test report
npx playwright show-report

# Seed database
npm run db:seed

# Generate Prisma client
npx prisma generate

# Push schema to database
npm run db:push

# Open Prisma Studio (database GUI)
npm run db:studio
```

---

## Expected Test Results

### Successful Test Run
```
Running 25 tests using 1 worker

✅ Found 6 locations for business 1
✅ Created test product 1633 with variation 1632
✅ Added stock across 6 locations

  ✓  1 Page Load - Should load successfully (5.2s)
  ✓  2 API Data Fetching - Should fetch data correctly (3.1s)
  ✓  3 Multi-Tenant Isolation - Should enforce isolation (4.5s)
  ✓  4 Summary Cards - Should display statistics (2.8s)
  ✓  5 DevExtreme Grid - Should render features (3.2s)
  ...
  ✓  25 Error Handling - Should handle errors (2.1s)

✅ Cleaned up test product 1633

25 passed (2.5m)
```

### Test Failure Example
```
  ✘  2 API Data Fetching - Should fetch data correctly

    Error: expect(received).toHaveProperty(expected)

    Expected property: "rows"
    Received object: { error: "Unauthorized" }
```

**Action:** Review error, check authentication, fix issue, re-run tests.

---

## Next Steps

After successful testing:
1. ✅ Review test report: `npx playwright show-report`
2. ✅ Check `BRANCH_STOCK_PIVOT_V2_TEST_REPORT.md` for detailed findings
3. ✅ Execute manual testing checklist
4. ✅ Verify database state with SQL queries
5. ✅ Test export functionality (Excel, PDF)
6. ✅ Test on different devices (mobile, tablet)
7. ✅ Test in different browsers (Chrome, Firefox, Edge)

---

## Support

**Documentation:**
- `TESTING_DELIVERABLES_SUMMARY.md` - Overview of all deliverables
- `BRANCH_STOCK_PIVOT_V2_TEST_REPORT.md` - Detailed test report
- `POS_FEATURE_TESTING_GUIDE.md` - Guide for all POS features
- `CLAUDE.md` - Project architecture and setup guide

**Test Files:**
- `e2e/branch-stock-pivot-v2.spec.ts` - Branch Stock Pivot V2 tests
- `e2e/*.spec.ts` - 48+ other test files

**Helpful Commands:**
- `npm run dev` - Start development server
- `npm run db:seed` - Seed demo data
- `npx playwright test --ui` - Interactive test runner
- `npx prisma studio` - Visual database browser

---

**Happy Testing! 🚀**

**Remember:** Quality software requires thorough testing. Take your time, verify everything, and trust but verify!
