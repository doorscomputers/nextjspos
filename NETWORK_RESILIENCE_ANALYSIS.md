# Network Resilience Analysis - Inventory System
**Date:** 2025-10-17
**Context:** Unreliable network connections (slow, intermittent, disconnections)

---

## Executive Summary

### Current State: ⚠️ VULNERABILITIES IDENTIFIED

The inventory system has **CRITICAL vulnerabilities** when operating under unreliable network conditions:

1. ❌ **No Idempotency Keys** - Duplicate submissions possible
2. ❌ **No Unique Constraints on Invoice/Receipt Numbers** - Race conditions
3. ⚠️ **Insufficient Timeouts** - 30 seconds may be too short for slow networks
4. ⚠️ **No Client-Side Request Deduplication** - Users can submit twice
5. ✅ **Transaction Rollback Works** - Database integrity preserved on failures

---

## Network Failure Scenarios

### Scenario 1: Network Timeout During Sale Submission ⚠️

**What Happens:**
```
User clicks "Complete Sale" → Request sent
↓
Network is slow (20 seconds to reach server)
↓
Transaction starts, processes for 15 seconds
↓
Total time: 35 seconds > 30 second timeout
↓
Server transaction rolls back ✅
↓
BUT: User doesn't know if sale completed!
↓
User clicks "Complete Sale" again
↓
Duplicate sale created ❌
```

**Risk Level:** 🔴 **HIGH** - Can cause duplicate inventory deductions

**Current Protection:** ❌ **NONE**
- No idempotency keys
- No unique constraint on `invoiceNumber`
- Invoice numbers generated sequentially (race condition)

---

### Scenario 2: Network Disconnection Mid-Transaction ✅

**What Happens:**
```
Transaction starts
↓
Network disconnects
↓
Database connection lost
↓
PostgreSQL/MySQL automatically rolls back transaction ✅
↓
No inventory change
```

**Risk Level:** 🟢 **LOW** - Database handles this correctly

**Current Protection:** ✅ **GOOD**
- Prisma uses connection pooling
- Database automatically rolls back incomplete transactions
- Row locks released on disconnection

---

### Scenario 3: Slow Network + Impatient User ❌

**What Happens:**
```
User submits sale → Network slow (15 seconds)
↓
User thinks it failed, clicks again
↓
First request completes → Sale created, invoice #001
↓
Second request completes → Sale created, invoice #002
↓
DUPLICATE INVENTORY DEDUCTION ❌
```

**Risk Level:** 🔴 **CRITICAL** - Most likely to occur

**Current Protection:** ❌ **NONE**

---

### Scenario 4: Invoice Number Race Condition ❌

**What Happens:**
```
Cashier A starts sale → Reads last invoice: INV-202510-0001
Cashier B starts sale → Reads last invoice: INV-202510-0001
↓
Cashier A creates invoice INV-202510-0002
Cashier B creates invoice INV-202510-0002  ← DUPLICATE!
↓
Database allows it (no unique constraint)
```

**Risk Level:** 🔴 **HIGH** - Violates BIR compliance (Philippines)

**Current Protection:** ❌ **NONE**

---

## Detailed Vulnerability Analysis

### 1. ❌ Duplicate Sale Submissions

**Affected Endpoints:**
- `POST /api/sales` (POS sales)
- `POST /api/sales/[id]/refund`
- `POST /api/purchases/receipts/[id]/approve`
- `POST /api/transfers/[id]/send`
- `POST /api/transfers/[id]/receive`
- `POST /api/inventory-corrections/[id]/approve`
- `POST /api/physical-inventory/import`

**Code Evidence:**
```typescript
// src/app/api/sales/route.ts:389-410
const lastSale = await prisma.sale.findFirst({
  where: {
    businessId: businessIdNumber,
    invoiceNumber: {
      startsWith: `INV-${currentYear}${currentMonth}`,  // ← Race condition window
    },
  },
  orderBy: { createdAt: 'desc' },
})

let invoiceNumber
if (lastSale) {
  const lastNumber = parseInt(lastSale.invoiceNumber.split('-').pop() || '0')
  invoiceNumber = `INV-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
  // ← Two concurrent requests can get same number!
} else {
  invoiceNumber = `INV-${currentYear}${currentMonth}-0001`
}
```

**Impact:**
- Stock deducted twice for same sale
- Customer charged twice
- Inventory becomes inaccurate
- Audit trail shows duplicate transactions

---

### 2. ❌ No Idempotency Protection

**Missing Implementation:**
- No idempotency key header (`Idempotency-Key`)
- No deduplication table
- No check for duplicate requests

**Industry Standard Pattern:**
```typescript
// CLIENT SENDS:
Headers: {
  'Idempotency-Key': 'uuid-generated-once-per-submit'
}

