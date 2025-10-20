# Network Resilience Implementation Guide
**Date:** 2025-10-17
**Purpose:** Step-by-step guide to implement network resilience fixes

---

## Overview

This guide implements fixes for:
1. ✅ Duplicate sale submissions on slow networks
2. ✅ Invoice number race conditions
3. ✅ Transaction timeouts
4. ✅ Client-side request deduplication

---

## Prerequisites

- PostgreSQL or MySQL database
- Database backup completed ✅
- Access to database credentials
- Node.js environment running

---

## Step 1: Run Database Migration

### Option A: Using PostgreSQL

```bash
# 1. Backup database first!
pg_dump -U your_user ultimatepos_modern > backup_$(date +%Y%m%d).sql

# 2. Run migration
psql -U your_user -d ultimatepos_modern -f prisma/migrations/001_add_network_resilience.sql
```

### Option B: Using MySQL (via XAMPP)

```bash
# 1. Backup database
mysqldump -u root ultimatepos_modern > backup_$(date +%Y%m%d).sql

# 2. Convert PostgreSQL migration to MySQL
# Replace SERIAL with AUTO_INCREMENT
# Replace JSONB with JSON
# Then run:
mysql -u root ultimatepos_modern < prisma/migrations/001_add_network_resilience_mysql.sql
```

### MySQL-Compatible Migration Script

Create `prisma/migrations/001_add_network_resilience_mysql.sql`:

```sql
-- MySQL version
CREATE TABLE IF NOT EXISTS idempotency_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  `key` VARCHAR(191) UNIQUE NOT NULL,
  business_id INT NOT NULL,
  user_id INT NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  request_body JSON,
  response_status INT NOT NULL,
  response_body JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_idempotency_keys_business_id (business_id),
  INDEX idx_idempotency_keys_expires_at (expires_at),
  INDEX idx_idempotency_keys_endpoint (endpoint)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoice_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  sequence INT DEFAULT 0 NOT NULL,
  UNIQUE KEY unique_business_year_month (business_id, year, month),
  INDEX idx_invoice_sequences_business_id (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS receipt_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  sequence INT DEFAULT 0 NOT NULL,
  UNIQUE KEY unique_business_year_month (business_id, year, month),
  INDEX idx_receipt_sequences_business_id (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transfer_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  sequence INT DEFAULT 0 NOT NULL,
  UNIQUE KEY unique_business_year_month (business_id, year, month),
  INDEX idx_transfer_sequences_business_id (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS return_sequences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  business_id INT NOT NULL,
  year INT NOT NULL,
  month INT NOT NULL,
  sequence INT DEFAULT 0 NOT NULL,
  UNIQUE KEY unique_business_year_month (business_id, year, month),
  INDEX idx_return_sequences_business_id (business_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add composite unique constraints
ALTER TABLE sales
  ADD CONSTRAINT sales_business_id_invoice_number_unique
  UNIQUE (business_id, invoice_number);

ALTER TABLE purchase_receipts
  ADD CONSTRAINT purchase_receipts_business_id_receipt_number_unique
  UNIQUE (business_id, receipt_number);

ALTER TABLE stock_transfers
  ADD CONSTRAINT stock_transfers_business_id_transfer_number_unique
  UNIQUE (business_id, transfer_number);

ALTER TABLE customer_returns
  ADD CONSTRAINT customer_returns_business_id_return_number_unique
  UNIQUE (business_id, return_number);
```

---

## Step 2: Update Sales Endpoint

**File:** `src/app/api/sales/route.ts`

### Before (Lines 389-410):
```typescript
const lastSale = await prisma.sale.findFirst({
  where: {
    businessId: businessIdNumber,
    invoiceNumber: { startsWith: `INV-${currentYear}${currentMonth}` },
  },
  orderBy: { createdAt: 'desc' },
})

let invoiceNumber
if (lastSale) {
  const lastNumber = parseInt(lastSale.invoiceNumber.split('-').pop() || '0')
  invoiceNumber = `INV-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
} else {
  invoiceNumber = `INV-${currentYear}${currentMonth}-0001`
}
```

### After:
```typescript
import { getNextInvoiceNumber } from '@/lib/atomicNumbers'
import { withIdempotency } from '@/lib/idempotency'

export async function POST(request: NextRequest) {
  return withIdempotency(request, '/api/sales', async () => {
    // ... existing validation code ...

    // Generate invoice number atomically inside transaction
    const sale = await prisma.$transaction(async (tx) => {
      const invoiceNumber = await getNextInvoiceNumber(businessIdNumber, tx)

      const newSale = await tx.sale.create({
        data: {
          // ... existing fields ...
          invoiceNumber, // Use atomic number
        },
      })

      // ... rest of sale creation logic ...
      return newSale
    }, {
      timeout: 60000, // Increased to 60 seconds for slow networks
    })

    // ... rest of endpoint ...
    return NextResponse.json(completeSale, { status: 201 })
  })
}
```

---

## Step 3: Update Client Code

**File:** `src/app/dashboard/pos/page.tsx` (or wherever sales are submitted)

### Before:
```typescript
const handleSubmitSale = async (saleData) => {
  const response = await fetch('/api/sales', {
    method: 'POST',
    body: JSON.stringify(saleData),
    headers: { 'Content-Type': 'application/json' }
  })
  // ...
}
```

### After:
```typescript
import { apiPost } from '@/lib/client/apiClient'

const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmitSale = async (saleData) => {
  if (isSubmitting) return // Prevent double-click

  setIsSubmitting(true)
  try {
    const sale = await apiPost('/api/sales', saleData)
    // Handle success
  } catch (error) {
    // Handle error
  } finally {
    setIsSubmitting(false)
  }
}

