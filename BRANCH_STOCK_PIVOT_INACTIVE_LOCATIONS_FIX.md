# Branch Stock Pivot - Inactive Locations Filter Fix

## Problem Statement

The Branch Stock Pivot pages (both V1 and V2) were displaying ALL business locations as columns in the pivot table, including inactive locations like "FUTURE LOCATION 2" and "FUTURELOCATION". This cluttered the view with locations that should not be shown.

## Root Cause

The API endpoint `/api/products/branch-stock-pivot` was fetching all business locations without filtering by the `isActive` status field.

**Location**: `C:\xampp\htdocs\ultimatepos-modern\src\app\api\products\branch-stock-pivot\route.ts` (Line 203-216)

**Original Code**:
```typescript
const allLocations = await prisma.businessLocation.findMany({
  where: {
    businessId,
    deletedAt: null,
  },
  select: {
    id: true,
    name: true,
  },
  orderBy: {
    name: 'asc',
  },
})
```

## Solution Implemented

### 1. API Route Fix

Added `isActive: true` filter to the location query in the API route.

**File**: `C:\xampp\htdocs\ultimatepos-modern\src\app\api\products\branch-stock-pivot\route.ts`

**Updated Code** (Line 203-216):
```typescript
const allLocations = await prisma.businessLocation.findMany({
  where: {
    businessId,
    deletedAt: null,
    isActive: true,  // ← ADDED: Only fetch active locations
  },
  select: {
    id: true,
    name: true,
  },
  orderBy: {
    name: 'asc',
  },
})
```

### 2. Branch Stock Pivot V2 Client-Side Cleanup

Removed redundant client-side filtering logic since the API now returns only active locations.

**File**: `C:\xampp\htdocs\ultimatepos-modern\src\app\dashboard\products\branch-stock-pivot-v2\page.tsx`

**Before** (Lines 144-148):
```typescript
// Filter out inactive locations and locations with "Future" in the name
const activeLocations = (data.locations || []).filter((loc: LocationColumn) => {
  const isFutureLocation = loc.name.toLowerCase().includes('future')
  return !isFutureLocation
})

setLocations(activeLocations)
```

**After** (Lines 144-145):
```typescript
// API now returns only active locations, so we can use them directly
setLocations(data.locations || [])
```

## Files Modified

1. **C:\xampp\htdocs\ultimatepos-modern\src\app\api\products\branch-stock-pivot\route.ts**
   - Line 207: Added `isActive: true` to location query filter

2. **C:\xampp\htdocs\ultimatepos-modern\src\app\dashboard\products\branch-stock-pivot-v2\page.tsx**
   - Lines 144-145: Simplified location handling (removed redundant client-side filter)

## Database Schema Reference

**Model**: `BusinessLocation` (prisma/schema.prisma, Line 169-183)

```prisma
model BusinessLocation {
  // ... other fields ...
  isActive Boolean @default(true) @map("is_active")
  // ... other fields ...
}
```

## Expected Behavior

### Before Fix
- Branch Stock Pivot V1: Showed ALL locations (active + inactive) as columns
- Branch Stock Pivot V2: Had client-side filter for "future" keyword only
- Result: Inactive locations like "FUTURE LOCATION 2", "FUTURELOCATION" appeared in pivot table

### After Fix
- Both Branch Stock Pivot pages now show ONLY active locations (`isActive = true`)
- Inactive locations are completely hidden from:
  - Column headers
  - Data display
  - Export files (CSV, Excel, PDF)
  - Summary totals
  - Location dropdowns

## Testing Checklist

- [x] API returns only active locations
- [x] Branch Stock Pivot V1 displays only active location columns
- [x] Branch Stock Pivot V2 displays only active location columns
- [x] Inactive locations do NOT appear in any view
- [x] Export functions (CSV, Excel, PDF) exclude inactive locations
- [x] Summary statistics calculate based on active locations only
- [x] Page loads without errors

## How to Verify

1. Navigate to `/dashboard/products/branch-stock-pivot` (V1) or `/dashboard/products/branch-stock-pivot-v2` (V2)
2. Check column headers - should only show active business locations
3. Verify that inactive locations like "FUTURE LOCATION 2" are not visible
4. Export data to verify inactive locations are excluded from exports
5. Check browser console - no errors should be present

## Related Documentation

- `LOCATION_ENABLE_DISABLE_FEATURE.md` - Documents the `isActive` field implementation
- `LOCATION_DROPDOWN_FILTERING_COMPLETE.md` - Shows how location filtering works across the system

## Notes

- The fix is backward compatible - existing data remains unchanged
- All locations default to `isActive: true` when created
- Inactive locations can be toggled via the location management interface
- The fix follows the multi-tenant architecture pattern (filters by `businessId`)
- No database migrations required (schema already had `isActive` field)

---

**Fix Completed**: 2025-10-25
**Tested**: Development environment (localhost:3000)
**Status**: Ready for production deployment
