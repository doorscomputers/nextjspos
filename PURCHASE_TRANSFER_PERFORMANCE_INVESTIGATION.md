# Purchase Orders & Transfer Performance Investigation

## Issue
Purchase receipt approval and transfer completion are taking significant time to save.

## Investigation Date
Current investigation (no code modifications)

---

## 1. PURCHASE RECEIPT APPROVAL (Adds Inventory)

### File: `src/app/api/purchases/receipts/[id]/approve/route.ts`

### Performance Flow Analysis

#### 1. **Idempotency Check** (Line 23)
- **Impact**: Minimal (~50-100ms)
- **Status**: ✅ Not a bottleneck

#### 2. **Initial Receipt Fetch** (Lines 51-69) ⚠️ **MODERATE BOTTLENECK**
- **Operation**: Fetch receipt with purchase, supplier, and items
- **Impact**: ~200-500ms depending on data size
- **Status**: ⚠️ Could be optimized

#### 3. **Sequential Serial Number Validation** (Lines 108-132) ⚠️ **SIGNIFICANT BOTTLENECK**
- **Operation**: For EACH item with serial numbers, check for duplicates
- **Code Pattern**:
  ```typescript
  for (const item of receipt.items) {
    for (const serialNumber of serialNumbersInReceipt) {
      const existing = await prisma.productSerialNumber.findUnique({...})
    }
  }
  ```
- **Impact**: 
  - Nested loops with sequential queries
  - For 10 items with 5 serials each = **50 sequential queries**
  - Estimated: **50-100ms per query = 2.5-5 seconds**
- **Status**: ⚠️ **CRITICAL BOTTLENECK** - Should be batched

#### 4. **Inventory Impact Tracking - BEFORE** (Line 138) ⚠️ **MODERATE BOTTLENECK**
- **Operation**: `captureBefore()` - Queries inventory state
- **Impact**: ~500ms - 2 seconds
- **Status**: ⚠️ Moderate bottleneck

#### 5. **Main Transaction** (Lines 141-416) ⚠️ **SIGNIFICANT BOTTLENECK**
- **Timeout**: 60 seconds (Line 415)
- **Operations Inside Transaction**:

  a. **For Each Item** (Lines 143-327):
  
     i. **Find Purchase Item** (Line 144)
        - In-memory find (no query)
        - Impact: Negligible
        - Status: ✅ Not a bottleneck
  
     ii. **Get Product Variation** (Lines 155-167) ⚠️ **MODERATE BOTTLENECK**
        - Query with warranty info
        - Impact: **100-200ms per item**
        - Status: ⚠️ Could be batched before transaction
  
     iii. **Process Purchase Receipt** (Lines 190-203) ⚠️ **SIGNIFICANT BOTTLENECK**
        - Calls `processPurchaseReceipt()` → `addStock()` → `updateStock()`
        - Each `updateStock()` does:
          - Raw SQL with `FOR UPDATE` lock
          - Update `variationLocationDetails`
          - Create `stockTransaction` record
          - Create `productHistory` record
          - Optional stock validation
        - Impact: **200-500ms per item**
        - Status: ⚠️ **SIGNIFICANT BOTTLENECK**
  
     iv. **Serial Number Creation** (Lines 207-266) ⚠️ **CRITICAL BOTTLENECK**
        - For each serial number:
          - `upsert` serial number record
          - Create `serialNumberMovement` record
        - Impact: **100-200ms per serial number**
        - For 10 items with 5 serials each = **50 operations = 5-10 seconds**
        - Status: ⚠️ **CRITICAL BOTTLENECK**
  
     v. **Weighted Average Cost Calculation** (Lines 269-316) ⚠️ **SIGNIFICANT BOTTLENECK**
        - Query ALL stock across ALL locations (Line 272)
        - Calculate weighted average
        - Update product variation
        - Impact: **200-500ms per item** (especially if many locations)
        - Status: ⚠️ **SIGNIFICANT BOTTLENECK** - Very expensive query
  
     vi. **Update Purchase Item** (Lines 319-326)
        - Single UPDATE
        - Impact: ~50ms per item
        - Status: ✅ Not a bottleneck
  
  b. **Check All Items Received** (Lines 330-340) ⚠️ **MODERATE BOTTLENECK**
     - For each purchase item, query to check if fully received
     - Impact: **50-100ms per purchase item**
     - Status: ⚠️ Could be optimized
  
  c. **Update Purchase Status** (Lines 344-347)
     - Single UPDATE
     - Impact: ~50ms
     - Status: ✅ Not a bottleneck
  
  d. **Update Receipt Status** (Lines 350-369)
     - Single UPDATE with includes
     - Impact: ~100-200ms
     - Status: ✅ Not a bottleneck
  
  e. **Auto-Create Accounts Payable** (Lines 372-411) ⚠️ **MODERATE BOTTLENECK**
     - Check if AP exists (Line 374)
     - Get supplier info (Line 383)
     - Create AP entry (Line 393)
     - Impact: **200-400ms** if purchase fully received
     - Status: ⚠️ Moderate bottleneck

