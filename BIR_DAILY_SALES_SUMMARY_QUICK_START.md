# BIR Daily Sales Summary Report - Quick Start Guide

## Quick Access

**URL:** `/dashboard/reports/bir/daily-sales-summary`

**File Location:** `src/app/dashboard/reports/bir/daily-sales-summary/page.tsx`

## What It Does

Generates a BIR-compliant Daily Sales Summary Report with all required fields for BIR inspection including VAT breakdown, discounts, payment methods, and accumulated grand totals.

## How to Use

### Step 1: Access the Report
Navigate to: **Reports > BIR > Daily Sales Summary**

### Step 2: Set Filters
1. **Select Date** - Choose the date for the report (defaults to today)
2. **Select Location** (Optional) - Filter by specific business location
3. **Select Cashier** (Optional) - Filter by specific cashier

### Step 3: Generate Report
Click **"Generate Report"** button

### Step 4: View Results
- **Summary Cards** - See key metrics at a glance
- **Detailed Grid** - View all BIR-required fields grouped by category

### Step 5: Export or Print
- **Excel Export:** Click export button in grid > Select "XLSX"
- **PDF Export:** Click export button in grid > Select "PDF"
- **Print:** Click "Print Report" button in header

## Key Features

### BIR-Required Fields Included
✅ Beginning/Ending Invoice Numbers
✅ Gross Sales & Net Sales
✅ VATable Sales (Base Amount)
✅ VAT Amount (12%)
✅ VAT-Exempt Sales
✅ Senior Citizen Discount & Count
✅ PWD Discount & Count
✅ Cash/Credit/Digital Sales Breakdown
✅ Void Transactions & Amount
✅ Beginning Balance (Accumulated Grand Total)
✅ Ending Balance (New Grand Total)
✅ Reset Counter
✅ Z-Counter

### DevExtreme Features
✅ Professional DataGrid with grouping
✅ Column filtering and search
✅ Export to Excel with business header
✅ Export to PDF with BIR formatting
✅ Print-friendly layout
✅ Responsive design (mobile-ready)
✅ Dark mode support

## API Endpoint

```
GET /api/reports/bir/daily-sales-summary
```

**Parameters:**
- `date` - Report date (YYYY-MM-DD)
- `locationId` - Optional location ID
- `cashierId` - Optional cashier ID

## Permission Required

```
PERMISSIONS.REPORT_VIEW
```

## Grid Categories

The report organizes data into these categories:

1. **Invoice Range** - Invoice numbers and count
2. **Sales** - Gross, VAT, exempt, discounts, net
3. **Discounts** - SC, PWD, regular breakdown
4. **Payment Methods** - Cash, credit, digital
5. **Transactions** - Total and void counts
6. **BIR Compliance** - Accumulated totals, counters

## Export Filenames

- **Excel:** `BIR_Daily_Sales_Summary_YYYY-MM-DD.xlsx`
- **PDF:** `BIR_Daily_Sales_Summary_YYYY-MM-DD.pdf`

## Tips for Accountants

1. **Daily Routine:** Run this report at end of each business day
2. **Reconciliation:** Compare with physical cash count
3. **BIR Inspection:** Have Excel/PDF exports ready
4. **Void Tracking:** Monitor void transactions regularly
5. **Z-Reading:** Check Last Z-Reading Date for accuracy

## Visual Summary

```
┌─────────────────────────────────────────────────┐
│  BIR DAILY SALES SUMMARY REPORT                 │
│                                                 │
│  Filters:                                       │
│  [Date Picker] [Location ▼] [Cashier ▼]       │
│  [Generate Report]                              │
│                                                 │
│  Summary Cards:                                 │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐          │
│  │Gross │ │ Net  │ │ VAT  │ │Invoices│         │
│  │Sales │ │Sales │ │ 12%  │ │ Count  │         │
│  └──────┘ └──────┘ └──────┘ └──────┘          │
│                                                 │
│  Business Info:                                 │
│  Business Name | TIN | Location | Date         │
│                                                 │
│  DataGrid with Categories:                      │
│  ├─ Invoice Range                               │
│  │  └─ Beginning/Ending/Total                   │
│  ├─ Sales                                       │
│  │  └─ Gross/VAT/Exempt/Discounts/Net          │
│  ├─ Discounts                                   │
│  │  └─ SC/PWD/Regular                           │
│  ├─ Payment Methods                             │
│  │  └─ Cash/Credit/Digital                      │
│  ├─ Transactions                                │
│  │  └─ Total/Void                               │
│  └─ BIR Compliance                              │
│     └─ Balances/Counters/Z-Reading             │
│                                                 │
│  [Export Excel] [Export PDF] [Print]           │
└─────────────────────────────────────────────────┘
```

## Common Use Cases

### End of Day Report
```
Date: Today
Location: All
Cashier: All
→ Get complete daily summary
```

### Single Location Report
```
Date: Today
Location: Main Store
Cashier: All
→ Get specific location performance
```

### Cashier Performance
```
Date: Today
Location: All
Cashier: John Doe
→ Track individual cashier sales
```

### Historical Report
```
Date: Last Week
Location: All
Cashier: All
→ Review past performance
```

## BIR Inspection Ready

This report includes ALL fields required for BIR inspection:

- **RR 18-2012 Compliant** - Electronic Cash Register/Point of Sale Machine
- **RR 11-2004 Compliant** - Invoicing requirements
- **Accumulated Grand Total** - Running balance tracking
- **Reset Counter** - System reset tracking
- **Z-Counter** - Daily closing count

## Technical Details

**Framework:** Next.js 15 (App Router)
**Components:** DevExtreme React DataGrid, SelectBox, DateBox
**Styling:** Tailwind CSS + Shadcn UI
**Export:** ExcelJS + jsPDF
**State:** React hooks (useState, useEffect, useRef)

## Troubleshooting

**Report not loading?**
→ Check you have `REPORT_VIEW` permission

**No locations shown?**
→ Verify locations exist in system

**No users in dropdown?**
→ Check users are active in business

**Export not working?**
→ Check browser allows downloads

**Print layout broken?**
→ Try Chrome or Edge browsers

## Related Reports

- X-Reading Report
- Z-Reading Report
- Sales Today Report
- Customer Sales Report
- Sales Analytics Report

## Support

For issues or questions, check:
1. Full documentation: `BIR_DAILY_SALES_SUMMARY_IMPLEMENTATION.md`
2. API endpoint: `src/app/api/reports/bir/daily-sales-summary/route.ts`
3. DevExtreme docs: https://js.devexpress.com/React/

---

**Created:** October 2025
**Version:** 1.0
**Status:** Production Ready ✅
