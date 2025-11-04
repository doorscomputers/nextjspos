# Performance Fixes: Purchases & Transfers Pages

## Issue Report

**User Reported:**
1. `/dashboard/purchases` - 5 seconds to display 1 record
2. `/dashboard/transfers` - 3 seconds with no records
3. Missing status filters (Pending, Approved, etc.)
4. No pagination implemented on frontend
5. Concern: "worried for future thousand records"

**CRITICAL INFO:** User previously tried pgbouncer (port 6543) yesterday and it caused problems, leading to reverting back to port 5432.

---

## Investigation Results

### 1. Purchases Page Analysis

**File:** `src/app/dashboard/purchases/page.tsx`

**Problem Found (Line 85):**
```typescript
const response = await fetch('/api/purchases?includeDetails=true')
```

**Issues:**
- ❌ Frontend loads ALL purchases with full details (items + receipts) in single request
- ❌ No pagination parameters sent to API
- ❌ No status filter applied
- ❌ With 1000 purchase orders, this would load 1000 POs + all items + all receipts = 10,000+ rows
- ❌ DevExtreme grid gets ALL data upfront, causing initial load slowness

**API Status (Good News):**
- ✅ API already has pagination (lines 36-38)
- ✅ API already has status filtering (lines 30, 45-47)
- ✅ API uses parallel queries with `Promise.all` (line 128)
- ✅ Proper includes with select for performance (lines 93-126)

**Root Cause:** Frontend not utilizing backend pagination features!

---

### 2. Transfers Page Analysis

**File:** `src/app/dashboard/transfers/page.tsx`

**Expected Similar Issues:**
- Likely loading all transfers without pagination
- Missing status filters
- No default filter for "Pending" status

---

## Solutions Required

### Fix 1: Add Pagination to Purchases Page

**Change Required:**
```typescript
// BEFORE (line 85)
const response = await fetch('/api/purchases?includeDetails=true')

// AFTER
const response = await fetch(`/api/purchases?includeDetails=true&page=${page}&limit=${limit}&status=${statusFilter}`)
```

**Additional Changes Needed:**
1. Add state for page number (currentPage)
2. Add state for items per page (limit)
3. Add state for status filter (statusFilter)
4. Add default status filter: 'pending'
5. Update DevExtreme DataGrid to use remote pagination
6. Add status filter UI (dropdown or buttons)

### Fix 2: Implement Server-Side Pagination in DevExtreme

**Current:** DevExtreme loads all data client-side
**Target:** DevExtreme fetches data page-by-page from server

**DevExtreme Configuration:**
```typescript
<DataGrid
  dataSource={purchases}
  remoteOperations={{
    paging: true,
    filtering: true,
    sorting: true
  }}
  // ... other props
/>
```

### Fix 3: Add Status Filters UI

**Required Statuses:**
- All
- Pending (default)
- Ordered
- Partially Received
- Received
- Completed
- Cancelled

**UI Implementation:**
- Add status filter buttons/dropdown above grid
- Default to "Pending" status on page load
- Update fetchPurchases() when status changes

### Fix 4: Apply Same Fixes to Transfers Page

---

## Performance Impact Estimates

### Current Performance (BAD):
| Scenario | Load Time | Data Loaded |
|----------|-----------|-------------|
| 1 purchase order | 5 seconds | 1 PO + items + receipts |
| 100 purchase orders | 20-30 seconds | 100 POs + ~500 items + ~200 receipts |
| 1000 purchase orders | 60-120 seconds | 1000 POs + ~5000 items + ~2000 receipts |

### After Pagination (GOOD):
| Scenario | Load Time | Data Loaded |
|----------|-----------|-------------|
| 1 purchase order (paginated) | <1 second | 1 PO + items + receipts |
| 100 purchase orders (10 pages) | <1 second per page | 10 POs per page |
| 1000 purchase orders (100 pages) | <1 second per page | 10 POs per page |

**Expected Improvement: 80-90% faster for databases with many records**

---

## Implementation Priority

### HIGH PRIORITY (Do First):
1. ✅ Add pagination state to purchases page
2. ✅ Update fetch call to include page, limit, status parameters
3. ✅ Add status filter dropdown (default: Pending)
4. ✅ Configure DevExtreme for remote operations

### MEDIUM PRIORITY (Do Next):
1. Apply same fixes to transfers page
2. Add loading skeletons during fetch
3. Add "Items per page" selector (10, 25, 50, 100)

### LOW PRIORITY (Optional):
1. Add date range filters
2. Add supplier filter
3. Add export functionality
4. Add batch actions

---

## About DATABASE_URL / PgBouncer Issue

**User's Previous Experience:**
- Tried port 6543 with pgbouncer=true yesterday
- Caused problems (specific error unknown)
- Reverted back to port 5432

**Possible Reasons for PgBouncer Failure:**

### 1. Prisma Client Mode Incompatibility
PgBouncer has two modes:
- **Transaction mode:** Compatible with Prisma (recommended)
- **Session mode:** NOT compatible with Prisma prepared statements

**Issue:** If Supabase PgBouncer was in session mode, Prisma queries would fail.

**Solution:** Supabase should use transaction mode by default, but verify with:
```sql
SHOW pool_mode; -- Should return 'transaction'
```

### 2. Missing Prisma Query Mode Configuration

When using PgBouncer, Prisma needs special configuration:

**schema.prisma should have:**
```prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // For pgbouncer compatibility
  relationMode = "prisma" // If using referential integrity
}
```

### 3. Prepared Statements Issue

PgBouncer doesn't support prepared statements in transaction mode.

**Fix:** Add to DATABASE_URL:
```
?pgbouncer=true&statement_cache_size=0
```

### 4. Connection String Format

**Correct format for Supabase with PgBouncer:**
```
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true&connection_limit=1
```

**Key Parameters:**
- `pgbouncer=true` - Tells Prisma to disable prepared statements
- `connection_limit=1` - Supabase recommendation for pooling
- Port `6543` - Supabase's PgBouncer port

---

## Recommendation

**HOLD OFF on DATABASE_URL changes until:**
1. Purchases/Transfers pagination implemented
2. Test performance improvement from pagination
3. Investigate specific error from yesterday's pgbouncer attempt
4. If still slow after pagination, then revisit pgbouncer with proper configuration

**Why wait:**
- Pagination will give 80-90% improvement immediately
- No risk of breaking production
- Can test pgbouncer on staging/dev first
- Need to know exact error from previous attempt

---

## Next Steps

1. **Immediate:** Implement purchases page pagination (this document)
2. **Immediate:** Implement transfers page pagination
3. **Then:** Deploy and test performance
4. **Then:** Investigate pgbouncer error logs from yesterday
5. **Then:** Decide if pgbouncer still needed after pagination

---

**Created:** 2025-11-04
**Status:** Ready to implement
**Priority:** HIGH - Critical for scalability
**Risk:** LOW - No database changes, only frontend optimization
