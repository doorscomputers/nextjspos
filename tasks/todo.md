# Fix: Shift cannot be closed after an interrupted close (Tuguegarao SHIFT-20261104-0001)

Plan: C:\Users\Warenski\.claude\plans\i-am-trying-to-warm-backus.md

## Todo
- [x] Close route: clear the leftover Z reading + closing cash count on a still-open shift instead of blocking it (`src/app/api/shifts/[id]/close/route.ts`)
- [x] Close page: show the error inside the authorization box, next to the Confirm button (`src/app/dashboard/shifts/close/page.tsx`)
- [x] Type-check: no new errors (only errors that already existed)
- [ ] After deploy: cashier clicks Confirm & Close Shift again for shift 1015; then confirm it is closed and location 4 zCounter = 332

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
