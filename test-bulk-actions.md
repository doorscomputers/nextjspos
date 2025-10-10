# Bulk Actions Testing Guide

## Overview
This guide provides testing procedures for the newly implemented bulk action features in the product list page.

## Features Implemented

### 1. API Endpoints Created

#### Bulk Delete
- **Endpoint**: `POST /api/products/bulk-delete`
- **Request Body**: `{ productIds: number[] }`
- **Permission Required**: `PRODUCT_DELETE`
- **Multi-Tenancy**: Verified - only deletes products belonging to user's business

#### Bulk Activate/Deactivate
- **Endpoint**: `POST /api/products/bulk-toggle-active`
- **Request Body**: `{ productIds: number[], isActive: boolean }`
- **Permission Required**: `PRODUCT_UPDATE`
- **Multi-Tenancy**: Verified - only updates products belonging to user's business

#### Bulk Add to Location
- **Endpoint**: `POST /api/products/bulk-add-to-location`
- **Request Body**: `{ productIds: number[], locationId: number }`
- **Permission Required**: `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK`
- **Multi-Tenancy**: Verified - checks business ownership for both products and location
- **Location Access Control**: Verified - checks user has access to the specified location

#### Bulk Remove from Location
- **Endpoint**: `POST /api/products/bulk-remove-from-location`
- **Request Body**: `{ productIds: number[], locationId: number }`
- **Permission Required**: `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK`
- **Multi-Tenancy**: Verified - checks business ownership for both products and location
- **Location Access Control**: Verified - checks user has access to the specified location

### 2. Frontend Features

#### Checkbox Selection
- **Select All**: Checkbox in table header to select all products on current page
- **Individual Selection**: Checkbox for each product row
- **Selected Count Display**: Shows number of products selected
- **Clear Selection**: Button to deselect all products

#### Bulk Action Buttons
All buttons appear at the bottom of the product table when products are selected:

1. **Delete Selected** (Red button)
   - Only visible with `PRODUCT_DELETE` permission
   - Shows confirmation dialog
   - Refreshes product list after deletion

2. **Activate Selected** (Green button)
   - Only visible with `PRODUCT_UPDATE` permission
   - Activates all selected products

3. **Deactivate Selected** (Yellow/Amber button)
   - Only visible with `PRODUCT_UPDATE` permission
   - Deactivates all selected products
   - Tooltip: "Deactivated products will not be available for purchase or sell"

4. **Location Dropdown + Actions** (Cyan and Gray buttons)
   - Only visible with `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK` permission
   - Dropdown to select target location
   - "Add to Location" button (Cyan) - Adds selected products to chosen location
   - "Remove from Location" button (Gray) - Removes selected products from chosen location

## Testing Checklist

### Unit Tests

#### Test Multi-Tenancy Isolation
- [ ] User A cannot delete products belonging to User B's business
- [ ] User A cannot activate/deactivate products belonging to User B's business
- [ ] User A cannot add products to locations belonging to User B's business
- [ ] User A cannot remove products from locations belonging to User B's business

#### Test Permission Enforcement
- [ ] User without `PRODUCT_DELETE` permission cannot bulk delete
- [ ] User without `PRODUCT_UPDATE` permission cannot bulk activate/deactivate
- [ ] User without `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK` cannot manage locations
- [ ] Buttons are hidden in UI when user lacks permissions

#### Test Location Access Control
- [ ] User assigned to Location A cannot add products to Location B
- [ ] User assigned to Location A cannot remove products from Location B
- [ ] User with `ACCESS_ALL_LOCATIONS` permission can access all locations

#### Test Edge Cases
- [ ] Bulk delete with empty array returns error
- [ ] Bulk activate/deactivate with empty array returns error
- [ ] Add to location without locationId returns error
- [ ] Add to location with non-existent locationId returns error
- [ ] Remove from location warns if products have stock

### Integration Tests

#### Test Delete Flow
1. Select multiple products
2. Click "Delete Selected"
3. Confirm deletion
4. Verify products are soft-deleted (deletedAt is set)
5. Verify products no longer appear in product list

#### Test Activate/Deactivate Flow
1. Select multiple inactive products
2. Click "Activate Selected"
3. Verify products are now active
4. Select same products
5. Click "Deactivate Selected"
6. Verify products are now inactive

#### Test Add to Location Flow
1. Create a new business location
2. Select multiple products
3. Choose location from dropdown
4. Click "Add to Location"
5. Verify inventory records created with qty 0
6. Attempting to add same products again should skip duplicates

#### Test Remove from Location Flow
1. Select products that exist in a location
2. Choose location from dropdown
3. Click "Remove from Location"
4. Confirm removal (especially if products have stock)
5. Verify inventory records are deleted

### UI/UX Tests

#### Test Checkbox Behavior
- [ ] Select All checkbox selects all products on current page
- [ ] Select All checkbox is checked when all products are selected
- [ ] Individual checkboxes update Select All state correctly
- [ ] Selection persists when changing visible columns
- [ ] Selection is cleared when changing page

#### Test Button States
- [ ] Buttons are disabled during bulk action (loading state)
- [ ] Buttons show appropriate loading indicators
- [ ] Location buttons are disabled when no location is selected
- [ ] Success/error toasts appear after each action

#### Test Responsive Design
- [ ] Bulk action buttons wrap properly on mobile
- [ ] Location dropdown is usable on mobile
- [ ] Buttons maintain proper spacing on small screens
- [ ] No dark-on-dark or light-on-light color issues

### Role-Based Testing

#### Super Admin / Admin
- [ ] Can see all bulk action buttons
- [ ] Can perform all bulk operations
- [ ] Can access all locations

#### Manager
- [ ] Can see bulk action buttons (depending on assigned permissions)
- [ ] Can only access assigned locations
- [ ] Cannot perform operations on inaccessible locations

#### Cashier
- [ ] Cannot see bulk delete button (no PRODUCT_DELETE permission)
- [ ] May have limited location access

## Manual Testing Steps

### Setup
1. Ensure database is seeded with demo data: `npm run db:seed`
2. Start development server: `npm run dev`
3. Login with different user roles

### Test as Super Admin
1. Navigate to Products page
2. Verify all bulk action buttons are visible
3. Select 3-5 products
4. Test each bulk action:
   - Delete Selected
   - Activate Selected
   - Deactivate Selected
   - Add to Location
   - Remove from Location

### Test as Manager
1. Login as manager user
2. Navigate to Products page
3. Verify location dropdown only shows assigned locations
4. Attempt to add products to non-assigned location (should fail)

### Test as Cashier
1. Login as cashier user
2. Navigate to Products page
3. Verify "Delete Selected" button is not visible
4. Verify other buttons may be hidden based on permissions

## Known Limitations

1. **Selection Scope**: Checkbox selection only applies to current page (not across all pages)
2. **Stock Warning**: Remove from location warns about stock but allows deletion
3. **Batch Size**: No limit on number of products that can be selected (consider adding limit for very large datasets)

## Future Enhancements

1. Add confirmation modal instead of browser confirm()
2. Add progress indicator for large batch operations
3. Add ability to select all products across all pages
4. Add undo functionality for bulk delete
5. Add CSV export of selected products
6. Add bulk edit for other fields (category, brand, tax, etc.)
