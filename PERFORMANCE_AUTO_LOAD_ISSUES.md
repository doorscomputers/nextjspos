# Performance Investigation: Auto-Load Issues

**Date:** January 26, 2025
**Issue:** Multiple dashboard pages auto-loading expensive queries on mount, causing slow performance

## Executive Summary

Found **11 pages** with critical auto-load performance issues that make the app feel slow despite being built with React. These pages execute expensive database queries immediately on page open without user interaction.

### Impact:
- **User Experience:** Pages appear to "hang" or show endless spinners
- **Database Load:** Unnecessary queries running every time user navigates
- **Network Traffic:** Large payloads loaded without user request
- **React Performance:** Defeats the purpose of React's efficiency

---

## Critical Priority (Fix Immediately) - P1

### 1. **Inventory Corrections Report** - CRITICAL ⚠️
**File:** `src/app/dashboard/reports/inventory-corrections/page.tsx`
**Line:** 85-87
**Issue:** Loads ALL 10,000 correction records on page open
**Current Behavior:**
```typescript
useEffect(() => {
  fetchCorrections() // Fetches 10,000 records!
}, [])
```
**Fix:** Add "Generate Report" button; implement pagination
**Impact:** Highest - Loading 10k records on every page visit

---

### 2. **Purchases List Page** - CRITICAL ⚠️
**File:** `src/app/dashboard/purchases/page.tsx`
**Line:** 78-80
**Issue:** Loads all purchases with nested details on mount
**API:** `/api/purchases?includeDetails=true`
**Current Behavior:**
```typescript
useEffect(() => {
  fetchPurchases() // Loads ALL purchases + receipts + items
}, [])
```
**Fix:** Implement lazy-load pagination; defer details until row expand
**Impact:** High - Includes nested relationships increases payload size

---

### 3. **Analytics Dashboard V2** - CRITICAL ⚠️
**File:** `src/app/dashboard/dashboard-v2/page.tsx`
**Line:** 104+
**Issue:** Heavy analytics query with thousands of data points
**API:** `/api/dashboard/analytics`
**Current Behavior:** Loads sales data, inventory data, pivot grids on mount
**Fix:** Load summary metrics only; add "Refresh Data" button for detailed pivot
**Impact:** High - Complex queries with date range calculations

---

### 4. **Historical Inventory Report** - HIGH 🔥
**File:** `src/app/dashboard/reports/historical-inventory/page.tsx`
**Line:** 99-107
**Issue:** Auto-generates report with 50+ items on mount
**Current Behavior:**
```typescript
useEffect(() => {
  fetchLocations()
  generateReport(1) // Auto-generate on mount!
}, [])
```
**Fix:** Remove `generateReport(1)` from useEffect; require button click
**Impact:** High - Complex inventory calculations at specific datetime

---

### 5. **Profit/Loss Report** - HIGH 🔥
**File:** `src/app/dashboard/reports/profit-loss/page.tsx`
**Line:** 129-131
**Issue:** Executes expensive financial calculations on mount
**Current Behavior:**
```typescript
useEffect(() => {
  fetchReport() // Complex financial calculations
}, [])
```
**Fix:** Add "Generate Report" button; wait for user to finalize date range
**Impact:** High - Financial aggregations across all transactions

---

## Medium Priority - P2

### 6. **Branch Stock Pivot** - MEDIUM
**File:** `src/app/dashboard/products/branch-stock-pivot/page.tsx`
**Line:** 255-257
**Issue:** Triggers on filter changes without debounce
**Fix:** Add "Apply Filters" button; implement debounce
**Impact:** Medium - Has pagination but still fetches on every filter change

### 7. **Sales Report** - MEDIUM
**File:** `src/app/dashboard/reports/sales-report/page.tsx`
**Line:** 121-123
**Issue:** Auto-loads when page state changes
**Fix:** Add "Search" button; don't auto-fetch on initial mount
**Impact:** Medium - 50 records default but unnecessary on mount

