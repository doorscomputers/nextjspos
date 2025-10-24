# Trending Products Report - Quick Start Guide

## What You Got

A complete, production-ready **Trending Products Chart Report** using DevExtreme React Chart Component with all the features you requested!

## Files Created

### 1. API Route
```
C:\xampp\htdocs\ultimatepos-modern\src\app\api\reports\trending-products\route.ts
```
- Handles data aggregation from sales and product tables
- Filters by date range, location, category, brand
- Returns top N products sorted by quantity sold
- Full RBAC and multi-tenant support

### 2. Page Component
```
C:\xampp\htdocs\ultimatepos-modern\src\app\dashboard\reports\trending-products\page.tsx
```
- Beautiful UI with DevExtreme Chart and DataGrid
- Collapsible filters panel
- Summary statistics cards
- Print and export functionality
- Dark mode support
- Responsive design

## How to Access

1. **Start your development server:**
   ```bash
   cd C:\xampp\htdocs\ultimatepos-modern
   npm run dev
   ```

2. **Navigate to:**
   ```
   http://localhost:3000/dashboard/reports/trending-products
   ```

3. **Login with your credentials** (must have `PERMISSIONS.REPORT_VIEW`)

## Features Overview

### 📊 Visual Chart
- **DevExtreme Bar Chart** showing units sold per product
- Interactive tooltips with product details (name, quantity, revenue)
- Rotated labels for better readability
- Export chart to PNG
- Professional blue theme (#2563eb)

### 🎯 Advanced Filters

#### Time Periods:
- ✅ Today
- ✅ This Week
- ✅ This Month
- ✅ This Quarter
- ✅ This Year
- ✅ Last 7 Days
- ✅ Last 30 Days (default)
- ✅ Last 90 Days
- ✅ Custom Range (with date pickers)

#### Dimension Filters:
- ✅ Business Location (respects RBAC permissions)
- ✅ Product Category
- ✅ Product Brand
- ✅ Top N Products (10, 20, 50, 100)

### 📈 Summary Statistics (Gradient Cards)
1. **Blue Card**: Total Products
2. **Green Card**: Total Units Sold
3. **Purple Card**: Total Revenue
4. **Orange Card**: Total Profit

### 📋 Data Table View
- Toggle between Chart View and Table View
- DevExtreme DataGrid with:
  - Column sorting
  - Filtering
  - Column reordering and resizing
  - Summary row with totals
  - Pagination (20 per page)

### 💾 Export Options

#### Excel Export:
- Button: Green "Export Excel" button
- Format: `.xlsx` file
- Includes: All data with formatting and totals
- Uses: `exceljs` library

#### PDF Export:
- Button: Red "Export PDF" button
- Format: `.pdf` file (landscape)
- Includes: Report header, metadata, and data table
- Uses: `jspdf` + `jspdf-autotable`

#### Print:
- Button: "Print" button
- Layout: Optimized for printing (landscape)
- Hides filters and buttons in print view
- Professional header with metadata

### 🎨 UI/UX Features
- ✅ Collapsible filters panel (toggle button)
- ✅ Loading spinner during data fetch
- ✅ Empty state message when no data
- ✅ Initial state prompt to generate report
- ✅ Responsive design (mobile-friendly)
- ✅ Dark mode support
- ✅ Professional gradient cards
- ✅ Smooth transitions and animations

## Quick Test

### Step 1: Generate Default Report
1. Go to the page
2. Click **"Generate Report"** (uses default: Last 30 Days, Top 10)
3. You should see:
   - 4 summary cards with statistics
   - Bar chart showing top 10 products
   - Option to switch to table view

### Step 2: Test Filters
1. Change **Time Period** to "This Month"
2. Select a **Location** from dropdown
3. Select a **Category** (if applicable)
4. Change **Show** to "Top 20"
5. Click **"Generate Report"**
6. Chart updates with new data

### Step 3: Test Exports
1. Click **"Show Table"** to switch to table view
2. Click **"Export Excel"** - downloads `.xlsx` file
3. Click **"Export PDF"** - downloads `.pdf` file with table
4. Click **"Print"** - opens print dialog with optimized layout

### Step 4: Test Responsiveness
1. Resize browser window to mobile size
2. Filters should stack vertically
3. Cards should stack in single column
4. Chart/table should be scrollable

## Data Structure

### API Response:
```json
{
  "trendingProducts": [
    {
      "productId": 1,
      "productName": "Product Name",
      "variationName": "Variation Name",
      "sku": "PROD-001",
      "categoryName": "Category",
      "brandName": "Brand",
      "totalQuantity": 150,
      "totalRevenue": 15000.00,
      "totalCost": 10000.00,
      "totalProfit": 5000.00,
      "salesCount": 45
    }
  ],
  "metadata": {
    "totalProducts": 10,
    "dateRange": {
      "start": "2024-09-24T00:00:00.000Z",
      "end": "2024-10-24T23:59:59.999Z"
    },
    "timePeriod": "last_30_days",
    "location": "All Locations",
    "category": "All Categories",
    "brand": "All Brands",
    "topN": 10
  },
  "reportGenerated": "2024-10-24T12:30:00.000Z"
}
```

## Permissions Required

**User must have:** `PERMISSIONS.REPORT_VIEW`

**Location Access:**
- If user has `ACCESS_ALL_LOCATIONS`: Can see all locations
- Otherwise: Only sees data from assigned locations

## Customization Options

### Change Chart Type:
In `page.tsx`, modify the `Series` component:
```typescript
<Series
  valueField="totalQuantity"
  argumentField="productName"
  name="Total unit sold"
  type="bar"  // Change to: line, area, stackedbar, etc.
  color="#2563eb"
/>
```

### Change Chart Colors:
```typescript
<Series
  // ...
  color="#10b981"  // Green
  // or
  color="#f59e0b"  // Orange
  // or
  color="#8b5cf6"  // Purple
/>
```

### Add Second Series (Revenue):
```typescript
<Series
  valueField="totalQuantity"
  argumentField="productName"
  name="Units Sold"
  type="bar"
  color="#2563eb"
/>
<Series
  valueField="totalRevenue"
  argumentField="productName"
  name="Revenue"
  type="line"
  color="#10b981"
/>
```

### Change Default Top N:
In `page.tsx`, line ~71:
```typescript
const [topN, setTopN] = useState(20)  // Changed from 10 to 20
```

### Change Default Time Period:
In `page.tsx`, line ~68:
```typescript
const [timePeriod, setTimePeriod] = useState('this_month')  // Changed from 'last_30_days'
```

## Troubleshooting

### Issue: Chart not showing
**Solution:**
- Check if `trendingProducts` array has data
- Open browser console and look for errors
- Verify DevExtreme CSS is imported

### Issue: Export not working
**Solution:**
- Check if `exceljs` and `file-saver` packages are installed:
  ```bash
  npm install exceljs file-saver
  npm install --save-dev @types/file-saver
  ```

### Issue: No data showing
**Solution:**
- Ensure you have sales data in the database for the selected period
- Check if user has permission: `PERMISSIONS.REPORT_VIEW`
- Verify user's location access in multi-tenant setup

### Issue: Dark mode not working
**Solution:**
- Ensure all text elements have `dark:text-*` classes
- Verify Tailwind dark mode is configured in `tailwind.config.js`

### Issue: Performance is slow
**Solution:**
- Reduce `topN` value (e.g., from 100 to 20)
- Add database indexes (already in schema):
  ```bash
  npx prisma db push
  ```

## Next Steps (Optional Enhancements)

1. **Add to Sidebar Menu:**
   - Edit `src/components/Sidebar.tsx`
   - Add menu item under Reports section
   - Link to `/dashboard/reports/trending-products`

2. **Add More Chart Types:**
   - Pie chart for revenue distribution
   - Line chart for trend over time
   - Stacked bar for category comparison

3. **Add Drill-Down:**
   - Click product in chart to see detailed history
   - Modal with date-wise breakdown
   - Transaction list

4. **Add Comparison:**
   - Compare with previous period
   - Year-over-year comparison
   - Show percentage change

5. **Add Scheduling:**
   - Schedule automatic report generation
   - Email reports to stakeholders
   - Save favorite filter combinations

## Technical Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **DevExtreme React** | Chart and DataGrid components |
| **Prisma ORM** | Database queries and aggregation |
| **Tailwind CSS** | Styling and responsive design |
| **Shadcn UI** | Card and Button components |
| **exceljs** | Excel export functionality |
| **jspdf** | PDF export functionality |
| **TypeScript** | Type safety |

## Support

If you encounter any issues:
1. Check the browser console for errors
2. Review the implementation guide: `TRENDING_PRODUCTS_IMPLEMENTATION.md`
3. Verify database connection and Prisma schema
4. Ensure all dependencies are installed: `npm install`

## Success!

You now have a fully functional, production-ready Trending Products Chart Report! 🎉

**Key Highlights:**
✅ DevExtreme Chart with beautiful visualizations
✅ Advanced filtering (date, location, category, brand, top N)
✅ Export to Excel, PDF, and Print
✅ Responsive design with dark mode
✅ Multi-tenant and RBAC compliant
✅ Professional UI with gradient cards
✅ Empty and loading states handled
✅ Follows project patterns and conventions

**Enjoy your new report!** 📊✨
