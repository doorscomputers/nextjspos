# Purchase Detail Page Fix - October 9, 2025

## Issue

When clicking the "View" (eye icon) button in the purchases list to view purchase order details, the application threw an error:

```
Runtime TypeError: amount.toFixed is not a function
```

This error occurred at line 152:23 in the `formatCurrency` function.

## Root Cause

The `formatCurrency` function in `src/app/dashboard/purchases/[id]/page.tsx` had two issues:

1. **Type handling**: It only accepted `number` type but database returns Prisma Decimal as string
2. **Currency symbol**: It used `$` instead of `₱` (Philippine Peso)

**Original code (broken):**
```typescript
const formatCurrency = (amount: number) => {
  return `$${amount.toFixed(2)}`
}
```

## Solution

Updated the `formatCurrency` function to:
1. Accept both `number` and `string` types
2. Convert strings to numbers before calling `.toFixed()`
3. Use `₱` symbol instead of `$`

**Fixed code:**
```typescript
const formatCurrency = (amount: number | string) => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount
  return `₱${numAmount.toFixed(2)}`
}
```

## Files Modified

- `src/app/dashboard/purchases/[id]/page.tsx` (line 151-154)

## Impact

This fix affects all currency displays in the purchase detail page:
- Line 438: Unit cost display
- Line 462: Subtotal
- Line 467: Tax amount
- Line 473: Discount amount
- Line 479: Shipping cost
- Line 485: Total amount

All these now correctly:
- ✅ Handle Prisma Decimal types (returned as strings from database)
- ✅ Display with Philippine Peso symbol (₱)
- ✅ Format to 2 decimal places

## Testing

After this fix:
- ✅ Purchase detail page loads without errors
- ✅ All currency amounts display correctly with ₱ symbol
- ✅ No TypeScript compilation errors
- ✅ Server compiled successfully

## Related Files Also Fixed

During this session, the following pages were also fixed with the same currency issue:

1. **`src/app/dashboard/purchases/page.tsx`** - List page (formatCurrency at line 178-181)
2. **`src/app/dashboard/purchases/[id]/page.tsx`** - Detail page (formatCurrency at line 151-154)
3. **`src/app/dashboard/purchases/receipts/[id]/page.tsx`** - Already using PHP currency via Intl.NumberFormat

All purchase-related pages now consistently use ₱ symbol and handle Decimal types correctly.
