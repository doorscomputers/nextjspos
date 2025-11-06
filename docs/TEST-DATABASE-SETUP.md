# 🧪 Test Database Setup Guide

## Overview

This guide explains how to set up a **separate test database** for Playwright E2E tests to avoid mixing test data with production data.

---

## 🎯 Why a Test Database?

### Problems with Testing on Production DB:
- ❌ Test data pollutes real data
- ❌ Can't safely delete test transactions
- ❌ Hard to reset to known state
- ❌ Risk of accidentally modifying real customer data

### Benefits of Test Database:
- ✅ Clean slate for every test run
- ✅ Safe to create/delete data
- ✅ Can reset to initial state
- ✅ Faster test execution (local)
- ✅ No risk to production data

---

## 📋 Option 1: Local PostgreSQL Test Database (Recommended)

### Prerequisites
1. PostgreSQL installed locally
   - Windows: Download from https://www.postgresql.org/download/windows/
   - Already have? Check with: `psql --version`

### Step-by-Step Setup

#### 1. Create Test Database

```bash
# Open PostgreSQL command line
psql -U postgres

# Create test database
CREATE DATABASE ultimatepos_test;

# Create test user (optional, more secure)
CREATE USER test_user WITH PASSWORD 'test_password';
GRANT ALL PRIVILEGES ON DATABASE ultimatepos_test TO test_user;

# Exit
\q
```

#### 2. Configure Environment

The `.env.test` file is already created with:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/ultimatepos_test"
```

**Update the password** to match your PostgreSQL installation.

#### 3. Initialize Test Database

```bash
# Set environment to use test database
set DATABASE_URL=postgresql://postgres:your_password@localhost:5432/ultimatepos_test

# Push schema to test database
npx prisma db push

# Seed with test data
npx prisma db seed
```

#### 4. Verify Setup

```bash
# Connect to test database
psql -U postgres -d ultimatepos_test

# Check tables
\dt

# Should see all tables (User, Product, Sale, etc.)
```

---

## 📋 Option 2: Supabase Test Project

### Step-by-Step Setup

#### 1. Create New Supabase Project

1. Go to https://supabase.com
2. Click **New Project**
3. Name it: `ultimatepos-test`
4. Set password (save it!)
5. Choose region: Asia Southeast (Singapore)
6. Click **Create Project**

#### 2. Get Connection String

1. Go to **Project Settings** → **Database**
2. Copy **Connection String** (Transaction mode)
3. Replace `[YOUR-PASSWORD]` with your password

Example:
```
postgresql://postgres.test:[PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

#### 3. Update .env.test

```env
DATABASE_URL="postgresql://postgres.test:[YOUR-PASSWORD]@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true"
```

#### 4. Initialize Database

```bash
# Set environment
set DATABASE_URL=your-supabase-connection-string

# Push schema
npx prisma db push

# Seed test data
npx prisma db seed
```

---

## 🔄 Reset Test Database

### Full Reset (Clean Slate)

```bash
# Drop and recreate all tables
npx prisma migrate reset --force

# Or manually
psql -U postgres -d ultimatepos_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Push schema again
npx prisma db push

# Seed fresh data
npx prisma db seed
```

### Quick Reset (Keep Schema)

```bash
# Delete all data but keep tables
npx tsx scripts/clean-test-database.ts
```

---

## 🧪 Running Tests with Test Database

### Method 1: Environment Variable

```bash
# Windows Command Prompt
set DATABASE_URL=postgresql://postgres:password@localhost:5432/ultimatepos_test
npm run test:e2e

# Windows PowerShell
$env:DATABASE_URL="postgresql://postgres:password@localhost:5432/ultimatepos_test"
npm run test:e2e
```

### Method 2: dotenv-cli (Recommended)

```bash
# Install dotenv-cli
npm install --save-dev dotenv-cli

# Add to package.json scripts:
"test:e2e:test-db": "dotenv -e .env.test -- playwright test"

# Run tests
npm run test:e2e:test-db
```

### Method 3: Playwright Configuration

Edit `playwright.config.ts`:
```typescript
use: {
  baseURL: 'http://localhost:3000',
},
env: {
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ultimatepos_test'
}
```

---

## 📊 Test Data Setup

### Default Test Users

After seeding, you'll have:

| Username | Password | Role | Location | RFID |
|----------|----------|------|----------|------|
| superadmin | password | Super Admin | All | N/A |
| Jheiron | password | Warehouse Manager | Main Warehouse | 1322311179 |
| JasminKateCashierMain | password | Cashier | Main Store | 3746350884 |
| JojitKateCashierBambang | password | Cashier | Bambang | 1323982619 |
| EricsonChanCashierTugue | password | Cashier | Tuguegarao | 1322774315 |

### Test Products

Create 3 test products with known quantities:

```bash
npx tsx scripts/create-test-products.ts
```

This creates:
- **Test Product A**: 40 units @ Main Warehouse
- **Test Product B**: 40 units @ Main Warehouse
- **Test Product C**: 40 units @ Main Warehouse

---

## 🎯 Test Execution Flow

### Before Each Test Suite

```typescript
import { test as setup } from '@playwright/test';

setup.beforeAll(async () => {
  // Reset database
  await resetTestDatabase();

  // Seed test data
  await seedTestData();

  // Create test products
  await createTestProducts();
});
```

### After All Tests

```typescript
setup.afterAll(async () => {
  // Optional: Clean up
  await cleanTestDatabase();
});
```

