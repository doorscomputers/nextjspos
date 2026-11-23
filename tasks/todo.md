# Block login outside office hours (2026-11-17) — PLAN, waiting for owner approval

## Findings (live DB, read-only)
- Feature already exists: `ScheduleLoginConfiguration` + `EmployeeSchedule`, checked in `src/lib/auth.ts:504-587`,
  admin page `src/app/dashboard/settings/schedule-login/page.tsx`.
- Live state: `enforce_schedule_login = false`, **0 employee schedules**. Turning it on today would lock out
  every non-exempt user ("not scheduled to work on ...").
- **Timezone bug**: the check uses `now.getDay()` / `setHours()` = server time. Vercel runs UTC, so a
  7:00–18:00 schedule would be enforced as 3:00 PM–2:00 AM Philippine time. Must be fixed before enabling.
- Sessions last 8 hours (`auth.ts:74`), so a 6:55 PM login keeps working until ~3 AM. Login-only block is not enough.
- Pattern (past year): all branches open ~7–8 AM, last logins ~5–6 PM, 7 days a week.
- After-hours report: 530 entries, 18 users (report published as private artifact).

## Owner decision
- No automatic logout at 7 PM (overtime is allowed). Hard limit is **9:00 PM**: login allowed
  6:30 AM – 9:00 PM every day; after 9:00 PM the session ends. Only Super Admin is exempt.
- Done with existing settings: schedule 07:00–20:00 + early grace 30 min (6:30) + late grace 60 min (21:00).

## Plan
- [x] Fix timezone in the schedule check: Philippine time = UTC+8 (no daylight saving), so use
      `Date.now() + 8h` with `getUTC*()`. Small change inside `auth.ts` only.
- [x] End open sessions at the same limit: at login store `sessionEndsAt` (today 9:00 PM PH) in the JWT;
      the `jwt` callback throws once it passes. Verified in next-auth 4.24.11 `core/routes/session.js`:
      a throw clears the cookie and `getServerSession` returns null. Middleware also redirects /dashboard.
- [x] Data (no schema change): insert `employee_schedules` 07:00–20:00, all 7 days, for the 48 active
      non-Super-Admin users (7 all-branch users without a location → Main Warehouse, label only).
      Attendance table is unused (0 rows), so no "late" side effects.
- [x] Type-check (0 new errors; 2 pre-existing at auth.ts:416/458), time-math test, commit + push.
- [x] Turn on `enforce_schedule_login` on live — done 2026-11-17 1:10 PM PH, after production deploy
      0dcbccd9 was READY. 0 active non-exempt users without a schedule.

## Review
- `src/lib/auth.ts`: schedule check now reads PH day/time; allowed window = start − early grace to
  end + late grace (6:30 AM–9:00 PM); `sessionEndsAt` stored in JWT; `jwt` callback ends the session after it.
- `middleware.ts`: /dashboard also treats a token past `sessionEndsAt` as logged out.
- No change for Super Admin / exempt roles, or while `enforce_schedule_login` is off (no limit set).
- Data: 336 rows in `employee_schedules` (48 users × 7 days). Attendance unused, so no side effects.
- Deployed: branch `tier2-security-fixes` 961aa8e1, production `master` 0dcbccd9 (cherry-pick).
- New users must get a schedule on Dashboard → Schedules, or they cannot log in once enforcement is on.
- To undo instantly: set `enforce_schedule_login = false` (Settings → Schedule Login).

---

# Stock pages showing old quantities (2026-11-11)

All Branch Stock / Branch Stock Pivot / Pivot V2 read the `stock_pivot_view` snapshot (materialized view).
Sales, transfers and adjustments never refreshed it, so pages lagged until someone clicked Refresh.

- [x] Add `refreshStockViewIfStale()` in `src/lib/refreshStockView.ts` (refresh only when
      `max(variation_location_details.updated_at)` > `max(stock_pivot_view.last_refreshed)`; never throws)
- [x] Call it in `src/app/api/products/stock/route.ts` (All Branch Stock)
- [x] Call it in `src/app/api/products/branch-stock-pivot/route.ts` (Pivot V1 + V2)
- [x] Type-check touched files (0 errors)

## Review
- Root cause: the snapshot is refreshed only by purchase approval, product edits and the manual Refresh button.
  `updateStock` skips refresh inside transactions (all sales/transfers), and its 2-second timer is unreliable on Vercel.
- Fix: the read APIs check staleness (~3 ms query on 9.9k rows) and refresh only when stock changed.
  Checkout/POS code untouched, so no added time on sales.
- Verified on live DB: check returned `stale = true` for a change at 03:40 after a 03:32 refresh. Timezone is UTC on both sides.

---

# Intermittent-internet hardening (2026-11-10)

