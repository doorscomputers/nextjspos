# Transfer Performance Fix - Architectural Solution

## Problem Statement

Current transfer system fails for large transfers (22+ items) due to:
1. **Synchronous processing** - HTTP request waits for entire transaction
2. **Vercel timeout** - 60 seconds max (300s on Pro plan)
3. **Expensive operations** - Stock validation, history queries, serial number updates
4. **Single transaction** - All-or-nothing causes rollbacks on timeout
5. **Network latency** - Vercel → Supabase round trips

**Current Performance**: ~3 seconds per item = 66 seconds for 22 items = **TIMEOUT**

**Target Performance**: Handle 100+ items without timeouts

---

## Solution Overview

Three approaches, ordered by implementation complexity:

### Option 1: Quick Fix (1 hour) - Batch Processing ⚡
- Split large transfers into smaller batches
- Process 10 items at a time
- Still synchronous but under timeout limit
- **Best for: Demo-ready in 1 hour**

### Option 2: Medium Fix (4 hours) - Async Job Queue 🔄
- Transfers create "job" in database
- Background worker processes items
- Client polls for completion
- **Best for: Production-ready within 1 day**

### Option 3: Full Fix (1 day) - Event-Driven Architecture 🏗️
- Message queue (Redis/BullMQ)
- Separate worker service
- Real-time progress updates via WebSockets
- **Best for: Enterprise-grade scalability**

---

## RECOMMENDED: Option 1 - Batch Processing (Quick Fix)

### Implementation Plan

1. **Modify Send Transfer API** to process in batches
2. **Keep UI responsive** with progress indication
3. **Maintain transaction safety** per batch
4. **Rollback strategy** if any batch fails

### Code Changes Required

**File**: `src/app/api/transfers/[id]/send/route.ts`

Current:
```typescript
// Process ALL items in ONE transaction (TIMEOUT RISK)
const result = await prisma.$transaction(async (tx) => {
  for (const item of transfer.items) {  // ❌ Could be 50+ items
    await transferStockOut({ tx, item })
  }
  await tx.stockTransfer.update({ status: 'in_transit' })
}, { timeout: 120000 })  // Meaningless - Vercel kills at 60s
```

**Proposed** (Batch Processing):
```typescript
// APPROACH 1: Process in batches of 10 items
const BATCH_SIZE = 10
const batches = []

for (let i = 0; i < transfer.items.length; i += BATCH_SIZE) {
  batches.push(transfer.items.slice(i, i + BATCH_SIZE))
}

// Process each batch in separate transaction
let processedCount = 0
const errors = []

for (const [batchIndex, batch] of batches.entries()) {
  try {
    await prisma.$transaction(async (tx) => {
      for (const item of batch) {
        await transferStockOut({
          tx,
          item,
          skipAvailabilityCheck: true  // Already validated
        })
      }

      // Update progress
      processedCount += batch.length

      // On last batch, update status
      if (batchIndex === batches.length - 1) {
        await tx.stockTransfer.update({
          where: { id: transferId },
          data: { status: 'in_transit', stockDeducted: true }
        })
      }
    }, {
      timeout: 30000,  // 30s per batch of 10 items
      maxWait: 10000
    })

    console.log(`✅ Batch ${batchIndex + 1}/${batches.length} complete (${processedCount}/${transfer.items.length} items)`)

  } catch (error) {
    console.error(`❌ Batch ${batchIndex + 1} failed:`, error)
    errors.push({ batchIndex, error })

    // ROLLBACK ALL PREVIOUS BATCHES
    await rollbackPartialTransfer(transferId, processedCount)
    throw new Error(`Transfer failed at batch ${batchIndex + 1}: ${error.message}`)
  }
}
```

### Rollback Strategy

If any batch fails, we need to reverse previous batches:

```typescript
async function rollbackPartialTransfer(transferId: number, itemsProcessed: number) {
  console.log(`🔄 Rolling back ${itemsProcessed} items from transfer ${transferId}`)

  // Get all stock transactions for this transfer
  const stockTxns = await prisma.stockTransaction.findMany({
    where: {
      referenceType: 'stock_transfer',
      referenceId: transferId,
      type: 'transfer_out'
    }
  })

  // Reverse each transaction
  await prisma.$transaction(async (tx) => {
    for (const stockTxn of stockTxns) {
      // Add stock back (reverse deduction)
      const stock = await tx.variationLocationDetails.findFirst({
        where: {
          productVariationId: stockTxn.productVariationId,
          locationId: stockTxn.locationId
        }
      })

      if (stock) {
        await tx.variationLocationDetails.update({
          where: { id: stock.id },
          data: {
            qtyAvailable: stock.qtyAvailable.add(Math.abs(parseFloat(stockTxn.quantity.toString())))
          }
        })
      }

      // Delete the stock transaction
      await tx.stockTransaction.delete({ where: { id: stockTxn.id } })

      // Delete product history
      await tx.productHistory.deleteMany({
        where: {
          referenceType: 'stock_transfer',
          referenceId: transferId,
          productVariationId: stockTxn.productVariationId,
          transactionType: 'transfer_out'
        }
      })
    }

    // Reset transfer status
    await tx.stockTransfer.update({
      where: { id: transferId },
      data: {
        status: 'checked',  // Back to previous state
        stockDeducted: false,
        sentBy: null,
        sentAt: null
      }
    })
  })

  console.log(`✅ Rollback complete - transfer reset to 'checked' status`)
}
```

