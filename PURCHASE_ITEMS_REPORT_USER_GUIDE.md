# Purchase Items Report - User Guide

## Overview
The Purchase Items Report has been upgraded with DevExtreme DataGrid, providing powerful filtering, sorting, grouping, and export capabilities.

## Quick Start Guide

### Accessing the Report
1. Navigate to **Reports** > **Purchase Items Report** in the sidebar
2. The report loads automatically with all purchase items from your business

---

## Using the Top Filters

### Pre-Grid Filters
These filters apply server-side and control which data is loaded into the grid:

#### Basic Filters
- **Location**: Filter by business location
- **Supplier**: Filter by supplier
- **Status**: Filter by purchase order status
  - Draft, Submitted, Approved, Partially Received, Received, Completed, Cancelled

#### Search Filters
- **Product Name**: Search by product name
- **SKU**: Search by SKU code
- **PO Number**: Search by purchase order number

#### Date Range
- **Start Date**: Filter from this date
- **End Date**: Filter to this date

#### Amount Range
- **Min Item Total**: Minimum total amount
- **Max Item Total**: Maximum total amount

### Filter Actions
- **Apply Filters**: Click to fetch data with selected filters
- **Reset Filters**: Click to clear all filters
- **Show/Hide Filters**: Toggle filter visibility

---

## Using the DevExtreme DataGrid

### Global Search
- **Search Box**: Type to search across ALL columns instantly
- Located at the top-right of the grid
- Searches: Product names, SKUs, PO numbers, suppliers, locations, etc.

### Column Filtering

#### Filter Row (Built-in)
- **Text Columns**: Type to filter (Product, Variation, SKU, Supplier, Location)
- **Date Columns**: Use date picker to filter
- **Number Columns**: Enter values to filter
- **Status Column**: Select from dropdown

#### Header Filters
- Click the filter icon in any column header
- Select specific values to show/hide
- Great for filtering by status, supplier, or location

### Sorting
- **Click Column Header**: Sort ascending
- **Click Again**: Sort descending
- **Click Third Time**: Remove sort
- **Shift+Click**: Multi-column sort

### Grouping
- **Drag Column to Group Panel**: Group data by that column
- **Best For**: Grouping by Status, Supplier, or Location
- **Multi-Level Grouping**: Drag multiple columns
- **Collapse/Expand Groups**: Click group headers

### Column Management

#### Column Chooser
- Click the **Column Chooser** icon (grid icon) in toolbar
- Check/uncheck columns to show/hide
- Useful for focusing on specific data

#### Column Reordering
- **Drag Column Headers**: Rearrange columns
- **Fixed Columns**: Product Name is fixed on left

#### Column Resizing
- **Drag Column Border**: Resize to desired width
- Grid remembers your preferences

### Row Selection
- **Checkboxes**: Select individual rows
- **Header Checkbox**: Select all rows
- **Export Selected**: Export only selected rows

### Pagination
- **Default**: 50 items per page
- **Change Page Size**: Click page size dropdown (10, 25, 50, 100)
- **Navigate**: Use previous/next buttons
- **Virtual Scrolling**: Smooth scrolling through large datasets

---

## Summary Cards

Six cards display real-time aggregated metrics:

1. **Total Items**: Count of purchase items
2. **Qty Ordered**: Total quantity ordered
3. **Qty Received**: Total quantity received
4. **Total Value**: Total item value (Qty × Unit Cost)
5. **Received Value**: Value of received items
6. **Avg Unit Cost**: Average cost per unit

---

## Export Features

### Excel Export
1. Click **Excel** icon in grid toolbar
2. Choose:
   - **Export All Data**: All filtered items
   - **Export Selected Rows**: Only checked rows
3. File includes:
   - Professional header formatting (blue background)
   - Auto-filters enabled
   - Summary totals in footer
   - Filename: `purchase-items-report-YYYY-MM-DD.xlsx`

### PDF Export
1. Click **PDF** icon in grid toolbar
2. Choose export scope (all or selected)
3. File features:
   - Landscape orientation for wide tables
   - Compact 7pt font to fit all columns
   - Professional header styling
   - Summary totals in footer
   - Filename: `purchase-items-report-YYYY-MM-DD.pdf`

---

## Understanding the Data Columns

### Product Information
- **Product**: Main product name (fixed column)
- **Variation**: Product variation
- **SKU**: Stock Keeping Unit code

### Purchase Order Details
- **PO Number**: Purchase order number (blue color)
- **PO Date**: Date purchase order was created
- **Expected Delivery**: Expected delivery date (or N/A)

### Business Details
- **Supplier**: Supplier name
- **Location**: Business location/branch

### Status
Color-coded badges indicate PO status:
- **Gray**: Draft
- **Blue**: Submitted
- **Green**: Approved or Received
- **Yellow**: Partially Received
- **Purple**: Completed
- **Red**: Cancelled

### Quantities
- **Qty Ordered**: Quantity ordered (2 decimal places)
- **Qty Received**: Quantity received so far

### Costs
- **Unit Cost**: Cost per unit
- **Item Total**: Total cost (Qty Ordered × Unit Cost) - Yellow highlight
- **Received Total**: Received cost (Qty Received × Unit Cost) - Green highlight

### Additional
- **Serial?**: Whether item requires serial number tracking

