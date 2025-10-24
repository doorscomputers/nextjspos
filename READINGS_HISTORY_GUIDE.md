# X & Z Readings History - User Guide

## Overview

The Readings History feature allows you to view, search, and print all past X and Z readings from your POS system. This is essential for:
- BIR compliance and auditing
- Historical sales analysis
- Reconciliation and verification
- Backup documentation

## Access

**Navigation:** Dashboard → Readings History

**URL:** `/dashboard/readings/history`

**Required Permission:** `reading.x_reading` or `reading.z_reading`

## Features

### 1. Comprehensive List View

View all historical readings in a clean, organized list showing:
- **Reading Type Badge** (X or Z)
- **Shift Number**
- **Date & Time**
- **Cashier Name**
- **Location**
- **Sales Totals** (Gross, Net, Discounts)
- **Transaction Count**
- **Expected Cash**

### 2. Advanced Filtering

Filter readings by multiple criteria:

#### Reading Type Filter
- **All**: Show both X and Z readings
- **X Reading**: Show only mid-shift readings
- **Z Reading**: Show only end-of-shift readings

#### Search Box
Search across:
- Shift numbers
- Cashier names
- Location names

#### Date Range Filter
- **From Date**: Start of date range
- **To Date**: End of date range
- Includes all times on the selected dates

### 3. Quick Actions

For each reading:
- **View**: Open the full reading details in a new tab
- **Print**: Open the reading in print-ready format

### 4. Sort & Display

- Readings are sorted by date (newest first)
- Shows result count: "Showing X of Y readings"
- Responsive design works on all devices

## How to Use

### View Historical Readings

1. Navigate to **Readings History** from the sidebar
2. All readings will load automatically
3. Scroll through the list to browse

### Filter by Type

Click the filter buttons at the top:
- **All** - Show everything
- **X Reading** - Mid-shift readings only
- **Z Reading** - End-of-shift readings only

### Search for Specific Reading

1. Use the **Search box**
2. Type any of:
   - Shift number (e.g., "SHIFT-20251024-0001")
   - Cashier name (e.g., "John")
   - Location name (e.g., "Main Store")
3. Results filter in real-time

### Filter by Date Range

1. Set **From Date** to start of period
2. Set **To Date** to end of period
3. Leave either blank for open-ended ranges

**Examples:**
- Last 7 days: From = 7 days ago, To = today
- Specific month: From = Oct 1, To = Oct 31
- All after date: From = Jan 1, To = (blank)

### View Full Reading

1. Find the reading you want
2. Click the **"View"** button
3. Opens in new tab with full details:
   - All sales transactions
   - Payment breakdowns
   - Discount analysis
   - Cash denominations (if Z reading)
   - BIR-compliant format

### Print Reading

1. Find the reading you want
2. Click the **"Print"** button
3. Opens print-ready version in new tab
4. Use browser print (Ctrl+P or Cmd+P)
5. Works with:
   - Thermal printers (58mm/80mm)
   - A4/Letter paper
   - PDF save

### Clear Filters

Click **"Clear Filters"** button to reset:
- Type filter to "All"
- Search box cleared
- Date range cleared

### Refresh List

Click **"Refresh"** button to reload data from database.

## Reading Types Explained

### X Reading (Mid-Shift)
- **Purpose**: Check sales during shift without closing
- **When**: Anytime during open shift
- **Effect**: Non-destructive, doesn't close shift
- **Counter**: Increments X Reading counter
- **Use Cases**:
  - Supervisor checks mid-shift
  - Transfer to another location (shows current sales)
  - Reconciliation during busy days
  - Backup before shift handover

### Z Reading (End-of-Shift)
- **Purpose**: Final sales report for closed shift
- **When**: After shift is closed
- **Effect**: Marks shift as completed
- **Counter**: Increments Z Reading counter
- **Use Cases**:
  - Daily BIR reporting
  - Cash reconciliation
  - End-of-day settlement
  - Audit trail