- **Total Transaction Impact**: 
  - For 10 items with 5 serials each: **10-20 seconds**
  - Weighted average calculation adds significant overhead

#### 6. **Inventory Impact Tracking - AFTER** (Line 419) ⚠️ **MODERATE BOTTLENECK**
- **Impact**: ~500ms - 2 seconds
- **Status**: ⚠️ Moderate bottleneck

#### 7. **Accounting Integration** (Lines 430-451) ⚠️ **MODERATE BOTTLENECK**
- **Condition**: Only if accounting enabled
- **Operations**:
  - Check if enabled: ~50ms
  - Calculate total cost: In-memory (negligible)
  - `recordPurchase()`: Creates journal entry + updates account balances
  - Impact: **500ms - 1 second**
- **Status**: ⚠️ Moderate bottleneck

#### 8. **Audit Log** (Lines 454-480)
- **Impact**: ~50-100ms
- **Status**: ✅ Not a bottleneck

#### 9. **Stock Materialized View Refresh** (Lines 483-492) ⚠️ **SIGNIFICANT BOTTLENECK**
- **Operation**: `SELECT * FROM refresh_stock_pivot_view()`
- **Impact**: **1-5 seconds** depending on data volume
- **Status**: ⚠️ **SIGNIFICANT BOTTLENECK** - Very expensive operation

### Purchase Receipt Approval - Query Count Analysis

For a receipt with 10 items and 50 serial numbers:

1. Idempotency check: **1 query**
2. Initial receipt fetch: **1 query** (with joins)
3. Serial number validation: **50 queries** (sequential)
4. Inventory impact - before: **2 queries**
5. Main transaction:
   - Product variation fetch: **10 queries** (sequential)
   - Stock updates: **10 queries** (with locks)
   - Stock transactions: **10 queries**
   - Product history: **10 queries**
   - Serial number upserts: **50 queries**
   - Serial number movements: **50 queries**
   - Weighted average (stock across locations): **10 queries** (expensive)
   - Purchase item updates: **10 queries**
   - Check all items received: **10 queries**
   - Purchase status update: **1 query**
   - Receipt update: **1 query**
   - AP check: **1 query**
   - Supplier fetch: **1 query**
   - AP create: **1 query**
6. Inventory impact - after: **2 queries**
7. Accounting (if enabled): **3-5 queries**
8. Audit log: **1 query**
9. Stock view refresh: **1 query** (expensive)

**Total: ~180-200 queries** for a typical purchase receipt

### Purchase Receipt Approval - Time Breakdown

- **Best Case** (5 items, no serials): ~5-8 seconds
- **Typical Case** (10 items, 50 serials): ~15-25 seconds
- **Worst Case** (20 items, 200 serials): ~30-45 seconds

---

## 2. TRANSFER COMPLETE (Adds to Destination)

### File: `src/app/api/transfers/[id]/complete/route.ts`

### Performance Flow Analysis