// In JSX:
<Button
  onClick={handleSubmitSale}
  disabled={isSubmitting}
>
  {isSubmitting ? 'Processing...' : 'Complete Sale'}
</Button>
```

---

## Step 4: Update Other Critical Endpoints

Apply the same pattern to:

### A. Refund Endpoint
**File:** `src/app/api/sales/[id]/refund/route.ts`

```typescript
import { withIdempotency } from '@/lib/idempotency'
import { getNextReturnNumber } from '@/lib/atomicNumbers'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withIdempotency(request, `/api/sales/${params.id}/refund`, async () => {
    // ... existing code ...

    const result = await prisma.$transaction(async (tx) => {
      // Generate return number atomically
      const returnNumber = await getNextReturnNumber(businessIdNumber, tx)

      const customerReturn = await tx.customerReturn.create({
        data: {
          returnNumber, // Use atomic number
          // ... rest of fields ...
        },
      })

      // ... rest of logic ...
      return { customerReturn, returnNumber }
    }, {
      timeout: 60000,
    })

    // ... rest of endpoint ...
  })
}
```

### B. Purchase Receipt Approval
**File:** `src/app/api/purchases/receipts/[id]/approve/route.ts`

```typescript
import { withIdempotency } from '@/lib/idempotency'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withIdempotency(request, `/api/purchases/receipts/${id}/approve`, async () => {
    // ... existing approval logic ...
  })
}
```

### C. Stock Transfer Send/Receive
**Files:** `src/app/api/transfers/[id]/send/route.ts` and `receive/route.ts`

```typescript
import { withIdempotency } from '@/lib/idempotency'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return withIdempotency(request, `/api/transfers/${id}/send`, async () => {
    // ... existing logic ...
  })
}
```

---

## Step 5: Testing

### Test 1: Duplicate Submission Prevention

```bash
# Simulate slow network + double-click
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"locationId": 1, ...}' &

curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-key-123" \
  -d '{"locationId": 1, ...}'

# Expected: Both return same result, only one sale created
```

### Test 2: Invoice Number Uniqueness

```javascript
// Run concurrently
const promises = []
for (let i = 0; i < 10; i++) {
  promises.push(
    fetch('/api/sales', {
      method: 'POST',
      body: JSON.stringify(saleData),
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': `test-concurrent-${i}`
      }
    })
  )
}

const results = await Promise.all(promises)
const invoiceNumbers = results.map(r => r.json().invoiceNumber)

// Expected: All invoice numbers unique (001, 002, 003, etc.)
console.log('Invoice numbers:', invoiceNumbers)
```

### Test 3: Network Timeout Recovery

```javascript
// Simulate 40-second delay
// Transaction should timeout at 60s, rollback, no inventory change
```

---

## Step 6: Monitor & Maintain

### Daily Cleanup Job

Add to `package.json`:
```json
{
  "scripts": {
    "cleanup:idempotency": "node scripts/cleanup-idempotency.js"
  }
}
```

Create `scripts/cleanup-idempotency.js`:
```javascript
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function cleanup() {
  const result = await prisma.$executeRaw`
    DELETE FROM idempotency_keys
    WHERE expires_at < CURRENT_TIMESTAMP
  `
  console.log(`Cleaned up ${result} expired idempotency keys`)
}

cleanup()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
```

### Cron Job (Linux/Mac)
```bash
# Run daily at 2 AM
0 2 * * * cd /path/to/app && npm run cleanup:idempotency
```

### Windows Task Scheduler
```cmd
# Create scheduled task
schtasks /create /tn "Cleanup Idempotency Keys" /tr "npm run cleanup:idempotency" /sc daily /st 02:00
```

---

## Rollback Plan

If issues occur, rollback with:

```sql
-- Remove constraints
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_business_id_invoice_number_unique;
ALTER TABLE purchase_receipts DROP CONSTRAINT IF EXISTS purchase_receipts_business_id_receipt_number_unique;
ALTER TABLE stock_transfers DROP CONSTRAINT IF EXISTS stock_transfers_business_id_transfer_number_unique;
ALTER TABLE customer_returns DROP CONSTRAINT IF EXISTS customer_returns_business_id_return_number_unique;

-- Drop tables
DROP TABLE IF EXISTS idempotency_keys CASCADE;
DROP TABLE IF EXISTS invoice_sequences CASCADE;
DROP TABLE IF EXISTS receipt_sequences CASCADE;
DROP TABLE IF EXISTS transfer_sequences CASCADE;
DROP TABLE IF EXISTS return_sequences CASCADE;
```

Then restore from backup:
```bash
psql -U your_user -d ultimatepos_modern < backup_YYYYMMDD.sql
```

---

## Success Criteria

✅ No duplicate sales on slow network
✅ Invoice numbers always unique
✅ Idempotency keys cached correctly
✅ Concurrent requests handled safely
✅ Transaction timeouts don't corrupt data

---

## Monitoring Dashboard Metrics

Add to your analytics:
- Idempotency cache hit rate (target: <5%)
- Duplicate invoice number attempts (target: 0)
- Transaction timeout frequency (target: <2%)
- Average request duration (track improvement)

---

## Support

If you encounter issues:
1. Check database logs for constraint violations
2. Verify idempotency_keys table exists
3. Ensure migration ran successfully
4. Test with slow network simulation (Chrome DevTools → Network → Slow 3G)

---

## Next Steps After Implementation

1. Update remaining endpoints (inventory corrections, physical inventory, etc.)
2. Add monitoring/alerting for duplicate attempts
3. Train staff on new loading states ("Processing..." button text)
4. Document for future developers

**Implementation Time:** 2-4 hours
**Testing Time:** 1-2 hours
**Total:** Half day to full day

---

**Remember:** Always test in development environment first before deploying to production!
