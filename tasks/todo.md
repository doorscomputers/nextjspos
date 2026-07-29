# Hide Cost View on Branch Stock Pivot Pages for Transfer Roles

## Problem
Transfer roles (Transfer Manager, Transfer Creator, Sender, Receiver, Approver) have
`PRODUCT_VIEW` permission, which lets them open Branch Stock Pivot and Branch Stock
Pivot V2. Those pages show cost columns (Cost, Last Cost, Total Cost) — sensitive data
transfer staff should not see.

## Key Finding
Permission `PRODUCT_VIEW_PURCHASE_PRICE` (`product.view_purchase_price`) already exists
in `src/lib/rbac.ts` and is defined as "Can see cost price". Transfer roles do NOT have
it. Admin/Manager roles DO. So gating cost display behind this permission fixes all
transfer roles automatically — no role changes needed.

## Todo

- [x] 1. **API** `src/app/api/products/branch-stock-pivot/route.ts`
      Compute `canViewCost = hasPermission(user, PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)`.
      If false: zero out `cost`, `lastPurchaseCost`, `totalCost` per row and
      `costByLocation` / `grandTotalCost` totals; ignore `minCost`/`maxCost` filters.
      (Server-side enforcement — client hiding alone is not security.)

- [x] 2. **V2 page** `src/app/dashboard/products/branch-stock-pivot-v2/page.tsx`
      Use session permissions; render DevExtreme columns `lastCost`, `cost`, `totalCost`
      and the `totalCost` TotalItem only when `canViewCost`.

- [x] 3. **V1 page** `src/app/dashboard/products/branch-stock-pivot/page.tsx`
      When `!canViewCost`: remove `cost` / `totalCost` from default visible columns,
      column chooser list, export column defs, table headers/cells, and totals row.

- [x] 4. Verify build compiles — `npx tsc --noEmit`: zero errors in touched files.

## Notes
- Super Admin unaffected (gets all permissions automatically).
- No DB/role changes. If a specific online role SHOULD see cost, grant it
  `product.view_purchase_price` in Roles UI.
- `route-optimized.ts` is not a routable file (only `route.ts` is served) — untouched.

## Review
Cost visibility on both Branch Stock Pivot pages is now gated behind the existing
`product.view_purchase_price` permission. Three files changed:

1. **API** (`branch-stock-pivot/route.ts`): computes `canViewCost` via `hasPermission()`.
   Without it, `cost`, `lastPurchaseCost`, `totalCost` return 0 (cost totals then
   compute to 0 automatically), cost range filters are ignored, and sorting by cost
   falls back to product name. This is the real security layer — the data never
   leaves the server.
2. **V2 page** (DevExtreme): Last Cost / Cost / Total Cost columns and the Total Cost
   summary render only when permission present. Absent columns also disappear from
   column chooser and Excel/PDF exports automatically.
3. **V1 page**: derived `visibleColumns` strips cost/totalCost without permission;
   column chooser options and CSV/Excel/PDF/print export columns filtered too.

Transfer roles (Manager/Creator/Sender/Receiver/Approver) have `product.view` but not
`product.view_purchase_price`, so they lose cost view with no role edits. Admin,
Manager, Super Admin unaffected. To grant cost view to any role later, add
`product.view_purchase_price` in the Roles UI. tsc clean on all touched files.
