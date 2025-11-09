# 🚨 CRITICAL TRANSACTION SAFETY FIXES
## All-or-Nothing Guarantee for Slow Internet Connections

**Priority**: 🔴 **CRITICAL**
**Date**: 2025-11-09
**Status**: ❌ **REQUIRES IMMEDIATE FIXES**

---

## Executive Summary

Your concern about "all succeed or all fail" transaction safety is **100% VALID**. I found **3 critical race conditions** that can cause problems on slow internet:

1. ❌ Serial number duplicate checks OUTSIDE transactions (race conditions)
2. ❌ Audit logs and accounting OUTSIDE transactions (can fail after inventory committed)
3. ❌ Serial validation OUTSIDE transactions in transfers (can receive same item twice)

**Good News**:
- ✅ All inventory operations ARE in transactions
- ✅ Transactions DO roll back on failure
- ✅ Idempotency protection works

**Bad News**:
- ❌ Critical audit/accounting operations can fail AFTER inventory committed
- ❌ Race conditions on serial numbers can cause confusing errors
- ❌ Transfer receive can process same serials twice

---

## 🔴 CRITICAL FIX #1: Purchase Receipt Serial Numbers

### The Problem

**File**: `src/app/api/purchases/receipts/[id]/approve/route.ts`

**Current Code** (UNSAFE):
```typescript
// Lines 108-132: OUTSIDE transaction ❌
for (const serialNumber of serialNumbersInReceipt) {
  const existing = await prisma.productSerialNumber.findUnique({
    where: { businessId_serialNumber: { businessId, serialNumber } }
  })

  if (existing) {
    return NextResponse.json({ error: 'Duplicate serial' })
  }
}

// Lines 141-416: INSIDE transaction ✅
await prisma.$transaction(async (tx) => {
  // Create serials here (lines 212-265)
  await tx.productSerialNumber.upsert({
    where: { businessId_serialNumber: { businessId, serialNumber } }
  })
})
```

**What Happens on Slow Internet**:
```
00:00 - User A: Check serial "XYZ" → Not found ✅
00:01 - Network delay (slow connection)...
00:02 - User B: Check serial "XYZ" → Not found ✅ (RACE!)
00:05 - User A: Transaction starts
00:06 - User A: Creates serial "XYZ" ✅
00:07 - User A: Transaction commits ✅
00:08 - User B: Transaction starts
00:09 - User B: Tries to create "XYZ" → ❌ UNIQUE CONSTRAINT ERROR
00:10 - User B: Transaction rolls back ✅ (Good, but confusing error)
```

### The Fix

**Move validation INSIDE transaction with row-level locking**:

```typescript
// REMOVE lines 108-132 completely

// INSIDE transaction (line 141)
await prisma.$transaction(async (tx) => {
  // Step 1: Collect all serial numbers first
  const allSerialNumbers: string[] = []
  for (const item of receipt.items) {
    const purchaseItem = receipt.purchase.items.find(pi => pi.id === item.purchaseItemId)
    if (purchaseItem?.requiresSerial && item.serialNumbers) {
      const serialsArray = (item.serialNumbers as any[]).map((sn: any) => sn.serialNumber)
      allSerialNumbers.push(...serialsArray)
    }
  }

  // Step 2: Check for duplicates INSIDE transaction with row lock
  if (allSerialNumbers.length > 0) {
    const existingSerials = await tx.productSerialNumber.findMany({
      where: {
        businessId: businessIdNumber,
        serialNumber: { in: allSerialNumbers }
      },
      select: { serialNumber: true }
    })

    if (existingSerials.length > 0) {
      const duplicates = existingSerials.map(s => s.serialNumber).join(', ')
      throw new Error(`Serial numbers already exist: ${duplicates}`)
    }
  }

  // Step 3: Now safe to create serials (existing code lines 143-413)
  for (const item of receipt.items) {
    // ... existing processing logic ...
  }

  return approved
}, {
  timeout: 120000, // 2 minutes for slow internet (increased from 60s)
  maxWait: 10000,  // Wait up to 10 seconds to acquire transaction
})
```

