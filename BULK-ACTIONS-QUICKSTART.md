# Bulk Actions Quick Start Guide

## Quick Reference

### How to Use Bulk Actions

1. **Navigate to Products Page**: Go to Dashboard > Products
2. **Select Products**: Use checkboxes to select one or more products
3. **Choose Action**: Bulk action buttons appear at bottom of table
4. **Execute**: Click desired button and confirm if prompted

### Button Reference

| Button | Color | Permission Required | Description |
|--------|-------|---------------------|-------------|
| Delete Selected | Red (`bg-red-600`) | `PRODUCT_DELETE` | Soft deletes selected products |
| Activate Selected | Green (`bg-green-600`) | `PRODUCT_UPDATE` | Activates selected products |
| Deactivate Selected | Yellow (`bg-yellow-600`) | `PRODUCT_UPDATE` | Deactivates selected products (not available for sale) |
| Add to Location | Cyan (`bg-cyan-600`) | `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK` | Creates zero-inventory records at chosen location |
| Remove from Location | Gray (`bg-gray-600`) | `PRODUCT_UPDATE` or `PRODUCT_OPENING_STOCK` | Deletes inventory records at chosen location |

### Keyboard Shortcuts & Tips

- **Ctrl+Click** (or Cmd+Click on Mac): Select multiple individual products
- **Shift+Click**: Select range of products (browser default behavior)
- **Select All Checkbox**: Header checkbox selects all products on current page
- **Clear Selection**: Click "Clear selection" link to deselect all

### Selection Behavior

- ✓ Selection applies to current page only
- ✓ Selection persists when changing visible columns
- ✗ Selection is cleared when changing pages
- ✗ Selection is cleared after successful bulk action

### Common Workflows

#### Workflow 1: Bulk Deactivate Seasonal Products
1. Use search to filter seasonal products (e.g., "Christmas")
2. Click Select All checkbox
3. Click "Deactivate Selected"
4. Confirm action

#### Workflow 2: Add New Products to All Locations
1. Filter by recently created products
2. Select the new products
3. Choose first location from dropdown
4. Click "Add to Location"
5. Repeat for each location

#### Workflow 3: Clean Up Discontinued Products
1. Filter by inactive products
2. Select discontinued items
3. Click "Delete Selected"
4. Confirm deletion

#### Workflow 4: Reactivate Products After Stock Arrival
1. Filter by inactive products
2. Select products that now have stock
3. Click "Activate Selected"
4. Products are now available for sale

### Troubleshooting

**Q: Why can't I see the Delete button?**
A: You need `PRODUCT_DELETE` permission. Contact your administrator.

**Q: Why are location buttons disabled?**
A: You must select a location from the dropdown first.

**Q: I selected products but the buttons disappeared when I changed pages.**
A: Selection is page-specific. Return to the original page or reselect products.

**Q: Can I select all products across all pages?**
A: Not currently. This feature may be added in the future. For now, adjust "Items per page" to show more products at once.

**Q: What happens to stock when I remove products from a location?**
A: All inventory records for those products at that location are permanently deleted. A warning appears if products have stock.

**Q: Can I undo a bulk delete?**
A: Not from the UI, but products are soft-deleted (not permanently removed from database). Contact a developer or database administrator for recovery.

### API Endpoints

For developers integrating with the bulk actions:

```bash
# Bulk Delete
POST /api/products/bulk-delete
Content-Type: application/json
{ "productIds": [1, 2, 3] }

# Bulk Activate/Deactivate
POST /api/products/bulk-toggle-active
Content-Type: application/json
{ "productIds": [1, 2, 3], "isActive": true }

# Add to Location
POST /api/products/bulk-add-to-location
Content-Type: application/json
{ "productIds": [1, 2, 3], "locationId": 5 }

# Remove from Location
POST /api/products/bulk-remove-from-location
Content-Type: application/json
{ "productIds": [1, 2, 3], "locationId": 5 }
```

All endpoints require:
- Valid authentication session
- Appropriate permissions
- Products must belong to user's business

### Performance Notes

- Bulk operations are optimized using Prisma's `updateMany()` and `createMany()`
- No hard limit on number of products, but recommended to process <100 at a time for best performance
- Location operations process all product variations, so variable products create more inventory records
- Database uses transactions to ensure atomicity

### Mobile Usage

All bulk action features are mobile-responsive:
- Buttons wrap to multiple lines on small screens
- Dropdowns remain usable on mobile
- Checkboxes are properly sized for touch input
- Action panel scrolls horizontally if needed

### Best Practices

1. **Use Filters First**: Filter products before selecting to avoid mistakes
2. **Double-Check Selection**: Review selected count before executing
3. **Start Small**: Test with a few products before doing large bulk operations
4. **Backup Important Data**: Consider exporting products before bulk delete
5. **Use Descriptive Names**: When adding to locations, ensure location names are clear
6. **Monitor Performance**: Large bulk operations may take a few seconds

### Support

For issues or feature requests:
1. Check the testing guide: `test-bulk-actions.md`
2. Review implementation details: `BULK-ACTIONS-IMPLEMENTATION.md`
3. Contact your system administrator
4. Review API error messages in browser console (F12)
