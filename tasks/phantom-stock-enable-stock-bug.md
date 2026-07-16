# Phantom Stock Bug — `enable_stock=false` on real inventory products

## Summary of investigation (READ-ONLY, no changes made)

A user reported that TECNO SPARK 50 5G (SKU `4894947118678`) at **Bambang** shows
**system count = 1** but expected **0**, even though the movement report correctly
shows a Transfer-In (+1) on 2026-06-16 and a Sale (−1) on 2026-06-26.

### Root cause (confirmed)

Product `id=1985` is configured with **`enable_stock = FALSE`** and
**`not_for_selling = TRUE`**, even though it is a genuine, physically-stocked,
sellable phone (it was purchased, transferred between branches, and sold for ₱14,999).

Chain of effect:
1. **Sale route** `src/app/api/sales/route.ts` (~line 1183-1203): stock deduction is
   collected into `bulkStockItems` only `if (!isNotForSelling)`. A `not_for_selling`
   item is **skipped** — no `variation_location_details.qty_available` decrement,
   no `stock_transactions` row, no `product_history` row.
   - Verified: sale `id=11783` (`InvBambang06_26_2026_0010`, completed) produced
     **zero** stock_transactions and **zero** product_history rows.
2. **Transfer route** does NOT respect `enable_stock` / `not_for_selling` — the
   2026-06-16 transfer-in still created a `product_history` transfer_in row and set
   `variation_location_details.qty_available = 1` at Bambang.
3. Net result: VLD stuck at 1 (from transfer-in), never decremented by the sale →
   **phantom stock**. The "Stock Story" report reads `sale_items` directly (ignores
   the flags) so it correctly shows the sale and computes Expected = 0, but the real
   system count (VLD) stays 1.

### Why VLD-vs-ledger reconciliation can't catch it
For these products the sale skipped BOTH the VLD and the ledger, so VLD still equals
the ledger sum. A discrepancy report comparing `variation_location_details` against
`product_history` shows a **match** (both wrong). Confirmed: only 1 VLD-vs-ledger
mismatch exists across 8,844 pairs — this bug is invisible to that check.

### Scope — misconfigured products that carry real stock and/or were sold

| id | sku | name | enable_stock | not_for_selling | total VLD qty | times sold | classification |
|----|-----|------|--------------|-----------------|---------------|------------|----------------|
| 1544 | SF1 | SERVICE FEE | false | true | 34611 | 3154 | **LEAVE — genuine service fee** |
| 2000 | PARTSBATTERY | LAPTOP PARTS BATTERY | false | true | 100000 | 13 | **LEAVE — generic placeholder** |
| 139 | AVR | SECURE AVR | false | false | 122 | 156 | **FIX — real product** |
| 59 | F20H | FINGERPRINT TIME ATTENDANCE F20 H | false | false | 9 | 8 | **FIX — real product** |
| 1931 | AS120W3.0 | ASUS 19V 6.32A charger | false | false | 9 | 1 | **FIX — real product** |
| 1985 | 4894947118678 | TECNO SPARK 50 5G 8/256 INK BLACK | false | true | 2 | 1 | **FIX — real phone (reported item)** |
| 554 | 8600G | AMD RYZEN 5 8600G | false | false | 1 | 0 | **FIX — real product** |
| 1944 | 4711514503142 | GAMDIAS AURA GC9M ELITE ARGB WHITE | false | false | 4 | 0 | **FIX — real product** |
| 1949 | 4712960139466 | GAMDIAS BOREAS E2-410 WHITE COOLER | false | false | 5 | 0 | **FIX — real product** |
| 1989 | 4894947105296 | TECNO SPARK GO3 4/128 TITANIUM GREY | false | true | 2 | 0 | **FIX — real phone** |
| 1991 | 4894947105289 | TECNO SPARK GO3 4/64 TITANIUM GREY | false | true | 3 | 0 | **FIX — real phone** |

Likely origin: recent CSV import created these products with `enable_stock=false`
(and the TECNO phones additionally `not_for_selling=true`). High product IDs confirm
recent creation.

