# Dashboard Values Audit — Investigation Report

**Date:** 2026-04-21
**Scope:** Compare & reconcile KPI values across 5 dashboards at pcinet.shop

## Observed Values (from screenshots)

| Metric | Main `/dashboard` (This Year) | V2 `/dashboard-v2` | V3 `/dashboard-v3` | Analytics DevExtreme (Apr 1-21) | V4 `/dashboard-v4` (Jan 1-Apr 21) |
|---|---|---|---|---|---|
| Sales/Revenue | Net 50.08M / Gross 50.98M | Revenue 11.17M | Revenue 13.41M | Sales 10.97M | — |
| Profit | — | 2.04M | 2.08M (3 decimals!) | 1.68M | — |
| Transactions | — | 1,000 (labeled "Total Sales") | 1,435 | — | — |
| Inventory/Stock Value | — | **₱23.56 TRILLION** | ₱69.76M | — | **₱23.56 TRILLION** |
| Stock Items | — | 60,491 | — | — | — |
| Invoice Due / Receivables | 6.37M | — | — | — | 49.36M |
| Total Purchase | 38.80M | — | — | 345K | 38.80M (as "Payables") |
| Purchase Due / Payables | 64.24M | — | — | — | 38.80M |
| Return (sell) | 98,146 | — | — | — | — |
| Return (supplier) | 296,950 | — | — | — | — |

---

## Root Cause Findings

### 🔴 BUG 1 — Stock Value = ₱23 TRILLION (CRITICAL)

**Affected:** V2 and V4 both show ~₱23,556,000,000,000

**Files:**
- `src/app/api/dashboard/analytics/route.ts:385-410,467` (V2)
- `src/app/api/dashboard/financial-v4/route.ts:215-253` (V4)

**Code pattern:**
```ts
// V2 — line 410
stockValue: Number(inv.qtyAvailable) * Number(inv.sellingPrice || ...)
// then summed without dedup:
totalStockValue: inventoryMetrics.reduce((sum, item) => sum + item.stockValue, 0)

// V4 — line ~240
const totalAvailableValue = availableInventory.reduce((sum, item) => {
  const qty  = parseFloat(item.qtyAvailable.toString())
  const price = parseFloat(item.sellingPrice?.toString() || '0')
  return sum + (qty * price)
}, 0)
```

**Root cause:** Both endpoints query `variationLocationDetails` (one row per variation × location). For a business with 4 locations and 60k+ variations there is massive row duplication. Also valued at **selling price**, not cost. Inflation compounds: duplicates × selling-price markup → trillions.

**Why V3 shows ₱69.76M (correct):** V3's `/api/dashboard/intelligence-optimized` uses **purchase price** and appears to deduplicate by variation — this is the trustworthy inventory-at-cost figure.

### 🟠 BUG 2 — "Total Sales: 1,000" mislabeled

**File:** `src/app/api/dashboard/analytics/route.ts:235-238,467`

`totalSales` field is actually `prisma.sale.count()` (transaction count), not a peso amount. Label must say **"Total Transactions"**.

### 🟠 BUG 3 — V3 displays 3 decimal places (₱2,080,304.**495**, ₱9,341.**808**)

**File:** `src/app/dashboard/dashboard-v3/page.tsx` (DevExtreme cells)

Raw floating-point values returned by API; DevExtreme default formatter prints full precision. Column format `₱#,##0.00` is set for grid columns but not for the KPI cards. **Fix:** force `.toFixed(2)` + `Intl.NumberFormat('en-PH', {minimumFractionDigits:2, maximumFractionDigits:2})` on KPI card rendering.

### 🟠 BUG 4 — V4 Receivables (49.36M) ≠ Main Invoice Due (6.37M)

**File:** `src/app/api/dashboard/financial-v4/route.ts:164-190`

V4 sums the **full `sale.totalAmount`** of any sale in the date range where a positive payment exists (into `receivablesPaid`), then adds `receivablesUnpaid`. The UI labels the combined figure "Receivables," but main dashboard's "Invoice Due" shows **only outstanding** (`totalAmount − paidAmount` for non-cancelled sales, no date filter).

- Main: `Σ (total − paid)` where status NOT IN (cancelled, voided) → outstanding AR
- V4: paid + unpaid within date range → total invoiced

