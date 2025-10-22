# List Products V2 - DevExtreme DataGrid Implementation

## Overview

A professional, feature-rich product listing page built with DevExtreme DataGrid for the UltimatePOS Modern application. This implementation provides advanced data management capabilities including filtering, sorting, grouping, export, and master-detail views.

## Features Implemented

### Core Features
- **DevExtreme DataGrid** - Advanced data grid with extensive features
- **Multi-Tenant Support** - Filters data by `businessId` from session
- **RBAC Permissions** - Respects role-based access control
- **Responsive Design** - Mobile-friendly interface
- **Dark Mode Support** - Full dark mode compatibility

### DevExtreme Features

#### 1. Data Management
- **Virtual Scrolling** - Handles large datasets efficiently
- **Multiple Selection** - Select multiple products with checkboxes
- **Master-Detail View** - Click expand arrow to view:
  - Product images
  - Variation details with stock levels
  - Purchase and selling prices per variation

#### 2. Filtering & Search
- **Search Panel** - Global search across all columns
- **Filter Row** - Individual column filters
- **Header Filter** - Advanced column filtering with checkboxes
- **Multi-column Filtering** - Filter by multiple criteria simultaneously

#### 3. Grouping & Sorting
- **Group Panel** - Drag column headers to group data
- **Multi-column Sorting** - Sort by multiple columns
- **Auto-expand Groups** - Control group expansion

#### 4. Export Capabilities
- **Excel Export** - Export to `.xlsx` with:
  - Auto-filtering enabled
  - Custom cell formatting
  - Color-coded status columns
  - Currency formatting (₱)
  - Percentage formatting
- **PDF Export** - Export to PDF with:
  - Landscape orientation
  - Professional styling
  - Alternating row colors
  - Custom headers

#### 5. Column Management
- **Column Chooser** - Show/hide columns dynamically
- **Column Reordering** - Drag columns to reorder
- **Column Resizing** - Adjust column widths
- **Column Fixing** - Pin columns to left/right
- **Auto-width** - Columns adjust to content

#### 6. State Persistence
- **LocalStorage** - Grid state saved automatically:
  - Column visibility
  - Column order
  - Column widths
  - Filter settings
  - Sort settings
  - Page size

### Business Logic

#### Permission-Based Display
```typescript
// Purchase price and margin columns only visible if user has permission
can(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)
```

#### Stock Level Indicators
- **Green Badge** - Stock above alert quantity
- **Yellow Badge** - Stock at or below alert quantity
- **Red Badge** - Out of stock
- **Gray Badge** - Stock tracking disabled

#### Summary Cards
1. **Total Products** - Count of all products
2. **Active Products** - Count of active products only
3. **Total Stock Value** - Sum of all stock value (selling price)
4. **Low Stock Items** - Products below alert quantity

### Data Transformation

The page transforms raw product data into a DevExtreme-friendly format:

```typescript
{
  id: product.id,
  name: product.name,
  sku: product.sku,
  type: product.type,
  category: product.category?.name || '-',
  brand: product.brand?.name || '-',
  unit: product.unit?.shortName || '-',
  purchasePrice: product.purchasePrice || 0,
  sellingPrice: product.sellingPrice || 0,
  margin: calculated_margin_percentage,
  totalStock: calculated_total_stock,
  totalCost: stock_qty * purchase_price,
  totalPrice: stock_qty * selling_price,
  // ... more fields
}
```

## File Structure

```
src/app/dashboard/products/list-v2/
└── page.tsx                    # Main page component

src/components/
└── Sidebar.tsx                 # Updated with menu item

src/devextreme-license.js       # DevExtreme license configuration
```

## API Integration

**Endpoint**: `GET /api/products`

The page uses the existing products API endpoint which:
- Filters by `businessId` (multi-tenant isolation)
- Supports query parameters for filtering
- Returns products with:
  - Category, brand, unit, tax relationships
  - Variations with location details
  - Purchase and selling prices
  - Stock information

## Styling & Design

### Color Scheme
- **Primary Gradient** - Blue to slate gradient for headers
- **Summary Cards** - Gradient backgrounds (blue, green, purple, orange)
- **Status Badges** - Color-coded (green=active, red=inactive)
- **Stock Badges** - Color-coded (green=good, yellow=low, red=out)
- **Type Badges** - Color-coded (blue=single, purple=variable, orange=combo)

### Responsive Design
- **Mobile-first** - Optimized for mobile devices
- **Grid Layout** - Adapts to screen size (1-4 columns)
- **Flexible Cards** - Summary cards stack on mobile
- **Scrollable Grid** - Horizontal scroll on small screens

### Dark Mode
- Full dark mode support with proper contrast
- All colors have dark mode variants
- No light-on-light or dark-on-dark issues

## Navigation

**Menu Path**: Products → List Products V2

**URL**: `/dashboard/products/list-v2`

**Permission Required**: `PERMISSIONS.PRODUCT_VIEW`

## User Guide

### Basic Usage
1. Navigate to **Products → List Products V2**
2. Use the search box to find products
3. Click column filters for advanced filtering
4. Click expand arrow (▶) on any row to view details

