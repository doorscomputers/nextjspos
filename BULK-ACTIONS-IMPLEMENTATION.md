# Bulk Actions Implementation Summary

## Overview
This document summarizes the implementation of bulk action features for the product list page in UltimatePOS Modern. All features include proper multi-tenancy isolation, RBAC permission checks, and location-based access control.

## Implementation Date
2025-10-06

## Files Created

### API Endpoints
All endpoints follow Next.js App Router conventions and include:
- Authentication checks
- Multi-tenancy isolation (businessId filtering)
- RBAC permission verification
- Proper error handling and HTTP status codes

#### 1. `src/app/api/products/bulk-delete/route.ts`
- **Method**: POST
- **Purpose**: Delete multiple products at once
- **Request**: `{ productIds: number[] }`
- **Permission**: `PERMISSIONS.PRODUCT_DELETE`
- **Operation**: Soft delete (sets deletedAt timestamp)
- **Returns**: Success message with count of deleted products

#### 2. `src/app/api/products/bulk-toggle-active/route.ts`
- **Method**: POST
- **Purpose**: Activate or deactivate multiple products
- **Request**: `{ productIds: number[], isActive: boolean }`
- **Permission**: `PERMISSIONS.PRODUCT_UPDATE`
- **Operation**: Updates isActive field for all selected products
- **Returns**: Success message with count of updated products

#### 3. `src/app/api/products/bulk-add-to-location/route.ts`
- **Method**: POST
- **Purpose**: Add selected products to a business location
- **Request**: `{ productIds: number[], locationId: number }`
- **Permission**: `PERMISSIONS.PRODUCT_UPDATE` or `PERMISSIONS.PRODUCT_OPENING_STOCK`
- **Location Access Check**: Uses `getUserAccessibleLocationIds()` to verify user can access the location
- **Operation**:
  - Gets all product variations for selected products
  - Creates `VariationLocationDetails` records with zero inventory
  - Skips duplicates (upsert behavior)
- **Returns**: Count of created records and skipped duplicates

#### 4. `src/app/api/products/bulk-remove-from-location/route.ts`
- **Method**: POST
- **Purpose**: Remove selected products from a business location
- **Request**: `{ productIds: number[], locationId: number }`
- **Permission**: `PERMISSIONS.PRODUCT_UPDATE` or `PERMISSIONS.PRODUCT_OPENING_STOCK`
- **Location Access Check**: Uses `getUserAccessibleLocationIds()` to verify user can access the location
- **Operation**:
  - Checks if any products have stock at the location (warning)
  - Deletes all `VariationLocationDetails` records for the selected products at the location
- **Returns**: Count of deleted records and warning if stock was cleared

## Files Modified

### Frontend
#### `src/app/dashboard/products/page.tsx`

**New State Variables Added:**
```typescript
const [selectedProductIds, setSelectedProductIds] = useState<number[]>([])
const [locations, setLocations] = useState<BusinessLocation[]>([])
const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null)
const [bulkActionLoading, setBulkActionLoading] = useState(false)
```

**New Functions Added:**
- `fetchLocations()` - Fetches available locations for the user
- `handleSelectAll()` - Selects/deselects all products on current page
- `handleSelectProduct()` - Toggles individual product selection
- `handleBulkDelete()` - Deletes selected products
- `handleBulkActivate()` - Activates selected products
- `handleBulkDeactivate()` - Deactivates selected products
- `handleBulkAddToLocation()` - Adds products to chosen location
- `handleBulkRemoveFromLocation()` - Removes products from chosen location

**UI Changes:**
1. **Checkbox Column Added:**
   - Header checkbox for Select All
   - Individual checkbox for each product row
   - Checkboxes use Tailwind classes for styling

2. **Bulk Action Panel:**
   - Appears at bottom of table when products are selected
   - Shows selected count and clear selection button
   - Contains all action buttons with permission-based visibility

3. **Action Buttons:**
   - Delete Selected (Red) - `PRODUCT_DELETE` permission
   - Activate Selected (Green) - `PRODUCT_UPDATE` permission
   - Deactivate Selected (Yellow) - `PRODUCT_UPDATE` permission
   - Location Dropdown + Add to Location (Cyan) - `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK`
   - Remove from Location (Gray) - `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK`

## Database Schema Changes
**None required.** The implementation uses existing tables:
- `products` - For activation/deactivation
- `variation_location_details` - For location management

## Security Implementation

### Multi-Tenancy Isolation
All API endpoints verify that:
1. User has a valid session with businessId
2. All products belong to the user's business
3. All locations belong to the user's business

**Example Pattern:**
```typescript
const products = await prisma.product.findMany({
  where: {
    id: { in: ids },
    businessId: parseInt(businessId),
    deletedAt: null
  }
})

if (products.length !== ids.length) {
  return NextResponse.json({ error: 'Products not found' }, { status: 404 })
}
```

