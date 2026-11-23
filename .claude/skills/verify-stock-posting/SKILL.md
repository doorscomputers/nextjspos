---
name: verify-stock-posting
description: Model-check that stock is never deducted or added twice (sales checkout, transfer send/receive/complete/cancel, GRN receiving, exchange, void, customer return, supplier return, replacement). Use before committing ANY change to the files in the coverage table below, or when someone reports doubled or missing stock.
---

# Verify: no double stock posting

## The property, in plain words

- One checkout deducts its items once. One transfer leaves the origin once, arrives once, is put back once at most, and is never both at the destination and back at the origin. One GRN adds its stock once, and a PO line never receives more than ordered. Units put back for a sale (void + exchange + customer returns) never exceed what was sold. Every other approve-once document (supplier return, purchase return, replacement issue) moves stock once.
- Harm when broken: branch stock counts are wrong, so you get phantom stock that can be "sold" but is not on the shelf, or wrong valuation.

## How it works (read once)

`formal/*.tla` are TLA+ models of the routes. TLC (the TLA+ model checker) tries **every order** in which up to 3–4 overlapping requests can run.

Each HTTP request is two steps, true to the code:
1. **Pre**: the `findUnique` and status checks at the top of the route. These run *outside* the transaction, so the values can be out of date.
2. **Commit**: the `prisma.$transaction`, as one atomic step. A guarded `updateMany({ where: { id, status: ... } })` locks the row and re-checks the WHERE on the latest committed row (PostgreSQL READ COMMITTED), and the whole transaction commits together.

Any value the code takes from the step-1 read is taken from `snap` in the model. That is where the bugs are.

## Run it

```bash
bash formal/run.sh                 # all models, ~2 minutes
bash formal/run.sh TransferStock_UI   # one config
```

Needs Java 11+ (on this machine: OpenJDK 25). The script downloads TLA+ tools **v1.7.4** once into `formal/.tools/` (git-ignored), checks its SHA-256, and writes each run's full output to `formal/.tools/<config>.out`.

Success means the last line is `ALL AS EXPECTED`. Each line shows `expected=` and `got=`:

| Config | Expected | What it means |
|---|---|---|
| Checkout_NoKill | pass | Same Idempotency-Key, retries, double clicks → one sale |
| Checkout_KillAfterCommit | pass | Even if Vercel stops the function right after the sale commits, a retry never makes a second sale (F6 fix) |
| TransferStock_UI | pass | The routes the screens call (send-async, receive, complete-async) |
| TransferStock_AllRoutes | pass | All 11 transfer routes, 4 requests at once, incl. cancel and the status-only routes (F1, F2 fixes) |
| SaleReturns_Concurrent | pass | Void, exchange, return create and approve overlapping (F3, F4 fixes) |
| SaleReturns_OneAtATime | pass | Same, one after another (return after void, repeat returns) |
| Receiving_OneAtATime | pass | GRNs one at a time |
| Receiving_ConcurrentApprove | pass | Approving a GRN / supplier return / replacement twice is blocked |
| Receiving_Concurrent | pass | Two GRNs created at once for one delivery (F5 fix) |

Every row is expected to pass. In `formal/run.sh` a row can be marked `fail` to record a KNOWN bug that the model must keep catching until the code is fixed. There are none at the sync commit.

## When to use it

Run it when your change touches any file in the coverage table, and especially when you change:
- a `where:` in an `updateMany` claim, or a `status` set
- which value a route reads before `prisma.$transaction` and then uses inside it
- a new route that changes a transfer/sale/return/GRN status or calls `addStock` / `deductStock` / `bulkUpdateStock` / `transferStockOut` / `transferStockIn` / `process*`

## Coverage record

**Last confirmed in sync with the code at commit `80193d81`.**

| Model step | Code |
|---|---|
| Checkout `Try` / `Mark` / `Age` | `src/lib/idempotency.ts` `withIdempotency` (claim ~line 66, stale-sale 409 at 154, other stale keys 169+, mark `markKeyCompleted`) |
| Checkout `Commit` | `src/app/api/sales/route.ts` POST, `prisma.$transaction` line 1081 |
| Checkout key | `src/lib/client/apiClient.ts` `generateDeterministicIdempotencyKey`; new `cartSessionId` per click `src/app/dashboard/pos/page.tsx` ~2185 |
| `CommitSend` | `src/app/api/transfers/[id]/send/route.ts` claim 205; `src/lib/job-processor.ts` `processTransferSend` claim 456 |
| `CommitReceive` | `src/app/api/transfers/[id]/receive/route.ts` claim 249 (incl. `stockReceived`), `deductAtReceive` 264 |
| `CommitCompleteSync` | `src/app/api/transfers/[id]/complete/route.ts` claim 177 (incl. `stockReceived`) |
| `CommitCompleteJob` | `src/lib/job-processor.ts` `processTransferComplete` claim 597; pre-check `complete-async/route.ts` 69 |
| `CommitCancel` | `src/app/api/transfers/[id]/cancel/route.ts` pre-check 92, claim 101, locked re-read of `stockDeducted` 120 |
| `CommitPlainStatus` | conditional `updateMany` in `mark-arrived/route.ts` 122, `start-verification/route.ts` 88, `verify-all/route.ts` 113, `verify-item/route.ts` 134, `unverify-item/route.ts` 112 |
| `CommitVoid` | `src/app/api/sales/[id]/void/route.ts` lock 279, locked returns count 313; `src/app/api/sales/[id]/route.ts` DELETE lock 253, returns count 281 |
| `CommitExchange` | `src/app/api/sales/[id]/exchange/route.ts` pre-checks 115, 290–316; sale lock + re-check 404 |
| `CommitCreate` (returns) | `src/app/api/customer-returns/route.ts` POST, sale lock + voided + cumulative check 355 |
| `CommitApprove` (returns) | `src/app/api/customer-returns/[id]/approve/route.ts` sale lock + checks 83, claim 118 |
| GRN `CommitCreate` | `src/app/api/purchases/[id]/receive/route.ts` pre-checks 95–150, PO lock + re-check 240 |
| GRN `CommitApprove` | `src/app/api/purchases/receipts/[id]/approve/route.ts` claim 304, PO lock + ordered-qty check 316 |
| `CommitDoc` | `supplier-returns/[id]/approve/route.ts` 147, `purchases/returns/[id]/approve/route.ts` 115, `customer-returns/[id]/issue-replacement/route.ts` 148 |
| Assumed correct, not modelled | `update_inventory_with_history` / `bulk_update_inventory_with_history` (balance computed server-side under `FOR UPDATE`, `database/functions/*v3*.sql`, `bulk_*.sql`) |