## Information Displayed

### Per Reading Card

**Header Section:**
- Reading type badge (X or Z)
- Shift number
- Date and time

**Details Grid:**
- Cashier who operated
- Location/branch
- Gross sales amount
- Number of transactions

**Additional Info:**
- Net sales (after discounts)
- Total discounts given
- Expected cash in drawer

## Print Formats

Printed readings include:

### Header
- Business name and details
- Reading type (X or Z)
- Shift number and date
- Cashier and location

### Sales Summary
- Gross sales
- Discounts breakdown (Senior, PWD, Regular)
- Net sales
- Void transactions

### Payment Methods
- Cash
- Credit/Debit card
- Digital payments (GCash, etc.)
- Other payment methods

### Cash Management (Z Reading)
- Beginning cash
- Cash sales
- Cash in/out operations
- Expected cash
- Actual counted cash
- Over/Short variance
- Cash denomination breakdown

### BIR Compliance
- Sequential numbering
- VAT breakdown
- Discount details with IDs
- Authorized signatures

## Best Practices

### Daily Operations
1. Generate Z Reading at end of each shift
2. Print for physical records
3. Verify variance is within tolerance
4. File with daily cash reconciliation

### Weekly Review
1. Filter by date range (past 7 days)
2. Review all Z Readings
3. Check for patterns in variances
4. Compare sales across locations

### Monthly Audit
1. Export all readings for the month
2. Compare with bank deposits
3. Verify BIR report accuracy
4. Archive printed copies

### Troubleshooting
1. If variance is high, review X Readings during shift
2. Compare timestamps for unusual patterns
3. Cross-reference with sales transactions
4. Check cash in/out records

## Tips & Shortcuts

- **Quick Print**: Use keyboard shortcut (Ctrl+P / Cmd+P) after clicking Print
- **Multiple Prints**: Open multiple readings in different tabs
- **Date Ranges**: Use browser's date picker for easy selection
- **Mobile**: Responsive design works on tablets/phones
- **Export**: Print to PDF to save digital copies

## Reporting & Compliance

### BIR Requirements
- All readings are BIR-compliant
- Sequential numbering maintained
- VAT calculations included
- Discount tracking with IDs

### Audit Trail
- Complete history preserved
- Cannot delete historical readings
- Timestamps are immutable
- Cashier accountability maintained

### Record Retention
- Keep printed Z Readings for 3+ years
- Store digitally as backup
- Organize by month and location
- Include in annual audit prep

## Frequently Asked Questions

**Q: Can I delete old readings?**
A: No, all readings are permanent for audit trail compliance.

**Q: How long is history kept?**
A: Unlimited. All readings from system start are available.

**Q: Can I export to Excel?**
A: Print to PDF, then use PDF to Excel conversion if needed.

**Q: Why can't I see some readings?**
A: You can only see readings from locations you're assigned to.

**Q: Do X Readings show final numbers?**
A: No, X Readings show mid-shift state. Only Z Readings show final numbers.

**Q: Can I generate X Reading for closed shift?**
A: No, only open shifts can generate X Readings.

**Q: Where are Z Readings?**
A: Z Readings are generated when you close a shift. They appear here automatically.

## Technical Details

### Data Source
- Pulls from `cashier_shifts` table
- Includes `cash_denominations`
- Links to `sales` and `payments`
- Filtered by user's assigned locations

### Performance
- Loads last 100 shifts by default
- Real-time filtering (no server requests)
- Lazy loading for large datasets
- Optimized queries for speed

### Security
- Multi-tenant data isolation
- Location-based access control
- RBAC permission enforcement
- Audit logging for access

## Support

If readings are missing or incorrect:
1. Verify shift was properly closed
2. Check user location assignments
3. Review permissions
4. Contact system administrator

---

**Ready to use!** Navigate to Readings History from the sidebar and start exploring your historical data.
