# Customers Page - Feature Guide

## Quick Overview
The Customers page now uses DevExtreme DataGrid for a professional, enterprise-grade experience.

## Main Features

### 1. Search & Filter
**Global Search**
- Search across all fields (name, email, mobile)
- Real-time filtering as you type
- 300px wide search box in toolbar

**Column Filters**
- Click filter icon in column header
- Individual column filtering
- Header filter dropdowns for advanced filtering

### 2. Data Grid Features

**Sorting**
- Click column header to sort
- Multi-column sort (Shift+Click)
- Ascending/Descending/Clear

**Pagination**
- Default: 20 rows per page
- Options: 10, 20, 50, 100 rows
- Page navigation buttons
- Shows total count and current range

**Column Management**
- Drag column headers to reorder
- Resize columns by dragging borders
- Auto-width for optimal viewing

**Row Alternation**
- Zebra-striped rows for easier reading
- Hover effect on rows
- Professional appearance

### 3. Export Options

**Excel Export**
- Click "Export to Excel" in toolbar (or use DataGrid export button)
- File format: `.xlsx`
- Includes all columns except Actions
- Auto-filter enabled in Excel
- Filename: `Customers_YYYY-MM-DD.xlsx`

**PDF Export**
- Click "Export to PDF" button
- Landscape orientation (better for wide tables)
- A4 paper size
- Filename: `Customers_YYYY-MM-DD.pdf`

### 4. Add/Edit Customers

**Add New Customer**
- Click "Add Customer" button (requires CUSTOMER_CREATE permission)
- Modern modal dialog opens
- Fill in form fields:
  - Customer Name (required)
  - Email (optional)
  - Mobile (optional)
  - Address (optional)
- Click "Create Customer" to save

**Edit Existing Customer**
- Click "Edit" button in Actions column (requires CUSTOMER_UPDATE permission)
- Dialog opens with pre-filled data
- Modify fields as needed
- Click "Update Customer" to save

### 5. Status Display
**Active Badge**: Green badge with "Active" text
**Inactive Badge**: Gray badge with "Inactive" text

### 6. Refresh Data
- Click "Refresh" button to reload customer list
- Shows success toast notification
- Spinner animation during refresh

## Removed Features

### Delete Functionality - DISABLED
- Delete button has been completely removed
- No delete option in Actions column
- DELETE API endpoint still exists but cannot be called from UI
- This prevents accidental customer deletions

## Permissions Required

### View Customers Page
- Any user with dashboard access can view this page

### Add New Customer
- Permission: `CUSTOMER_CREATE`
- If missing: "Add Customer" button is hidden

### Edit Customer
- Permission: `CUSTOMER_UPDATE`
- If missing: "Edit" button in Actions column is hidden

### Delete Customer
- **DISABLED** - No UI option available regardless of permissions

## Column Structure

| Column | Description | Sortable | Filterable | Width |
|--------|-------------|----------|------------|-------|
| Customer Name | Full name of customer | Yes | Yes | 200px min |
| Email | Email address or "-" | Yes | Yes | 200px min |
| Mobile | Phone number or "-" | Yes | Yes | 150px min |
| Address | Full address or "-" | Yes | Yes | 250px min |
| Status | Active/Inactive badge | Yes | Yes | 120px |
| Actions | Edit button only | No | No | 120px |

## Responsive Behavior

### Desktop (>= 768px)
- Header buttons in row layout
- Full table visible
- All columns shown
- Optimal column widths

### Mobile (< 768px)
- Header buttons stack vertically
- Table scrolls horizontally
- Touch-friendly controls
- Responsive pagination

## Dark Mode

### Fully Supported
- Background: Dark gradient (gray-900)
- DataGrid: Dark theme styling
- Dialog: Dark background with light text
- Buttons: Adjusted colors for dark mode
- No contrast issues

### Color Palette (Dark Mode)
- Background: `from-gray-900 via-gray-900 to-gray-900`
- Card: `bg-gray-800 border-gray-700`
- Text: `text-gray-100` to `text-white`
- Accents: Blue 400-500 range

## Performance Features

### Virtual Scrolling
- Only renders visible rows
- Handles thousands of customers efficiently
- Smooth scrolling experience

