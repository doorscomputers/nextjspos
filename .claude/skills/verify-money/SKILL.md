---
name: verify-money
description: Model-check that money is counted once - customer (AR) payments on credit sales, supplier (AP) payments, and cashier shift totals / X-Z readings / BIR accumulated sales. Use before committing ANY change to the files in the coverage table below, or when someone reports an overpaid invoice, a supplier balance that does not match its payments, a wrong Z reading, a Z counter jump, or a sale landing in a closed shift.
---

# Verify: money is counted once

## The property, in plain words

- A customer is never charged past the sale total. A voided sale stays voided. A sale shows `completed` exactly when it is paid in full.
- A supplier invoice's `paidAmount` is the sum of its payment rows, and never more than the invoice.
- A cashier has at most one open shift. Closing a shift raises the branch Z counter once and adds its sales to the BIR accumulated sales once. The Z reading / system cash of a closed shift equals the money recorded in that shift, and nothing is added to a shift after it closed.
- Harm when broken: wrong receivables and payables, a voided sale coming back to life, wrong cash-count variance, and BIR Z readings / accumulated grand totals that do not match the shifts (a compliance problem).

## How it works (read once)

Same method as `.claude/skills/verify-stock-posting` (read its "How it works"). `formal/Payments.tla` and `formal/Shifts.tla` are TLA+ models. TLC tries **every order** in which up to 3 overlapping requests can run. Each request is a pre-check outside `prisma.$transaction` (values kept in `snap`, which can be stale) and then the transaction as one atomic step. Every model has a `Fixed` switch: `Fixed = FALSE` is today's code; `Fixed = TRUE` is the smallest fix that makes all properties hold (a row lock or a status in the `WHERE`, re-check inside the transaction, `{ increment }` instead of an absolute value).

## Run it

```bash
bash formal/run.sh Payments     # AR + AP, a few seconds
bash formal/run.sh Shifts       # shifts, a few seconds
bash formal/run.sh              # every model (stock + money)
```

Needs Java 11+ (this machine: OpenJDK 25). The script downloads TLA+ tools v1.7.4 once into `formal/.tools/` (git-ignored, SHA-256 checked) and writes each run to `formal/.tools/<config>.out`. Success = last line `ALL AS EXPECTED`.

| Config | Expected today | What it means |
|---|---|---|
| Payments_ArOneAtATime | **fail** (G6) | Void, then a payment on the same credit sale: accepted, and the sale goes back to `pending` |
| Payments_ArConcurrent | **fail** (G6) | Two payments at once: paid > total, or fully paid but left `pending` |
| Payments_ApOneAtATime | pass | Supplier payments one after another are right |
| Payments_ApConcurrent | **fail** (G7) | Single + batch payment at once: one payment lost from `paidAmount`, overpay |
| Payments_ApSingleOnly | **fail** (G7) | Two single payments: the unique payment number blocks some orders, not all |
| Payments_Fixed | pass | All of the above with the fix |
| Shifts_OneAtATime | pass | Open / sale / close one after another are right |
| Shifts_Concurrent | **fail** (G8) | Double close, sale landing after the Z snapshot or in a closed shift, two open shifts |
| Shifts_Fixed | pass | With the fix |

A `fail` row is a KNOWN bug the model must keep catching. Flip it to `pass` in `formal/run.sh` only after the product code is fixed and the model updated to describe the fix (normally: set the matching code path to the `Fixed` branch and delete the old branch).

`run.sh` shows only the FIRST property that breaks. To see each one, run TLC with one invariant at a time: copy the `.cfg`, keep one name on the `INVARIANTS` line, and run `java -cp formal/.tools/tla2tools.jar tlc2.TLC -deadlock -config <copy>.cfg formal/<Module>.tla` from `formal/`.

## When to use it