Investigation found no duplicate sales/stock moves in production data, but these code gaps could still
produce one on a slow or dropping connection. All fixes are minimal and server-side safe.

## Plan
- [x] `vercel.json`: move functions to `sin1` (same region as the Supabase DB) and give every route a
      time limit longer than its own DB transaction (default 30s → 90s; sales 120s; shift close 300s;
      transfers send/complete/receive, exchange, GRN approve, PI imports 150s). Remove entries that would
      now lower a route below the new default.
- [x] `src/lib/idempotency.ts`: run the handler at most once. If recording the result fails, retry the
      record (not the handler) and return the handler's response. Raise stale-key threshold to 180s
      (must exceed the longest idempotent function lifetime, now 150s).
- [x] `src/lib/client/apiClient.ts`: update the comment that references the old 90s threshold.
- [x] `transfers/[id]/cancel` and `transfers/[id]/complete`: atomic status claim inside the transaction
      (a retry can no longer restore/add stock twice). Return 409 when the claim loses.
- [x] `inventory-corrections/[id]/approve` and `bulk-approve`: atomic status claim inside the transaction.
- [x] POS Cash In / Cash Out: send through `apiPost` (60s timeout, Idempotency-Key, retries) instead of
      bare `fetch` with no timeout. No offline queueing for cash movements.
- [x] Verify build (`next build`; `tsc` has ~2,500 pre-existing errors, none on changed lines), commit, push.
- [x] Set `CRON_SECRET` in Vercel (production/preview/development, sensitive). Active from the next deploy.

## Review
- Root cause of the remaining duplicate risk was a mismatch: Vercel killed API functions at 30s while the
  sales transaction alone was allowed 60s (shift close 600s), and the server sat in Virginia talking to a
  Singapore database (~200ms per query). A sale killed after COMMIT but before the idempotency key was
  marked completed could be replayed as a new sale after the stale-key window.
- Fixes keep the existing architecture: time limits now cover every transaction budget, functions run
  next to the database, the idempotency wrapper can no longer run a handler twice, and the four
  unguarded stock-moving routes got the same atomic "claim the status row first" pattern the
  transfer send/receive jobs already use.
- Invariant to keep in future: `STALE_KEY_THRESHOLD_MS` (180s) must stay greater than the largest
  `maxDuration` of any route wrapped in `withIdempotency` (currently 150s).
- Not changed: the client 60s timeout / retry chain (still tops out ~71s, below the 180s threshold).
- Office follow-ups cleared by the owner: back-to-back SERVICE FEE sales are real; HIKSEMI "Enable
  Stock" toggling is deliberate (free items).

---

# Audit: Main Dashboard values vs online database (2026-11-09, "This Year")

Read-only SQL against Supabase (business 1). API: `src/app/api/dashboard/stats-cached/route.ts`. No code changed yet.

| Card | Dashboard | Database | Verdict |
|---|---|---|---|
| Net Sales (Σ total_amount, completed+pending) | 163,418,014.90 | 163,418,014.90 | ✅ |
| Gross Sales (Σ subtotal) | 165,737,197.25 | 165,737,197.25 (= line items exactly) | ✅ (see note 5) |
| A/R Outstanding | 12,925,082.52 | 12,925,082.52 this year / **13,344,814.60 all-time** | ⚠️ hides ₱419,732 from older sales |
| Purchases (Period) | 119,475,590.69 | 119,475,590.69 (271 received POs) | ✅ |
| A/P Outstanding | 144,951,092.66 | 144,951,092.66 (339 of 351 AP rows unpaid) | ✅ math / ⚠️ no supplier payments recorded |
| Total Sell Return | 470,530.00 | 469,240 exchanged + **1,290 voided** | ❌ counts a voided return |
| Total Supplier Return | 1,370,280.55 | 1,312,280.55 approved + **58,000 pending** | ❌ counts pending returns |
| Expense | 0.00 | only 2 *draft* expenses (₱3,000) | ✅ |
| Low Stock "10 product(s)" | 10 | **56 active products** (276 location rows) | ❌ list capped at 10 |
| Payments to Suppliers "Sum" | 1,135,215.55 | 1,312,280.55 (11 payments) | ❌ sum of first 10 rows only |
| Pending Transfers | 1 | 1 (in_transit) | ✅ |
| Sales by Location (Today) | Main 1.156M / Bambang 129.9K / Tugue 61.9K | same | ✅ |

