# Cash In / Cash Out — Investigation & Fixes (2026-08-10)

## Problem

Cashier reported a **Cash Out** that "went to the Cash In record". Asked to verify whether Cash Out
writes the wrong record type, and whether Cash In really saves as `cash_in`.

## Investigation result

**The code was never swapping the types.** Both reported incidents were cashier data-entry error at
the POS, and both were already self-corrected by the cashiers themselves.

- `src/app/api/cash/out/route.ts:129` — `type: 'cash_out'` hardcoded literal.
- `src/app/api/cash/in/route.ts:122` — `type: 'cash_in'` hardcoded literal.
- POS request body carries **no** `type` field — the endpoint alone decides direction.
- POS buttons → dialogs → handlers are not crossed (`pos/page.tsx:2598-2643`, `3857`, `3897`).
- Idempotency replay could theoretically cross endpoints (`ON CONFLICT (key)` is not scoped by
  endpoint in `src/lib/idempotency.ts`), but the POS sends no `Idempotency-Key` for cash in/out, so
  it never engages here.
- Live DB: 1,999 rows in `cash_in_out`, only two distinct `type` values (`cash_out` 1827,
  `cash_in` 172). No typos, no case variants, no NULLs.

The two incidents (both netted out correctly, both shifts closed with `cash_over = 0` and
`cash_short = 0`, no money lost):

- Shift 762 — `cash_in` 3,500 (id 1995, error) cancelled by `cash_out` 3,500 (id 1996, reason
  `PETTY CASH NA NA-ICASH IN INSTEAD OF CASH OUT`), then the real petty cash re-entered as
  `cash_out` 3,000 + 500 (ids 1998, 1999).
- Shift 757 — `cash_in` 290 (id 1982, error), real `cash_out` 290 LUNCH (id 1984), correcting
  `cash_out` 290 (id 1985, reason `WRONG INPUT (DAPAT SA CASHOUT PO SIYA SA CASH IN KO PO NILAGAY)`).

## Todo

- [x] Trace the Cash Out save path end to end (UI → API → Prisma)
- [x] Trace the Cash In save path and confirm it stores `cash_in`
- [x] Check the idempotency wrapper for cross-endpoint response replay
- [x] Query the live DB for corrupt / unexpected `type` values
- [x] Locate the actual reported transactions and determine what really happened
- [x] Audit the read/report side for direction bugs
- [x] Fix 1 — X-Reading missing `withdrawalAmount` in the SQL-aggregation path
- [x] Fix 2 — make the Cash In and Cash Out dialogs impossible to confuse
- [x] Typecheck both edited files (clean)
- [x] Fix 3 — separate float pullouts from real expenses (new `float_pullout` type)
- [x] Fix 4 — flashing direction banners + FINAL CHECK double-confirm (2026-08-11)
- [ ] Test in the running app (see Verification below) before deploy

## Changes made

### Fix 1 — `src/lib/readings-optimized.ts` (+4 lines)

`generateXReadingDataOptimized` built its `XReadingData` return object without four fields that the
interface declares as required: `withdrawalAmount`, `refundAmount`, `startDateTime`, `endDateTime`.
TypeScript would have caught this, but `next.config` sets `ignoreBuildErrors: true`, so it shipped.

The X-Reading UI reads `xReading.withdrawalAmount` for the "CASH OUT (Withdrawals)" line, Net Cash
Movement, and the drawer breakdown (`src/components/BIRReadingDisplay.tsx:675, 679, 696`), while
Cash In reads `xReading.cashIn`. This code path runs whenever
`runningGrossSales === 0 && runningTransactions === 0` (`src/lib/readings-instant.ts:46-77`) — i.e.
an X-Reading printed **before the shift's first sale**.

Result: petty cash taken at shift open printed as **Cash Out ₱0.00** with Cash In showing normally,
while `expectedCash` still subtracted the cash out — a receipt that reads exactly like "my cash out
went to the cash in". `startDateTime` / `endDateTime` were also `undefined`, so the BIR date lines on
that same receipt rendered from an undefined value.

Added the four fields, mirroring `src/lib/readings-instant.ts:421-426`. Z-Reading was already fine.

### Fix 2 — `src/app/dashboard/pos/page.tsx` (UI + confirmation text only, no logic)

The two dialogs were near-identical — same layout, same shared `cashIOAmount` / `cashIORemarks`
state, and both confirmations opened with the same green ✅, so nothing about the screen told the
cashier which direction the money was moving.

