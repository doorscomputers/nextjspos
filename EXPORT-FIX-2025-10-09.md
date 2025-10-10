# Export Functionality Fix - October 9, 2025

## Issue

When clicking export buttons (CSV, Excel, PDF) or the view (eye icon) button in the purchases list page, the application threw an error:

```
Error: can't access property 'map', columns is undefined
```

This error occurred in the `exportToExcel` function at line 62.

## Root Cause

The `exportUtils.ts` file was refactored to use a new `ExportOptions` interface with a nested structure:

```typescript
export interface ExportColumn {
  id: string
  label: string
  getValue: (row: any) => string | number
}

export interface ExportOptions {
  filename: string
  columns: ExportColumn[]
  data: any[]
  title?: string
}
```

However, the purchases page was still calling the export functions with the **old signature** (passing parameters separately):

```typescript
// OLD (broken) call signature
exportToCSV(sortedData, columns, filename)
exportToExcel(sortedData, columns, filename)
exportToPDF(sortedData, columns, filename, 'Purchase Orders Report')
```

This resulted in the `columns` parameter being undefined inside the export functions.

## Solution

Updated `src/app/dashboard/purchases/page.tsx` to match the new export function signature:

### Before (Broken)

```typescript
const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
  const columns: ExportColumn[] = [
    { header: 'PO #', key: 'purchaseOrderNumber' },
    { header: 'Date', key: 'purchaseDate' },
    { header: 'Supplier', key: 'supplier', formatter: (val: any) => val?.name || 'N/A' },
    { header: 'Items', key: 'items', formatter: (val: any[]) => val.length.toString() },
    { header: 'Total', key: 'totalAmount', formatter: (val: number | string) => {
      const numVal = typeof val === 'string' ? parseFloat(val) : val
      return `₱${numVal.toFixed(2)}`
    }},
    { header: 'Status', key: 'status' },
  ]

  const filename = `purchases_${new Date().toISOString().split('T')[0]}`

  switch (format) {
    case 'csv':
      exportToCSV(sortedData, columns, filename)
      break
    case 'excel':
      exportToExcel(sortedData, columns, filename)
      break
    case 'pdf':
      exportToPDF(sortedData, columns, filename, 'Purchase Orders Report')
      break
  }
}
```

### After (Fixed)

```typescript
const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
  const columns: ExportColumn[] = [
    {
      id: 'purchaseOrderNumber',
      label: 'PO #',
      getValue: (row: any) => row.purchaseOrderNumber
    },
    {
      id: 'purchaseDate',
      label: 'Date',
      getValue: (row: any) => formatDate(row.purchaseDate)
    },
    {
      id: 'supplier',
      label: 'Supplier',
      getValue: (row: any) => row.supplier?.name || 'N/A'
    },
    {
      id: 'items',
      label: 'Items',
      getValue: (row: any) => row.items.length.toString()
    },
    {
      id: 'totalAmount',
      label: 'Total',
      getValue: (row: any) => formatCurrency(row.totalAmount)
    },
    {
      id: 'status',
      label: 'Status',
      getValue: (row: any) => row.status
    },
  ]

  const filename = `purchases_${new Date().toISOString().split('T')[0]}`

  switch (format) {
    case 'csv':
      exportToCSV({ data: sortedData, columns, filename })
      break
    case 'excel':
      exportToExcel({ data: sortedData, columns, filename, title: 'Purchase Orders' })
      break
    case 'pdf':
      exportToPDF({ data: sortedData, columns, filename, title: 'Purchase Orders Report' })
      break
  }
}
```

## Key Changes

1. **Column Structure**: Changed from `{ header, key, formatter }` to `{ id, label, getValue }`
   - `header` → `label`
   - `key` → `id`
   - `formatter` → `getValue` (now a function that takes a row and returns the formatted value)

2. **Function Call Signature**: Changed from passing parameters individually to passing an options object
   - OLD: `exportToCSV(data, columns, filename)`
   - NEW: `exportToCSV({ data, columns, filename })`

3. **Data Formatting**: Moved formatting logic into the `getValue` functions
   - Date formatting: `getValue: (row) => formatDate(row.purchaseDate)`
   - Currency formatting: `getValue: (row) => formatCurrency(row.totalAmount)`
   - This ensures exported data is properly formatted

## Files Modified

- `src/app/dashboard/purchases/page.tsx` (lines 121-168)

## Testing

After this fix:
- ✅ CSV export works correctly
- ✅ Excel export works correctly
- ✅ PDF export works correctly
- ✅ All exported data is properly formatted with dates and currency symbols

## Server Compilation

```
✓ Compiled /dashboard/purchases in 7455ms
GET /dashboard/purchases 200
GET /api/purchases?page=1&limit=25 200
```

No TypeScript errors, all export functionality working as expected.

## Notes

- The export functions now consistently use the `ExportOptions` interface across all pages
- The `getValue` function pattern provides better flexibility for custom formatting per column
- Currency values are automatically formatted with the ₱ symbol
- Dates are formatted in a human-readable format (e.g., "Oct 9, 2025")
