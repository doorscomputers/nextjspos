# BIR Daily Sales Summary Report - Implementation Guide

## Overview

A professional, BIR-compliant Daily Sales Summary Report built with DevExtreme React DataGrid that provides accountants and BIR inspectors with all required sales data in a clear, organized format.

## File Location

```
src/app/dashboard/reports/bir/daily-sales-summary/page.tsx
```

## Features Implemented

### 1. **BIR Compliance**
- All required BIR fields per RR 18-2012 and RR 11-2004
- Beginning/Ending Invoice Numbers
- VAT breakdown (VATable Sales, VAT Amount 12%, VAT-Exempt, Zero-Rated)
- Discount breakdowns (Senior Citizen, PWD, Regular)
- Payment method categorization
- Accumulated Grand Total tracking (Beginning/Ending Balance)
- Reset Counter and Z-Counter
- Void transaction tracking

### 2. **DevExtreme DataGrid Integration**
- Professional data grid with BIR-required fields
- **Export to Excel** with business header information
- **Export to PDF** with formatted BIR layout
- Column filtering and header filters
- Grouped by category for easy reading
- Responsive design for all screen sizes

### 3. **Advanced Filters**
- **Date Picker** (DevExtreme DateBox) - Default to today, max today
- **Location Dropdown** (DevExtreme SelectBox) - Filter by business location
- **Cashier Dropdown** (DevExtreme SelectBox) - Filter by cashier/user
- All filters with search capability
- Clear button for all dropdowns

### 4. **Report Features**
- Summary cards showing key metrics (Gross Sales, Net Sales, VAT, Total Invoices)
- Business information header with TIN and address
- Print-friendly layout with browser print dialog
- Loading states with spinner
- Empty state with helpful message
- Toast notifications for user feedback

### 5. **Professional UI/UX**
- Gradient summary cards matching project style
- Dark mode support
- Mobile-responsive design
- Consistent colors (no dark-on-dark issues)
- Clear button styling (not label-like)
- Professional typography and spacing

## API Endpoint Used

```
GET /api/reports/bir/daily-sales-summary
```

**Query Parameters:**
- `date` - Report date (ISO format: YYYY-MM-DD)
- `locationId` - Optional location filter
- `cashierId` - Optional cashier filter

**Response Structure:**
```json
{
  "summary": {
    "reportDate": "2025-10-24",
    "businessName": "...",
    "businessTIN": "...",
    "businessAddress": "...",
    "location": "...",
    "cashier": "...",
    "beginningInvoice": "...",
    "endingInvoice": "...",
    "totalInvoices": 250,
    "grossSales": 1250000.00,
    "vatableSales": 1017857.14,
    "vatAmount": 122142.86,
    "vatExemptSales": 50000.00,
    "totalDiscount": 50000.00,
    "seniorDiscount": 30000.00,
    "seniorCount": 15,
    "pwdDiscount": 20000.00,
    "pwdCount": 10,
    "regularDiscount": 5000.00,
    "netSales": 1200000.00,
    "cashSales": 800000.00,
    "creditSales": 200000.00,
    "digitalSales": 100000.00,
    "totalCollections": 1100000.00,
    "totalTransactions": 250,
    "voidTransactions": 5,
    "voidAmount": 5000.00,
    "beginningBalance": 5000000.00,
    "endingBalance": 6250000.00,
    "resetCounter": 1,
    "zCounter": 450,
    "lastZReadingDate": "2025-10-23T18:00:00Z"
  }
}
```

## DevExtreme Components Used

### 1. **DataGrid**
```tsx
import DataGrid, {
  Column,
  Export,
  FilterRow,
  HeaderFilter,
  LoadPanel,
  Summary,
  TotalItem,
  Toolbar,
  Item as ToolbarItem,
} from 'devextreme-react/data-grid'
```

**Key Features:**
- Grouped columns by category
- Built-in export (Excel & PDF)
- Column filtering
- Header filters
- Row alternation for readability
- Custom cell rendering for values

### 2. **SelectBox** (Dropdowns)
```tsx
import { SelectBox } from 'devextreme-react/select-box'
```