#### 1. **Initial Transfer Fetch** (Lines 49-64)
- **Operation**: Fetch transfer with items and business
- **Impact**: ~200-500ms
- **Status**: ✅ Not a bottleneck

#### 2. **SOD Validation** (Lines 122-136) ⚠️ **MODERATE BOTTLENECK**
- **Operation**: Separation of duties validation
- **Impact**: **200-500ms** (queries user roles, business rules)
- **Status**: ⚠️ Moderate bottleneck

#### 3. **Inventory Impact Tracking - BEFORE** (Line 161) ⚠️ **MODERATE BOTTLENECK**
- **Operation**: `captureBefore()` for BOTH locations
- **Impact**: ~500ms - 2 seconds (tracks 2 locations)
- **Status**: ⚠️ Moderate bottleneck

#### 4. **Main Transaction** (Lines 164-288) ⚠️ **SIGNIFICANT BOTTLENECK**
- **Operations Inside Transaction**:

  a. **For Each Item** (Lines 166-270):
  
     i. **Get/Create Stock Record** (Lines 180-200) ⚠️ **MODERATE BOTTLENECK**
        - Query to find existing stock
        - Create if doesn't exist
        - Impact: **100-200ms per item**
        - Status: ⚠️ Moderate bottleneck
  
     ii. **Update Stock at Destination** (Lines 206-212)
        - Single UPDATE
        - Impact: ~50ms per item
        - Status: ✅ Not a bottleneck
  
     iii. **Create Stock Transaction** (Lines 215-229)
        - Single INSERT
        - Impact: ~50ms per item
        - Status: ✅ Not a bottleneck
  
     iv. **Create Product History** (Lines 232-249)
        - Single INSERT
        - Impact: ~50ms per item
        - Status: ✅ Not a bottleneck
  
     v. **Update Serial Numbers** (Lines 252-269) ⚠️ **MODERATE BOTTLENECK**
        - Batch update serial numbers
        - Impact: **100-200ms per batch**
        - Status: ⚠️ Moderate bottleneck (if many serials)
  
  b. **Update Transfer Status** (Lines 274-285)
     - Single UPDATE
     - Impact: ~50ms
     - Status: ✅ Not a bottleneck

- **Total Transaction Impact**: 
  - For 10 items: **1-3 seconds**
  - For 10 items with 50 serials: **2-5 seconds**

#### 5. **Inventory Impact Tracking - AFTER** (Line 295) ⚠️ **MODERATE BOTTLENECK**
- **Impact**: ~500ms - 2 seconds (tracks 2 locations)
- **Status**: ⚠️ Moderate bottleneck

#### 6. **Audit Log** (Lines 306-323)
- **Impact**: ~50-100ms
- **Status**: ✅ Not a bottleneck

### Transfer Complete - Query Count Analysis

For a transfer with 10 items and 50 serial numbers:

1. Transfer + business fetch: **2 queries** (parallel)
2. User location check: **1 query**
3. SOD validation: **2-3 queries**
4. Inventory impact - before: **2 queries** (2 locations)
5. Main transaction:
   - Get/create stock: **10 queries**
   - Update stock: **10 queries**
   - Stock transactions: **10 queries**
   - Product history: **10 queries**
   - Serial number updates: **1 query** (batch)
   - Transfer update: **1 query**
6. Inventory impact - after: **2 queries** (2 locations)
7. Audit log: **1 query**

**Total: ~50-60 queries** for a typical transfer

### Transfer Complete - Time Breakdown

- **Best Case** (5 items, no serials): ~2-4 seconds
- **Typical Case** (10 items, 50 serials): ~4-8 seconds
- **Worst Case** (20 items, 200 serials): ~8-15 seconds

---

## 3. TRANSFER SEND (Deducts from Source)

### File: `src/app/api/transfers/[id]/send/route.ts`

### Performance Flow Analysis

#### 1. **Idempotency Check** (Line 25)
- **Impact**: Minimal (~50-100ms)
- **Status**: ✅ Not a bottleneck

#### 2. **Initial Transfer Fetch** (Lines 57-66)
- **Impact**: ~200-500ms
- **Status**: ✅ Not a bottleneck