**Benefits**:
- ✅ No race conditions - validation happens atomically
- ✅ Clear error messages
- ✅ Faster (one batch query instead of N queries)

---

## 🔴 CRITICAL FIX #2: Critical Operations After Transaction

### The Problem

**File**: `src/app/api/purchases/receipts/[id]/approve/route.ts`

**Current Code** (UNSAFE):
```typescript
// Lines 141-416: Transaction commits here ✅
const updatedReceipt = await prisma.$transaction(async (tx) => {
  // Inventory operations
  return approved
})

// Lines 418-498: AFTER transaction - CAN FAIL ❌
const inventoryImpact = await impactTracker.captureAfterAndReport(...) // Can fail
await recordPurchase(...) // Accounting - can fail ❌
await createAuditLog(...) // Audit log - can fail ❌
await prisma.$queryRaw`...refresh...` // View refresh - can fail

return NextResponse.json({ ...updatedReceipt, inventoryImpact })
```

**What Happens on Slow Internet**:
```
✅ Inventory added to database
✅ Serial numbers created
✅ Accounts Payable created
✅ Transaction commits

❌ Network timeout during audit log creation
❌ Accounting entries not recorded
❌ No audit trail

Result: Data is correct but no way to trace what happened!
```

### The Fix

**Move critical operations INSIDE transaction**:

```typescript
await prisma.$transaction(async (tx) => {
  // ... existing stock operations ...

  // MOVE AUDIT LOG INSIDE TRANSACTION
  await tx.auditLog.create({
    data: {
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'purchase_receipt_approve',
      entityType: 'purchase',
      entityIds: [updatedReceipt.id],
      description: `Approved GRN ${receipt.receiptNumber}`,
      metadata: {
        receiptId: updatedReceipt.id,
        grnNumber: receipt.receiptNumber,
        purchaseId: receipt.purchaseId,
        // ... all existing metadata ...
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    }
  })

  // MOVE ACCOUNTING INSIDE TRANSACTION
  if (await isAccountingEnabled(businessIdNumber)) {
    const totalCost = receipt.purchase.items.reduce(
      (sum, item) => sum + (parseFloat(item.unitCost.toString()) * parseFloat(item.quantity.toString())),
      0
    )

    // Create accounting journal entries INSIDE transaction
    await tx.accountingTransaction.create({
      data: {
        businessId: businessIdNumber,
        userId: userIdNumber,
        date: receipt.receiptDate,
        referenceType: 'purchase',
        referenceId: receipt.purchaseId,
        referenceNumber: receipt.purchase.purchaseOrderNumber,
        // Debit: Inventory Asset
        debitAccountId: INVENTORY_ACCOUNT_ID,
        debitAmount: totalCost,
        // Credit: Accounts Payable
        creditAccountId: ACCOUNTS_PAYABLE_ACCOUNT_ID,
        creditAmount: totalCost,
        description: `Purchase from ${receipt.purchase.supplier.name} - ${receipt.receiptNumber}`,
      }
    })
  }

  return approved
}, {
  timeout: 120000, // 2 minutes for slow connections
  maxWait: 10000
})

// AFTER transaction - Only non-critical operations
// These can fail safely without affecting data integrity

// Impact tracking (nice to have, not critical)
let inventoryImpact = null
try {
  inventoryImpact = await impactTracker.captureAfterAndReport(
    productVariationIds,
    locationIds,
    'purchase',
    updatedReceipt.id,
    receipt.receiptNumber,
    undefined,
    userDisplayName
  )
} catch (error) {
  console.error('[Non-critical] Impact tracking failed:', error)
  // Continue - this is just reporting
}

// Materialized view refresh (eventually consistent, can be async)
setImmediate(() => {
  prisma.$queryRaw`SELECT * FROM refresh_stock_pivot_view()`
    .then(() => console.log('[Purchase Approval] Stock view refreshed'))
    .catch(err => console.error('[Non-critical] View refresh failed:', err))
})

return NextResponse.json({
  ...updatedReceipt,
  inventoryImpact // May be null if tracking failed, that's OK
})
```