---

## Summary Totals (Footer Row)

The grid footer displays:
- **Total Items**: Count of all items
- **Qty Ordered**: Sum of all quantities ordered
- **Qty Received**: Sum of all quantities received
- **Item Total**: Sum of all item totals
- **Received Total**: Sum of all received totals
- **Unit Cost**: Average unit cost across all items

These totals update based on:
- Active filters
- Search criteria
- Visible rows (if grouped)

---

## Advanced Features

### State Persistence
- Grid remembers your preferences:
  - Column widths
  - Column order
  - Column visibility
  - Sort order
  - Page size
- Stored in browser localStorage
- Persists across sessions

### Grouping Examples

#### Group by Status
1. Drag "Status" column to group panel
2. See items organized by status
3. Click status groups to expand/collapse

#### Group by Supplier
1. Drag "Supplier" column to group panel
2. See items per supplier
3. View supplier-level summaries

#### Multi-Level Grouping
1. Drag "Supplier" to group panel
2. Drag "Status" to group panel
3. See items grouped by supplier, then status within each supplier

### Conditional Formatting

#### Status Badges
- Automatically colored for easy identification
- Dark mode compatible

#### Cost Highlighting
- **Item Total**: Yellow background for quick reference
- **Received Total**: Green background for received amounts

---

## Tips & Tricks

### Finding Specific Items
1. Use **Global Search** for quick text searches
2. Use **Header Filters** for exact matches
3. Use **Filter Row** for partial matches
4. Combine multiple filters for precise results

### Analyzing Data
1. **Group by Status** to see PO progress
2. **Group by Supplier** to analyze supplier performance
3. **Sort by Item Total** to find highest value items
4. **Filter by Date Range** to analyze periods

### Preparing Reports
1. Apply desired filters
2. Group data if needed
3. Select specific rows (optional)
4. Export to Excel or PDF
5. Review in external application

### Performance Optimization
- Grid uses virtual scrolling for smooth performance
- Filters are applied client-side after initial load
- Large datasets handled efficiently
- Grouping doesn't impact performance

---

## Mobile & Tablet Support

### Mobile View (< 768px)
- Summary cards stack vertically
- Filters stack into single column
- Grid enables horizontal scrolling
- Touch-friendly interactions

### Tablet View (768px - 1024px)
- Summary cards in 2 columns
- Filters in 2 columns
- Grid fully functional with touch

### Desktop View (> 1024px)
- Summary cards in 6 columns
- Filters in 4 columns
- Full grid features available

---

## Dark Mode

All components support dark mode:
- Automatic theme detection
- Readable text on all backgrounds
- Status badges with dark-compatible colors
- No light-on-light or dark-on-dark issues

---

## Keyboard Shortcuts

### Navigation
- **Tab**: Navigate between columns
- **Arrow Keys**: Navigate cells
- **Page Up/Down**: Scroll pages

### Selection
- **Space**: Toggle row selection
- **Ctrl+A**: Select all rows

### Grouping
- **Drag & Drop**: Move columns to group

---

## Troubleshooting

### No Data Showing
- Check top filters - ensure they're not too restrictive
- Click "Reset Filters" to clear all filters
- Verify you have purchase items in the system

### Export Not Working
- Ensure you have data in the grid
- Check browser allows file downloads
- Try different browser if issues persist

### Grid Performance Issues
- Clear browser cache
- Reduce page size to 25 or 10
- Apply more restrictive filters to reduce data

### Lost Customizations
- Grid state stored in localStorage
- Clear browser data may reset preferences
- Recreate custom layout if needed

---

## Best Practices

### Daily Operations
1. Use top filters to narrow down to relevant period/location
2. Use global search for quick lookups
3. Group by status to track PO progress

### Monthly Reviews
1. Set date range for the month
2. Export to Excel for analysis
3. Use grouping for supplier analysis

### Audits
1. Apply all relevant filters
2. Export complete dataset
3. Use Excel for detailed analysis

---

## Comparison with Old Version

### What Changed
- ✅ Replaced custom table with DevExtreme DataGrid
- ✅ Removed manual column filters (replaced with better ones)
- ✅ Removed custom pagination (DevExtreme handles it)
- ✅ Enhanced export with professional styling

### What Stayed the Same
- ✅ All top filters (location, supplier, status, etc.)
- ✅ Summary cards with same metrics
- ✅ API endpoint (no backend changes)
- ✅ Data structure and calculations

### New Features Added
- ✅ Global search across all columns
- ✅ Header filters for exact matches
- ✅ Column chooser (show/hide columns)
- ✅ Column reordering via drag-and-drop
- ✅ Grouping panel with multi-level grouping
- ✅ Row selection with export selected
- ✅ State persistence (remembers preferences)
- ✅ Virtual scrolling for better performance
- ✅ Professional Excel/PDF exports

---

## Support

For issues or questions:
1. Check this guide first
2. Try "Reset Filters" if data not showing
3. Clear browser cache if performance issues
4. Contact IT support for persistent problems

---

## Version Information

- **Implementation**: DevExtreme DataGrid 25.1
- **Export**: ExcelJS 4.4.0, jsPDF 3.0.3
- **Browser Support**: Modern browsers (Chrome, Firefox, Edge, Safari)
- **Mobile Support**: Full responsive design