// SERVER CHECKS:
const existing = await checkIdempotencyKey(idempotencyKey)
if (existing) {
  return existing.response  // Return cached response
}

// ... process transaction ...

// CACHE RESULT:
await storeIdempotencyKey(idempotencyKey, response)
```

**Currently:** ❌ **NOT IMPLEMENTED**

---

### 3. ⚠️ Timeout Configuration Issues

**Current Timeouts:**

| Endpoint | Timeout | Adequate? |
|----------|---------|-----------|
| Sales (POST) | 30 seconds | ⚠️ Maybe |
| Physical Inventory Import | 120 seconds | ✅ Good |
| Bulk Corrections | 10 seconds | ❌ Too short |
| Purchases Receive | 30 seconds | ⚠️ Maybe |
| Transfer Send/Receive | None specified | ❌ Default (2 min) |

**Problem:**
On slow networks (2G/3G in rural areas), requests can take 10-20 seconds just for network transmission. Add 10-15 seconds for database operations = 30+ seconds total.

**Recommendation:**
- Increase timeouts to 60-90 seconds for critical operations
- Add client-side loading states (prevent double-click)
- Implement request deduplication

---

### 4. ✅ Transaction Rollback (GOOD)

**Confirmed Behavior:**

```typescript
await prisma.$transaction(async (tx) => {
  // ... multiple database operations ...
}, {
  timeout: 30000,  // If exceeds this, rollback
  maxWait: 120000, // Max time to wait for transaction to start
})
```

**What Happens on Network Loss:**
1. Connection to database broken
2. Prisma detects broken connection
3. PostgreSQL/MySQL automatically rolls back
4. Row locks released
5. No partial updates committed

**Test Result:** ✅ **SAFE** - Database integrity maintained

---

## Row-Level Locking Effectiveness

### ✅ Concurrent Sales of Different Products

```
Sale A: Product X, qty 5
Sale B: Product Y, qty 3
↓
Sale A locks row for Product X variation ✅
Sale B locks row for Product Y variation ✅
↓
Both proceed independently ✅
```

**Result:** ✅ **WORKS CORRECTLY**

---

### ✅ Concurrent Sales of SAME Product

```
Sale A: Product X, qty 5 → Locks row (FOR UPDATE)
Sale B: Product X, qty 3 → Waits for lock...
↓
Sale A: Read qty=10, deduct 5, write qty=5, commit
↓
Sale B: Lock acquired, reads qty=5, deduct 3, write qty=2, commit
↓
Final qty=2 ✅ CORRECT
```

**Result:** ✅ **WORKS CORRECTLY**

---

### ❌ Duplicate Sale Submission (PROBLEM)

```
User clicks "Submit" → Request 1 starts
User thinks it failed, clicks again → Request 2 starts
↓
Request 1: Generate invoice INV-001, lock Product X
Request 2: Generate invoice INV-002, lock Product X (waits)
↓
Request 1: Deduct 5 units, commit
Request 2: Lock acquired, deduct 5 units again ❌
↓
Total deducted: 10 units (should be 5)
```

**Result:** ❌ **DUPLICATE DEDUCTION**

---

## Critical Fixes Required

### Fix 1: Add Unique Constraint on Invoice Numbers ✅

**Schema Change:**
```prisma
model Sale {
  // ... existing fields ...
  invoiceNumber String @db.VarChar(191)

  @@unique([businessId, invoiceNumber])  // ← ADD THIS
  @@map("sales")
}

model PurchaseReceipt {
  receiptNumber String @db.VarChar(191)

  @@unique([businessId, receiptNumber])  // ← ADD THIS
}

model StockTransfer {
  transferNumber String @db.VarChar(191)

  @@unique([businessId, transferNumber])  // ← ADD THIS
}
```

**Migration:**
```sql
ALTER TABLE sales
  ADD CONSTRAINT sales_business_id_invoice_number_unique
  UNIQUE (business_id, invoice_number);

ALTER TABLE purchase_receipts
  ADD CONSTRAINT purchase_receipts_business_id_receipt_number_unique
  UNIQUE (business_id, receipt_number);