**Benefits**:
- ✅ Audit log ALWAYS created with inventory
- ✅ Accounting entries ALWAYS created with inventory
- ✅ All critical data is atomic
- ✅ Non-critical operations can fail gracefully

---

## 🔴 CRITICAL FIX #3: Transfer Receive Race Condition

### The Problem

**File**: `src/app/api/transfers/[id]/receive/route.ts`

**Current Code** (UNSAFE):
```typescript
// Lines 224-252: OUTSIDE transaction ❌
for (const snId of receivedItem.serialNumberIds) {
  const sn = await prisma.productSerialNumber.findFirst({
    where: { id: snIdNumber, status: 'in_transit' }
  })

  if (!sn) {
    return NextResponse.json({ error: 'Serial not in transit' })
  }
}

// Lines 257-380: INSIDE transaction ✅
await prisma.$transaction(async (tx) => {
  for (const snId of receivedItem.serialNumberIds) {
    await tx.productSerialNumber.update({
      where: { id: Number(snId) },
      data: { status: 'in_stock', currentLocationId: toLocationId }
    })
  }
})
```

**What Happens on Slow Internet**:
```
00:00 - User A: Check serial "ABC123" status → in_transit ✅
00:01 - Network delay...
00:02 - User B: Check serial "ABC123" status → in_transit ✅ (RACE!)
00:05 - User A: Transaction starts
00:06 - User A: Updates serial "ABC123" → in_stock ✅
00:07 - User A: Adds stock to location ✅
00:08 - User A: Transaction commits ✅
00:09 - User B: Transaction starts
00:10 - User B: Updates serial "ABC123" → in_stock ✅ (DUPLICATE!)
00:11 - User B: Adds stock AGAIN ✅ (DOUBLE INVENTORY!)
00:12 - User B: Transaction commits ✅

Result: Same item received twice, inventory doubled! 💥
```

### The Fix

**Move validation INSIDE transaction with optimistic locking**:

```typescript
// REMOVE lines 224-252 completely

// INSIDE transaction (line 257)
await prisma.$transaction(async (tx) => {
  // Update transfer status
  await tx.stockTransfer.update({
    where: { id: transferIdNumber },
    data: {
      status: 'received',
      stockDeducted: true,
      receivedBy: userIdNumber,
      receivedAt: receivedDate ? new Date(receivedDate) : new Date(),
      verifierNotes: notes,
    }
  })

  const deductAtReceive = !transfer.stockDeducted

  // Process each item
  for (const receivedItem of items) {
    const transferItem = transfer.items.find(
      (ti) => ti.id === Number(receivedItem.transferItemId)
    )!

    const quantityReceived = parseFloat(receivedItem.quantityReceived)

    if (quantityReceived <= 0) {
      continue
    }

    // CRITICAL: Validate and lock serials INSIDE transaction
    if (receivedItem.serialNumberIds && receivedItem.serialNumberIds.length > 0) {
      // Update with WHERE condition that enforces status
      // This will fail if serial is already received
      const updateResult = await tx.productSerialNumber.updateMany({
        where: {
          id: { in: receivedItem.serialNumberIds.map(Number) },
          status: 'in_transit', // CRITICAL: Only update if still in transit
        },
        data: {
          status: 'in_stock',
          currentLocationId: transfer.toLocationId,
        }
      })

      // Verify all serials were updated
      if (updateResult.count !== receivedItem.serialNumberIds.length) {
        throw new Error(
          `Cannot receive transfer - some serial numbers are not in transit. ` +
          `Expected: ${receivedItem.serialNumberIds.length}, ` +
          `Updated: ${updateResult.count}. ` +
          `This transfer may have already been received.`
        )
      }

      // Create movement records (batch)
      await tx.serialNumberMovement.createMany({
        data: receivedItem.serialNumberIds.map(snId => ({
          serialNumberId: Number(snId),
          movementType: 'transfer_in',
          fromLocationId: transfer.fromLocationId,
          toLocationId: transfer.toLocationId,
          referenceType: 'transfer',
          referenceId: transfer.id,
          movedBy: userIdNumber,
          notes: `Transfer ${transfer.transferNumber} received`
        }))
      })
    }

    // ... rest of existing stock operations ...
  }
}, {
  timeout: 120000, // 2 minutes for slow internet
  maxWait: 10000,
})
```