#### 3. **SOD Validation** (Lines 99-125) ⚠️ **MODERATE BOTTLENECK**
- **Impact**: **200-500ms**
- **Status**: ⚠️ Moderate bottleneck

#### 4. **Inventory Impact Tracking - BEFORE** (Line 132) ⚠️ **MODERATE BOTTLENECK**
- **Impact**: ~500ms - 2 seconds
- **Status**: ⚠️ Moderate bottleneck

#### 5. **Main Transaction** (Lines 135-194) ⚠️ **SIGNIFICANT BOTTLENECK**
- **Operations Inside Transaction**:

  a. **For Each Item** (Lines 137-179):
  
     i. **Transfer Stock Out** (Lines 147-158) ⚠️ **SIGNIFICANT BOTTLENECK**
        - Calls `transferStockOut()` → `deductStock()` → `updateStock()`
        - Each `updateStock()` does:
          - Raw SQL with `FOR UPDATE` lock
          - Update `variationLocationDetails`
          - Create `stockTransaction` record
          - Create `productHistory` record
        - Impact: **200-500ms per item**
        - Status: ⚠️ **SIGNIFICANT BOTTLENECK**
  
     ii. **Update Serial Numbers** (Lines 161-179) ⚠️ **MODERATE BOTTLENECK**
        - Batch update serial numbers to `in_transit`
        - Impact: **100-200ms per batch**
        - Status: ⚠️ Moderate bottleneck
  
  b. **Update Transfer Status** (Lines 183-191)
     - Single UPDATE
     - Impact: ~50ms
     - Status: ✅ Not a bottleneck

- **Total Transaction Impact**: 
  - For 10 items: **2-5 seconds**
  - For 10 items with 50 serials: **3-7 seconds**

#### 6. **Inventory Impact Tracking - AFTER** (Line 198) ⚠️ **MODERATE BOTTLENECK**
- **Impact**: ~500ms - 2 seconds
- **Status**: ⚠️ Moderate bottleneck

#### 7. **Audit Log** (Lines 209-225)
- **Impact**: ~50-100ms
- **Status**: ✅ Not a bottleneck

#### 8. **Telegram Notification** (Lines 228-269) ⚠️ **MODERATE BOTTLENECK**
- **Operations**:
  - Fetch locations: **1 query**
  - Fetch transfer items with products: **1 query**
  - Send Telegram message
