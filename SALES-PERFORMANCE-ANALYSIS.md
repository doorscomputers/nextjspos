# Sales Performance Analysis and Optimization Report

## Executive Summary

Analysis of the sales completion process reveals multiple sequential database operations causing slow performance (4 retry attempts observed). The primary bottlenecks are:

1. **Idempotency key lookup** adds roundtrip on every request
2. **Sequential database queries** inside transaction loop (N queries for N items)
3. **Network latency to Supabase** compounds with each sequential query

**Estimated Current Time:** 2-4 seconds per sale
**Target Time:** <1 second per sale
**Potential Improvement:** 50-75% faster

---

## Detailed Performance Bottlenecks

### 1. Idempotency Key Lookup (CRITICAL)

**Location:** `src/lib/idempotency.ts:42-53`

**Issue:**
```typescript
// Runs BEFORE processing every request with idempotency key
const existing = await prisma.$queryRaw`
  SELECT id, response_status, response_body, created_at
  FROM idempotency_keys
  WHERE key = ${idempotencyKey}
    AND business_id = ${businessId}
  LIMIT 1`
```

**Impact:**
- Adds 100-200ms roundtrip to Supabase on EVERY request
- This happens even for first-time requests (most common case)
- Good for preventing duplicates, but expensive

**Why It's Slow:**
- Supabase pooler latency (cloud database)
- Sequential query (blocks handler execution)
- No caching layer

**Recommended Fix:**
```typescript
// Option 1: Add Redis cache layer for hot keys
const cachedResult = await redis.get(`idem:${idempotencyKey}`)
if (cachedResult) return cachedResult

// Option 2: Run idempotency check in parallel with validation
const [existing, validationResult] = await Promise.all([
  checkIdempotencyKey(idempotencyKey),
  validateRequest(request)
])

// Option 3: Use optimistic locking (process first, check after)
// Less safe but much faster for most requests
```

---

### 2. Sequential Item Processing in Transaction (HIGH PRIORITY)

**Location:** `src/app/api/sales/route.ts:558-596`

**Issue:**
```typescript
// Inside transaction loop - runs sequentially for EACH item
for (const item of items) {
  // Query 1: Fetch product variation (100-200ms each)
  const variation = await tx.productVariation.findUnique({
    where: { id: productVariationIdNumber },
  })

  // Query 2: Fetch serial numbers if needed (100-200ms each)
  if (item.requiresSerial && item.serialNumberIds) {
    const serialNumberRecords = await tx.productSerialNumber.findMany({
      where: {
        id: { in: item.serialNumberIds.map((id: any) => Number(id)) },
      },
    })
  }

  // Query 3: Create sale item
  await tx.saleItem.create({ ... })

  // Query 4: Process sale (deduct stock, create history)
  await processSale({ ... })
}
```

**Impact per 3-item sale:**
- 3 variation fetches: 300-600ms
- 3 sale item creates: 300-600ms
- 3 processSale calls: 600-1200ms
- **Total: 1.2-2.4 seconds just for items**

**Why It's Slow:**
- Each query waits for previous query to complete
- Network latency multiplied by item count
- Transaction lock held for entire duration

**Recommended Fix:**
```typescript
// BEFORE transaction: Batch fetch all variations
const variationIds = items.map(item => Number(item.productVariationId))
const variations = await prisma.productVariation.findMany({
  where: { id: { in: variationIds } },
})
const variationsMap = new Map(variations.map(v => [v.id, v]))

// BEFORE transaction: Batch fetch all serial numbers
const allSerialNumberIds = items
  .filter(item => item.requiresSerial)
  .flatMap(item => item.serialNumberIds || [])
  .map(id => Number(id))

const serialNumbers = allSerialNumberIds.length > 0
  ? await prisma.productSerialNumber.findMany({
      where: { id: { in: allSerialNumberIds } },
    })
  : []
const serialNumbersMap = new Map(serialNumbers.map(sn => [sn.id, sn]))

// INSIDE transaction: Use pre-fetched data
await prisma.$transaction(async (tx) => {
  for (const item of items) {
    const variation = variationsMap.get(productVariationIdNumber)
    // No database call needed!

    const serialNumbersData = item.serialNumberIds
      ? item.serialNumberIds.map(id => serialNumbersMap.get(id))
      : null
    // No database call needed!
  }
})
```

**Expected Improvement:** 600-1200ms saved (50-75% faster for multi-item sales)

---

### 3. Stock Availability Checks (MEDIUM PRIORITY)

**Location:** `src/app/api/sales/route.ts:440-459`

**Issue:**
```typescript
// Runs sequentially for each item BEFORE transaction
for (const item of items) {
  const availability = await checkStockAvailability({
    productId: item.productId,
    productVariationId: item.productVariationId,
    locationId: locationIdNumber,
    quantity: parseFloat(item.quantity),
  })
}
```