### 8. **Sales Today Report** - MEDIUM
**File:** `src/app/dashboard/reports/sales-today/page.tsx`
**Line:** 119-121
**Issue:** Auto-loads when location changes
**Fix:** Add "Refresh" button
**Impact:** Medium - Today's sales can be large in busy locations

### 9. **Customers List** - MEDIUM
**File:** `src/app/dashboard/customers/page.tsx`
**Line:** 45-47
**Issue:** Loads all customers on mount (no pagination)
**Fix:** Implement pagination
**Impact:** Medium - Grows over time

### 10. **Audit Trail** - MEDIUM
**File:** `src/app/dashboard/reports/audit-trail/page.tsx`
**Issue:** Security logs can be extensive
**Fix:** Require date range selection before loading
**Impact:** Medium - Security audit logs grow continuously

---

## Already Fixed (Good Pattern) ✅

### **Stock History V2** - FIXED ✅
**File:** `src/app/dashboard/reports/stock-history-v2/page.tsx`
**Status:** Auto-load removed with explicit comment (Lines 124-130)
**Pattern:**
```typescript
// REMOVED: Auto-load on selection change (was causing performance issues)
// Now user must click "Generate Report" button to load data
```
**This is the correct pattern all report pages should follow!**

---

## Recommended Fix Pattern

### Before (Bad - Auto-Load):
```typescript
useEffect(() => {
  if (selectedProduct && selectedLocation) {
    fetchStockHistory() // ❌ Runs automatically!
  }
}, [selectedProduct, selectedLocation, startDate, endDate])
```

### After (Good - Manual Trigger):
```typescript
// ✅ Removed auto-load
// User must click "Generate Report" button

const handleGenerateReport = () => {
  if (!selectedProduct || !selectedLocation) {
    toast.error('Please select product and location')
    return
  }
  fetchStockHistory()
}

<Button onClick={handleGenerateReport} disabled={loading}>
  {loading ? 'Generating...' : 'Generate Report'}
</Button>
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)
1. **Inventory Corrections** - Add pagination + manual trigger
2. **Purchases List** - Implement lazy-load pagination
3. **Analytics Dashboard** - Defer heavy queries
4. **Historical Inventory** - Remove auto-generate
5. **Profit/Loss** - Add manual trigger

### Phase 2: Medium Fixes (Week 2)
6. **Branch Stock Pivot** - Add "Apply Filters" button
7. **Sales Report** - Add "Search" button
8. **Sales Today** - Add "Refresh" button
9. **Customers List** - Implement pagination
10. **Audit Trail** - Require date range

### Phase 3: Testing (Week 3)
- Performance benchmarking
- User acceptance testing
- Load time comparisons

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Page Load | 3-5s | <500ms | 6-10x faster |
| Navigation Speed | Slow (data fetching) | Instant | Immediate |
| Database Load | Continuous queries | On-demand only | 80% reduction |
| User Experience | Frustrating waits | Responsive | Professional |

---

## Best Practices Going Forward

1. ✅ **Never auto-load expensive queries** on page mount
2. ✅ **Always require user action** for reports (button click)
3. ✅ **Implement pagination** for list pages
4. ✅ **Debounce filter inputs** (300-500ms delay)
5. ✅ **Show loading states clearly** with spinners + text
6. ✅ **Load metadata only** on mount (locations, categories, etc.)
7. ✅ **Defer heavy calculations** until user finalizes filters

---

## Next Steps

**Immediate Action Required:**
- [ ] Fix Critical Priority pages (P1) - 5 pages
- [ ] Test performance improvements
- [ ] Deploy to staging for user testing
- [ ] Fix Medium Priority pages (P2) - 5 pages
- [ ] Document performance gains

**User Communication:**
- Explain to users that reports now require clicking "Generate Report"
- Emphasize the massive performance improvement
- Provide training on new workflow