ALTER TABLE stock_transfers
  ADD CONSTRAINT stock_transfers_business_id_transfer_number_unique
  UNIQUE (business_id, transfer_number);
```

**Impact:**
✅ Prevents duplicate invoice numbers
✅ Database enforces uniqueness
⚠️ Retry logic needed to handle conflicts

---

### Fix 2: Implement Idempotency Keys

**Database Schema:**
```prisma
model IdempotencyKey {
  id             Int      @id @default(autoincrement())
  key            String   @unique @db.VarChar(191)
  businessId     Int      @map("business_id")
  endpoint       String   @db.VarChar(255)
  requestBody    Json?    @map("request_body")
  responseStatus Int      @map("response_status")
  responseBody   Json?    @map("response_body")
  createdAt      DateTime @default(now()) @map("created_at")
  expiresAt      DateTime @map("expires_at")  // Clean up after 24 hours

  @@index([businessId])
  @@index([expiresAt])
  @@map("idempotency_keys")
}
```

**Middleware:**
```typescript
// src/middleware/idempotency.ts
export async function handleIdempotency(
  request: NextRequest,
  endpoint: string,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const idempotencyKey = request.headers.get('Idempotency-Key')

  if (!idempotencyKey) {
    // No idempotency key = normal processing
    return await handler()
  }

  const session = await getServerSession(authOptions)
  const businessId = (session?.user as any)?.businessId

  // Check if request already processed
  const existing = await prisma.idempotencyKey.findUnique({
    where: { key: idempotencyKey }
  })

  if (existing) {
    // Return cached response
    return new NextResponse(
      JSON.stringify(existing.responseBody),
      {
        status: existing.responseStatus,
        headers: { 'X-Idempotent-Replay': 'true' }
      }
    )
  }

  // Process request
  const response = await handler()
  const responseData = await response.json()

  // Cache result (expires in 24 hours)
  await prisma.idempotencyKey.create({
    data: {
      key: idempotencyKey,
      businessId: parseInt(businessId),
      endpoint,
      requestBody: await request.json(),
      responseStatus: response.status,
      responseBody: responseData,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
    }
  })

  return NextResponse.json(responseData, { status: response.status })
}
```

**Usage:**
```typescript
export async function POST(request: NextRequest) {
  return handleIdempotency(request, '/api/sales', async () => {
    // Existing sale creation logic
    // ...
  })
}
```

---

### Fix 3: Atomic Invoice Number Generation

**Current (Unsafe):**
```typescript
const lastSale = await prisma.sale.findFirst({...})
const nextNumber = lastNumber + 1  // ← Race condition!
```

**Fixed (Safe):**
```typescript
// Use database sequence or atomic counter
model InvoiceSequence {
  id         Int      @id @default(autoincrement())
  businessId Int      @map("business_id")
  year       Int
  month      Int
  sequence   Int      @default(0)

  @@unique([businessId, year, month])
  @@map("invoice_sequences")
}

// Atomic increment
async function getNextInvoiceNumber(businessId: number, tx: TransactionClient) {
  const year = new Date().getFullYear()
  const month = new Date().getMonth() + 1

  const seq = await tx.invoiceSequence.upsert({
    where: {
      businessId_year_month: { businessId, year, month }
    },
    update: {
      sequence: { increment: 1 }
    },
    create: {
      businessId,
      year,
      month,
      sequence: 1
    }
  })

  return `INV-${year}${String(month).padStart(2, '0')}-${String(seq.sequence).padStart(4, '0')}`
}
```

---

### Fix 4: Client-Side Request Deduplication

**Frontend Implementation:**
```typescript
// src/lib/api-client.ts
const pendingRequests = new Map<string, Promise<Response>>()

export async function deduplicatedPost(
  url: string,
  body: any,
  options?: RequestInit
) {
  const requestKey = `${url}-${JSON.stringify(body)}`

  // If same request already in flight, return existing promise
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey)!
  }

  const requestPromise = fetch(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),  // Generate once per request
      ...options?.headers
    }
  }).finally(() => {
    // Remove from pending after completion
    pendingRequests.delete(requestKey)
  })

  pendingRequests.set(requestKey, requestPromise)
  return requestPromise
}
```

**Button Disable Pattern:**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false)

const handleSubmit = async () => {
  if (isSubmitting) return  // Prevent double-click

  setIsSubmitting(true)
  try {
    await createSale(saleData)
  } finally {
    setIsSubmitting(false)
  }
}

<Button disabled={isSubmitting}>
  {isSubmitting ? 'Processing...' : 'Complete Sale'}
</Button>
```

