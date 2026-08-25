# Cashier Short ₱630 / Phantom "AR Payment" — Main Store, Aug 25 2026

## Root Cause (confirmed from live data)

Not regional settings. The "AR Payment Received 630.00" is a **duplicate sale created by the POS offline-queue replay**:

1. Aug 24 14:20 PH — cashier JOJITKATECashierMain rang a ₱630 cash sale (EPSON 0031 BLACK ₱310 + EPSON 0034 YELLOW ₱320). Network trouble → multiple submits: `InvMain08_24_2026_0022` (voided 2 min later), `InvMain08_24_2026_0023` (the real sale), plus a third attempt stuck in the offline queue (`pos_offline_queue` localStorage).
2. Aug 25 12:13 PH — queue flushed, replayed the stale body → `InvMain08_25_2026_0016`: same items, ₱630 cash, `sale_date = 2026-08-24`, attached to today's shift 805.
3. Effects: shift 805 expected ₱630 cash that never entered the drawer (short ₱630 at Z reading, 18:17 PH); sales-today API classified the payment (paid today, sale dated yesterday) as an AR collection; inventory deducted twice (1× each EPSON ink).
4. Only sale in 14 days with `sale_date` ≠ creation date — one-off, not systemic.

## Todo

- [x] Investigate: trace 630.00 AR payment to source records (Supabase)
- [x] Fix A: cap offline-queue replay age at 2h (`src/lib/client/apiClient.ts`) — drop expired entries on load and on flush, emit `offlineQueueExpired` event
- [x] Fix A: POS page alert listener so cashier is told when queued sales are dropped (`src/app/dashboard/pos/page.tsx`)
- [x] Fix B: server-side stale-date guard in POST `/api/sales` (`src/app/api/sales/route.ts`) — if client `saleDate` isn't today's Manila date, use server clock
- [x] Typecheck edited files (clean; `useCurrency.ts` errors pre-existing, untouched)
- [x] Void duplicate `InvMain08_25_2026_0016` — done 2026-08-25 via `scripts/void-duplicate-sale-InvMain08_25_2026_0016.ts` (user approved; no login used). Mirrors void route logic: sale 15609 status → voided, void_transactions id 186, stock restored via addStock (284: 12→13, 287: 19→20), audit log written, 1 stale idempotency key deleted. Skipped by design: shift 805 totals (closed/frozen Z), email/Telegram alerts. Verified: AR-card query for Aug 25 Main Store now returns 0 payments / 0.00. Shift 805's recorded ₱630 shortage is explained by void record + audit log — cashier not at fault.

## Review

- `src/lib/client/apiClient.ts`: added `MAX_QUEUE_AGE_MS` (2h). `loadOfflineQueue` purges expired entries at startup; `processOfflineQueue` drops expired entries before replay and dispatches `offlineQueueExpired` with details. Fresh entries behave exactly as before.
- `src/app/dashboard/pos/page.tsx`: network-status effect now also listens for `offlineQueueExpired` and shows an alert telling the cashier which queued sale(s) were dropped and to re-ring if genuinely unsent.
- `src/app/api/sales/route.ts`: after field validation, computes `effectiveSaleDate` — client value if its Manila calendar date is today, otherwise server "now" (+8h shift for the DATE column, same convention POS uses). All five former `new Date(saleDate)` usages (sale row, soldAt, credit-payment rows, history timestamp) now use it. Normal sales are byte-for-byte unchanged; only stale replays are corrected. Bonus: fixes sales/create page early-morning (12am–8am PH) sales landing on the previous date.
- No schema, RBAC, or inventory-logic changes. 3 files, +74/−9 lines.

### Verification done
- Live DB queries traced the exact duplicate (invoices, payments, shift, items).
- `npx tsc --noEmit`: no errors in the three edited files.

### Verification remaining (after void)
- Sales Today (Aug 25, Main Store): AR card should read 0.00 / 0 payments.
- Stock of products 287 (EPSON 0031 BLACK) & 284 (EPSON 0034 YELLOW) at Main Store +1 each.
- Watch: `select count(*) from sales where sale_date <> (created_at at time zone 'utc' at time zone 'Asia/Manila')::date and created_at > now() - interval '14 days';` should stay 0.