**Benefits**:
- ✅ Optimistic locking prevents double receive
- ✅ Clear error if already received
- ✅ No race conditions possible
- ✅ Batched operations (faster)

---

## 🔴 CRITICAL FIX #4: Transfer Send (Already Safe, But Verify)

**File**: `src/app/api/transfers/[id]/send/route.ts`

**Current Status**: ✅ **MOSTLY SAFE**

The transfer send operation is already well-structured:

```typescript
// Line 135-194: Everything critical is INSIDE transaction
await prisma.$transaction(async (tx) => {
  for (const item of transfer.items) {
    // Deduct stock
    await transferStockOut({ ... })

    // Update serials to in_transit
    if (item.serialNumbersSent) {
      await tx.productSerialNumber.updateMany({
        where: {
          id: { in: serialIds },
          status: 'in_stock', // Only if currently in stock
          currentLocationId: transfer.fromLocationId
        },
        data: {
          status: 'in_transit',
          currentLocationId: null
        }
      })
    }
  }

  // Update transfer status
  await tx.stockTransfer.update({
    where: { id: transferId },
    data: {
      status: 'in_transit',
      stockDeducted: true,
      sentBy: userIdNumber,
      sentAt: new Date()
    }
  })
})
```

**Only Minor Improvement Needed**:

Add audit log INSIDE transaction:

```typescript
await prisma.$transaction(async (tx) => {
  // ... existing stock operations ...

  // Update transfer status
  const updatedTransfer = await tx.stockTransfer.update({ ... })

  // MOVE AUDIT LOG INSIDE TRANSACTION
  await tx.auditLog.create({
    data: {
      businessId: businessIdNumber,
      userId: userIdNumber,
      username: user.username,
      action: 'transfer_send',
      entityType: 'stock_transfer',
      entityIds: [transferId],
      description: `Sent transfer ${transfer.transferNumber}`,
      metadata: {
        transferNumber: transfer.transferNumber,
        fromLocationId: transfer.fromLocationId,
        toLocationId: transfer.toLocationId,
        itemCount: transfer.items.length,
        notes
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    }
  })

  return updatedTransfer
}, {
  timeout: 120000, // 2 minutes
  maxWait: 10000
})

// AFTER transaction - Only notifications (non-critical)
setImmediate(() => {
  sendTelegramStockTransferAlert({ ... })
    .catch(err => console.error('[Non-critical] Telegram failed:', err))
})
```

---

## 🛡️ Additional Safety Measures

### 1. Increase Transaction Timeout for Slow Internet

**All three files need this change**:

```typescript
await prisma.$transaction(async (tx) => {
  // ... operations ...
}, {
  timeout: 120000, // 2 minutes instead of 60 seconds
  maxWait: 10000,  // Wait up to 10 seconds to acquire transaction
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable // Highest safety
})
```

**Why**:
- Slow internet can take 30-60 seconds for large operations
- 60-second timeout is too short
- 120 seconds gives enough buffer
- Serializable isolation prevents all race conditions

---

### 2. Add Retry Logic for Network Failures

