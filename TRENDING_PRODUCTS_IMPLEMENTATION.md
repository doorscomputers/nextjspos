# Trending Products Chart Report - Implementation Guide

## Overview
A comprehensive DevExtreme-powered trending products report showing top-selling products with interactive charts, data tables, and advanced filtering capabilities.

## File Structure

### 1. API Route
**Location:** `C:\xampp\htdocs\ultimatepos-modern\src\app\api\reports\trending-products\route.ts`

**Responsibilities:**
- Fetches sale items data from the database
- Aggregates sales by product variation
- Applies filters (date range, location, category, brand)
- Respects RBAC permissions and multi-tenant data isolation
- Returns top N products sorted by quantity sold

**Key Features:**
- Multi-tenant data filtering by `businessId`
- RBAC location access control
- Time period presets (Today, This Week, This Month, etc.)
- Custom date range support
- Category and brand filtering
- Configurable top N products (10, 20, 50, 100)

### 2. Page Component
**Location:** `C:\xampp\htdocs\ultimatepos-modern\src\app\dashboard\reports\trending-products\page.tsx`

**Key Components Used:**
- **DevExtreme Chart**: Interactive bar chart showing units sold
- **DevExtreme DataGrid**: Tabular view with sorting and filtering
- **DevExtreme SelectBox**: Dropdown filters
- **DevExtreme DateBox**: Date range pickers
- **Shadcn UI Cards**: Summary statistics and layout

## Features Implemented