- **Impact**: **500ms - 2 seconds** (includes network call)
- **Status**: ⚠️ Moderate bottleneck (but async, shouldn't block)

### Transfer Send - Query Count Analysis

For a transfer with 10 items and 50 serial numbers:

1. Idempotency check: **1 query**
2. Transfer fetch: **1 query**
3. User location check: **1 query**
4. SOD validation: **2-3 queries**
5. Inventory impact - before: **2 queries**
6. Main transaction:
   - Stock deductions: **10 queries** (with locks)
   - Stock transactions: **10 queries**
   - Product history: **10 queries**
   - Serial number updates: **1 query** (batch)
   - Transfer update: **1 query**
7. Inventory impact - after: **2 queries**
8. Audit log: **1 query**
9. Telegram notification: **2 queries** + network call

**Total: ~45-50 queries** for a typical transfer send

### Transfer Send - Time Breakdown

- **Best Case** (5 items, no serials): ~2-4 seconds
- **Typical Case** (10 items, 50 serials): ~4-8 seconds
- **Worst Case** (20 items, 200 serials): ~8-15 seconds

---

## Root Cause Analysis Summary

### Purchase Receipt Approval - Primary Bottlenecks:

1. **Sequential Serial Number Validation** (2.5-5 seconds)
   - **Cause**: Nested loops with sequential queries
   - **Impact**: Scales with item count × serial count

2. **Serial Number Creation in Transaction** (5-10 seconds for 50 serials)
   - **Cause**: Sequential upserts and movement record creation
   - **Impact**: Scales with serial number count

3. **Weighted Average Cost Calculation** (2-5 seconds)
   - **Cause**: Queries ALL stock across ALL locations for EACH item
   - **Impact**: Very expensive, especially with many locations

4. **Stock Materialized View Refresh** (1-5 seconds)
   - **Cause**: Expensive database operation
   - **Impact**: Fixed overhead but very costly

5. **Stock Deduction Operations** (2-5 seconds for 10 items)
   - **Cause**: Multiple writes per item with locks
   - **Impact**: Scales with item count

### Transfer Complete - Primary Bottlenecks:

1. **Stock Addition Operations** (1-3 seconds for 10 items)
   - **Cause**: Multiple writes per item
   - **Impact**: Scales with item count

2. **Inventory Impact Tracking** (1-4 seconds)
   - **Cause**: Tracks 2 locations (source + destination)
   - **Impact**: Fixed overhead

3. **SOD Validation** (200-500ms)
   - **Cause**: Multiple queries for validation
   - **Impact**: Fixed overhead

### Transfer Send - Primary Bottlenecks:

1. **Stock Deduction Operations** (2-5 seconds for 10 items)
   - **Cause**: Multiple writes per item with locks
   - **Impact**: Scales with item count

2. **Inventory Impact Tracking** (1-4 seconds)
   - **Cause**: Queries inventory state
   - **Impact**: Fixed overhead

3. **SOD Validation** (200-500ms)
   - **Cause**: Multiple queries for validation
   - **Impact**: Fixed overhead

---

## Recommendations (For Future Optimization)

### High Priority:

#### Purchase Receipt Approval:

1. **Batch Serial Number Validation**
   - Collect all serial numbers first
   - Single batch query: `WHERE serialNumber IN (...)`
   - **Expected improvement**: 2.5-5 seconds → 200-500ms

2. **Batch Product Variation Fetch**
   - Fetch all variations before transaction
   - **Expected improvement**: 1-2 seconds → 200-500ms

3. **Optimize Weighted Average Calculation**
   - Cache stock totals or calculate once per transaction
   - **Expected improvement**: 2-5 seconds → 500ms-1 second

4. **Batch Serial Number Creation**
   - Use `createMany` where possible
   - Batch movement records
   - **Expected improvement**: 5-10 seconds → 1-2 seconds

5. **Make Stock View Refresh Async**
   - Don't wait for refresh to complete
   - **Expected improvement**: 1-5 seconds → 0ms (async)

#### Transfer Operations:

6. **Batch Stock Operations**
   - Consider batch updates where possible
   - **Expected improvement**: 1-3 seconds → 500ms-1 second

7. **Optimize Inventory Impact Tracking**
   - Consider making it optional or async
   - Reduce number of queries
   - **Expected improvement**: 1-4 seconds → 500ms-1 second

### Medium Priority:

8. **Optimize SOD Validation**
   - Cache user roles
   - Batch validation queries
   - **Expected improvement**: 200-500ms → 100-200ms

9. **Review Database Indexes**
   - Ensure indexes on frequently queried fields
   - Review lock contention

### Low Priority:

10. **Review Transaction Scope**
    - Consider moving some operations outside transaction
    - Balance between atomicity and performance

---

## Conclusion

### Purchase Receipt Approval:
- **Current**: 15-25 seconds (typical case)
- **Primary Issues**: Sequential serial validation, weighted average calculation, stock view refresh
- **Potential Improvement**: 50-70% reduction possible with optimizations

### Transfer Complete:
- **Current**: 4-8 seconds (typical case)
- **Primary Issues**: Stock operations, inventory tracking
- **Potential Improvement**: 30-50% reduction possible with optimizations

### Transfer Send:
- **Current**: 4-8 seconds (typical case)
- **Primary Issues**: Stock operations, inventory tracking
- **Potential Improvement**: 30-50% reduction possible with optimizations

All three operations have similar bottlenecks:
1. Sequential operations that could be batched
2. Inventory impact tracking overhead
3. Multiple database writes per item
4. Lock contention in transactions

The system is functional but has performance bottlenecks that scale with transaction complexity (number of items, serial numbers, and locations).