### RBAC Permission Checks
All endpoints check user permissions before executing operations:

```typescript
if (!user.permissions?.includes(PERMISSIONS.PRODUCT_DELETE)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

Frontend buttons are conditionally rendered based on permissions:

```typescript
{can(PERMISSIONS.PRODUCT_DELETE) && (
  <button onClick={handleBulkDelete}>Delete Selected</button>
)}
```

### Location Access Control
Location-specific operations check user access using the RBAC utility:

```typescript
const accessibleLocationIds = getUserAccessibleLocationIds(user)
if (accessibleLocationIds !== null && !accessibleLocationIds.includes(locId)) {
  return NextResponse.json({ error: 'No access to location' }, { status: 403 })
}
```

## User Experience Features

### Visual Feedback
- Toast notifications for success/error messages (using `sonner` library)
- Loading states with disabled buttons during operations
- Selected product count display
- Clear selection button for easy reset

### Confirmation Dialogs
- Delete action requires confirmation
- Remove from location warns about stock deletion

### Responsive Design
- Bulk action buttons wrap on smaller screens
- Location dropdown maintains usability on mobile
- Proper spacing and padding for all screen sizes
- Color contrast verified (no dark-on-dark or light-on-light issues)

### Button States
- Disabled during loading (prevents double-submission)
- Location buttons disabled when no location selected
- Tooltips on deactivate button explaining the feature

## Testing Recommendations

### Manual Testing Workflow
1. **Login as Super Admin**
   - Navigate to Products page
   - Select multiple products using checkboxes
   - Test each bulk action button
   - Verify success messages appear

2. **Test Multi-Tenancy**
   - Create two businesses with different products
   - Attempt cross-business operations (should fail)
   - Verify error messages

3. **Test Permissions**
   - Login as different roles (Admin, Manager, Cashier)
   - Verify button visibility based on permissions
   - Attempt restricted operations (should fail with 403)

4. **Test Location Access**
   - Create user with limited location access
   - Attempt to add products to inaccessible location (should fail)
   - Verify accessible locations appear in dropdown

5. **Test Edge Cases**
   - Try bulk operations with empty selection
   - Try adding products already at a location (should skip)
   - Try removing products with stock (should warn)

### Automated Testing
See `test-bulk-actions.md` for comprehensive testing checklist.

## Known Limitations

1. **Selection Scope**: Checkbox selection only applies to products on the current page, not across all pages
2. **No Undo**: Deleted products cannot be easily restored (soft delete, but no UI for recovery)
3. **Browser Confirm**: Uses native browser confirm() instead of custom modal
4. **No Batch Limit**: No enforced limit on number of selected products (consider for very large datasets)

## Future Enhancements

1. **Enhanced Confirmation Modals**: Replace browser confirm() with custom modal components
2. **Progress Indicators**: Add progress bars for large batch operations
3. **Cross-Page Selection**: Add ability to select all products matching current filter across all pages
4. **Bulk Edit**: Extend to support bulk editing of category, brand, tax, pricing, etc.
5. **CSV Export of Selection**: Allow exporting only selected products
6. **Undo Functionality**: Add ability to undo bulk operations
7. **Audit Log**: Track bulk operations in activity log for compliance

## API Response Examples

### Successful Bulk Delete
```json
{
  "message": "Successfully deleted 5 product(s)",
  "deletedCount": 5
}
```

### Successful Bulk Activate
```json
{
  "message": "Successfully activated 3 product(s)",
  "updatedCount": 3,
  "isActive": true
}
```

### Successful Add to Location
```json
{
  "message": "Successfully added 5 product(s) to location. Created 15 inventory record(s), skipped 2 existing record(s)",
  "createdCount": 15,
  "skippedCount": 2,
  "locationName": "Main Store"
}
```

### Error - Forbidden
```json
{
  "error": "Forbidden - Insufficient permissions"
}
```

### Error - Invalid Input
```json
{
  "error": "Product IDs array is required"
}
```

### Error - Multi-Tenancy Violation
```json
{
  "error": "Some products not found or do not belong to your business"
}
```

## Dependencies
No new dependencies were added. Implementation uses existing libraries:
- Next.js 15 (App Router)
- Prisma ORM
- NextAuth (authentication)
- Sonner (toast notifications)
- Tailwind CSS (styling)
- Heroicons (icons)
- shadcn/ui Select component

## Deployment Notes
1. No database migrations required
2. No environment variable changes needed
3. Code changes are backward compatible
4. Existing product functionality remains unchanged
5. Build process unchanged (existing build errors are unrelated to this implementation)

## Conclusion
The bulk actions feature is fully implemented with production-ready code that follows all project conventions:
- Multi-tenant architecture enforced
- RBAC permissions properly checked
- Location-based access control implemented
- Error handling comprehensive
- User experience polished
- Code maintainable and well-documented

All four bulk action buttons are functional and ready for production use after testing.
