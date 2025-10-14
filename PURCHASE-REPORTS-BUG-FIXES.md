# Purchase Reports - Bug Fixes
**Date:** October 10, 2025
**Issue:** Three reports showing errors on first test

---

## 🐛 Bugs Found During Initial Testing

### Issue #1: Division by Zero - Item Purchase Summary ✅ FIXED
**File:** `src/app/api/reports/purchases/item-summary/route.ts`
**Line:** 106-107

**Problem:**
```typescript
const avgCost = item.costs.reduce((sum, cost) => sum + cost, 0) / item.costs.length
const costVariance = ((item.maxCost - item.minCost) / item.minCost) * 100
```

When `item.costs.length` is 0 or `item.minCost` is 0 or Infinity, this causes `NaN` values which crash the API.

**Fix Applied:**
```typescript
const avgCost = item.costs.length > 0
  ? item.costs.reduce((sum: number, cost: number) => sum + cost, 0) / item.costs.length
  : 0

const costVariance = item.minCost > 0 && item.minCost !== Infinity
  ? ((item.maxCost - item.minCost) / item.minCost) * 100
  : 0
```

**Result:** Now handles empty cost arrays and invalid min cost values gracefully.

---

### Issue #2: Division by Zero - Supplier Purchase Summary ✅ FIXED
**File:** `src/app/api/reports/purchases/supplier-summary/route.ts`
**Line:** 122-124

**Problem:**
```typescript
const avgOrderValue =
  supplier.orderValues.reduce((sum, val) => sum + val, 0) /
  supplier.orderValues.length
```

When `supplier.orderValues.length` is 0, this causes `NaN`.

**Fix Applied:**
```typescript
const avgOrderValue = supplier.orderValues.length > 0
  ? supplier.orderValues.reduce((sum: number, val: number) => sum + val, 0) / supplier.orderValues.length
  : 0
```

**Result:** Now handles suppliers with no orders gracefully.

---

### Issue #3: Webpack Cache Corruption ✅ ROOT CAUSE IDENTIFIED
**Problem:** After applying code fixes, server continues to return 500 errors with message "Internal Server Error" (not JSON).

**Server Logs Show:**
```
[Error: ENOENT: no such file or directory, stat 'C:\xampp\htdocs\ultimatepos-modern\.next\cache\webpack\server-development\4.pack.gz']
[Error: Cannot find module 'C:\xampp\htdocs\ultimatepos-modern\.next\server\middleware-manifest.json']
[Error: ENOENT: no such file or directory, open 'C:\xampp\htdocs\ultimatepos-modern\.next\routes-manifest.json']
```

**Root Cause:**
1. `.next` directory was deleted while server was running
2. Server lost access to critical manifest files mid-execution
3. New compilation created `.next` files, but server references were broken
4. Multiple zombie node processes kept ports occupied

**Solution:**
The correct order should be:
1. **KILL** all node processes FIRST
2. **DELETE** .next directory SECOND
3. **START** server THIRD

We did it backwards (deleted while servers were running).

---

## ✅ Test Results After Fixes

### Code Fixes Applied:
- ✅ Item Purchase Summary - division by zero guards added
- ✅ Supplier Purchase Summary - division by zero guards added
- ✅ Default quarter values fixed in UI pages

### Server State Issue:
- ⏸️ Server needs proper clean restart to apply fixes
- ⏸️ Multiple zombie processes need cleanup
- ⏸️ Fresh `.next` build needed after all processes killed

---

## 🔧 Code Quality Improvements Made

### Safety Checks Added:
1. **Division by zero prevention** in all calculation logic
2. **Infinity value handling** for min/max cost calculations
3. **Empty array handling** for reduce operations
4. **Graceful defaults** (returning 0 instead of NaN)

### Best Practices Applied:
- Guard clauses before divisions
- Proper type annotations for reduce functions
- Consistent error handling patterns
- Clear default values for edge cases

---

## 🚀 Next Steps

1. ✅ **Code fixes applied** - All division by zero issues resolved
2. ⏸️ **Clean server restart needed** - Kill all processes, delete .next, restart fresh
3. ⏸️ **Test with empty database** - Reports should show "No data found" message
4. ⏸️ **Test with sample data** - Create purchase orders to verify calculations
5. ⏸️ **Verify Payment Status Report** - Test independently

---

## 💡 Lessons Learned

### Always guard against:
- Division by zero in financial calculations
- Empty arrays in reduce operations
- Infinity values in min/max calculations
- Missing related records (joins)

### Server restart protocol:
1. Kill all node processes FIRST
2. Delete build cache SECOND
3. Start server THIRD
4. Never delete cache while server is running

### Testing strategy:
- Test with empty database first
- Test with minimal data (1 record)
- Test with full data sets
- Test edge cases (no costs, no payables, etc.)

---

**Document Version:** 1.1
**Status:** Code fixes complete, awaiting clean server restart and validation
**Next Review:** After clean server restart and user confirms reports are working

## 📝 Restart Instructions for User

To properly restart the server and test the fixes:

1. Close any browser tabs accessing localhost:3009 or localhost:3003
2. Open Task Manager (Ctrl+Shift+Esc)
3. Find all "Node.js: Server-side JavaScript" processes
4. End all of them
5. Delete the `.next` folder in the project directory
6. Run `npm run dev`
7. Wait for "Ready in X.Xs" message
8. Test reports at http://localhost:3000 (or whatever port it starts on)
