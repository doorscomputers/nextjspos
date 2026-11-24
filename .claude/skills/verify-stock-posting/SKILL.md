---
name: verify-stock-posting
description: Model-check that stock is never deducted or added twice and that stock is set correctly (sales checkout, transfer send/receive/complete/cancel, GRN receiving, exchange, void, customer return, supplier return, replacement, inventory corrections, physical-count upload, opening stock, and the database stock function). Use before committing ANY change to the files in the coverage table below, or when someone reports doubled or missing stock.
---

# Verify: no double stock posting

## The property, in plain words

- One checkout deducts its items once. One transfer leaves the origin once, arrives once, is put back once at most, and is never both at the destination and back at the origin. One GRN adds its stock once, and a PO line never receives more than ordered. Units put back for a sale (void + exchange + customer returns) never exceed what was sold. Every other approve-once document (supplier return, purchase return, replacement issue) moves stock once.
- A correction moves stock only if it ends approved and not deleted, once, to the count shown on it; approving two corrections leaves stock at the last count. A physical-count upload sets stock to the counted quantity once. Opening stock is set once. The stock balance always equals the sum of its stock_transactions rows.
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
bash formal/run.sh Corrections     # every config whose name starts with Corrections
bash formal/run.sh large           # bigger numbers for Checkout / TransferStock / SaleReturns / Receiving (about 2.5 minutes)
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
| Corrections_OneAtATime | **fail** (G1) | Reject, then approve: a rejected correction is approved and moves stock |
| Corrections_Concurrent | **fail** (G1, G2) | Approve overlapping reject / delete / edit, or two approvals for one item |
| Corrections_Fixed | pass | With the fix (see G1, G2) |
| Imports_Upload | **fail** (G3) | Physical-count upload submitted twice at once: the difference is added twice |
| Imports_UploadOneAtATime | pass | Re-uploading the same file later is safe (difference is re-read) |
| Imports_Opening | **fail** (G4) | Opening stock saved twice at once / overlapping a sale or receive |
| Imports_Fixed | pass | With the fix |
| StockFunction_RowExists | pass | The database stock function, 4 movements at once, stock row exists |
| StockFunction_FirstPosting | **fail** (G5) | First ever movement of an item at a branch, two at once: one is lost |
| StockFunction_Fixed | pass | With the fix (create the row, then lock it) |

In `formal/run.sh` a row marked `fail` records a KNOWN bug that the model must keep catching until the code is fixed (G1-G5 below, waiting for the owner). Each failing model has a `Fixed` switch: `Fixed = TRUE` is the smallest fix that makes it pass. `run.sh` shows only the first property that breaks; to see each one, copy the `.cfg`, keep one name on the `INVARIANTS` line and run TLC on the copy from `formal/`. The money models (`Payments_*`, `Shifts_*`) belong to the `verify-money` skill.

## When to use it

Run it when your change touches any file in the coverage table, and especially when you change:
- a `where:` in an `updateMany` claim, or a `status` set
- which value a route reads before `prisma.$transaction` and then uses inside it
- an inventory-corrections route, the physical-inventory upload, opening stock, or a `database/functions/*.sql` stock function
- a new route that changes a transfer/sale/return/GRN status or calls `addStock` / `deductStock` / `bulkUpdateStock` / `transferStockOut` / `transferStockIn` / `process*`

## Coverage record

**Last confirmed in sync with the code at commit `e76c2076`** (no `src/` change since `80193d81`).

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
| Corrections `Approve` pre | `src/app/api/inventory-corrections/[id]/approve/route.ts` `findFirst` (deletedAt null) 51, approved check 79, `physicalCount` 91; `bulk-approve/route.ts` 54/86 |
| Corrections `CommitClaim` / `CommitPost` | approve 95-101 claim `status <> 'approved'`, `getCurrentStock` (no lock, `src/lib/stockOperations.ts` 298-323), `updateStock(physicalCount - currentQty)` 114; bulk-approve 115-138 (one transaction per correction) |
| Corrections `CommitReject` | `[id]/reject/route.ts` checks 82/88, `update({ where: { id } })` 102 (no transaction) |
| Corrections `CommitEdit` / `CommitDelete` | `[id]/route.ts` PUT check 143, update 170; DELETE check 281, update 288; `bulk-delete/route.ts` 80→98 |
| Imports `Upload` | `src/app/api/admin/physical-inventory-upload/route.ts` stock read 291/380, difference 411, transaction 488, `updateStock(quantity: difference)` 539-544 |
| Imports `Opening` | `src/app/api/products/[id]/opening-stock/route.ts` checks 131/145-159, transaction 165-205 (absolute `qtyAvailable` upsert + ledger row); the single-product branch further down has the same pattern |
| Imports `Move`, StockFunction `Read` / `Write` | `update_inventory_with_history` (`database/functions/update_inventory_with_history_v3_schema_fix.sql` lock 31-37, balance 39-40, negative check 42, upsert 49-54) and `bulk_update_inventory_with_history` (`bulk_update_inventory_with_history.sql` 83-94); called from `stockOperations.ts` 632 / 839. Live definitions checked 2026-11-24: same lock, balance and `ON CONFLICT ... DO UPDATE SET qty_available = EXCLUDED.qty_available` text |

To see whether the code moved since the sync commit:

```bash
git diff --stat e76c2076 -- src/lib/idempotency.ts src/lib/job-processor.ts src/lib/stockOperations.ts \
  src/app/api/sales src/app/api/transfers src/app/api/customer-returns \
  src/app/api/purchases src/app/api/supplier-returns src/app/api/inventory-corrections \n  src/app/api/admin/physical-inventory-upload src/app/api/products database/functions
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

### Part 2 findings (found at `e76c2076`, NOT fixed - waiting for the owner)

Production checks on 2026-11-24 (read-only): all 9,989 stock rows equal the sum of their `stock_transactions` rows, and no item has two opening-stock rows. So none of G1-G5 has visibly damaged stock yet.

- **G1 A correction's decision is not final.**
  - Approve's claim only excludes `approved` (`status <> 'approved'`), and its pre-check only refuses `approved`. So a **rejected** correction can still be approved and move stock, even one request at a time.
  - Reject, delete and edit write `where: { id }` with no status. If one overlaps an approve, you get a correction that shows `rejected` or deleted while its stock was posted, or one whose shown count differs from the posted count.
  - Fix (as modelled with `FixedClaim`): every write uses `updateMany where { id, status: 'pending', deletedAt: null }` and returns 409 on 0 rows.
  - Production: 1 rejected and 1 deleted-approved correction. Neither has a stock row (id 482 and 305), so no stock moved.
- **G2 Two corrections for the same item approved at the same moment.**
  - Each reads stock with `getCurrentStock` (no lock) and posts `count - read`, so stock ends at count1 + count2 - old instead of the last count.
  - Fix: take the difference from the balance locked inside the stock function, or lock the stock row (`FOR UPDATE`) before reading.
  - Bulk approve runs one at a time, so the window needs two separate approve requests.
- **G3 Physical-count upload (Admin > Physical Inventory Upload) submitted twice at the same moment.**
  - Both read stock before the transaction and both add the difference, so the count is applied twice.
  - A sale between the read and the save also leaves stock one off the count.
  - Uploading the same file again later is safe.
  - Fix: compute the difference from the locked balance inside the transaction.
- **G4 Opening stock saved twice at once, or while a sale or receive posts.**
  - The "no transactions yet" check is outside the transaction, and the save writes `qtyAvailable` as an absolute value.
  - Result: two opening rows with one balance, or a receive that is overwritten.
  - Fix: re-check under a row lock inside the transaction.
- **G5 The database stock function, very first movement of an item at a branch.**
  - When the `variation_location_details` row does not exist, `FOR UPDATE` locks nothing. Two first movements at once both start from 0, and `ON CONFLICT DO UPDATE SET qty_available = EXCLUDED.qty_available` keeps only the second.
  - With the row present, the function is proven correct (4 at once).
  - Production has 1,211 item×branch pairs with no row yet. They get their row on the first transfer in, GRN or sale, so the window is real but rare.
  - Fix: `INSERT ... ON CONFLICT DO NOTHING` the row first, then `SELECT ... FOR UPDATE`, in both functions.
- **Not modelled, recorded for later:**
  - **Serial numbers.** Production has 0 rows in `product_serial_numbers`, so the feature is unused. If it is turned on: the sale sets a serial to `sold` with `update where { id }` and no status (`sales/route.ts` 1260), so two sales can sell one serial. Transfer send (`transfers/[id]/send/route.ts` 244) and supplier return (`supplier-returns/[id]/approve/route.ts` 189) ignore a 0-row serial update. The async transfer jobs (`job-processor.ts`) do not update serials at all.
  - **`src/app/api/physical-inventory/import/route.ts`** (the Physical Inventory page). It calls `updateStock(...)` with positional arguments, so it fails, and production has 0 corrections from it. If someone fixes that call, note that it posts the stale CSV difference again on every re-upload (G3, but also one at a time).
  - **`physical-inventory/import-safe`** has no caller.
  - **`products/import` and `products/import-branch-stock`** create new products only.

## What this does NOT cover

- **Bounds.** The normal run (`bash formal/run.sh`) checks 3–4 overlapping requests, 1–2 documents and 1–2 units. `bash formal/run.sh large` checks the part-1 models with bigger numbers: Checkout 5 attempts, TransferStock 5 requests, SaleReturns 4 requests × 3 documents × 3 units sold, Receiving 4 requests × 3 GRNs × 3 units ordered. All of them pass. Receiving with 5 requests also passed once at `e76c2076` (367 million states, about 1 h 40 min), but that is too slow to keep in `run.sh`. Numbers above these follow the same code paths and are not checked.
- **The database stock function** (`update_inventory_with_history` and the bulk version) is checked by `StockFunction.tla` for the order of lock / read / write and for "balance = sum of movements". The SQL text itself is compared with the repo by hand: the live function matched the repo's v3 / bulk text on 2026-11-24. Decimal rounding is not modelled; quantities are whole numbers.
- **Serial numbers** are not modelled (production had 0 serial rows on 2026-11-24). Known risk from reading the code: a sale marks a serial `sold` with an update by id only, so two sales could sell one serial. Build `Serials.tla` before serial numbers are switched on.
- **Not modelled imports:** `physical-inventory/import` (used 0 times; broken by a positional `updateStock` call), `import-safe` and `products/import` (see "Part 2 findings → Not modelled").
- **Money** (AR/AP payments, shift totals, Z readings) belongs to the `verify-money` skill.
- Whether the code matches the model. That is a human check, done against the coverage table.