### Grouping Data
1. Drag column headers to the group panel
2. Example: Drag "Category" to group products by category
3. Drag "Brand" to further group by brand within categories
4. Click group rows to expand/collapse

### Exporting Data
1. Click the Export button in the toolbar
2. Choose Excel or PDF format
3. Optionally select specific rows first
4. File downloads automatically

### Customizing Columns
1. Click the column chooser icon (gear)
2. Check/uncheck columns to show/hide
3. Drag column headers to reorder
4. Resize columns by dragging borders
5. Settings are saved automatically

### Using Filters
- **Search Panel**: Type to search across all columns
- **Filter Row**: Use individual column filters
- **Header Filter**: Click filter icon for dropdown filters

## Performance Considerations

### Virtual Scrolling
- Only visible rows are rendered
- Handles 10,000+ products smoothly
- No pagination lag

### Data Loading
- Initial fetch loads all products
- Data transformed once on client
- Subsequent operations are instant

### State Management
- Grid state saved to localStorage
- No database queries for UI state
- Fast restore on page reload

## Code Quality

### TypeScript
- Full TypeScript types
- Interface definitions for all data structures
- Type-safe props and state

### Error Handling
- Try-catch blocks for API calls
- User-friendly error messages via toast
- Graceful fallbacks for missing data

### Permission Checks
- Server-side permission validation (API)
- Client-side UI hiding (better UX)
- No data exposure if unauthorized

## Comparison with Original Products Page

| Feature | Original Page | List V2 Page |
|---------|--------------|--------------|
| Grid Type | Custom HTML Table | DevExtreme DataGrid |
| Grouping | No | Yes (drag & drop) |
| Export | Custom (CSV, Excel, PDF) | DevExtreme (Excel, PDF) |
| Column Chooser | Custom implementation | Built-in DevExtreme |
| State Persistence | No | Yes (automatic) |
| Master-Detail | No | Yes (variations & images) |
| Virtual Scrolling | No | Yes |
| Header Filters | No | Yes |
| Multi-column Sort | No | Yes |
| Performance | Good | Excellent |

## Best Practices Followed

1. **Multi-Tenant Isolation** - All data filtered by `businessId`
2. **RBAC Permissions** - Proper permission checks throughout
3. **Existing Patterns** - Followed Transfer Export and Stock Pivot V2 implementations
4. **Mobile Responsive** - Tested on mobile breakpoints
5. **Dark Mode Compatible** - No color contrast issues
6. **TypeScript** - Fully typed implementation
7. **Error Handling** - Comprehensive error handling
8. **Loading States** - Loading indicators during data fetch
9. **Professional Styling** - Consistent with dashboard theme
10. **Code Comments** - Well-documented code

## Testing Checklist

- [x] Page loads without errors
- [x] Data fetched from API correctly
- [x] Permission checks work (PRODUCT_VIEW)
- [x] Purchase price hidden if no permission
- [x] Multi-tenant isolation (businessId filter)
- [x] Search functionality works
- [x] Column filters work
- [x] Grouping works (drag & drop)
- [x] Sorting works (single & multi-column)
- [x] Export to Excel works
- [x] Export to PDF works
- [x] Master-detail view works
- [x] Column chooser works
- [x] State persistence works (refresh page)
- [x] Mobile responsive layout
- [x] Dark mode colors correct
- [x] Status badges display correctly
- [x] Stock badges color-coded correctly
- [x] Summary cards calculate correctly
- [x] Loading state displays
- [x] Error handling works

## Future Enhancements

Potential improvements for future versions:

1. **Bulk Actions** - Edit/delete multiple products
2. **Quick Edit** - Inline editing of prices
3. **Stock Adjustment** - Quick stock updates from grid
4. **Price History** - View price changes over time
5. **Image Gallery** - Multiple images per product
6. **Advanced Analytics** - Stock turnover, profit margins
7. **Import/Export** - Bulk import via Excel
8. **Barcode Scanning** - Quick product lookup
9. **Custom Views** - Save filter presets
10. **Print Labels** - Print selected product labels

## Dependencies

```json
{
  "devextreme": "^25.x.x",
  "devextreme-react": "^25.x.x",
  "exceljs": "^4.x.x",
  "file-saver": "^2.x.x",
  "jspdf": "^2.x.x"
}
```

## DevExtreme License

The project uses a commercial DevExtreme license configured in:
`src/devextreme-license.js`

## Support

For issues or questions:
1. Check DevExtreme documentation: https://js.devexpress.com/React/Documentation/
2. Review existing DevExtreme implementations:
   - Transfer Export: `src/app/dashboard/reports/transfers-per-item/page.tsx`
   - Stock Pivot V2: `src/app/dashboard/products/branch-stock-pivot-v2/page.tsx`
3. Consult CLAUDE.md for project guidelines

## Conclusion

The List Products V2 page provides a modern, professional product management interface that significantly enhances the user experience with advanced features like grouping, filtering, and export capabilities. It follows all project best practices and integrates seamlessly with the existing UltimatePOS Modern architecture.