## Notes
1. Timezone: sale_date is stored as a date (00:00 UTC), so Manila day/year boundaries line up. No gap.
2. sales.paid_amount = Σ sale_payments for all 19,561 sales. A/P balance = total − paid for all rows.
3. A/P Outstanding has no date filter (includes 80 POs from 2025, ₱26.8M) — that's why it is bigger than this year's purchases. Correct by design.
4. Only supplier-return credits exist as supplier payments. If the office pays suppliers outside the system, ₱145M is overstated in real life (process issue, not code).
5. 421 sales have total_amount higher than (items − discount), Σ ₱396,141 (e.g. InvBambang01_10_2026_0004: items 31,729, charged/paid 39,999). Customers paid the higher total, so Net Sales is right, but Gross is ₱396K lower than real and Gross−Net ≠ discounts. Needs office confirmation of what these are.
6. Low-stock query also includes deleted/inactive products (70 of 346 rows).

## Fixes
- [x] Sell Return: exclude voided/rejected → 469,240
- [x] Supplier Return: approved/completed only → 1,312,280.55
- [x] Low Stock: real distinct-product count, skip deleted/inactive → 56
- [x] Payments to Suppliers: footer shows server total of the whole period (`/api/payments` now returns `totalAmount`) → 1,312,280.55
- [x] A/R Outstanding: no date filter, owner confirmed (matches A/P) → 13,344,814.60
- [x] Type-check: same 41 old errors in touched files before and after, none new
- [ ] Ask office about note 4 and note 5

## Review
- Files: `src/app/api/dashboard/stats-cached/route.ts`, `src/app/api/payments/route.ts` (additive `totalAmount` field), `src/app/dashboard/page.tsx`.
- Every new value checked with the same filters against the online DB (verified above).
- A/R card no longer changes with the Period dropdown; it is a balance, like A/P.
- Dashboard cache is 60s, so new values appear within a minute after deploy.

---

# Fix: Shift cannot be closed after an interrupted close (Tuguegarao SHIFT-20261104-0001)

Plan: C:\Users\Warenski\.claude\plans\i-am-trying-to-warm-backus.md

## Todo
- [x] Close route: clear the leftover Z reading + closing cash count on a still-open shift instead of blocking it (`src/app/api/shifts/[id]/close/route.ts`)
- [x] Close page: show the error inside the authorization box, next to the Confirm button (`src/app/dashboard/shifts/close/page.tsx`)
- [x] Type-check: no new errors (only errors that already existed)
- [x] After deploy: shift 1015 closed (Nov 5, 8:44 AM), balanced ₱28,974, single Z #332, location 4 zCounter = 332

## Review
- Root cause: on Nov 4 the close of shift 1015 saved its cash count (id 1021) and Z reading #332 (id 8568), but the final transaction (zCounter++ and status=closed) never finished. Every retry was then rejected with "already has a Z Reading", and that error showed at the top of the page, out of view.
- Fix: an open shift that has a Z reading can only come from an interrupted close, because only the close route writes Z readings. The route now deletes those leftovers and retries. zCounter was never incremented, so the Z number stays #332.
- No manual database changes, per the user's decision.
- Known issue, not changed: page.tsx:495 refers to `updatedZReading` outside the block where it is defined, so the localStorage recovery cache is never saved.

---

# Exchange: configurable window + manager override + auto cash refund

Plan: C:\Users\Warenski\.claude\plans\please-see-how-you-smooth-graham.md

## Todo
- [x] A. Schema: `Business.exchangeWindowDays Int @default(30)`; prisma generate
- [x] A. `/api/business/settings` PUT accepts + validates `exchangeWindowDays`
- [x] A. POS Settings page: numeric field
- [x] B. Exchange route: window from settings; past window → manager password; record authorizer
- [x] B. Exchange route: exchange-down → `CashInOut type=refund` on current open shift; 400 if no open shift
- [x] F. Exchange route: set `CustomerReturn.replacementSaleId`
- [x] G. Exchange route: unitCost on exchange sale items + stock ledger
- [x] C. Void route: delete refund row when voiding exchange (open shift)
- [x] D. ExchangeDialog: fetch window, warning + manager password, refund notice, send managerPassword
- [x] D. ExchangeInvoicePrint label
- [x] E. Cash in/out report pages: "Refund" label/badge/filter
- [x] Build passes (`npm run build`)
- [x] Review section

## Review

### What changed
- **Setting** `Business.exchangeWindowDays` (Int, default 30). Editable on Settings → POS Settings. Validated 0–365 in `/api/business/settings`.
- **Exchange route** (`/api/sales/[id]/exchange`):
  - Window read from business setting instead of hardcoded 7.
  - Past window → requires `managerPassword` (same role list + bcrypt check as refund/void). Authorizer stored in `CustomerReturn.approvedBy/approvedAt` and appended to notes + audit log.
  - Exchange-down on a paid sale → `cash_in_out` row `type='refund'` on the cashier's current open shift, `referenceNumber` = exchange number. Every expected-cash formula already subtracts non-`cash_in` rows, so X/Z reading and shift close drop automatically. Expense reports filter `type='cash_out'` so refunds are not expenses.
  - No open shift + refund due → 400 before any write.
  - Bug fix: `CustomerReturn.replacementSaleId` now set → original sale ← return → exchange sale linked by FK; "previous exchanges" warning now shows replacement invoice.
  - Bug fix: exchange sale items and stock ledger now carry `unitCost` (was 0) → profit report COGS correct.
  - Response includes `cashRefundAmount`.