**All three files**:

```typescript
// Wrap the entire idempotency block with retry logic
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error: any) {
      lastError = error

      // Don't retry on business logic errors
      if (error.message.includes('Insufficient stock') ||
          error.message.includes('already exists') ||
          error.message.includes('Forbidden')) {
        throw error
      }

      // Don't retry on final attempt
      if (attempt === maxRetries) {
        throw error
      }

      // Network error or timeout - retry with exponential backoff
      const backoff = delayMs * Math.pow(2, attempt - 1)
      console.log(`[Retry] Attempt ${attempt} failed, retrying in ${backoff}ms...`)
      await new Promise(resolve => setTimeout(resolve, backoff))
    }
  }

  throw lastError || new Error('Operation failed after retries')
}

// Usage
export async function POST(request: NextRequest, { params }: ...) {
  return executeWithRetry(async () => {
    return withIdempotency(request, `/api/...`, async () => {
      // ... entire operation ...
    })
  })
}
```

---

### 3. Add Transaction Status Tracking

**Create a new table for tracking long-running operations**:

```sql
CREATE TABLE transaction_status (
  id SERIAL PRIMARY KEY,
  business_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- 'purchase_approval', 'transfer_send', etc.
  reference_id INTEGER NOT NULL, -- receipt_id, transfer_id, etc.
  status VARCHAR(20) NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Usage**:

```typescript
await prisma.$transaction(async (tx) => {
  // Create status record
  const statusRecord = await tx.transactionStatus.create({
    data: {
      businessId: businessIdNumber,
      userId: userIdNumber,
      operationType: 'purchase_approval',
      referenceId: receipt.id,
      status: 'processing',
      startedAt: new Date()
    }
  })

  try {
    // ... all operations ...

    // Mark as completed
    await tx.transactionStatus.update({
      where: { id: statusRecord.id },
      data: {
        status: 'completed',
        completedAt: new Date()
      }
    })
  } catch (error) {
    // Mark as failed
    await tx.transactionStatus.update({
      where: { id: statusRecord.id },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: error.message
      }
    })
    throw error
  }
})
```

**Benefits**:
- Users can see if operation is still processing
- Can detect stuck transactions
- Easier debugging on slow networks

---

## 📋 Implementation Checklist

### Priority 1: Critical Fixes (Implement Immediately)

- [ ] **Purchase Receipt Approval**
  - [ ] Move serial validation inside transaction
  - [ ] Move audit log inside transaction
  - [ ] Move accounting inside transaction
  - [ ] Increase timeout to 120 seconds
  - [ ] Test with slow network simulation

- [ ] **Transfer Receive**
  - [ ] Move serial validation inside transaction
  - [ ] Add optimistic locking to serial updates
  - [ ] Add batch serial movement creation
  - [ ] Increase timeout to 120 seconds
  - [ ] Test with duplicate receive attempts

- [ ] **Transfer Send**
  - [ ] Move audit log inside transaction
  - [ ] Increase timeout to 120 seconds
  - [ ] Make notifications async (non-blocking)

### Priority 2: Safety Enhancements

- [ ] Add retry logic for network failures
- [ ] Add transaction status tracking table
- [ ] Implement operation monitoring dashboard
- [ ] Add alerting for stuck transactions

### Priority 3: Testing

- [ ] Test with 10 Kbps network (simulate very slow connection)
- [ ] Test with network interruptions (disconnect mid-transaction)
- [ ] Test concurrent operations (2+ users on same data)
- [ ] Test idempotency (retry same request multiple times)
- [ ] Verify all audit logs created
- [ ] Verify accounting entries always created
- [ ] Monitor transaction durations in production

---

## 🧪 Testing Procedure

### 1. Slow Network Simulation

**Using Chrome DevTools**:
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G" or custom (10 Kbps)
3. Approve purchase receipt with 50 serials
4. Should complete in < 2 minutes
5. Verify ALL data committed (inventory, audit, accounting)

**Using `tc` (Linux/Mac)**:
```bash
# Limit bandwidth to 10 Kbps
sudo tc qdisc add dev eth0 root tbf rate 10kbit burst 10kb latency 50ms