---

## Recommendations by Priority

### 🔴 CRITICAL (Implement Immediately)

1. **Add Unique Constraints** on:
   - `sales.invoiceNumber`
   - `purchase_receipts.receiptNumber`
   - `stock_transfers.transferNumber`

2. **Implement Idempotency Keys** for:
   - Sales creation
   - Refunds
   - Purchase receipt approvals
   - Transfer send/receive

3. **Client-Side Deduplication:**
   - Disable submit buttons while processing
   - Track in-flight requests
   - Show loading states

### 🟡 HIGH (Implement Soon)

4. **Atomic Invoice Number Generation:**
   - Use database sequences
   - Eliminate race conditions

5. **Increase Timeouts:**
   - Sales: 30s → 60s
   - Bulk operations: Keep at 120s
   - Inventory corrections: 10s → 30s

6. **Retry Logic with Exponential Backoff:**
   - Client retries on network timeout
   - Max 3 retries
   - Use idempotency keys

### 🟢 MEDIUM (Nice to Have)

7. **Offline Queue System:**
   - Cache failed requests
   - Retry when network recovers
   - Show sync status to user

8. **Request Timeout Monitoring:**
   - Log slow requests
   - Alert on frequent timeouts
   - Identify network issues

---

## Testing Scenarios

### Test 1: Double Submit Prevention
```
1. Start sale submission
2. Immediately click submit again (within 1 second)
3. Expected: Only one sale created
4. Current: ❌ Two sales created
5. After Fix: ✅ Second request returns first result
```

### Test 2: Network Timeout Recovery
```
1. Simulate 40-second network delay
2. Submit sale
3. Transaction timeout (30s)
4. Expected: Transaction rolled back, no inventory change
5. Current: ✅ Works correctly
```

### Test 3: Concurrent Invoice Generation
```
1. Two cashiers submit sales at exact same time
2. Expected: Sequential invoice numbers (001, 002)
3. Current: ❌ Both might get 001
4. After Fix: ✅ Database ensures uniqueness
```

---

## Migration Plan

### Phase 1: Database Constraints (Week 1)
```sql
-- Backup database first!
ALTER TABLE sales ADD CONSTRAINT sales_business_id_invoice_number_unique
  UNIQUE (business_id, invoice_number);
```

### Phase 2: Idempotency Infrastructure (Week 2)
- Add `idempotency_keys` table
- Implement middleware
- Update sales endpoint

### Phase 3: Client Updates (Week 3)
- Add loading states
- Implement request deduplication
- Generate idempotency keys

### Phase 4: Atomic Sequences (Week 4)
- Add `invoice_sequences` table
- Migrate invoice generation
- Test concurrency

---

## Monitoring & Alerts

**Metrics to Track:**
- Duplicate invoice number attempts
- Idempotency key cache hits
- Transaction timeout frequency
- Average request duration
- Network error rate

**Alerts:**
- Duplicate invoice constraint violations
- Transaction timeout > 5% of requests
- Idempotency replay rate > 10%

---

## Conclusion

### Current Risk Assessment

| Risk | Likelihood | Impact | Overall |
|------|------------|--------|---------|
| Duplicate sales | 🔴 High | 🔴 Critical | 🔴 **CRITICAL** |
| Duplicate invoice numbers | 🔴 High | 🔴 High | 🔴 **HIGH** |
| Transaction rollback failure | 🟢 Low | 🔴 Critical | 🟡 **MEDIUM** |
| Timeout on slow network | 🟡 Medium | 🟡 Medium | 🟡 **MEDIUM** |

### Answer to Your Question:

> "If network connection is unreliable, will inventory logic be reliable?"

**Current Answer: ⚠️ NO - High risk of duplicate submissions**

**After Fixes: ✅ YES - Protected against network issues**

The centralized `stockOperations.ts` ensures **database integrity** is maintained (transactions roll back on failures), but does **NOT** protect against **duplicate user submissions** caused by slow/unreliable networks.

**Critical fixes needed:**
1. Unique constraints on invoice numbers
2. Idempotency keys
3. Client-side deduplication

Once implemented, the inventory system will be resilient to unreliable networks.