- **Void route**: voiding an exchange on an open shift deletes its refund row (cash comes back).
- **ExchangeDialog**: loads window on open; past-window sale loads with amber warning + manager password field (also reacts to server `requiresManagerAuth`); green notice shows cash refund amount; sends `managerPassword`.
- **Receipt**: "Cash Refunded to Customer" vs "Credit to Customer" (credit sale).
- **Reports**: Cash In/Out + Non-Sales Cash pages show REFUND badge and filter option.

### Untouched on purpose
- `incrementShiftTotalsForExchange` / running totals, all reading formulas.
- Credit-sale exchange path (AR adjustment) unchanged.
- `sales/[id]/refund/route.ts` (pre-existing broken writes, no UI uses it).

### Deploy steps
1. `npx prisma generate` (done locally) and `npm run db:push` against production DB — adds one nullable-default column, no data change.
2. Deploy. Default window becomes 30 days (was 7).

### Verification done
- `npx prisma generate` OK.
- `npm run build` exit 0 (warnings are pre-existing unrelated imports).
- `tsc --noEmit`: no new errors in touched files (project has ~2.5k pre-existing errors; build ignores TS errors).

### Manual test checklist (production-like data)
See plan file verification list: within window, past window (wrong + right password), exchange-down with/without open shift, exchange-up, equal value, credit sale, void exchange, X/Z expected cash, profit report COGS, cash-in-out report badge.

### Follow-up (2026-10-09)
- [x] Fixed `api/sales/[id]/previous-exchanges` (always 500: selected non-existent `product`/`productVariation` relations on CustomerReturnItem). Now selects `productId`, looks up names, scoped by businessId. Verified read-only against production data; build passes; deployed (master 72b6d13).
- E2E on throwaway DB: 41/42 passed before this fix; the one failure was this endpoint.
- Incident: seed accidentally ran against production, added 2,117 role_permissions rows; all deleted (backup CSV kept). Never run `db:seed`/`db:push` with the main `.env`.

### Follow-up 2 (2026-10-10) - deep exchange test on isolated local Postgres
- [x] Fixed: item could be exchanged again after the 5-min duplicate window (double refund / phantom stock). Happened once in prod: InvBambang12_20_2025_0010 (RTN-EXC-202512-0014/0015). Data left as is.
- [x] Fixed: line discount treated as per-unit in exchange credit (qty>1 discounted lines credited wrong). API + dialog.
- [x] Tests: 49/49 new (multi-item, partial qty, GCash, discounts, cashier role, window edges, double-submit, void re-exchange, ledger reconciliation) + 42/42 original. Deployed master e143cb5.
- Not tested: Exchange dialog in a real browser (automation failed to load pages). Serial numbers (not used in prod).

### Follow-up 3 (2026-10-10) - Exchange Receipt froze POS (Bambang, EXC-202610-0003)
- Cause (reproduced in Edge): Exchange Receipt "Print" opened a separate 800x600 popup window and called print() there. While that print dialog is open the POS tab's JavaScript is fully blocked (same-origin popup shares the event loop). If the popup goes behind the main window, the cashier sees a frozen POS with the receipt still showing, busy cursor, nothing clickable.
- [x] `ExchangeInvoicePrint.tsx`: print from a hidden iframe on the same page instead of a popup. Print preview now opens over the POS tab itself (cannot get lost behind windows); iframe removed after printing. Same HTML/CSS, same printed layout (compared print previews old vs new on EPSON TM-T82X).
- [x] `pos/page.tsx`: missing `import { toast } from 'sonner'` (Package load threw ReferenceError after adding items).
- Ruled out (tested, not a cause): dialog hand-off between Exchange dialog and Receipt. Closing the receipt worked 30+/30+ rounds on old code incl. 6x CPU throttle and production-size catalog (2,100 products, 5 locations).
- Production data checked read-only: EXC-202610-0003 saved once, one refund row of 2,819 on shift 944. No cleanup needed.
- Note: `SalesInvoicePrint.tsx` uses the same popup print pattern (same freeze risk on sales receipts). Not changed here.