**Impact:**
- N separate database queries for N items
- Each query: 100-200ms
- Blocks transaction from starting

**Why It's Slow:**
- Sequential execution
- Each query fetches variation_location_details separately

**Recommended Fix:**
```typescript
// Batch fetch all stock levels at once
const variationIds = items.map(item => Number(item.productVariationId))
const stockLevels = await prisma.variationLocationDetails.findMany({
  where: {
    productVariationId: { in: variationIds },
    locationId: locationIdNumber,
  },
})

const stockMap = new Map(
  stockLevels.map(s => [s.productVariationId, parseFloat(s.qtyAvailable)])
)

// Validate all items using pre-fetched data
for (const item of items) {
  const available = stockMap.get(Number(item.productVariationId)) || 0
  if (available < parseFloat(item.quantity)) {
    return NextResponse.json({ error: `Insufficient stock...` })
  }
}
```

**Expected Improvement:** 200-400ms saved

---

### 4. Serial Number Pre-fetching (ALREADY OPTIMIZED ✓)

**Location:** `src/app/api/sales/route.ts:419-438`

**Current Code:**
```typescript
// GOOD: Batch fetches all serial numbers at once
const allSerialNumberIds = items
  .filter((item: any) => item.requiresSerial && item.serialNumberIds)
  .flatMap((item: any) => item.serialNumberIds)

const serialNumbers = allSerialNumberIds.length > 0
  ? await prisma.productSerialNumber.findMany({
      where: {
        id: { in: allSerialNumberIds.map((id: any) => Number(id)) },
        status: 'in_stock',
      },
    })
  : []
```

**Status:** ✅ Already optimized - no changes needed

---

### 5. Transaction Scope Too Large (MEDIUM PRIORITY)

**Location:** `src/app/api/sales/route.ts:526-670`

**Issue:**
- Transaction holds database locks for entire sale creation process
- Includes invoice number generation, sale creation, items creation, stock deduction
- Long-running transactions block other operations

**Impact:**
- Database connection held for 1-3 seconds
- Locks prevent concurrent sales at same location
- Connection pool exhaustion under load

**Recommended Fix:**
```typescript
// Move READ operations OUTSIDE transaction
const invoiceNumber = await getNextInvoiceNumber(businessId, locationId, locationName)
const variations = await prisma.productVariation.findMany({ ... })
const serialNumbers = await prisma.productSerialNumber.findMany({ ... })

// Keep ONLY WRITE operations in transaction
await prisma.$transaction(async (tx) => {
  // Verify invoice number still available (optimistic locking)
  // Create sale
  // Create sale items
  // Deduct stock
  // Update serial numbers
})
```

**Expected Improvement:**
- Shorter transaction time (better concurrency)
- Reduced connection pool usage

---

## Network Latency Analysis

### Supabase Connection Latency
Based on connection pooler usage:

- **Typical Latency:** 100-200ms per query from Philippines to Supabase (US/Singapore)
- **Connection Pooler:** Adds 10-50ms overhead
- **SSL Handshake:** 50-100ms (first connection)

### Query Breakdown for 3-item Sale

| Operation | Queries | Latency Each | Total |
|-----------|---------|--------------|-------|
| Idempotency check | 1 | 150ms | 150ms |
| Session fetch | 1 | 150ms | 150ms |
| User location check | 1 | 150ms | 150ms |
| Stock checks (sequential) | 3 | 150ms | 450ms |
| Variation fetches (sequential) | 3 | 150ms | 450ms |
| Serial number fetches (batched) | 1 | 150ms | 150ms |
| Transaction (sale + items + stock) | ~10 | 150ms | 1500ms |
| **TOTAL ESTIMATED TIME** | | | **3000ms (3 seconds)** |

### With Optimizations

| Operation | Queries | Latency Each | Total |
|-----------|---------|--------------|-------|
| Idempotency check (cached) | 0 | 0ms | 0ms |
| Session fetch | 1 | 150ms | 150ms |
| User location check | 1 | 150ms | 150ms |
| Stock checks (batched) | 1 | 150ms | 150ms |
| Variation fetches (batched) | 1 | 150ms | 150ms |
| Serial number fetches (batched) | 1 | 150ms | 150ms |
| Transaction (optimized) | ~5 | 150ms | 750ms |
| **TOTAL ESTIMATED TIME** | | | **1500ms (1.5 seconds)** |

**50% improvement** from 3 seconds to 1.5 seconds

---

## Prioritized Optimization Roadmap

### Phase 1: Quick Wins (High Impact, Low Effort)

1. **Batch Fetch Variations** (HIGHEST PRIORITY)
   - Location: Before transaction loop
   - Code Change: 20 lines
   - Expected Gain: 400-800ms (30%)
   - Risk: Low
   - Implementation Time: 30 minutes

