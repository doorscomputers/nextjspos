# AR + Supplier Payment Idempotency (2026-08-29, round 5)

## Problem

Payment routes are atomic (no partial writes) but have NO duplicate-submit protection.
Flaky link: request commits server-side, response lost, cashier clicks Pay again → payment recorded twice, balance double-decremented.

## Approach — proven ExchangeDialog pattern, NOT apiPost

apiPost's deterministic key = hash(url+body). Payment bodies are small; two LEGITIMATE
identical payments (same invoice, same amount, same day) would collide → second payment
silently swallowed as replay. So client uses random key held in useRef:
- generated once per submit attempt, reused across retries of that attempt
- cleared on success and whenever payload changes (stale-key fake success guard)
- sent as `Idempotency-Key` header; server `withIdempotency` does the rest

No offline queueing for payments (queue UX is sale-shaped; payment forms keep the
user on the page with an explicit error instead).

## Todos

- [x] Server: wrap POST /api/sales/[id]/payment in withIdempotency
- [x] Server: wrap POST /api/payments in withIdempotency
- [x] Server: wrap POST /api/payments/batch in withIdempotency
- [x] Client: ARPaymentCollectionModal — key per invoice (single + batch loop)
- [x] Client: dashboard/sales/[id]/payment page — key on submit
- [x] Client: dashboard/payments/new page — key on submit
- [x] Client: dashboard/payments/batch page — key on submit
- [x] tsc --noEmit on edited files, npm run build
- [x] Adversarial review of full diff before commit (verdict: SHIP; 2 findings fixed)
- [ ] Commit + push + verify Vercel READY

## Regression hazards

- withIdempotency no-key path is passthrough → old clients/tabs keep working (backwards compatible)
- Handler bodies must NOT change — wrap only
- withIdempotency clones response as json — all three routes return NextResponse.json, OK
- Batch loop in ARPaymentCollectionModal needs DISTINCT key per invoice, stable across retries of the same run
- Key must reset when user edits amount/method/reference — else fake success replay

## Review

Round 5 closes the last open money-movement idempotency gap from the 2026-08-29 network audit.

**Server (wrap-only, handler bodies untouched):**
- `sales/[id]/payment`, `payments`, `payments/batch` POST wrapped in `withIdempotency`.
  No-key requests pass through — fully backwards compatible with old tabs.

**Client (ExchangeDialog pattern on 4 screens):**
- Random key in useRef, generated once per submit attempt, sent as `Idempotency-Key`.
- Key reset on: payload change (fake-success guard), success (where page stays),
  and received 4xx/500 EXCEPT 429 (server rolled back → retry must re-execute;
  429 means original may still be committing → key must be kept).
- AR modal Pay-All: per-invoice key map fingerprinted on
  id|balance|method|reference|shiftId — re-run after partial failure replays
  committed payments, re-executes failed ones; two invoices can never share a key.

**Why not apiPost:** deterministic hash(url+body) key would collide for two
legitimate identical payments (same invoice, amount, day) — second payment
silently swallowed as replay. Random per-attempt keys avoid that class entirely.

**Verification:** tsc clean on all edited files; production build exit 0 (twice —
before and after review fixes); adversarial subagent review verdict SHIP
(braces/JSON contract/key lifecycle/multi-tenant/React all verified clean;
its 2 findings — stale-error replay and missing shiftId dep — fixed pre-commit).

**Follow-ups still open (unchanged):** dead sales/[id]/refund route deletion,
physical-inventory/import positional-arg bug, GRN-create pre-tx dup window.