### Follow-up 4 (2026-10-10) - Sales receipt print + Sales list Re-Print
- [x] `SalesInvoicePrint.tsx`: same freeze risk as exchange receipt (popup + print()). Now prints from hidden in-page iframe; preview opens over the current tab. Kept the `/print/sales-invoice/<invoice>` print URL (set on the iframe; page URL unchanged).
- [x] `dashboard/sales/page.tsx` Re-Print: was always failing. `/api/sales/[id]/reprint` includes `SaleItem.productVariation` (relation does not exist) and returns a different shape than the receipt reads. Re-Print now loads `/api/sales/[id]` (same data + same view/view_own checks as the working sale detail print). `/reprint` API left as is (no callers now).
- Tests (Playwright, Edge, isolated local Postgres): POS real sale -> receipt, Sales list Re-Print, Sale detail; each in 80mm/A4/Letter/Legal. New code 53/53: no popup, iframe cleaned up, page URL unchanged, page clickable after Close, no page errors. Old code 20/21 (Re-Print failed = bug above).
- Printed HTML old vs new: byte-identical for all paper sizes (POS + detail). Re-Print output identical to detail page except the red REPRINT badge. Headed check: preview opens in-tab on EPSON TM-T82X 80mm.
- Not changed, noticed in prod logs: `api/supplier-returns` POST includes `location` on SupplierReturn (no such relation) -> 500 after the return is created.

