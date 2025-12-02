# Daily Cash Collection Report - December 2, 2025

## Overview
Create a new **Daily Cash Collection Report** that displays all cash collections and payment breakdowns for a selected date, matching the format shown in the owner's reference image.

## Requirements
- Separate Report Page under Reports > Cashier Reports menu
- All Payment Types tracked individually (Cash, Check, GCash, PayMaya, Card, NFC, Bank Transfer)
- Reference/Payer Combined - use existing referenceNumber field for payer identification
- Cash denomination breakdown from closed shifts
- Print and Export (CSV) functionality

## Tasks
- [x] Create API endpoint `/api/reports/daily-cash-collection`
- [x] Create report page with grid layout matching the image
- [x] Add menu item to Sidebar under Cashier Reports
- [x] Add permission `REPORT_DAILY_CASH_COLLECTION` to RBAC
- [x] Implement print functionality (full page)
- [x] Add CSV export

## Review
Created a new Daily Cash Collection Report feature with the following components:

### Files Created
1. `src/app/api/reports/daily-cash-collection/route.ts` - API endpoint that:
   - Fetches all payments for a selected date
   - Groups payments by payment method (cash, check, gcash, paymaya, card, nfc, bank_transfer, other)
   - Retrieves cash denomination counts from closed shifts
   - Returns structured data for the report

2. `src/app/dashboard/reports/daily-cash-collection/page.tsx` - Report page with:
   - Date picker for selecting report date (defaults to today)
   - Location filter dropdown
   - Cash denominations table (1000, 500, 200, 100, 50, 20, 10, 5, 1, 0.25)
   - Individual payment type sections with reference numbers and amounts
   - Grand total calculation
   - Print functionality (A4 format)
   - CSV export functionality
   - Responsive grid layout

### Files Modified
1. `src/lib/rbac.ts` - Added:
   - `REPORT_DAILY_CASH_COLLECTION` permission
   - Added permission to Cashier role
   - Added permission to Branch Manager role

2. `src/components/Sidebar.tsx` - Added:
   - "Daily Cash Collection" menu item under Cashier Reports section

### Layout Matches Reference Image
- Left column: Cash denominations with QTY and AMOUNT
- Right section: Grid of payment type cards (Check, GCash, PayMaya, Card, NFC, Bank Transfer)
- Each payment card shows: Reference/Payer, Reference Number, Amount
- Collection total prominently displayed