**Fix:** Either relabel V4 card as "Total Invoiced (Period)" or change formula to outstanding-only to match main.

### 🟠 BUG 5 — V4 Payables (38.80M) mislabeled

**File:** `src/app/api/dashboard/financial-v4/route.ts:193-210`

V4 sums `balanceAmount + paidAmount` from `accountsPayable` in date range → this equals **total purchases in the period** (38.80M exactly matches main's "Total Purchase"). It is NOT payables outstanding.

- Main "Purchase Due" (64.24M) = `accountsPayable.balanceAmount` where `paymentStatus IN ('unpaid','partial','overdue')` — no date filter → correct A/P outstanding
- V4 "Payables" = total purchase volume in period → mislabeled

**Fix:** Filter V4 by `paymentStatus IN ('unpaid','partial','overdue')` and drop `invoiceDate` filter, or relabel to "Total Purchases (Period)".

### 🟠 BUG 6 — Analytics DevExtreme Purchases 345K looks implausibly low

**File:** `src/app/api/dashboard/intelligence/route.ts:~260`

Sums `accountsPayable.totalAmount` for date range Apr 1–21. If most purchases were made before Apr 1 or the endpoint accidentally filters by `paymentStatus = 'paid'`/due-date, the total will undercount. Needs verification — confirm same table (`accountsPayable`) and same date field as main dashboard.

### 🟡 NOTE 7 — Sales/Revenue values differ because of date ranges AND different source tables

| Dashboard | Date range | Source |
|---|---|---|
| Main | Jan 1 → today (This Year) | `sale.totalAmount` |
| V2 | **all time** (empty default) | `saleItem.unitPrice × qty` via analytics |
| V3 | last 30 days (API default) | `intelligence-optimized` |
| Analytics DevExtreme | last ~1 month | `intelligence` |
| V4 | user-selected | `sale.totalAmount` with filter |

The numbers are not directly comparable without aligning the date range and source. UI should show the effective date range on every KPI card.

### ✅ NOT BROKEN
- Tenant (`businessId`) filtering is consistent on all endpoints
- Aging breakdowns on V4 (0-30/31-60/61-90/90+) use correct `today − saleDate/dueDate` logic
- Main dashboard Gross vs Net (subtotal vs totalAmount) is internally correct

---

## Prioritized Fix List

1. **[CRITICAL] Inventory valuation overflow** — Deduplicate `variationLocationDetails` rows (GROUP BY variationId and SUM(qty) per variation, OR honor the user-selected location). Switch to `purchasePrice` for cost valuation. Fix both `analytics/route.ts` and `financial-v4/route.ts`.
2. **[HIGH] V4 Receivables/Payables labels & formulas** — Align with main dashboard definitions OR relabel cards to say "Period Invoiced / Period Purchased".
3. **[HIGH] V2 "Total Sales" label** → rename to "Transactions".
4. **[MED] V3 three-decimal PHP formatting** — enforce 2-decimal format on KPI cards and every `₱` display.
5. **[MED] Show effective date range on every KPI card** (prevents apples-to-oranges confusion).
6. **[LOW] Verify analytics-devextreme purchase total** — confirm no stray `paymentStatus` filter.

## Canonical Metric Definitions (to adopt across all dashboards)

- **Gross Sales:** Σ `sale.totalAmount` where status ∉ (cancelled, voided), in period
- **Net Sales:** Σ `sale.subtotal` same filter
- **A/R Outstanding:** Σ `sale.totalAmount − paidAmount` where status ∉ (cancelled, voided) — **no date filter**
- **A/P Outstanding:** Σ `accountsPayable.balanceAmount` where `paymentStatus ∈ (unpaid,partial,overdue)` — **no date filter**
- **Total Purchases (Period):** Σ `purchase.totalAmount` in period (use `purchase` table, not `accountsPayable`)
- **Inventory Value (at cost):** Σ (current `qtyAvailable` × `purchasePrice`) grouped by variation — per selected location(s)
- **Inventory Value (at retail):** same with `sellingPrice`
- **Transactions:** COUNT(sale) in period, status ∉ (cancelled, voided, draft)

## Review / Next Step

No code changes made. Awaiting your go-ahead to begin fixes, starting with the inventory 23-trillion bug (biggest blast radius). Recommend implementing in this order: 1 → 3 → 2 → 4 → 5 → 6.