### Follow-up 5 (2026-10-10) - Supplier return "Failed" after saving
- Cause: `POST /api/supplier-returns`, after the transaction and audit log, re-reads the return with `include: { location }`. SupplierReturn has no `location` relation -> Prisma error -> 500 "Failed to create supplier return" although the return WAS saved. Cashier stays on the form and may resubmit (5-min duplicate guard blocks only within 5 minutes). Every create since Aug 7 hit this (prod errors on returns #10, #11).
- [x] Removed the invalid include; location name fetched separately (same pattern as `api/supplier-returns/[id]`), scoped by businessId. Response now includes `location` like the detail endpoint.
- Tests (isolated local Postgres): API old 4/8 (500 but saved) -> new 10/10 (201, one row, returnNumber, location, product name, identical resubmit 409, bad qty 400, list + detail 200). UI create-manual page in Edge: old = error toast + stays on form + row saved; new 6/6 = success toast, redirect to list, one row, correct values.
- Production (read-only): SR-202601-0001 and SR-202601-0002 look like a duplicate (same supplier 40, variation 139 x100, 22,000, 21s apart, both pending). Not changed.
- Not changed: `supplier-returns/new` (serial-lookup flow) sends productVariationId = productId and a serial string as serialNumberIds; unused (no serial records in prod). Dashboard mounts two sonner Toasters (providers.tsx + dashboard/layout.tsx) so every toast shows twice.

### Follow-up 6 (2026-10-12) - Serial No. on exchange (trace replacement units) + Exchange Items report
- [x] `ExchangeDialog.tsx`: optional "Serial No." box per returned item (pre-filled from the original sale's serials) and per replacement item. Comma/newline separated.
- [x] `api/sales/[id]/exchange`: saves typed serials as `[{serialNumber}]` (same shape as POS sale) on CustomerReturnItem and the replacement SaleItem; receipt data includes them (existing "SN:" line on the Exchange Receipt now shows). Bad input ignored (non-array/non-string dropped, max 191 chars, max 100). No schema change; stock/cash logic untouched.
- [x] Exchange Items report API: was ALWAYS 500 (includes `location` on CustomerReturn, `product`/`productVariation` on CustomerReturnItem, `productVariation` on SaleItem - none exist). Names now looked up separately. Added returned/replacement serial fields.
- [x] Exchange Items report page: "Serial No." column under Returned and Replacement (searchable, exported). Fixed date filters: handlers spread stale `filters` so DevExtreme's programmatic valueChanged wiped Start Date -> error toast on load and Generate failed; "This Month" used UTC (started Sep 30). Now functional state updates + local date.
- Tests (isolated local Postgres + Edge): exchange regression 49/49; serial API/report 22/22 (old report route 500 reproduced, new 200); UI 13/13 (prefill, receipt SN lines, DB rows, report columns, search by serial, old saved grid layout still shows new columns); report filters 8/8 (old code: error toast + missing startDate reproduced). `npm run build` ok.

### Follow-up 7 (2026-10-16) - Back-encode missed exchange InvMain09_30_2026_0008 (JONELIX GACAD)
Cashier swapped HP OMNIBOOK 5 16-BC1015AU (SN CND5360V3J, 64,990) for HP OMNIBOOK 5 16-AF1062TU (SN CND528007B, 63,990, paper SI 91688) and gave 1,000 cash back, but recorded only a Cash Out (cash_in_out 2519, shift 960). Likely cause: staff still followed the old hard 7-day block (removed 2026-10-09; window is now 30 days, sale was 16 days old).
- [x] One-off script `scripts/exchange-InvMain09_30_2026_0008.ts` mirroring `api/sales/[id]/exchange` (dry-run default, `--commit` writes)
- [x] Dry-run reviewed with user
- [x] Shift 960 was closed (balanced, 86,072) before commit -> per user: closed shift untouched. No refund row, Cash Out 2519 kept, shift totals not changed, EXC sale shiftId null (X/Z re-query sales by shift_id).
- [x] Committed run: RTN-EXC-202610-0007 (return id 96) + EXC-202610-0007 (sale id 18518, total 0), +1 var 1846 / -1 var 1862 at Main Store, audit log.

#### Review
- Verified (read-only): Main Store qty var 1846 = 1, var 1862 = 0; ledger rows customer_return +1 / sale -1; return linked to EXC sale; shift 960 still closed, ending/system cash 86,072, 0 over/short, running totals unchanged; row 2519 unchanged.
- Trade-off: 1,000 stays a Cash Out (shows in Cash In/Out report, not tied to EXC number). Voiding EXC-202610-0007 later will not touch that cash row.

### Follow-up 8 (2026-10-16) - Exchange: calmer UI, location-code override, cash-count gaps
Cashier skipped an exchange fearing the old 7-day block. Prod check: all 4 exchanges since Oct 9 (2 refunds, 2 pay-more) closed 0 over/short.
- [x] Route: past-window override accepts manager password OR location code (same check as Void)
- [x] Route: charge (pending) sale -> payment forced 0 (was "Payment amount mismatch" error when customer pays more)
- [x] Route: customer pays more with no open shift at location -> blocked (was posting cash to original sale's old shift = OVER)
- [x] Dialog: no yellow past-window toast; calm blue note with password / location code choice
- [x] Dialog: charge sale texts (added to / deducted from balance, no cash); refund box "do not add a separate Cash Out"
- [x] Route: exchange location = cashier's open shift location (session never had currentLocationId -> always used original sale's branch; cross-branch refund/pay-more found no shift). Prod: no user has 2 open shifts, 0 cross-branch exchanges so far.
- [x] tsc clean for both files; `npm run build` ok
- [x] Local DB scenario tests (throwaway local DB, real API + NextAuth login): 16/16 PASS

#### Review
- Paid sale: refund -> refund row on cashier shift; pay-more cash -> payment on shift (+runningCashSales); gcash -> runningGcashSales only. Shift close with independently computed cash: over 0 / short 0 (2 shifts, incl. cross-branch + charge + past-window cases).
- Charge sale: pay-more now 200 (was 400 mismatch), balance +diff, no cash; exchange-down balance -diff, no refund row.
- Past 30 days: no auth -> asks; wrong location code 403; valid location code 200 (approver = cashier, code in notes); manager password 200.
- No open shift: pay-more and refund both blocked, nothing written.
- Cross-branch (sale at A, cashier shift at B): cash + stock land on B shift/location, A untouched.
- Not changed: serial-number movement rows still use the original sale location (only when serial IDs are sent; unused in prod). Location code check same as Void (any active code of the business, case-sensitive). Seed lacks stock DB functions (update_inventory_with_history etc.) - test DB needed database/functions/*.sql.

---

# Batch Price Increase — TP-Link / Mercusys (2026-10-17)

- [x] Read `batch price increase.xlsx` (62 rows, `Item Name` / `New SRP`)
- [x] Read-only preview vs Supabase: 62/62 exact name matches, 0 missing, 0 duplicates
- [x] Script `scripts/update-prices-batch-increase-oct2026.ts` (copy of update-prices-from-excel.ts, match by name, per-product transaction)
- [x] Ran on online Supabase: 62 updated across 4 active locations
- [x] Verified: all variation + location prices = new SRP (62/62)

## Review
Updated `productVariation.sellingPrice` and `variationLocationDetails.sellingPrice` for 62 networking items. 2 rows were already at target (MA12N 319, TAPO C501GW 4490). Largest jumps: OC200 4490→9090, ER605 2390→5190, LS105G 800→1790. No app code changed.

---

# Price Adjustment — Laptops (2026-10-28)

- [x] Read `PriceAdjustment.xlsx` (49 rows, no header: col A = product name, col B = new SRP)
- [x] Read-only preview vs Supabase: 49/49 exact name matches (R9UE row needs whitespace normalize), 0 duplicates
- [x] Script `scripts/update-prices-adjustment-oct28-2026.ts` (copy of oct2026 batch script; header-less sheet + collapse spaces)
- [x] Ran on online Supabase: 49 updated across 4 active locations
- [x] Verified: all variation + location prices = new SRP (49/49)

## Review
Updated `productVariation.sellingPrice` and `variationLocationDetails.sellingPrice` for 49 laptops (Acer, HP, Asus, Gigabyte, MSI, Dell). 1 row already at target (MSI PRESTIGE 79995). Decreases: ACER AN16S 124999→105999, HP AG0034AU, HP VICTUS S1557AX, ASUS UX5304MA, MSI CYBORG. Largest increase: DELL 15 5250 59990→89990 (confirmed by user). No app code changed.

---

## Data fix 2026-10-29 — InvBambang10_29_2026_0010 missed canvass discount (online Supabase)

ASUS V3607VM-RP045W line: cashier forgot line discount 3,000 "PRICE DURING CANVASS"
(canvass 81,995; SRP rose to 84,995). Customer LGU BAMBANG MEO, charge invoice, unpaid.

- [x] Snapshot before (rollback values)
  - sales 19257: subtotal 270815, discount_amount 0, total_amount 270815, paid 0
  - sale_items 33471: unit_price 84995, discount_type/value null, discount_amount 0, remark null
  - sale_payments 19971 (credit AR placeholder): 270815
  - cashier_shifts 1001 (open): running_net_sales 285974, running_total_discounts 0, running_other_discount 0
  - sales_personnel 3: total_revenue 23182917.55 (live, changes with sales)
- [x] Apply line discount 3000 + remark, sale discount 3000 / total 267815, credit row 267815
- [x] Shift 1001: net −3000, total & other discount +3000; sales personnel 3 revenue −3000
- [x] Audit log row
- [x] Verify

### Review
Applied as one guarded DO-block transaction on Supabase (every UPDATE required exactly 1 row
matching the old values, else full rollback). First attempt failed on table name `businesses`
(actual `business`) and rolled back cleanly — verified no partial write — then re-run succeeded.
Result: ASUS line 84,995 − 3,000 = 81,995 (fixed, "PRICE DURING CANVASS"); sale subtotal 270,815,
discount 3,000, total/AR 267,815 = sum of item nets; credit row 267,815; shift 1001 net −3,000,
total/other discount +3,000 (gross/VAT unchanged, same as POS); sales personnel 3 −3,000;
audit_logs 41449. No code change.

---

# Price Adjustment — Vention + Tecno (2026-10-30)

- [x] Read `PRICEADJUSTMENTVENTION.xlsx` (6 rows) + `PRICEADJUSTMENTTECNO.xlsx` (11 rows); no header, col A = name, col B = new SRP
- [x] Read-only preview vs Supabase: 17/17 exact name matches, 0 duplicates
- [x] Script `scripts/update-prices-adjustment-oct30-2026.ts` (copy of oct28 script; loops both files)
- [x] Run on online Supabase (variation + all active location prices)
- [x] Verify all 17 prices = new SRP

## Review
Updated `productVariation.sellingPrice` and `variationLocationDetails.sellingPrice` for 17 items (6 Vention, 11 Tecno) across 4 active locations. Verified 17/17 (68 location rows). 1 row already at target (SPARK GO3 4/64 TITANIUM GREY 6499). All increases; largest: VENTION ALIBL HDMI 10M 450→799, ALIBN 15M 790→1239, VAS-A16-B300 140→219 (confirmed by user). No app code changed.

---

## Inventory Corrections grid: record count + First/Prev/Next/Last paging (2026-11-23)

- [x] Root cause: `<Scrolling mode="virtual">` made the grid one long scroll list, so paging did not work like real pages -> removed
- [x] New shared `src/components/DataGridPagerBar.tsx` (hook `useDataGridPager` + bar) for any DevExtreme grid
- [x] Rows per page 10/20/30/40/50/100 (default 20), "Showing X–Y of Z records", First / Previous / Page N of M / Next / Last (disabled at ends)
- [x] Built-in DevExtreme pager hidden (`<Pager visible={false} />`) so there is only one pager
- [x] Build passes (`npm run build`, exit 0); no new type errors

### Review
- Only `inventory-corrections/page.tsx` (4 small edits) + new pager component. No API/database changes.
- Record count = rows after filters/search. The page loads up to 1000 newest corrections (`?limit=1000`, unchanged).

---

# Formal verification: no double stock posting (2026-11-23)

- [x] Map every route that moves stock and how it blocks a second posting
- [x] TLA+ models in `formal/` (Checkout, TransferStock, SaleReturns, Receiving) + `bash formal/run.sh`
- [x] Show each passing model fails when its guard is removed
- [x] Project skill `.claude/skills/verify-stock-posting/SKILL.md` (coverage table, sync commit fb30d53b)
- [x] Hand-off test: scratch break in job-processor.ts caught, then reverted

## Review
- No product code changed. Added only model files, a run script, a skill, and a .gitignore line.
- Proven safe: checkout with the same key; transfer send-async / receive / complete-async (the routes the screens use); approving a GRN, supplier return, purchase return or replacement twice.
- Findings (NOT fixed, waiting for owner's decision), details in the skill: F1 transfer cancel after receive, F2 plain status updates reopen transfers, F3 void vs exchange race, F4 customer return on a voided sale / repeat returns, F5 two GRNs at once, F6 checkout killed after commit (rare). Refund route: no guard, but broken and unused.

---

# Fix double stock posting findings F1-F6 (2026-11-23) - approved by owner ("fix all")

- [x] F1 transfers/cancel: cannot cancel a received transfer; restore decision read inside the transaction
- [x] F2 mark-arrived / start-verification / verify-all / verify-item: status update only if status unchanged; receive + complete set stockReceived so destination stock is added once
- [x] F3 void (both routes) + exchange: lock the sale row and re-check status/returns inside the transaction
- [x] F4 customer returns: refuse voided sales, count earlier returns (create + approve, approve re-checks under sale lock)
- [x] F5 GRN: create locks the purchase row and re-checks pending GRN + quantity; approve re-checks ordered quantity
- [x] F6 checkout: stale 'processing' key on /api/sales is not re-run automatically
- [x] Update TLA+ models to the fixed code, all configs pass, skill sync commit moved
- [x] Type-check touched files, commit, push

## Review (fixes)
- Code commit 80193d81 (16 route/lib files, small guarded checks only; no schema or UI change).
- Proof: all 9 TLA+ configs pass on the fixed code; removing each new guard from the model makes it fail (9/9).
- Type-check: per-file error counts identical before/after for every touched file (project has ~2800 pre-existing errors; builds ignore them).
- Live DB read-only checks: 0 over-received PO lines (GRN check blocks no normal work), 0 open transfers with stockReceived set, live stock function is the safe server-side version.
- Owner to check by hand: exchanges RTN-EXC-202606-0003 (InvBambang06_07_2026_0002) and RTN-EXC-202606-0002 (InvMain06_05_2026_0009) are on voided sales - stock may be +1 too high for those items.
- Still open: sales/[id]/refund route (broken + unused) has no already-refunded check.

---

# Formal verification, part 2: the areas not covered yet (2026-11-24) - PLAN, waiting for owner

Same method as part 1: a TLA+ model per area, each request = (pre-check outside the transaction) + (transaction as one step),
TLC tries every order of 3-4 overlapping requests. A model that fails on today's code = a suspected bug, confirmed only after
replaying the trace against the route line by line. No product code is changed in this part.

## Models to write (formal/)
- [ ] Corrections.tla - create / approve / bulk-approve / reject / edit / delete overlapping.
      Proves: stock posted once per correction; a rejected or deleted correction never posts; an approved one is never flipped to rejected.
      Suspected: reject/delete use plain updates (no status in WHERE); approve claim only excludes 'approved'.
- [ ] Imports.tla - physical-inventory import, import-safe, admin upload, opening stock, product import, with retries and a sale in between.
      Proves: uploading the same count twice does not move stock twice; final stock = counted qty; opening stock set once.
      Suspected: import / admin upload post a stale CSV difference again on every re-upload; opening-stock checks are outside the transaction.
- [ ] Serials.tla - sale, transfer send/receive, supplier return, void, exchange on the same serial.
      Proves: a serial is sold at most once and is in one place; serial status agrees with stock.
      Suspected: sale updates the serial by id only, so two sales can sell one serial.
- [ ] StockFunction.tla - the database function update_inventory_with_history (v3) and the bulk one.
      Proves: balance = sum of movements; never negative unless allowed.
      Suspected: when no stock row exists yet, two first postings at once can lose one.
- [ ] Payments.tla - AR (customer pays a credit sale) and AP (single + batch supplier payments, AP edit).
      Proves: paid = sum of payment rows; paid never > amount due; status 'paid'/'completed' exactly when balance = 0; voided sale cannot be paid.
      Suspected: two payments at once overpay (AR) or lose one (AP writes absolute amounts from a stale read).
- [ ] Shifts.tla - open, close, force-close, and sale / AR payment / cash in-out / void / refund landing at the same time.
      Proves: one open shift per user; a shift closes once (Z counter +1 once); nothing is added to a closed shift; system cash = the money recorded in it.
      Suspected: two closes both count; late sale/payment lands in a closed shift; two open shifts per user.
- [ ] Bigger numbers: add a larger config to each part-1 model where TLC still finishes in a few minutes.

## Then
- [ ] For each failing model: replay the trace against the code, list confirmed findings (G1, G2, ...) in plain words, with real-data checks (read-only SQL) of whether it has already happened in production.
- [ ] Show each passing model fails when its guard is removed.
- [ ] Add the configs to formal/run.sh (known bugs marked expected=fail); extend skill verify-stock-posting (stock parts) and add skill verify-money (AR/AP/shifts).
- [ ] Commit + push (models, run.sh, skills only).
- [ ] Owner decides which findings to fix (separate step, like part 1).
