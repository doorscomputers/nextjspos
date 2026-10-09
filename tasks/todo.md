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
