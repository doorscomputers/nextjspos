# Fix Dashboard Timezone Issue - December 2, 2025

## Problem
The dashboard "Sales by Location" section is showing yesterday's sales (December 1) instead of today's sales (December 2) because the server (Vercel) runs in UTC timezone while the business operates in Philippine Time (UTC+8).

## Root Cause
In `src/app/api/dashboard/sales-by-location/route.ts`, the date calculation uses `new Date()` which returns server time (UTC). When it's December 2 at 8:00 AM in Manila, it's still December 1 at 12:00 AM (midnight) in UTC.

## Solution
Convert to Philippine Time (Asia/Manila, UTC+8) before calculating the start date.

## Tasks
- [x] Identify root cause in sales-by-location API route
- [x] Fix timezone calculation in API route
- [x] Commit and push changes

## Review
Fixed the timezone issue in `src/app/api/dashboard/sales-by-location/route.ts`:

1. Added Philippine Time offset calculation (UTC+8)
2. Converted server UTC time to Philippine Time before extracting date components
3. Created proper UTC timestamps that represent Philippine midnight when filtering sales data

The fix ensures that when filtering sales for "today" in Philippine Time, the query uses the correct date boundaries regardless of the server's timezone.

### Changes Made
- `src/app/api/dashboard/sales-by-location/route.ts`:
  - Added Philippine timezone offset calculation
  - Modified `now` variable to represent current time in Philippine Time
  - Updated all `startDate` calculations to use UTC dates adjusted for Philippine timezone
  - Added debug logging to help verify the fix in production