---

## Additional Optimizations

### 1. Skip Redundant Validation

Stock availability already validated before send - no need to re-check:

```typescript
await transferStockOut({
  tx,
  item,
  skipAvailabilityCheck: true  // ✅ Save 500ms per item
})
```

### 2. Batch Serial Number Updates

Instead of updating one-by-one, batch update all serial numbers:

```typescript
// ❌ OLD: Multiple queries
for (const serialId of serialIds) {
  await tx.productSerialNumber.update({ where: { id: serialId }, ... })
}

// ✅ NEW: Single query
await tx.productSerialNumber.updateMany({
  where: { id: { in: serialIds } },
  data: { status: 'in_transit', currentLocationId: null }
})
```

### 3. Disable Stock Validation in Transaction

Already covered - keep `ENABLE_STOCK_VALIDATION=false` in production.

### 4. Parallel Batch Processing (Advanced)

Process multiple batches concurrently (risks partial failures):

```typescript
// Process 3 batches at once
await Promise.all(
  batches.slice(0, 3).map(batch => processBatch(batch))
)
```

⚠️ **Caution**: Harder to rollback if one fails mid-flight.

---

## Performance Comparison

| Scenario | Current | Batch (Option 1) | Async Job (Option 2) |
|----------|---------|------------------|----------------------|
| 10 items | 30s | 15s | 2s (returns immediately) |
| 22 items | **TIMEOUT (66s)** | 30s | 2s (returns immediately) |
| 50 items | **TIMEOUT (150s)** | 60s | 2s (returns immediately) |
| 100 items | **TIMEOUT (300s)** | **TIMEOUT (120s)** | 2s (returns immediately) |

**Batch processing** solves the immediate problem for typical transfers (< 30 items).

**Async jobs** needed for very large transfers (50+ items).

---

## Recommended Implementation Order

### Phase 1: Emergency Fix (NOW - 1 hour)
1. ✅ Disable `ENABLE_STOCK_VALIDATION` in Vercel
2. ✅ Add `skipAvailabilityCheck: true` to `transferStockOut()`
3. ✅ Batch serial number updates
4. ✅ Test with 22-item transfer

**Result**: Should complete in ~30-40 seconds

### Phase 2: Batch Processing (This Week - 4 hours)
1. Implement batch processing (10 items per batch)
2. Add rollback mechanism
3. Update client to show "Processing batch X/Y" progress
4. Test with 50-item transfer

**Result**: Handles up to 50 items reliably

### Phase 3: Async Jobs (Next Sprint - 1 day)
1. Create `transfer_jobs` table
2. Add background worker (cron or long-running process)
3. Add polling endpoint for job status
4. Update UI to show real-time progress

**Result**: Handles unlimited items, scales to thousands

---

## Long-Term Architecture (Option 3)

For enterprise-grade system:

```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ 1. POST /api/transfers/[id]/send
       ↓
┌─────────────┐
│   Vercel    │ → Creates transfer job in DB
│  Function   │ → Returns job ID immediately
└──────┬──────┘
       │ 2. Publishes message to queue
       ↓
┌─────────────┐
│Redis/BullMQ │
│   Queue     │
└──────┬──────┘
       │ 3. Worker picks up job
       ↓
┌─────────────┐
│ Background  │ → Processes items (no timeout)
│   Worker    │ → Updates job progress
└──────┬──────┘
       │ 4. Writes results to DB
       ↓
┌─────────────┐
│  Database   │
│ (Job Status)│
└──────┬──────┘
       │ 5. Client polls GET /api/jobs/[id]
       ↓
┌─────────────┐
│   Client    │ → Shows progress bar
│  (Polling)  │ → Redirects when complete
└─────────────┘
```

**Benefits**:
- No timeouts (worker has unlimited time)
- Real-time progress
- Retry failed items
- Scale to 1000+ items
- Process multiple transfers concurrently

---

## Immediate Next Steps

**Which option do you want?**

1. **Quick Demo Fix** (1 hour):
   - Skip validation checks
   - Batch serial numbers
   - Test with your 22-item transfer
   - **Gets you through demo safely**

2. **Production Ready** (4 hours):
   - Full batch processing
   - Rollback mechanism
   - Progress indication
   - **Handles 50-item transfers**

3. **Enterprise Grade** (1 day):
   - Async job queue
   - Background workers
   - Real-time progress
   - **Unlimited scalability**

**Your demo is soon - I recommend Option 1 NOW, then Option 2 after demo.**

Let me know which approach you want and I'll implement it immediately.