**Features:**
- Location filter with search
- Cashier filter with search
- Display expression for user-friendly names
- Clear button for resetting

### 3. **DateBox** (Date Picker)
```tsx
import { DateBox } from 'devextreme-react/date-box'
```

**Features:**
- Date selection for report
- Max date set to today
- Formatted display (MMMM dd, yyyy)

## Data Transformation

The API response is transformed into a grid-friendly format:

```typescript
const transformDataForGrid = (data: DailySalesSummary) => {
  const gridItems: GridDataItem[] = [
    // Invoice Range
    { label: 'Beginning Invoice Number', value: data.beginningInvoice, category: 'Invoice Range' },
    { label: 'Ending Invoice Number', value: data.endingInvoice, category: 'Invoice Range' },

    // Sales (with formatted currency)
    { label: 'Gross Sales', value: formatCurrency(data.grossSales), category: 'Sales' },

    // Discounts
    { label: 'Senior Citizen Discount', value: formatCurrency(data.seniorDiscount), category: 'Discounts' },

    // Payment Methods
    { label: 'Cash Sales', value: formatCurrency(data.cashSales), category: 'Payment Methods' },

    // BIR Compliance
    { label: 'Beginning Balance', value: formatCurrency(data.beginningBalance), category: 'BIR Compliance' },
    // ... more fields
  ]
  setGridData(gridItems)
}
```

## Export Functionality

### Excel Export
- Business header included (name, TIN, address)
- Location and date information
- Formatted data with proper columns
- Auto-filter enabled
- Filename: `BIR_Daily_Sales_Summary_YYYY-MM-DD.xlsx`

### PDF Export
- Professional BIR header with business info
- Centered title and company name
- Date and location details
- Grid data with proper formatting
- Filename: `BIR_Daily_Sales_Summary_YYYY-MM-DD.pdf`

## Print Layout

Print-specific styles ensure professional output:

```tsx
<style jsx global>{`
  @media print {
    body {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
    .print\\:hidden {
      display: none !important;
    }
    @page {
      margin: 1.5cm;
      size: portrait;
    }
  }
`}</style>
```

## Permission Requirements

```typescript
PERMISSIONS.REPORT_VIEW
```

Users without this permission see an access denied message.

## Usage Instructions

### For End Users

1. **Access the Report:**
   - Navigate to Reports > BIR > Daily Sales Summary

2. **Set Filters:**
   - Select report date (defaults to today)
   - Optionally filter by location
   - Optionally filter by cashier

3. **Generate Report:**
   - Click "Generate Report" button
   - Wait for data to load (spinner shown)
   - View summary cards and detailed grid

4. **Export Options:**
   - **Excel:** Click export button in grid toolbar > Select XLSX
   - **PDF:** Click export button in grid toolbar > Select PDF
   - **Print:** Click "Print Report" button (opens browser print dialog)

### For Developers

1. **Accessing the Page:**
   ```
   /dashboard/reports/bir/daily-sales-summary
   ```

2. **Dependencies:**
   - DevExtreme React components
   - exceljs (for Excel export)
   - jsPDF (for PDF export)
   - file-saver (for download functionality)
   - All already installed in the project

3. **API Integration:**
   ```typescript
   const response = await fetch(`/api/reports/bir/daily-sales-summary?${params}`)
   const data = await response.json()
   ```

4. **Styling:**
   - Uses project's Tailwind CSS classes
   - DevExtreme light theme (`devextreme/dist/css/dx.light.css`)
   - Shadcn UI components (Card, Button)
   - Dark mode support with `dark:` variants

## BIR Report Categories

The grid data is grouped into these categories:

1. **Invoice Range**
   - Beginning Invoice Number
   - Ending Invoice Number
   - Total Invoices

2. **Sales**
   - Gross Sales
   - VATable Sales (Base)
   - VAT Amount (12%)
   - VAT-Exempt Sales
   - Zero-Rated Sales
   - Total Discounts
   - Net Sales

3. **Discounts**
   - Senior Citizen Discount & Count
   - PWD Discount & Count
   - Regular Discount

4. **Payment Methods**
   - Cash Sales
   - Credit Sales
   - Digital Sales
   - Total Collections

5. **Transactions**
   - Total Transactions
   - Void Transactions
   - Void Amount

6. **BIR Compliance**
   - Beginning Balance (Accumulated Grand Total)
   - Ending Balance (New Grand Total)
   - Reset Counter
   - Z-Counter
   - Last Z-Reading Date

## Key Code Patterns

### DevExtreme Export Configuration
```typescript
const onExporting = (e: any) => {
  if (e.format === 'xlsx') {
    const workbook = new Workbook()
    const worksheet = workbook.addWorksheet('Daily Sales Summary')

    // Add custom header rows
    worksheet.addRow([summary.businessName])
    worksheet.addRow([`TIN: ${summary.businessTIN}`])

    exportToExcel({
      component: e.component,
      worksheet,
      topLeftCell: { row: 8, column: 1 },
    }).then(() => {
      workbook.xlsx.writeBuffer().then((buffer) => {
        saveAs(new Blob([buffer]), `filename.xlsx`)
      })
    })
    e.cancel = true // Prevent default export
  }
}
```

### Grouped DataGrid Configuration
```typescript
<DataGrid dataSource={gridData} ...>
  <Column
    dataField="category"
    caption="Category"
    groupIndex={0}  // Group by this column
  />
  <Column dataField="label" caption="Description" />
  <Column dataField="value" caption="Value" alignment="right" />
</DataGrid>
```

## Responsive Design

- **Desktop:** Full 3-column filter layout, 4-column summary cards
- **Tablet:** 2-column layouts
- **Mobile:** Single column, stacked layouts
- All DevExtreme components responsive by default

## Dark Mode Support

All components have `dark:` variants:
- `dark:bg-gray-800` for cards
- `dark:text-white` for headings
- `dark:text-gray-300` for body text
- `dark:border-gray-700` for borders

## Testing Checklist

- [ ] Page loads without errors
- [ ] Filters populate correctly (locations, users)
- [ ] Date picker defaults to today
- [ ] Generate report fetches data
- [ ] Summary cards display correct values
- [ ] DataGrid shows all BIR fields
- [ ] Excel export includes header information
- [ ] PDF export is properly formatted
- [ ] Print layout is clean and professional
- [ ] Loading states work correctly
- [ ] Error handling shows toast messages
- [ ] Permission check blocks unauthorized users
- [ ] Dark mode renders correctly
- [ ] Mobile responsive design works

## Future Enhancements

1. **Date Range Support:** Extend to weekly/monthly summaries
2. **Comparison View:** Compare multiple dates side-by-side
3. **Chart Visualization:** Add charts for visual analysis
4. **Email Report:** Send BIR report via email
5. **Schedule Reports:** Auto-generate at end of day
6. **Historical Data:** View past Z-readings and comparisons

## References

- **DevExtreme DataGrid Docs:** https://js.devexpress.com/React/Documentation/Guide/UI_Components/DataGrid/Overview/
- **Export Documentation:** https://js.devexpress.com/React/Documentation/Guide/UI_Components/DataGrid/Export/
- **BIR Requirements:** RR 18-2012, RR 11-2004
- **Project Pattern:** Transfer Export page, Stock Pivot V2 page

## Troubleshooting

### Export not working
- Check DevExtreme CSS is imported
- Verify exceljs and jsPDF are installed
- Check browser console for errors

### Data not loading
- Verify API endpoint is accessible
- Check network tab for response
- Ensure user has REPORT_VIEW permission

### Print layout issues
- Check print-specific styles are applied
- Verify `.print:hidden` classes work
- Test in different browsers

### Dark mode colors wrong
- Ensure all `dark:` variants are applied
- Check Tailwind dark mode is enabled
- Verify no absolute color values override theme

## Summary

This implementation provides a **production-ready, BIR-compliant Daily Sales Summary Report** with:

- Professional DevExtreme DataGrid integration
- Full export functionality (Excel, PDF, Print)
- Advanced filtering (Date, Location, Cashier)
- Mobile-responsive design
- Dark mode support
- Comprehensive BIR field coverage
- Clean, maintainable code following project patterns

Perfect for Philippine businesses requiring BIR compliance and professional sales reporting.