Run it when a change touches a file in the coverage table, especially when you change:
- how `paidAmount`, `balanceAmount`, `paymentStatus` or `sale.status` is written (absolute value vs `{ increment }`, value computed from a read made before the transaction)
- a `cashierShift` update (`where: { id }` vs `where: { id, status: 'open' }`), shift close / force-close, X/Z reading generation, `zCounter` or `accumulatedSales`
- a new route that records a payment, a cash in/out, or calls an `incrementShiftTotalsFor*` helper

## Coverage record

**Last confirmed in sync with the code at commit `e76c2076`** (no `src/` change since `80193d81`).

| Model step | Code |
|---|---|
| Payments `ArPay` pre | `src/app/api/sales/[id]/payment/route.ts` `findFirst` 171, balance 202-204, refuse 214 (no status check) |
| Payments `CommitArPay` | same file, transaction 237, `sale.update` 300-310 (`paidAmount { increment }`, status from the stale `sale.paidAmount`) |
| Payments `CommitVoid` | `src/app/api/sales/[id]/void/route.ts` lock 285 (modelled as one step; covered in detail by `SaleReturns.tla`) |
| Payments `ApPay` pre / `ApNumber` | `src/app/api/payments/route.ts` AP read 200, refuse 217; payment number 252-270; unique `[businessId, paymentNumber]` `prisma/schema.prisma` 2548 |
| Payments `CommitApPay` | same file, transaction 273, `accountsPayable.update` 318-339 (absolute values from the stale read) |
| Payments `CommitApBatch` | `src/app/api/payments/batch/route.ts` reads 82/120, transaction 175, update 235-252 |
| Shifts `Open` | `src/app/api/shifts/route.ts` open-shift check 199-206, `create` 264 (no transaction, no unique index) |
| Shifts `Close` pre | `src/app/api/shifts/[id]/close/route.ts` `findUnique` 165, closed check 184, totals 208-240, readings via `src/lib/readings-instant.ts` (`zCounter` read 562, reading log 748 in try/catch) |
| Shifts `CommitClose` | same file, transaction 317: `zCounter`/`accumulatedSales` increment 321-326, `cashierShift.update where { id }` 330-343. Same pattern: `shifts/[id]/force-close/route.ts` 132→183, `shifts/force-close/route.ts` 45→57 |
| Shifts `Money` | sale: `src/app/api/sales/route.ts` open-shift read 757-803, transaction 1081, `incrementShiftTotalsForSale` 1393 → `src/lib/shift-running-totals.ts` 83 (`update where { id }`); AR payment `shift-running-totals.ts` 543-580; cash `src/app/api/cash/in/route.ts`, `cash/out/route.ts`, `cash/in-out/route.ts`; refund `sales/[id]/refund/route.ts` 260 |

To see whether the code moved since the sync commit:

```bash
git diff --stat e76c2076 -- src/app/api/sales src/app/api/payments src/app/api/accounts-payable \
  src/app/api/shifts src/app/api/cash src/app/api/readings src/lib/shift-running-totals.ts \
  src/lib/readings-instant.ts src/lib/idempotency.ts prisma/schema.prisma
```

If that lists files, re-read the changed lines against the table. Move the sync commit forward **only** after you confirm the models still describe the code at the new commit.

## Reading a result

- Read every TLC counterexample with the pstack **/statechart** skill (`/pstack:statechart`). It turns the trace into the shortest path in plain words; when a model passes, it draws how the document moves between states.
- Raw trace: `formal/.tools/<config>.out`. Each `State n: <CommitXxx ...>` is one route's transaction; `Start` is its pre-check. Map it back with the coverage table.

**Real bug or modelling error?** Replay the trace against the code one step at a time. For each step check that (a) the route's pre-check really passes with that `snap`, and (b) its transaction really commits with those values. If every step matches, it is a real bug: report it in the code's words and do **not** weaken the model. If a step cannot happen in the code, the model is wrong: fix that action and cite the code line.

## Updating after an intended change

1. Change the matching `Commit*` / `PreOK` so it mirrors the new code, with the file and line in a comment.
2. If you fixed a known finding, flip its rows in `formal/run.sh` from `fail` to `pass`.
3. Prove the check can still fail: temporarily remove the guard you rely on from the model (for example `IF ~Fixed \/ st[s] = "open"` → `IF TRUE`), run, see `got=fail`, restore.
4. Update the coverage table and the sync commit.