---

## 🔍 Verifying Test Results

### Check Data After Test

```bash
# Connect to test database
psql -U postgres -d ultimatepos_test

# Check stock levels
SELECT
  p.name,
  l.name as location,
  vld.qty_available
FROM products p
JOIN product_variations pv ON p.id = pv.product_id
JOIN variation_location_details vld ON pv.id = vld.product_variation_id
JOIN business_locations l ON vld.location_id = l.id
WHERE p.name LIKE 'Test Product%'
ORDER BY p.name, l.name;

# Check sales
SELECT
  l.name as location,
  COUNT(*) as sale_count,
  SUM(final_total) as total_sales
FROM sales s
JOIN business_locations l ON s.location_id = l.id
GROUP BY l.name;

# Check purchases
SELECT
  reference_no,
  supplier_id,
  total_amount,
  status
FROM purchases
ORDER BY created_at DESC
LIMIT 5;
```

---

## 📁 Test Database Scripts

### scripts/clean-test-database.ts

```typescript
// Deletes all test data but keeps schema
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanTestDatabase() {
  console.log('🧹 Cleaning test database...')

  // Delete in order (respect foreign keys)
  await prisma.sale.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.stockTransfer.deleteMany()
  await prisma.variationLocationDetails.deleteMany()
  await prisma.productVariation.deleteMany()
  await prisma.product.deleteMany()

  console.log('✅ Test database cleaned')
}

cleanTestDatabase()
```

### scripts/create-test-products.ts

```typescript
// Creates 3 test products with known quantities
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestProducts() {
  console.log('📦 Creating test products...')

  const business = await prisma.business.findFirst()
  const warehouse = await prisma.businessLocation.findFirst({
    where: { name: 'Main Warehouse' }
  })

  const category = await prisma.category.findFirst()
  const unit = await prisma.unit.findFirst()

  for (let i = 1; i <= 3; i++) {
    const product = await prisma.product.create({
      data: {
        name: `Test Product ${String.fromCharCode(64 + i)}`, // A, B, C
        sku: `TEST-PROD-${i}`,
        businessId: business!.id,
        categoryId: category!.id,
        unitId: unit!.id,
        isActive: true
      }
    })

    const variation = await prisma.productVariation.create({
      data: {
        name: 'Default',
        productId: product.id,
        businessId: business!.id,
        defaultPurchasePrice: 100,
        defaultSellingPrice: 150,
        profitMargin: 50
      }
    })

    await prisma.variationLocationDetails.create({
      data: {
        productId: product.id,
        productVariationId: variation.id,
        locationId: warehouse!.id,
        qtyAvailable: 40
      }
    })

    console.log(`✅ Created: ${product.name} (40 units @ Warehouse)`)
  }

  console.log('✅ Test products created')
}

createTestProducts()
```

---

## 🚀 CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
          POSTGRES_DB: ultimatepos_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          npx prisma db push
          npx prisma db seed
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/ultimatepos_test

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          DATABASE_URL: postgresql://test_user:test_password@localhost:5432/ultimatepos_test
```

---

## 🔧 Troubleshooting

### Error: Database doesn't exist

```bash
# Create database
psql -U postgres -c "CREATE DATABASE ultimatepos_test"
```

### Error: Connection refused

```bash
# Check if PostgreSQL is running
pg_ctl status

# Start PostgreSQL (Windows)
net start postgresql-x64-15

# Or using pg_ctl
pg_ctl -D "C:\Program Files\PostgreSQL\15\data" start
```

### Error: Permission denied

```bash
# Grant privileges
psql -U postgres -d ultimatepos_test -c "GRANT ALL PRIVILEGES ON DATABASE ultimatepos_test TO postgres"
```

### Reset Everything

```bash
# Drop database
psql -U postgres -c "DROP DATABASE IF EXISTS ultimatepos_test"

# Recreate
psql -U postgres -c "CREATE DATABASE ultimatepos_test"

# Push schema
npx prisma db push

# Seed
npx prisma db seed
```

---

## 📊 Comparison: Production vs Test DB

| Aspect | Production DB | Test DB |
|--------|---------------|---------|
| **Data** | Real customer data | Fake test data |
| **Location** | Supabase Cloud | Local or separate Supabase |
| **Reset** | ❌ Never | ✅ After each test |
| **Size** | Growing | Fixed (small) |
| **Speed** | Slower (network) | Faster (local) |
| **Cost** | Production tier | Free tier |
| **Risk** | High | None |

---

## ✅ Verification Checklist

Before running tests on test database:

- [ ] Test database created
- [ ] `.env.test` configured with correct DATABASE_URL
- [ ] Schema pushed to test database (`npx prisma db push`)
- [ ] Test data seeded (`npx prisma db seed`)
- [ ] Can connect to test database (`psql -U postgres -d ultimatepos_test`)
- [ ] Test users exist (check with `SELECT * FROM users LIMIT 5`)
- [ ] Locations exist (check with `SELECT * FROM business_locations`)
- [ ] Test products created (`SELECT * FROM products WHERE name LIKE 'Test Product%'`)

---

## 📚 Next Steps

1. ✅ Set up test database (you are here)
2. ⏳ Implement UI interactions in Playwright
3. ⏳ Run comprehensive E2E tests
4. ⏳ Generate test reports
5. ⏳ Integrate with CI/CD

---

**Ready to proceed? Once you approve, I'll implement the actual UI interactions in the Playwright tests!**