- Cash In dialog: green header bar, green border, ⬇️ CASH IN title, "Money ENTERING the drawer"
  subtitle, and a green banner in the body.
- Cash Out dialog: red header bar, red border, ⚠️ CASH OUT title, "Money LEAVING the drawer"
  subtitle, and a red banner in the body.
- Both confirmations now state the direction explicitly ("will be ADDED to" / "will be REMOVED
  from" your drawer) and point at the other button if the cashier picked wrong.
- Close (X) button forced to white so it stays readable on the colored header (no dark-on-dark).
- Both variants styled for light and dark mode.

No change to any handler, endpoint, payload, or validation.

### Fix 3 — separate float pullouts from real expenses

Follow-up finding, and the larger one. Every shift at all three locations ends with a `cash_out`
exactly equal to that shift's `beginning_cash` (₱3,000 / ₱3,500 / ₱7,500), labelled "PETTY CASH" —
the cashier returning the change fund. That is **mechanically correct**: the float is part of the
`expectedCash` formula, so if it physically leaves the drawer it must be subtracted, or every shift
would show short. The zero over/short results (with occasional genuine ₱2 and ₱6 variances) confirm
the money really is leaving and the counts are real.

The problem is that the system had no concept of a float pullout, so
`reports/profit/route.ts:61`, `reports/profit-loss/route.ts:316` and `reports/tax/route.ts:157` —
which all filter `type: 'cash_out'` — counted it as a business expense:

```
float pullouts    731 rows   ₱3,433,500   ← change fund moving, not money spent
real expenses    1096 rows   ₱1,891,882
```

**~64% of reported expenses were not expenses.** Profit understated by ₱3.43M, feeding the tax
report too.

**Solution: a third `cash_in_out.type` value, `float_pullout`.** The column is already free-text
`VARCHAR(20)` with no enum or constraint, so **no schema change and no migration**. The design uses a
split that already existed in the code — expense readers filter `type: 'cash_out'` explicitly, so a
new type is excluded from them automatically with zero changes to those three files.

Drawer-math readers were the real work: several tested `=== 'cash_out'` and would have **silently
dropped** the new type, breaking every shift's balance. They now test `!== 'cash_in'`, which is also
correct by default for any future outflow type.

- `src/app/api/cash/out/route.ts` — optional `isFloatPullout` in the body picks the type literal;
  duplicate detection now scopes to the same type so pullouts and expenses dedupe independently.
  Same permission, same validation, same ownership check, same audit log.
- `src/lib/auditLog.ts` — added `FLOAT_PULLOUT` action.
- `src/app/api/shifts/[id]/close/route.ts` — **most critical**, computes `systemCash`.
- `src/app/api/shifts/[id]/force-close/route.ts`, `src/app/api/shifts/check-unclosed/route.ts`.
- `src/lib/readings.ts` (3 sites), `src/lib/readings-instant.ts`.
- `src/lib/readings-optimized.ts` — different shape: a `GROUP BY type` result read with
  `.find(r => r.type === 'cash_out')` returns one group, so it now sums every non-`cash_in` group.
- `src/app/dashboard/pos/page.tsx` — third amber **🏦 Float Out** button and dialog beside Cash In /
  Cash Out, with its own warning text explaining it is not an expense. `handleCashOut` now takes an
  explicit `isFloatPullout` boolean; both call sites pass it explicitly, since wiring it straight to
  `onClick` would pass the click event as the argument and read as truthy.
- `src/app/dashboard/reports/cashier/non-sales-cash/page.tsx` — FLOAT OUT badge, filter option,
  amber amount colour.
- `src/app/api/reports/cash-in-out/route.ts` — `totalFloatPullout`, `countFloatPullout` and
  `totalCashOutExpense` in the summary.
- `src/app/api/cash/in-out/route.ts` — whitelist updated.

**Not touched:** `prisma/schema.prisma`, any migration, `src/lib/rbac.ts`, roles, permissions, menus,
and the three expense report files.

X/Z readings keep the pullout inside the existing CASH OUT total — drawer-correct and identical to
today's receipts.

### Fix 4 — flashing direction banners + FINAL CHECK double-confirm (2026-08-11)

Owner asked for a louder guard against clumsy mis-clicks:

- `src/app/globals.css` — added `cash-flash` keyframes + `.animate-cash-flash` (0.9s hard opacity
  blink) in the existing `@layer utilities`, following the `blob` animation pattern already there.
- `src/app/dashboard/pos/page.tsx` — each of the three dialogs now shows a flashing solid-color
  banner above the form: green "CHECK: THIS IS CASH IN — MONEY GOES IN", red "CHECK: THIS IS CASH
  OUT — MONEY GOES OUT", amber "CHECK: THIS IS FLOAT PULLOUT — NOT AN EXPENSE". White text on solid
  bg in both light and dark mode.
- Second confirmation added before saving: after the existing confirm, a color-coded
  "🟢/🔴/🟡 FINAL CHECK" `window.confirm` restates the direction and tells the user to Cancel if
  they meant the other action. Applies to Cash In, Cash Out, and Float Pullout.

No handler logic, payload, or endpoint changed — the extra confirm only gates the existing save.

## Verification

- `npx tsc --noEmit` — **zero errors in any edited file**, and the project-wide total is unchanged at
  95, all pre-existing in untouched files (e.g. `src/hooks/useCurrency.ts`). Note `next.config` sets
  `ignoreBuildErrors: true`, so the build will not catch type errors for you — this is exactly how
  the missing `withdrawalAmount` shipped.
- Full `npm run build` was **not** run, to avoid disturbing a running dev server. Worth running
  before deploy.

Still to test in the app:

1. **Drawer balance is the thing that must not break.** Open a test shift with a known float, record
   a normal Cash Out, a Cash In and a Float Out, then close it counting denominations. `system_cash`
   must equal `beginning + cashSales + cashIn − cashOut − floatPullout + arCash`, and `cash_over` /
   `cash_short` must be 0. Repeat via force-close.
2. Record a Cash Out **before** any sale, print the X-Reading: "CASH OUT (Withdrawals)" must show the
   amount (including the pullout) and Net Cash Movement must equal `cashIn − cashOut`. Make a sale,
   re-print, confirm the instant path agrees. Z-Reading must match.
3. **Expense exclusion:** run Profit, Profit & Loss and Tax over the test range — the Float Out must
   be absent, the normal Cash Out present.
4. Open all three POS dialogs and confirm the colours, titles and confirmation wording differ
   unmistakably; verify each still writes its own type in `cash_in_out`.
5. Read-only DB check: `SELECT type, count(*), sum(amount) FROM cash_in_out GROUP BY type;` — three
   values, the pullout under `float_pullout`.
6. Confirm all three actions are still blocked while the cart is non-empty, and that Cashier and
   Manager permissions behave unchanged.

## Historical data — reported, not changed

The 731 existing float rows keep `type = 'cash_out'`, so past reports keep the inflated expense
figure and reports will show a step change from the day this ships. A read-only month-by-location
breakdown of how much of each period's "expense" was really float movement is in
`tasks/float-pullout-historical-breakdown.md`. No `UPDATE`, no migration, nothing in production
touched.

## Not done (deliberately)

- **`CHECK` constraint on `cash_in_out.type`.** Safe and defensive, but a migration against the live
  production DB; not needed for this change and never authorised.
- **A "reverse / void" button for cash in/out.** It would add an audit-trail and permissions surface
  to a live money path, and the current practice — posting an offsetting entry with an explanatory
  reason — already produces a correct, fully auditable ledger, as both incidents show.
- **No data repair.** Both reported incidents net out correctly and both shifts closed with zero
  variance.

## Review

The reported bug does not exist: Cash Out saves as `cash_out` and Cash In saves as `cash_in`, proven
in code and confirmed against 1,999 live rows. The two incidents were mis-clicks the cashiers had
already corrected themselves.

What the investigation turned up instead was worth more than the original report:

1. A genuine X-Reading bug that omitted Cash Out from any reading printed before the shift's first
   sale — producing exactly the symptom the cashier described.
2. Three dialogs' worth of missing direction cues, now colour-coded and explicit.
3. The big one: the cashiers' nightly "PETTY CASH" entry is the beginning float going back out, and
   it was being booked as a business expense — ₱3.43M of it, 64% of all reported expenses. They were
   compensating correctly for a feature that did not exist. They now have the right button.

The changes are additive and narrow: one new type value, one optional request field, one new button
and dialog, and a set of one-line `=== 'cash_out'` → `!== 'cash_in'` edits so no drawer calculation
can silently drop an outflow. No schema change, no migration, no RBAC change, and the three expense
reports were not touched at all — they exclude the new type on their own.

The one thing to watch on deploy is drawer balance (verification step 1). Everything else is display.