## Findings (found at `e76c2076`, NOT fixed - waiting for the owner)

- **G6 Customer payments (AR).** (a) A payment on a **voided** credit sale is accepted, and the payment route writes `status: 'pending'`, so the voided sale becomes a live, unpaid sale again. This happens with no race at all (void, then pay). (b) Two payments on one sale at the same time both pass the balance check, so paid can exceed the total. (c) Two partial payments that together pay in full can leave the sale `pending`, because each one decides the status from its stale read. Production 2026-11-24: 0 overpaid sales. 1 fully paid sale left `pending` (`InvMain07_15_2026_0005`, 451.40 paid of 451.41). That one is a floating-point slip in the 1-centavo tolerance (`newTotalPaid >= totalAmount - 0.01`), not this race.
- **G7 Supplier payments (AP).** The single and batch payment routes write `paidAmount = <stale paid> + amount` as an absolute value. Two payments on one invoice at the same time keep both payment rows, but the invoice shows only one of them, and a third payment can then overpay. Production: 0 overpaid invoices. 13 invoices have a paid amount with **no** payment rows at all (for example `PO-202512-0010`). Those amounts come from return credits, not from this race. Supplier-return approve (`supplier-returns/[id]/approve/route.ts` 256), purchase-return approve (`purchases/returns/[id]/approve/route.ts` 221) and PO amendments (`purchases/amendments/[id]/approve/route.ts` 199) also raise `paidAmount`. They also write it as an absolute value from a read, so they can lose a payment that commits at the same time. They are not modelled. The AP edit `PUT` (`accounts-payable/[id]/route.ts` 120-124) recomputes `balanceAmount` from a stale `paidAmount`.
- **G8 Cashier shifts.** (a) Two close requests for one shift both pass the "already closed" check, which is outside the transaction. Both commit, so the Z counter goes up twice and the BIR accumulated sales add the shift twice. **This has happened.** Main Store `SHIFT-20251227-0001`, `SHIFT-20260102-0002` and `SHIFT-20260127-0001` each have two Z readings 10-12 seconds apart. Main Store's `z_counter` is 358 with 355 closed shifts, and `accumulated_sales` is **₱1,053,842 higher** than the sum of its closed shifts (exactly those three shifts added twice). (b) A sale / AR payment / cash in-out that commits after the close read its totals is in the shift's running totals but not in the Z reading or system cash. One that commits after the close lands in an already closed shift, because the increments use `where: { id }` with no status check. Seen once: `SHIFT-20251210-0001` Z total 376,133 vs running 376,793 (₱660). (c) Two "open shift" requests at once can open two shifts for one cashier (production: 0 overlapping shifts). **Since then (checked 2026-11-24):** the last double close was `SHIFT-20260127-0001`. Feb-Nov 2026 has 0 double Z readings in 1,072 closed shifts, and every closed shift in Jan-Nov 2026 has Z gross = running gross. Every other branch's `z_counter` equals its closed shifts; only Main Store is +3, from the three old shifts. The `z_reading_count = 2` on `SHIFT-20261104-0001` (Tuguegarao) is a reprint/view counter: it has one Z row and the branch counter matches. The race in the code is still open, but it has not happened in 10 months. Main Store's old totals need a one-time correction with the accountant.

## What this does NOT cover

- Up to 3 overlapping requests, one document, amounts 1-2 against a total of 2. Bigger numbers follow the same paths but are not checked.
- AP credits from supplier returns, purchase returns and PO amendments (see G7), and the AP edit `PUT`.
- GL / journal entries (`accounting-integration`), bank transactions, post-dated cheques, refunds' own amount checks (`sales/[id]/refund` is covered only as a shift increment; see verify-stock-posting for its open finding).
- The exact X/Z reading figures (VAT split, discounts): only "the Z total equals the money recorded in the shift".
- Whether the code matches the model. That is a human check against the coverage table.