### Optimized Rendering
- DevExtreme's internal optimization
- React refs for direct DOM access
- Efficient state management

## User Experience Details

### Loading States
1. **Initial Load**: Spinner with "Loading customers..." text
2. **Refresh**: Button shows spinner icon during refresh
3. **Save**: Dialog button shows "Saving..." with spinner

### Empty States
- No customers: Informative message in DataGrid
- No search results: Grid shows empty state

### Error Handling
- Failed fetch: Toast error notification
- Save failed: Toast error with details
- Network errors: Graceful error messages

### Success Feedback
- Customer created: Green toast notification
- Customer updated: Green toast notification
- Data refreshed: Success toast message

## Keyboard Shortcuts (DevExtreme Built-in)

- `Tab`: Navigate between cells
- `Arrow Keys`: Navigate grid
- `Enter`: Start editing (if enabled)
- `Esc`: Cancel editing
- `Space`: Toggle selection (if enabled)
- `Ctrl+A`: Select all (if enabled)

## Accessibility Features

### Screen Reader Support
- ARIA labels on all interactive elements
- Proper heading hierarchy
- Form label associations
- Status announcements

### Keyboard Navigation
- All features accessible via keyboard
- Logical tab order
- Focus indicators
- Skip links for navigation

## Common Use Cases

### 1. Find a Specific Customer
**Option A - Use Search**
1. Type customer name in search box
2. Results filter automatically

**Option B - Use Column Filter**
1. Click filter icon on Name column
2. Enter search term
3. Press Enter

### 2. Export Customer List for Marketing
1. Apply any filters needed (optional)
2. Click "Export to Excel" button
3. Open file in Excel
4. Use for mail merge or analysis

### 3. Update Customer Information
1. Find customer using search
2. Click "Edit" button
3. Update details
4. Click "Update Customer"
5. Changes saved immediately

### 4. Add New Customer During Sale
1. Click "Add Customer" button
2. Enter name (minimum requirement)
3. Add mobile for SMS notifications (optional)
4. Add email for receipts (optional)
5. Click "Create Customer"

### 5. Review All Active Customers
1. Click Status column filter
2. Select "Active" only
3. Review filtered list
4. Export if needed

## Tips & Tricks

### Quick Navigation
- Use search for fastest lookup
- Use filters for complex queries
- Combine search + filters for precision

### Bulk Operations
- Export to Excel
- Modify in Excel
- Consider adding import feature (future)

### Data Quality
- Email validation in form
- Required name field prevents empty records
- Optional fields allow partial data entry

### Performance
- Default 20 rows per page for fast loading
- Increase to 100 for fewer pages
- Virtual scrolling handles large datasets

## Troubleshooting

### Search Not Working
- Clear all column filters first
- Check for empty data
- Refresh the page

### Can't See Edit Button
- Check if you have CUSTOMER_UPDATE permission
- Contact administrator for role/permission update

### Export Not Working
- Ensure customers exist in list
- Check browser download settings
- Allow popups if needed

### Dialog Won't Close
- Wait for save operation to complete
- Check for validation errors
- Use Cancel button if needed

## Integration Points

### API Endpoints
- `GET /api/customers` - Fetch list
- `POST /api/customers` - Create new
- `PUT /api/customers/{id}` - Update existing

### Related Pages
- **Sales**: Select customer during checkout
- **Reports**: Customer purchase history
- **Settings**: Manage customer groups (future)

### Data Flow
1. Page loads → Fetch customers from API
2. User creates/edits → POST/PUT to API
3. Success → Refresh list from API
4. Display updated data in grid

## Future Enhancement Ideas

1. **Inline Editing**: Edit directly in grid cells
2. **Bulk Import**: Upload Excel to create multiple customers
3. **Customer Groups**: Organize by segments
4. **Purchase History**: View customer transactions
5. **Custom Fields**: Add business-specific fields
6. **Email Integration**: Send bulk emails to filtered customers
7. **SMS Integration**: Send promotions via SMS
8. **Loyalty Points**: Track customer rewards
9. **Credit Limits**: Manage customer credit
10. **Notes & Tags**: Add metadata to customers

---

**Last Updated**: 2025-10-26
**Version**: 1.0 (DevExtreme)
**Component**: DataGrid from DevExtreme React 25.1
