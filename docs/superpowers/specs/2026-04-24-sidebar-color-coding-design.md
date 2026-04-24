# Sidebar Color Coding — Design

**Date:** 2026-04-24
**Scope:** `src/components/Sidebar.tsx` only
**Motivation:** All ~27 top-level menus currently render with the same `from-blue-500 to-blue-600` gradient. New users cannot visually scan to the menu they need. Color coding by functional domain adds learnable visual structure.

## Strategy

Group top-level menus into 8 color families by domain. The color is reinforced via three visual signals simultaneously:

1. **Icon color** (strong signal)
2. **Left accent bar** (3–4px vertical stripe on the left edge of the menu row)
3. **Active-state background** (soft tinted bg using the same color family)

Background in the resting state is neutral (white / `gray-50` light, `gray-800/40` dark) instead of the current blue gradient. Hover state: slightly darker neutral bg with the colored left bar still visible. Active state: saturated tinted bg in the domain color family — "pops" so the user always knows where they are.

Submenus (children and grandchildren) retain their current styling — they already read well once a parent is expanded.

## Color Families

| Color (Tailwind) | Domain | Menus |
|---|---|---|
| `emerald` | Selling | POS & Sales, Customers, Sales Personnel |
| `sky` | Inventory | Products, Package Templates, Package Template 2, Price Editor |
| `orange` | Supply Chain | Purchases, Stock Transfers, Returns Management, Suppliers |
| `violet` | Money Out | Expenses, Accounting |
| `amber` | Reports / Analytics | Reports, Analytics Dashboard V1, V2, V3, Dashboard V4 |
| `indigo` | Home / Operations | Dashboard, HR & Attendance, Technical Services |
| `slate` | Admin | Administration, Settings |
| `pink` | Personal / Help | AI Assistant, Notifications, Help Center, My Profile |

Default fallback: `indigo` (for any menu not mapped, so behavior stays safe).

## Implementation

### `getMenuColors(name: string)` helper

Returns an object with class strings:

```ts
{
  iconColor: "text-emerald-600 dark:text-emerald-400",
  accentBar: "before:bg-emerald-500",
  activeBg:  "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100",
  hoverBg:   "hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
}
```

A single `Record<string, keyof typeof colorMap>` lookup by menu name → color family, then return the pre-built class strings for that family.

### Class swap

Two locations in `Sidebar.tsx`:

- **Parent button** (menu with children): lines ~1998–2004
- **Leaf link** (menu without children): lines ~2108–2114

Both currently use:
```
bg-gradient-to-r from-blue-500 to-blue-600 text-white
```

Replace with neutral resting bg + colored accent bar + colored icon. Active state uses the domain's `activeBg`.

### Icon-only (collapsed) mode

Colored icon still shows; left accent bar preserved. Tooltip remains the menu name.

### Dark mode

Every color class has a `dark:` variant. Tested color families all have readable contrast in both modes.

## Blast Radius

- One file modified: `src/components/Sidebar.tsx`
- ~50 lines added (helper + class swaps)
- No permission logic touched, no menu structure changed, no API/DB changes
- No package changes

## Acceptance Criteria

1. Each top-level menu renders with its domain color icon + left accent bar
2. Active menu has a clearly saturated colored bg (not identical to hover)
3. Hover state has a visible but gentler bg change
4. Dark mode readable for all 8 color families
5. Collapsed (icon-only) mode still shows colors
6. Build passes (`npm run lint` + Next.js compile)
7. No permission/RBAC behavior changes