### Key facts for the reported item (product 1985 / variation 1984)
- Purchase GRN-202606-0008: +2 into Main Warehouse (2026-06-16).
- Transfer 1576 → Bambang +1 (TR-202606-0093, recv April Danica, 2026-06-16 07:03).
- Transfer 1577 → Main Store +1 (TR-202606-0094, recv Francis Ace).
- Sale 11783 at Bambang −1 (2026-06-26) — **did NOT decrement** (flags).
- Current VLD: Bambang = 1, Main Store = 1. Both are 1 too high vs what sales imply.
- Physical expected at Bambang (per user) = 0.

### Exact per-location numbers (corrected = VLD − skipped_sold)

Only ONE phantom correction exists. All other rows: `skipped_sold=0`, `VLD = ledger`.
The `not_for_selling=false` products decremented normally — their VLD is accurate;
only the `enable_stock` flag is wrong (hides them from stock reports/reorder).

| id | sku | location | variation | VLD | ledger | total_sold | skipped_sold | CORRECTED |
|----|-----|----------|-----------|-----|--------|-----------|--------------|-----------|
| **1985** | 4894947118678 | **Bambang** | 1984 | **1** | 1 | 1 | **1** | **0** ⚠️ correct this |
| 1985 | 4894947118678 | Main Store | 1984 | 1 | 1 | 0 | 0 | 1 |
| 1989 | 4894947105296 | Bambang | 1988 | 1 | 1 | 0 | 0 | 1 |
| 1989 | 4894947105296 | Main Store | 1988 | 1 | 1 | 0 | 0 | 1 |
| 1991 | 4894947105289 | Bambang | 1990 | 1 | 1 | 0 | 0 | 1 |
| 1991 | 4894947105289 | Main Store | 1990 | 1 | 1 | 0 | 0 | 1 |
| 1991 | 4894947105289 | Tuguegarao | 1990 | 1 | 1 | 0 | 0 | 1 |
| 139 | AVR | Bambang | 139 | 7 | 7 | 72 | 0 | 7 |
| 139 | AVR | Main Store | 139 | 5 | 5 | 114 | 0 | 5 |
| 139 | AVR | Main Warehouse | 139 | 104 | 104 | 0 | 0 | 104 |
| 139 | AVR | Tuguegarao | 139 | 6 | 6 | 14 | 0 | 6 |
| 59 | F20H | Bambang | 59 | 2 | 2 | 2 | 0 | 2 |
| 59 | F20H | Main Store | 59 | 3 | 3 | 12 | 0 | 3 |
| 59 | F20H | Main Warehouse | 59 | 3 | 3 | 0 | 0 | 3 |
| 59 | F20H | Tuguegarao | 59 | 1 | 1 | 0 | 0 | 1 |
| 554 | 8600G | Main Warehouse | 554 | 1 | 1 | 0 | 0 | 1 |
| 1931 | AS120W3.0 | Main Store | 1930 | 9 | 9 | 1 | 0 | 9 |
| 1944 | 4711514503142 | Bambang | 1943 | 1 | 1 | 0 | 0 | 1 |
| 1944 | 4711514503142 | Main Warehouse | 1943 | 2 | 2 | 0 | 0 | 2 |
| 1944 | 4711514503142 | Tuguegarao | 1943 | 1 | 1 | 0 | 0 | 1 |
| 1949 | 4712960139466 | Bambang | 1948 | 1 | 1 | 0 | 0 | 1 |
| 1949 | 4712960139466 | Main Store | 1948 | 1 | 1 | 0 | 0 | 1 |
| 1949 | 4712960139466 | Main Warehouse | 1948 | 2 | 2 | 0 | 0 | 2 |
| 1949 | 4712960139466 | Tuguegarao | 1948 | 1 | 1 | 0 | 0 | 1 |

**Stock correction needed: exactly ONE** — product 1985 / variation 1984 @ Bambang
(location_id 3): 1 → 0. All 9 products still need the flag fix; only 1985 Bambang
needs a quantity change. Physical spot-check advised before flipping flags.

Database: Supabase project `ydytljrzuhvimrtixinw` (this is the production DB per `.env`).
Tables are snake_case: `products`, `product_variations`, `variation_location_details`,
`product_history`, `stock_transactions`, `sales`, `sale_items`, `inventory_corrections`.
