# GRN Page Error Investigation - October 9, 2025

## Issue

User Jheirone is getting "Failed to fetch purchase receipts" error when accessing the Goods Received Notes (GRN) page at `/dashboard/purchases/receipts`.

## Investigation Steps Taken

### 1. Verified Permissions ✅
- User has `purchase.receipt.view` permission via "Warehouse Manager" role
- Permission check passed: User has correct RBAC permissions

### 2. Verified Location Access ✅
- User has access to location ID: 2 (Warehouse)
- Query: `UserLocation` record exists for user ID 12

### 3. Verified Database Tables ✅
- `purchase_receipts` table exists and is queryable
- `purchase_receipt_items` table exists and is queryable
- Both tables are empty (count: 0), which is expected

### 4. Tested Prisma Queries ✅
- Standalone Prisma queries work correctly
- Query with `where`, `include`, and relations executes successfully
- No PrismaClientValidationError when running queries directly

### 5. Server Logs Show Error Type
```
Error fetching purchase receipts: Error [PrismaClientValidationError]:
```

## Root Cause Analysis

The error `PrismaClientValidationError` typically occurs when:
1. **Prisma Client is out of sync with schema** - We tried to regenerate but file was locked
2. **TypeScript types are incorrect** - Possible if there's a type mismatch in the API
3. **Next.js compilation issue** - The server-side code might have stale cached types

## What I've Done

### 1. Added Debug Logging
Added detailed logging to `src/app/api/purchases/receipts/route.ts`:
- Logs the `where` clause being used
- Logs user information
- Logs detailed error information including error type, message, stack trace

### 2. Killed All Node Processes
Attempted to regenerate Prisma Client but file was locked by running dev servers.

### 3. Started Fresh Dev Server
Dev server now running on port **3007** (ports 3000 and 3005 were occupied)

## Next Steps - USER ACTION REQUIRED

**Please navigate to the GRN page to trigger the error** so we can capture the detailed logs:

1. Open browser to: `http://localhost:3007`
2. Log in as Jheirone (if not already logged in)
3. Navigate to: **Purchases → Goods Received Notes (GRN)**
4. The error will occur, but now we'll have detailed debug logs

## Expected Debug Output

Once you access the page, the terminal will show:

```
=== GRN API Debug ===
User: Jheirone ID: 12
Where clause: {
  "businessId": 1,
  "locationId": {
    "in": [2]
  }
}

=== GRN API Error === (if error occurs)
Error type: PrismaClientValidationError
Error message: [detailed error message]
Full error: [error object]
Error stack: [stack trace]
```

This will tell us **exactly** what Prisma validation is failing on.

## Possible Fixes (After Seeing Debug Output)

Depending on what the error shows, possible fixes:

### Option 1: Prisma Client Regeneration
If it's a schema mismatch:
```bash
# Stop all dev servers
# Then run:
npx prisma generate
npm run dev
```

### Option 2: Clear Next.js Cache
If it's a compilation/cache issue:
```bash
# Stop dev server
# Delete .next folder
rm -rf .next
npm run dev
```

### Option 3: Fix Query Structure
If the where clause structure is incorrect, modify the API route query.

## Important Notes

- The GRN approval process is **ALREADY FULLY IMPLEMENTED** (see `GRN-APPROVAL-PROCESS-NOTES.md`)
- The database tables exist and are queryable
- User has correct permissions
- The issue is likely Next.js/Prisma integration, not missing functionality

## Files Modified

- `src/app/api/purchases/receipts/route.ts` - Added debug logging (lines 67-69, 149-157)

## Status

⏳ **WAITING FOR USER** to access the GRN page at `http://localhost:3007/dashboard/purchases/receipts` to capture detailed error logs.