To see whether the code moved since the sync commit:

```bash
git diff --stat 80193d81 -- src/lib/idempotency.ts src/lib/job-processor.ts src/lib/stockOperations.ts \
  src/app/api/sales src/app/api/transfers src/app/api/customer-returns \
  src/app/api/purchases src/app/api/supplier-returns
```

If that lists files, re-read the changed lines against the table. Move the sync commit forward **only** after you confirm the models still describe the code at the new commit.

## Reading a result

- Read every TLC counterexample with the pstack **/statechart** skill (`/pstack:statechart`). It turns the trace into the shortest path in plain words, and when a model passes it draws how the document moves between states.
- Raw trace: `formal/.tools/<config>.out`. Each `State n: <CommitXxx ...>` is one route's transaction. Map it back with the coverage table.

**Real bug or modelling error?** Take the trace and replay it against the code one step at a time. For each step, open the route and check that (a) its pre-check would really pass with that `snap`, and (b) its transaction would really commit with those values. If every step matches the code, it is a real bug: report it in the code's words and do **not** weaken the model. If a step cannot happen in the code, the model is wrong: fix that action and cite the code line.

## Updating after an intended change

1. Change the matching `Commit*` / `PreOK` action so it mirrors the new code. Put the file and line in a comment.
2. If you fixed a known finding, flip its row in `formal/run.sh` from `fail` to `pass`.
3. Prove the check can still fail. Temporarily delete the guard you rely on from the model (for example `IF status = "checked" /\ ~stockDeducted` → `IF TRUE`), run, see `got=fail`, then restore it.
4. Update the coverage table lines and the sync commit.

## Findings history

Found at `fb30d53b`, fixed at `80193d81`. Each fix has a model check that fails if the guard is removed.

- **F1 Cancel after receive added stock twice; a cancel overlapping a send lost stock.** Fix: cancel refuses `received` / `stockReceived` transfers (pre-check and claim), and re-reads `stockDeducted` under the row lock. Invariants `NoStockFromNothing`, `NoLostOnCancel`.
- **F2 Status-only routes reopened finished transfers, and a second complete added stock again.** Fix: mark-arrived, start-verification, verify-all, verify-item and unverify-item update only `WHERE status = <the status they checked>` (409 otherwise). Sync receive and sync complete now set and require `stockReceived = false`, so destination stock is added once whatever the status says. Invariant `NoDoubleTransferIn`.
- **F3 Void and exchange at the same time returned units twice.** Fix: exchange locks the sale (`FOR UPDATE`) and re-checks status and earlier returns inside its transaction. Both void routes count active returns inside their locked transaction. (`sales/[id]` DELETE had no returns check at all.)
- **F4 A return on a voided sale, or repeat returns, added stock again.** Fix: customer-return create and approve lock the sale, refuse voided/cancelled sales, and require all active returns ≤ sold, per product variation. Two such returns existed in production before the fix: `RTN-EXC-202606-0003` (invoice `InvBambang06_07_2026_0002`) and `RTN-EXC-202606-0002` (invoice `InvMain06_05_2026_0009`). The owner must check those by hand.
- **F5 Two GRNs at once for one delivery.** Fix: GRN create locks the PO row and re-checks "no pending GRN" and ordered quantity. GRN approve locks the PO and refuses to go past the ordered quantity. (Production had 0 over-received PO lines, so no normal work is blocked.)
- **F6 Checkout stopped right after the sale commit could be re-run 180 s later.** Fix: a stale `processing` key on `/api/sales` returns 409 "may already be saved" and is never re-run. Each new Checkout click sends a new `cartSessionId`, so the cashier is not stuck. Other endpoints keep the old stale-key retry; their stock effects are guarded by document claims.
- **Still open, not modelled:** `src/app/api/sales/[id]/refund/route.ts` has no "already refunded" check. It calls `addStock` with the wrong argument shape (positional, not an object), so it fails today, and no screen calls it. If someone "fixes" that call, add the same sale lock and cumulative check as customer returns first.

## What this does NOT cover

- Up to 3–4 overlapping requests, one document, and 1–2 units. Larger numbers follow the same paths, but they are not checked.
- Stock balance arithmetic (assumed correct in the stored functions), inventory corrections, physical-count imports, CSV imports, opening stock, and serial-number status.
- Money and accounting (AR/AP, shift totals).
- Whether the code matches the model. That is a human check, done against the coverage table.