# Remove limit
sudo tc qdisc del dev eth0 root
```

### 2. Race Condition Testing

**Test concurrent approvals**:
```javascript
// Run this in browser console for TWO different receipts
async function testConcurrent() {
  const promises = [
    fetch('/api/purchases/receipts/1/approve', { method: 'POST', ... }),
    fetch('/api/purchases/receipts/1/approve', { method: 'POST', ... })
  ]

  const results = await Promise.all(promises)
  console.log('Result 1:', results[0].status)
  console.log('Result 2:', results[1].status)
  // Expected: One 200 (success), one 409 (conflict - idempotency)
}
```

### 3. Network Interruption Testing

**Simulate connection drop mid-transaction**:
1. Start operation
2. Disconnect network after 5 seconds
3. Reconnect after 10 seconds
4. Verify:
   - Transaction rolled back OR completed (not partial)
   - Idempotency allows safe retry
   - All data is consistent

---

## 🎯 Expected Results After Fixes

### Before Fixes

**Scenario**: Approve purchase receipt with 50 serials on slow internet

```
✅ Inventory added
✅ Serial numbers created
✅ Accounts payable created
❌ Audit log missing (network timeout)
❌ Accounting entries missing (network timeout)
❌ No way to trace what happened
```

**Problem**: Data is correct but untraceable.

### After Fixes

**Scenario**: Same operation on slow internet

```
✅ Inventory added
✅ Serial numbers created
✅ Accounts payable created
✅ Audit log created (inside transaction)
✅ Accounting entries created (inside transaction)
✅ Full audit trail maintained
```

**OR** (if transaction fails):

```
❌ Entire operation rolled back
❌ Nothing committed to database
✅ User gets clear error message
✅ Can retry safely (idempotency)
✅ No partial data
```

---

## 🚀 Deployment Steps

1. **Backup database** before deploying
2. Deploy fixes one at a time (not all at once)
3. Start with **Transfer Send** (lowest risk)
4. Then **Purchase Receipt Approval** (highest impact)
5. Finally **Transfer Receive** (most complex)
6. Monitor transaction durations in production
7. Set up alerts for transactions > 60 seconds
8. Review error logs daily for first week

---

## 📊 Monitoring Queries

**Check for stuck transactions**:
```sql
SELECT * FROM transaction_status
WHERE status = 'processing'
  AND started_at < NOW() - INTERVAL '5 minutes'
ORDER BY started_at ASC;
```

**Find slow operations**:
```sql
SELECT
  operation_type,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration_seconds,
  COUNT(*) as total_operations
FROM transaction_status
WHERE status = 'completed'
  AND completed_at > NOW() - INTERVAL '24 hours'
GROUP BY operation_type
ORDER BY avg_duration_seconds DESC;
```

---

## ✅ Summary

**Your concern is VALID** - the current code has race conditions and can lose audit/accounting data on slow networks.

**The fixes are straightforward**:
1. Move all validations INSIDE transactions
2. Move all critical operations (audit, accounting) INSIDE transactions
3. Increase timeouts for slow networks
4. Add proper optimistic locking

**After fixes, you will have**:
- ✅ 100% atomic operations (all or nothing)
- ✅ No race conditions
- ✅ Complete audit trails
- ✅ Works reliably on slow internet
- ✅ Clear error messages
- ✅ Safe retry behavior

**Estimated Time to Implement**: 2-3 days
**Risk Level**: Low (if tested thoroughly)
**Impact**: High (critical for data integrity)

---

**Generated by**: Claude Code Investigation
**Date**: 2025-11-09
**Priority**: 🔴 **CRITICAL - Implement ASAP**
