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
| Checkout_KillAfterCommit | **fail** | Known finding F6 |
| TransferStock_UI | pass | The routes the screens call (send-async, receive, complete-async) are safe |
| TransferStock_AllRoutes | **fail** | Known finding F1 (cancel after receive) |
| TransferStock_NoCancel | **fail** | Known finding F2 (plain status update reopens a transfer) |
| SaleReturns_Current | **fail** | Known finding F3 (void vs exchange race) |
| SaleReturns_OneAtATime | **fail** | Known finding F4 (return after void, no race needed) |
| SaleReturns_Fixed | pass | The PROPOSED fix (`LockSale = TRUE`), not today's code |
| Receiving_OneAtATime | pass | GRNs one at a time are safe |
| Receiving_ConcurrentApprove | pass | Approving a GRN / supplier return / replacement twice is blocked |
| Receiving_Concurrent | **fail** | Known finding F5 (two GRNs created at once) |

`expected=fail` rows are **known bugs in today's code**. The model must keep catching them until the product code is fixed.

## When to use it

Run it when your change touches any file in the coverage table, and especially when you change:
- a `where:` in an `updateMany` claim, or a `status` set
- which value a route reads before `prisma.$transaction` and then uses inside it
- a new route that changes a transfer/sale/return/GRN status or calls `addStock` / `deductStock` / `bulkUpdateStock` / `transferStockOut` / `transferStockIn` / `process*`

## Coverage record

**Last confirmed in sync with the code at commit `fb30d53b`.**

| Model step | Code |
|---|---|
| Checkout `Try` / `Mark` / `Age` | `src/lib/idempotency.ts` `withIdempotency` (claim line 66, stale 140–165, mark 97) |
| Checkout `Commit` | `src/app/api/sales/route.ts` POST, `prisma.$transaction` line 1081 |
| Checkout key | `src/lib/client/apiClient.ts` `generateDeterministicIdempotencyKey` |
| `CommitSend` | `src/app/api/transfers/[id]/send/route.ts` claim 205; `src/lib/job-processor.ts` `processTransferSend` claim 456 |
| `CommitReceive` | `src/app/api/transfers/[id]/receive/route.ts` claim 249, `deductAtReceive` 263 |
| `CommitCompleteSync` | `src/app/api/transfers/[id]/complete/route.ts` claim 177 |
| `CommitCompleteJob` | `src/lib/job-processor.ts` `processTransferComplete` claim 597; pre-check `complete-async/route.ts` 69 |
| `CommitCancel` | `src/app/api/transfers/[id]/cancel/route.ts` claim 95, restore 108 |
| `CommitPlainStatus` | `mark-arrived/route.ts` 120, `start-verification/route.ts` 87, `verify-all/route.ts` 111 |
| `CommitVoid` | `src/app/api/sales/[id]/void/route.ts` 254 (returns check), 279 (lock); same pattern in `src/app/api/sales/[id]/route.ts` DELETE |
| `CommitExchange` | `src/app/api/sales/[id]/exchange/route.ts` checks 115, 290–316; transaction 398 |
| `CommitCreate` (returns) | `src/app/api/customer-returns/route.ts` POST (qty check 198) |
| `CommitApprove` (returns) | `src/app/api/customer-returns/[id]/approve/route.ts` claim 81 |
| GRN `CommitCreate` | `src/app/api/purchases/[id]/receive/route.ts` checks 95–150, transaction 235 |
| GRN `CommitApprove` | `src/app/api/purchases/receipts/[id]/approve/route.ts` claim 304 |
| `CommitDoc` | `supplier-returns/[id]/approve/route.ts` 147, `purchases/returns/[id]/approve/route.ts` 115, `customer-returns/[id]/issue-replacement/route.ts` 148 |
| Assumed correct, not modelled | `update_inventory_with_history` / `bulk_update_inventory_with_history` (balance computed server-side under `FOR UPDATE`, `database/functions/*v3*.sql`, `bulk_*.sql`) |

To see whether the code moved since the sync commit:

```bash
git diff --stat fb30d53b -- src/lib/idempotency.ts src/lib/job-processor.ts src/lib/stockOperations.ts \
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
2. If you fixed a known finding, flip its row in `formal/run.sh` from `fail` to `pass`. For sale returns, set `LockSale` to match what the code now does, or fold the fix into the main actions.
3. Prove the check can still fail. Temporarily delete the guard you rely on from the model (for example `IF status = "checked" /\ ~stockDeducted` → `IF TRUE`), run, see `got=fail`, then restore it.
4. Update the coverage table lines and the sync commit.

## Known findings at `fb30d53b` (product code NOT changed)

- **F1 Cancel after receive adds stock twice.** Steps: send (origin −1), receive (destination +1), then POST `/api/transfers/[id]/cancel`. The claim only excludes `completed`/`cancelled`, so a `received` transfer can be cancelled, and the origin gets +1 back while the destination keeps its +1. A second risk in the same route: `transfer.stockDeducted` is read before the transaction, so a cancel that overlaps a send cancels without restoring (stock lost; found by reading the code, not checked by the model, which only checks for double posting). No screen calls this route today, but the API is live.
- **F2 A plain status update reopens a finished transfer.** `mark-arrived`, `start-verification` and `verify-all` (modelled), and `verify-item` (same pattern, not modelled), check status outside the transaction, then run `update({ where: { id } })` with no status in the WHERE. If a complete/receive commits between the check and the update, the transfer goes back to `arrived`/`verifying`/`verified`, and a second complete adds the destination stock again. (Sync `receive` never sets `stockReceived`, so `complete-async` is not stopped by that flag either.) API-only today.
- **F3 Void and exchange at the same time return the units twice.** Void checks "no returns" before its transaction. Exchange checks sale status and earlier returns before its transaction and never locks the sale. Both commit, and the returned unit is added by the exchange AND by the void.
- **F4 A customer return on a voided sale adds stock again. No race is needed.** Steps: void the sale (all units back), create a customer return for it (`customer-returns` POST does not check `sale.status`), approve it, and the units are added again. The same happens with two returns of the same unit by different staff, or more than 5 minutes apart, because the quantity check is per return, not cumulative.
- **F5 Two GRNs created at the same moment for one delivery.** The "pending GRN already exists" check runs outside the transaction, and the route has no Idempotency-Key. The approve step does not compare against the ordered quantity, so approving both receives the delivery twice.
- **F6 Checkout: a function stopped after the sale commits.** If Vercel stops `/api/sales` between the sale commit and `markKeyCompleted`, the key stays `processing`. After 180 s, a retry with the same key deletes it as stale and creates a second sale. This is rare (needs a kill in a window of milliseconds).
- **Not modelled:** `src/app/api/sales/[id]/refund/route.ts` has no "already refunded" check, but it calls `addStock` with the wrong argument shape (positional, not an object), so it fails today, and no screen calls it. If someone "fixes" that call, it becomes an unlimited double add.

## What this does NOT cover

- Up to 3–4 overlapping requests, one document, and 1–2 units. Larger numbers follow the same paths, but they are not checked.
- Stock balance arithmetic (assumed correct in the stored functions), inventory corrections, physical-count imports, CSV imports, opening stock, and serial-number status.
- Money and accounting (AR/AP, shift totals).
- Whether the code matches the model. That is a human check, done against the coverage table.
