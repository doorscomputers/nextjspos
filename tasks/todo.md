# Fix: crash-safe transfer receive (no leaked claim on hard-kill)

## Problem

`processTransferComplete` (src/lib/job-processor.ts:541) claims `stockReceived = true` in its own commit, then processes items in per-batch transactions, then sets `status = 'completed'` in another separate commit. If the serverless function is hard-killed mid-processing (Vercel 60s timeout, crash, deploy):

1. **Claim leaks** — `stock_received = true` with status stuck `in_transit`; every retry gets 409 (exactly how TR-202608-0062 looked, different trigger).
2. **Worse, partial-batch hazard** — batches commit independently. Killed after batch 1 commits → 30 items already added to destination stock. Any manual flag reset + retry would re-add those 30 items (the bulk stock step does not check per-item whether stock was already added) → **double stock**.

## Fix (1 file: src/lib/job-processor.ts, function processTransferComplete only)

Wrap claim + all item processing + final status update in **ONE Prisma transaction**:

```
await prisma.$transaction(async (tx) => {
  1. Atomic claim (moved inside, first statement):
     tx.stockTransfer.updateMany({ where: { id, status in valid, stockReceived: false }, data: { stockReceived: true } })
     → count 0 ⇒ mark skipped, return early
  2. Existing batch loop logic unchanged — but using this outer tx
     (bulkUpdateStock already executes directly in a passed tx — stockOperations.ts:886)
  3. status = 'completed' update (moved inside, last statement)
}, { timeout: 300000, maxWait: 20000 })
```

Result: hard-kill at ANY point → Postgres aborts the connection's transaction → **everything rolls back including the claim** → transfer immediately re-receivable, zero partial state, zero double-add. No schema change, no stale-claim timer, no recovery job.

Keep: pre-checks, catch-block claim release (harmless no-op after rollback), job progress updates (move to tx).

## Trade-offs (accepted)

- Second concurrent click blocks on the row lock until the first commits (~4s for a 22-item transfer, 30-45s for 70 items), then correctly skips → 409. Route-level fast-fail still catches non-simultaneous duplicates instantly.
- Stock row locks held for the whole transfer instead of per batch — bounded by the same durations.
- A transfer too large to process within Vercel's 60s still can't complete — unchanged from today, but now it cleanly rolls back instead of leaking a claim.

## Out of scope (flag for later)

`processTransferSend` (job-processor.ts:408) and the synchronous send route have the same claim + per-batch pattern on `stockDeducted` — same crash window on the send side. Same fix pattern applies; separate change if wanted.

## Steps

- [x] Restructure processTransferComplete into single transaction
- [x] Typecheck (`npx tsc --noEmit`, filter file) — zero errors
- [x] Commit `d9c947c`, push, Vercel deploy
- [ ] Post-deploy: receive a real transfer end-to-end, verify counts + no stuck claims

## Review

Commit `d9c947c` — src/lib/job-processor.ts only, ~96 lines changed, all inside
processTransferComplete:

- Atomic `stockReceived` claim moved to the first statement INSIDE one
  `prisma.$transaction` that also wraps every 30-item batch and the final
  `status = 'completed'` update (timeout 300s).
- Hard kill / thrown error at any point → Postgres rolls back everything,
  including the claim. No leaked claim, no partial batches, no double-add on
  retry. Invariant: stock added ⟺ status = completed.
- Removed manual `stockReceived: false` release in the catch path — rollback
  already releases it, and an explicit reset could clobber a claim taken by a
  newer request after our rollback.
- Skip path (`claimed.count === 0`) now signals via a `skipped` flag returned
  after the transaction; route maps it to 409 (from previous fix `d0ae51d`).
- Batch body (auto-verify, receivedQuantity, bulkUpdateStock, progress) is
  byte-for-byte unchanged — only the transaction wrapper moved.
- processTransferSend deliberately untouched (same pattern, separate follow-up).

## Follow-up: send side (approved by user)

Audit of ALL send/receive paths:
- `send-async` route + `processTransferSend` — ACTIVE path (UI page.tsx:586).
  Had same multi-commit claim pattern → fixed identically: claim + batches +
  status='in_transit' in one transaction; send-async route now reports real
  job outcome (was: always 200 even on failure).
- Sync `receive/route.ts` (Quick Receive, UI page.tsx:825) — already fully
  wrapped in one $transaction (line 244, 120s timeout) + withIdempotency.
  SAFE, untouched.
- Sync `send/route.ts` — no UI callers (legacy); already single $transaction
  (line 200) + withIdempotency. SAFE, untouched.

## Follow-up 2: create-route duplicate guard false positive (`3d9c668`)

Angelo blocked with "Duplicate transaction detected" creating a 3-item
transfer — guard blocked on same user + same from/to pair within 60 min,
never comparing items (his unrelated 20-item transfer 1924 was 55 min old).
Fixed: create guard now compares productVariationId:quantity fingerprints
(mirrors send-route guard). True network-retry duplicates still blocked;
different contents pass. No schema change.

## Follow-up 3: audit of ALL duplicate guards (`0ff28d5`)

- cash/in, cash/out — already compare amount (+/-0.01) + shift + type. Sound, untouched.
- inventory-corrections — was user+product+location+time only; added physicalCount (+/-0.01) match.
- purchases/receipts — was user+supplier+location+time only (broke back-to-back
  partial receipts); added productVariationId:quantityReceived fingerprint compare.
- customer-returns — replacement-only returns matched ANY return on the sale;
  added productVariationId:quantity:returnType fingerprint compare.

## 2026-08-12 — Manage Stock filter on Product list

Task: users confused between "Selling" filter (notForSelling) and "Manage Stock?" checkbox (enableStock);
no way to audit which products had Manage Stock unchecked (those are silently excluded from inventory counting).

Changes:
- [x] src/app/dashboard/products/page.tsx — new "Manage Stock: All / Checked / Unchecked" dropdown
      beside Selling filter; sends enableStock=true/false query param; added to fetch deps + page-reset effect.
- [x] src/app/api/products/list/route.ts — reads enableStock param, adds whereClause.enableStock.

Review: two flags are distinct by design — notForSelling = not sold at POS but still counted;
enableStock=false = no stock tracking at all (services/charges). No schema change. tsc clean on both files.

## 2026-08-12 — Deactivated products selectable in Transfer Create (branch users)

Task: branch users (Bambang, Tuguegarao, Main Branch) could search/select deactivated
products on Transfer Create; warehouse could not. Not role-based — Create page sent
`status=active` to /api/products, which only reads `active`/`forTransaction` params,
so the filter was silently ignored. Deactivated items appeared only where they still
had stock > 0 (branches), hiding the bug from the warehouse.

Changes:
- [x] src/app/dashboard/transfers/create/page.tsx:150 — `status=active` → `forTransaction=true`
      (API sets isActive: true for this param; one-line fix, no API change).

Review: Add-Items dialog on existing transfers unaffected (uses /api/products/search,
which already enforces isActive). Existing draft transfers created before the fix may
still contain deactivated items — remove manually if found. Change is inside a fetch
URL string literal; no type impact.
