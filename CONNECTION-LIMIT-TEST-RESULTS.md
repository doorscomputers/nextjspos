# Connection Limit Performance Test Results

## Test Configuration
- Report: Sales Per Item
- Date Range: 2025-11-01 to 2025-11-30
- Database: Supabase PostgreSQL with pgbouncer
- Environment: Vercel Production

## Results

| connection_limit | Load Time | Status | Notes |
|-----------------|-----------|--------|-------|
| 1 | 11s | ❌ Too Slow | Original issue |
| 5 | 6s | ✅ Better | 45% improvement! |
| 10 | ? | ? | Test this next |
| 15 | ? | ? | Test if 10 is good |
| 20 | ? | ? | Test if 15 is good |

## Instructions to Test

1. **Update DATABASE_URL in Vercel:**
   - Go to https://vercel.com/dashboard
   - Settings → Environment Variables
   - Edit DATABASE_URL
   - Change `connection_limit=5` to `connection_limit=10`
   - Save

2. **Redeploy:**
   - Click latest deployment
   - Click "Redeploy"
   - Wait 2 minutes

3. **Test:**
   - Go to https://pcinet.shop/dashboard/reports/sales-per-item
   - Set date range: 2025-11-01 to 2025-11-30
   - Click "Generate Report"
   - **Time how long it takes to load**

4. **Record Result:**
   - Update this table with the load time

5. **Repeat for next value** if performance improves

## Optimal Value

**Best connection_limit found:** ___ (fill in after testing)

**Final DATABASE_URL:**
```
postgresql://postgres.ydytljrzuhvimrtixinw:Mtip12_14T%21@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=___
```

## Other Reports to Test with Optimal Value

After finding the best connection_limit, test these:

- [ ] Sales History - https://pcinet.shop/dashboard/reports/sales-history
- [ ] Sales Per Cashier - https://pcinet.shop/dashboard/reports/sales-per-cashier
- [ ] Dashboard - https://pcinet.shop/dashboard
- [ ] Products-Suppliers - https://pcinet.shop/dashboard/reports/products-suppliers

**Expected:** All should be faster with optimal connection_limit

## Recommendation

Based on Vercel serverless best practices:

- **Low traffic:** `connection_limit=5-10` (what you're testing now)
- **Medium traffic:** `connection_limit=10-15`
- **High traffic:** `connection_limit=20-30`

**Note:** Supabase pooler can handle multiple connections efficiently. The key is finding the sweet spot between too restrictive (1) and too many (causing connection overhead).

---

**Created:** 2025-11-04
**Status:** Testing in progress
**Current Best:** connection_limit=5 (6 seconds)
