# Intermittent-Internet Data-Integrity Fixes

Plan: C:\Users\Warenski\.claude\plans\i-want-yo-to-graceful-kahan.md (approved 2026-08-29)

## Todo

### Phase A — duplicate-sale windows
- [x] A1 (S1): idempotency.ts — STALE_KEY_THRESHOLD_MS 30s → 90s (> 60s sale tx budget)
- [x] A2 (S2): apiClient.ts — queue sale on retry exhaustion for network errors even when navigator.onLine === true; POS clears cart on queued sale
- [x] A3 (S4a): apiClient.ts — item removed from queue only after server confirms; localStorage is now the single source of truth

### Phase B — transfer double-fire
- [x] B1 (S3): send route — atomic claim `updateMany({id, status:'checked', stockDeducted:false})` inside transaction; 409 on already-sent
- [x] B2 (S3): receive route — atomic claim on validStatuses inside transaction; 409 on already-received

### Phase C — opening stock atomicity
- [x] C1 (S5): opening-stock route — both upsert+stockTransaction pairs wrapped in $transaction

### Phase D — client hardening
- [x] D1 (S7): inventory-correction approve — approving state, disabled button
- [x] D2 (S7): expense approve — approvingId state, disabled button (void already had one)
- [x] D3 (S4b): queue read-merge-write per operation — two tabs can no longer clobber each other
- [x] D4 (S6): purchase create now uses apiPost (Idempotency-Key; /api/purchases already wrapped in withIdempotency). AR payment + supplier payment DEFERRED — their server routes are not wrapped in withIdempotency, so a client header alone would do nothing; wrapping those routes is a follow-up.

### Verify
- [x] npx tsc --noEmit — zero errors in edited files (pre-existing errors in src/hooks/useCurrency.ts untouched)
- [x] npm run build — clean

## Round 2 Todo (adversarial review + return-side/PO audit) — ALL DONE

### Phase E — apiClient regressions from round 1
- [x] E1 (CRITICAL): processOfflineQueue on load (5s) + 60s interval (online event alone never fires on flaky WAN)
- [x] E2 (HIGH): offlineQueueExpired event now fired from readOfflineQueue prune path (2s poll was silently swallowing expiry alert)
- [x] E3 (HIGH): idempotency key computed at enqueue, stored on queue item, reused on replay (UTC-midnight = 8AM Manila key change → duplicate)
- [x] E4 (MEDIUM): minted ids for legacy queue items persisted back to storage

### Phase F — guarded claims (transfer pattern) on gates outside tx — all mapped to 409
- [x] F1: GRN approve (purchases/receipts/[id]/approve) — claim notIn ['approved','rejected']
- [x] F2: customer-return approve — claim status:'pending'
- [x] F3: issue-replacement — claim replacementIssued:false
- [x] F4: supplier-return approve + purchase-return approve — claim status:'pending'
- [x] F5: PO close — claim status notIn ['received','cancelled','pending'] (prevents totals drift on re-run); also fixed ITS misplaced timeout

### Phase G — misplaced tx timeouts (options passed to .create()/.update() instead of $transaction → tx silently ran at Prisma 5s default)
- [x] Full-repo sweep found 17 instances (a historic bad mass find-replace). ALL fixed — options removed from the model call, timeout attached to the $transaction:
  supplier-returns, purchases/returns, purchases/[id]/close, banks, bank-transactions/manual, payments, payments/batch, purchases/amendments/[id]/approve, purchases/generate-from-suggestions, purchases/receipts, purchases/[id]/amendments, purchases (PO create), qc-inspections/[id]/conduct, quotations, roles/[id], job-orders (create/complete/parts/parts-delete/delete), location-changes/[id]/approve, locations, products (create), products/[id] (update: options were on plain generateProductSKU helper), products/bulk-add-to-location, service-payments (create/void), superadmin/businesses
- Left alone: sales/[id]/refund (dead route, no caller)

### Phase H — exchange idempotency
- [x] ExchangeDialog — key held in useRef, generated once per attempt, reused on retry, cleared on success/close

### Verify round 2
- [x] tsc --noEmit: zero errors outside pre-existing useCurrency.ts
- [x] npm run build clean. 44 files changed total (rounds 1+2), uncommitted.

## Review

### Files changed
- `src/lib/idempotency.ts` — stale-key threshold 30s → 90s (S1: retry could delete key while original 60s sale transaction still running → duplicate sale + double stock deduction)
- `src/lib/client/apiClient.ts` — offline queue rewritten: localStorage is source of truth (read on every op), items get UUIDs, item removed only AFTER server confirms (S4a), read-merge-write prevents two-tab clobber (S4b), re-entrancy guard on processOfflineQueue; network-error detection (`TypeError`/`TimeoutError`/`AbortError`) so retry exhaustion queues the sale even when navigator.onLine is still true (S2); fetch spread order fixed so caller headers can't drop Idempotency-Key
- `src/app/dashboard/pos/page.tsx` — a queued sale now clears the cart (same reset as duplicate-sale path) with a "DO NOT re-enter" alert; leaving the cart intact was inviting the cashier to re-ring → duplicate after replay
- `src/app/api/transfers/[id]/send/route.ts` — atomic claim inside transaction (guarded updateMany), 409 TRANSFER_ALREADY_SENT (S3)
- `src/app/api/transfers/[id]/receive/route.ts` — same pattern, 409 TRANSFER_ALREADY_RECEIVED (S3)
- `src/app/api/products/[id]/opening-stock/route.ts` — balance upsert + ledger row now commit atomically, both branches (S5)
- `src/app/dashboard/inventory-corrections/[id]/page.tsx` — approve button in-flight disable (S7)
- `src/app/dashboard/expenses/page.tsx` — approve button in-flight disable (S7)
- `src/app/dashboard/purchases/create/page.tsx` — create now goes through apiPost with idempotency key, no offline queueing (S6, partial)

### Deferred / follow-ups
1. Wrap AR-payment and supplier-payment API routes in withIdempotency, then switch their pages to apiPost (S6 remainder).
2. Async transfer send/complete poll-failure UX (`transfers/[id]/page.tsx`) — modal clears on poll error while server job continues; B-phase server guard now makes a re-click harmless for send, but UX still confusing.
3. `physical-inventory/import/route.ts:260` positional-args call to updateStock — latent defect, not connectivity.
4. Midnight replay of queued sale gets a new idempotency key (date component) — only the 10s dup window + saleDate guard apply.
5. Void route stock restore labeled ADJUSTMENT instead of SALE_VOID (reporting cosmetics).

### Behavior changes to tell staff
- Sale that fails after retries on a flaky (but "connected") network is now QUEUED and the cart CLEARS. Alert says do not re-enter. Previously it errored and kept the cart.
- Second send/receive of the same transfer now returns "already sent/received" instead of silently double-moving stock.

### Not committed — awaiting user go-ahead (live production repo).