### 1. Interactive Chart Visualization
- **DevExtreme Chart Component**: Horizontal/vertical bar chart
- **Chart Features:**
  - Interactive tooltips showing product details
  - Legend display
  - Export chart to PNG/PDF
  - Responsive design
  - Custom colors (blue theme: #2563eb)
  - Rotated labels for better readability

### 2. Advanced Filtering System

#### Time Period Filters:
- Today
- This Week
- This Month
- This Quarter
- This Year
- Last 7 Days
- Last 30 Days (default)
- Last 90 Days
- Custom Range (with start/end date pickers)

#### Dimension Filters:
- **Location**: Filter by business location (respects RBAC)
- **Category**: Filter by product category
- **Brand**: Filter by product brand
- **Top N**: Show top 10, 20, 50, or 100 products

### 3. Dual View Modes
- **Chart View**: Visual bar chart representation
- **Table View**: DevExtreme DataGrid with:
  - Sorting on all columns
  - Filtering
  - Column reordering and resizing
  - Summary row (totals)
  - Pagination (20 per page)

### 4. Summary Statistics Cards
Four gradient cards displaying:
1. **Total Products**: Count of trending products
2. **Total Units Sold**: Sum of all quantities
3. **Total Revenue**: Sum of all sales revenue
4. **Total Profit**: Sum of all profits

### 5. Export Capabilities

#### Excel Export:
- Uses `exceljs` library
- Exports DevExtreme DataGrid data
- Includes report header with metadata
- Preserves formatting and filters
- Auto-filter enabled

#### PDF Export:
- Uses `jspdf` and `jspdf-autotable`
- Contains report header with business details
- Exports table data with professional styling
- Landscape orientation for better fit
- Blue header styling (#2563eb)

#### Print Functionality:
- Print-optimized layout
- Hidden filters and buttons in print view
- Clean table format
- Professional header with metadata
- Landscape orientation

### 6. UI/UX Features

#### Responsive Design:
- Mobile-friendly layout
- Collapsible filters panel
- Responsive grid (1 column on mobile, 4 on desktop)
- Touch-friendly DevExtreme components

#### Dark Mode Support:
- All components support dark mode
- Proper color contrast in both modes
- Dark-friendly gradient cards
- DevExtreme theme compatibility

#### Loading States:
- Spinner animation during data fetch
- Disabled buttons while loading
- Loading text indicators

#### Empty States:
- "No data found" message with icon
- "Initial state" prompt to generate report
- Clear instructions for users

### 7. Multi-Tenant & RBAC

#### Permission Checking:
- Requires `PERMISSIONS.REPORT_VIEW`
- Shows permission denied message if unauthorized
- Uses `usePermissions()` hook

#### Data Isolation:
- Filters by user's `businessId`
- Respects user's accessible locations
- Uses `getUserAccessibleLocationIds()` for location filtering

## Data Flow

1. **User Interaction:**
   - User selects filters (time period, location, category, brand, top N)
   - User clicks "Generate Report" button

2. **API Request:**
   - Frontend sends GET request to `/api/reports/trending-products`
   - Query parameters include all filter values

3. **Backend Processing:**
   - Validates user session and permissions
   - Builds date range from time period or custom dates
   - Constructs Prisma query with filters
   - Fetches sale items with related data
   - Aggregates data by product variation
   - Sorts by total quantity descending
   - Limits to top N products

4. **Data Response:**
   - Returns trending products array
   - Includes metadata (date range, location, filters)
   - Frontend displays in chart/table format

5. **Export/Print:**
   - User can switch between chart and table views
   - Export to Excel/PDF with full data
   - Print with optimized layout

## Technical Highlights

### DevExtreme Chart Configuration:
```typescript
<Chart
  dataSource={trendingProducts}
  rotated={false}
  className="dx-card"
>
  <Title text="Total Units Sold by Product" />
  <ArgumentAxis>
    <Label overlappingBehavior="rotate" rotationAngle={-45} />
  </ArgumentAxis>
  <ValueAxis>
    <Label format="fixedPoint" />
  </ValueAxis>
  <Series
    valueField="totalQuantity"
    argumentField="productName"
    name="Total unit sold"
    type="bar"
    color="#2563eb"
  />
  <Legend visible={true} />
  <Tooltip enabled={true} customizeTooltip={customizeTooltip} />
  <Export enabled={true} />
</Chart>
```

### DevExtreme DataGrid Configuration:
```typescript
<DataGrid
  dataSource={trendingProducts}
  showBorders={true}
  rowAlternationEnabled={true}
  allowColumnReordering={true}
  allowColumnResizing={true}
>
  <FilterRow visible={true} />
  <HeaderFilter visible={true} />
  <Paging defaultPageSize={20} />
  <DataGridExport enabled={true} />
  <Column dataField="productName" caption="Product Name" />
  <Column dataField="totalQuantity" format="fixedPoint" />
  <Column dataField="totalRevenue" format="currency" />
  <Summary>
    <TotalItem column="totalQuantity" summaryType="sum" />
  </Summary>
</DataGrid>
```

### API Data Aggregation:
```typescript
const aggregatedData = new Map()
filteredSaleItems.forEach(item => {
  const existing = aggregatedData.get(item.productVariationId)
  if (existing) {
    existing.totalQuantity += quantity
    existing.totalRevenue += revenue
    existing.salesCount += 1
  } else {
    aggregatedData.set(item.productVariationId, {
      productName, totalQuantity, totalRevenue, ...
    })
  }
})

// Sort and limit
trendingProducts = Array.from(aggregatedData.values())
  .sort((a, b) => b.totalQuantity - a.totalQuantity)
  .slice(0, topN)
```

## Color Scheme

### Gradient Cards:
- **Blue**: Total Products (`from-blue-50 to-blue-100`)
- **Green**: Total Units Sold (`from-green-50 to-green-100`)
- **Purple**: Total Revenue (`from-purple-50 to-purple-100`)
- **Orange**: Total Profit (`from-orange-50 to-orange-100`)

### Chart Colors:
- **Primary Bar Color**: `#2563eb` (Blue 600)
- **PDF Header**: `[37, 99, 235]` (RGB for Blue 600)

### Dark Mode Colors:
- Cards: `dark:from-{color}-900 dark:to-{color}-800`
- Text: `dark:text-white`, `dark:text-gray-300`
- Backgrounds: `dark:bg-gray-800`, `dark:bg-gray-900`

## Access the Report

**URL:** `http://localhost:3000/dashboard/reports/trending-products`

**Required Permission:** `PERMISSIONS.REPORT_VIEW`

## Testing Checklist

- [ ] Generate report with default filters (Last 30 Days, Top 10)
- [ ] Test each time period preset
- [ ] Test custom date range
- [ ] Filter by location (single location)
- [ ] Filter by category
- [ ] Filter by brand
- [ ] Change top N (10, 20, 50, 100)
- [ ] Switch between chart and table view
- [ ] Export to Excel (verify data accuracy)
- [ ] Export to PDF (verify formatting)
- [ ] Print report (verify layout)
- [ ] Test with no data (empty state)
- [ ] Test with single product
- [ ] Test dark mode toggle
- [ ] Test on mobile device (responsive)
- [ ] Test permission denied scenario
- [ ] Test multi-tenant isolation (different businessId)
- [ ] Test RBAC location restrictions

## Future Enhancements (Optional)

1. **Additional Chart Types:**
   - Pie chart for revenue distribution
   - Line chart for trend over time
   - Combo chart (quantity + revenue)

2. **Advanced Filters:**
   - Price range filter
   - Profit margin filter
   - Stock status filter
   - Supplier filter

3. **Comparison Features:**
   - Compare with previous period
   - Year-over-year comparison
   - Side-by-side product comparison

4. **Drill-Down:**
   - Click product to see detailed sales history
   - Modal with transaction details
   - Date-wise breakdown

5. **Scheduling:**
   - Schedule automatic report generation
   - Email report to stakeholders
   - Save favorite filter combinations

## Troubleshooting

### Chart Not Displaying:
- Ensure DevExtreme CSS is imported: `import 'devextreme/dist/css/dx.light.css'`
- Check if `trendingProducts` array has data
- Verify `valueField` and `argumentField` match data structure

### Export Not Working:
- Verify `exceljs` and `file-saver` are installed
- Check browser console for errors
- Ensure DevExtreme license (if applicable)

### Dark Mode Issues:
- Verify all text has `dark:text-*` classes
- Check background colors have `dark:bg-*` variants
- Ensure DevExtreme components support dark mode

### Performance Issues:
- Limit data fetching with pagination
- Add database indexes on frequently queried fields
- Consider caching for frequently accessed reports

## Database Indexes (Already in Schema)

The following indexes support optimal query performance:

```prisma
model Sale {
  @@index([businessId])
  @@index([locationId])
  @@index([status])
  @@index([saleDate])
}

model SaleItem {
  @@index([saleId])
  @@index([productId])
  @@index([productVariationId])
}
```

## Conclusion

This implementation provides a production-ready, feature-rich trending products report with:
- Professional DevExtreme chart visualization
- Comprehensive filtering system
- Multi-format export capabilities
- Full RBAC and multi-tenant support
- Responsive design with dark mode
- Print-optimized layout

The report follows the existing codebase patterns (BIR Daily Sales Summary and Sales Per Item reports) while adding advanced DevExtreme chart features for better data visualization.