2. **Batch Fetch Stock Levels**
   - Location: Before transaction
   - Code Change: 15 lines
   - Expected Gain: 200-400ms (15%)
   - Risk: Low
   - Implementation Time: 20 minutes

3. **Add Index on idempotency_keys table**
   ```sql
   CREATE INDEX IF NOT EXISTS idx_idempotency_keys_lookup
     ON idempotency_keys(key, business_id)
     WHERE expires_at > CURRENT_TIMESTAMP;
   ```
   - Expected Gain: 50-100ms (5%)
   - Risk: None
   - Implementation Time: 5 minutes

**Phase 1 Total Gain:** 650-1300ms (50% improvement)

---

### Phase 2: Medium-Term Improvements

4. **Optimize Transaction Scope**
   - Move read operations outside transaction
   - Use optimistic locking for invoice numbers
   - Expected Gain: 300-600ms (20%)
   - Risk: Medium
   - Implementation Time: 2 hours

5. **Parallel Query Execution**
   ```typescript
   const [session, stockLevels, variations] = await Promise.all([
     getServerSession(authOptions),
     fetchStockLevels(items, locationId),
     fetchVariations(items),
   ])
   ```
   - Expected Gain: 200-400ms (15%)
   - Risk: Low
   - Implementation Time: 1 hour

---

### Phase 3: Advanced Optimizations (Optional)

6. **Redis Cache for Idempotency Keys**
   - Requires Redis setup
   - Expected Gain: 100-150ms (10%)
   - Risk: Medium (infrastructure dependency)
   - Implementation Time: 4 hours

7. **Connection Pool Tuning**
   - Increase Prisma connection pool size
   - Add connection timeout monitoring
   - Expected Gain: Better concurrency
   - Risk: Low
   - Implementation Time: 30 minutes

8. **Debounce POS Submissions**
   - Prevent multiple rapid clicks on "Complete Sale"
   - Client-side optimization
   - Expected Gain: Prevent retry storms
   - Risk: Low
   - Implementation Time: 20 minutes

---

## Implementation Priority

**IMMEDIATE (This Week):**
- ✅ Fix Status 500 error (DONE)
- 🔴 Batch fetch variations (30 min)
- 🔴 Batch fetch stock levels (20 min)
- 🔴 Add idempotency index (5 min)

**SHORT-TERM (Next Week):**
- 🟡 Optimize transaction scope (2 hours)
- 🟡 Parallel query execution (1 hour)

**MEDIUM-TERM (Future):**
- 🟢 Redis caching (4 hours)
- 🟢 Connection pool tuning (30 min)
- 🟢 Client-side debounce (20 min)

---

## Monitoring Recommendations

### Add Performance Logging

```typescript
// At start of POST handler
const perfStart = Date.now()

// After each major operation
console.log(`[PERF] Idempotency check: ${Date.now() - perfStart}ms`)
console.log(`[PERF] Validation: ${Date.now() - perfStart}ms`)
console.log(`[PERF] Stock check: ${Date.now() - perfStart}ms`)
console.log(`[PERF] Transaction: ${Date.now() - perfStart}ms`)
console.log(`[PERF] Total sale time: ${Date.now() - perfStart}ms`)
```

### Track Metrics

- Average sale completion time
- P95/P99 latency (95th/99th percentile)
- Timeout rate
- Retry rate
- Database connection pool usage

### Set Alerts

- Alert if average sale time > 2 seconds
- Alert if retry rate > 20%
- Alert if connection pool usage > 80%

---

## Testing Strategy

### Before Optimization
1. Record baseline metrics (10 test sales)
2. Measure average completion time
3. Check retry count

### After Each Optimization
1. Run same test sales
2. Compare completion time
3. Verify correctness (stock levels, transactions)
4. Check error rate

### Load Testing
```bash
# Simulate 10 concurrent sales
ab -n 100 -c 10 -H "Idempotency-Key: test-\${RANDOM}" \\
  -H "Authorization: Bearer ${TOKEN}" \\
  -p sale.json \\
  http://localhost:3000/api/sales
```

---

## Conclusion

The sales performance issue is caused by **sequential database queries** compounded by **network latency to Supabase**. The good news is that most bottlenecks can be fixed with **simple code changes** (batching queries, moving reads outside transactions).

**Expected Results After Phase 1:**
- Sales complete in 1-2 seconds (down from 3-4 seconds)
- Fewer retries (better user experience)
- Better support for concurrent sales

**Status:** Ready to implement optimizations

---

**Created:** 2025-11-08
**Analysis Time:** 30 minutes
**Estimated Fix Time:** 1-2 hours (Phase 1 + Phase 2)
**Priority:** HIGH (affects every sale)
