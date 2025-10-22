# Add Product V2 - Quick Reference Guide

## Navigation
- **URL**: `/dashboard/products/add-v2`
- **Sidebar**: Products → Add Product V2
- **Permission Required**: `PRODUCT_CREATE`

## Form Structure (4 Tabs)

### Tab 1: Basic Information
```
┌─────────────────────────────────────────────────────────────┐
│ Product Name *        │ Product Type * (Single/Variable/Combo)│
├─────────────────────────────────────────────────────────────┤
│ SKU (Auto-generated)  │ Barcode Type (Code128/Code39/EAN13)  │
├─────────────────────────────────────────────────────────────┤
│ Category (Searchable) │ Sub-Category (Filtered by Category)   │
├─────────────────────────────────────────────────────────────┤
│ Brand (Searchable)    │ Unit of Measure (Name + Short Name)  │
├─────────────────────────────────────────────────────────────┤
│ Description (TextArea - Internal)                            │
├─────────────────────────────────────────────────────────────┤
│ Product Description (TextArea - Customer-facing)             │
└─────────────────────────────────────────────────────────────┘
```

### Tab 2: Pricing & Tax

#### For Single Products:
```
┌─────────────────────────────────────────────────────────────┐
│ Purchase Price (Cost) * │ Margin Percentage (%)              │
├─────────────────────────────────────────────────────────────┤
│ Selling Price *         │ Weight (optional)                  │
│ (Auto-calculates from margin)                                │
├─────────────────────────────────────────────────────────────┤
│ Tax Rate (Name + %)     │ Tax Type (Inclusive/Exclusive)     │
└─────────────────────────────────────────────────────────────┘
```

#### For Variable Products:
```
┌─────────────────────────────────────────────────────────────┐
│ Product Variations                        [Add Variation]    │
├──────────┬──────┬───────────┬──────────┬─────────┬─────────┤
│ Name *   │ SKU  │ Purchase *│ Selling *│ Default │ Actions │
├──────────┼──────┼───────────┼──────────┼─────────┼─────────┤
│ Small    │ S-01 │ 100.00    │ 150.00   │ ☑       │ Delete  │
│ Medium   │ M-01 │ 120.00    │ 180.00   │ ☐       │ Delete  │
│ Large    │ L-01 │ 140.00    │ 210.00   │ ☐       │ Delete  │
└──────────┴──────┴───────────┴──────────┴─────────┴─────────┘
* Inline editing enabled - click cells to edit
```

#### For Combo Products:
```
┌─────────────────────────────────────────────────────────────┐
│ Combo Items                                  [Add Item]      │
├────────────────────────────────────┬────────────┬──────────┤
│ Product *                          │ Quantity * │ Actions  │
├────────────────────────────────────┼────────────┼──────────┤
│ Coffee Beans (1kg)                 │ 1          │ Delete   │
│ Sugar (500g)                       │ 2          │ Delete   │
└────────────────────────────────────┴────────────┴──────────┘
```

### Tab 3: Inventory
```
┌─────────────────────────────────────────────────────────────┐
│ ☑ Enable stock management for this product                  │
├─────────────────────────────────────────────────────────────┤
│ Alert Quantity (Low Stock Warning): [____]                  │
├─────────────────────────────────────────────────────────────┤
│ ℹ️ Note: Initial stock quantities will be set on the next   │
│   page after saving the product.                            │
└─────────────────────────────────────────────────────────────┘
```

### Tab 4: Advanced Settings
```
┌─────────────────────────────────────────────────────────────┐
│ Preparation Time (minutes): [____]  │ ☑ Active Status      │
├─────────────────────────────────────────────────────────────┤
│ ☐ Track IMEI/Serial numbers         │ ☐ Not for Selling    │
├─────────────────────────────────────────────────────────────┤
│ Product Image                                                │
│ [Select Image] or drag image here                           │
│                                                              │
│ Preview:                                                     │
│ ┌────────────────┐                                          │
│ │                │                                          │
│ │  Image Preview │                                          │
│ │                │                                          │
│ └────────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
```

## Form Actions (Bottom of Page)
```
┌────────────────┬────────────────────┬──────────────────────┬────────┐
│ Save & Close   │ Save & Add Another │ Save & Add Opening   │ Cancel │
│ (Success type) │ (Default type)     │ Stock (Default)      │ (Danger)│
└────────────────┴────────────────────┴──────────────────────┴────────┘
```

## Smart Features

### 1. Auto-Calculation
```javascript
Purchase Price: 100.00
Margin %: 50
→ Selling Price: 150.00 (auto-calculated)
```

### 2. Cascading Dropdowns
```
Category: Electronics
→ Sub-Category: [Phones, Laptops, Tablets]

Category: Clothing
→ Sub-Category: [Shirts, Pants, Shoes]
```

### 3. Conditional Rendering
```
Product Type: Single   → Show: Purchase Price, Selling Price fields
Product Type: Variable → Show: Variations DataGrid
Product Type: Combo    → Show: Combo Items DataGrid

Enable Stock: ☑ → Show: Alert Quantity field
Enable Stock: ☐ → Hide: Alert Quantity field
```

### 4. Validation Rules
```
✓ Product Name: Required
✓ Product Type: Required
✓ Purchase Price (Single): Required, > 0
✓ Selling Price (Single): Required, > 0
✓ Variations (Variable): At least 1 required
✓ Combo Items (Combo): At least 1 required
✓ All numeric fields: Must be valid numbers
```

## Save Actions Behavior

| Action | Behavior |
|--------|----------|
| **Save & Close** | Saves product → Redirects to `/dashboard/products` |
| **Save & Add Another** | Saves product → Resets form → Keeps tax setting → Shows "Ready to add another product" toast |
| **Save & Add Opening Stock** | Saves product → Redirects to `/dashboard/products/${id}/opening-stock` |
| **Cancel** | No save → Redirects to `/dashboard/products` |

## Loading States

1. **Page Load**: "Loading form..." with DevExtreme LoadPanel
2. **Submission**: "Saving product..." with DevExtreme LoadPanel + Disabled buttons

## Toast Notifications

| Event | Message | Type |
|-------|---------|------|
| Success | "Product created successfully" | Success (green) |
| Validation Error | "Please fill in all required fields correctly" | Error (red) |
| Variable No Variations | "Variable products must have at least one variation" | Error (red) |
| Combo No Items | "Combo products must have at least one item" | Error (red) |
| API Error | API error message or "Failed to create product" | Error (red) |
| Save & Add Another | "Ready to add another product" | Info (blue) |

## Default Values

| Field | Default Value | Reason |
|-------|--------------|--------|
| Product Type | Single | Most common product type |
| Tax Type | Inclusive | Common in Philippines/BIR |
| Tax Rate | Standard VAT (12%) | Auto-selected if available |
| Enable Stock | ☑ (true) | Most products need stock tracking |
| Active Status | ☑ (true) | New products typically active |
| First Variation | Is Default = true | Variable products need a default |

## Common Workflows

### Creating a Single Product
1. Enter Product Name
2. Select Category, Brand, Unit
3. Go to Pricing tab
4. Enter Purchase Price and Margin %
5. Selling Price auto-calculates
6. Select Tax Rate
7. Click "Save & Close"

### Creating a Variable Product
1. Enter Product Name
2. Set Product Type to "Variable"
3. Select Category, Brand, Unit
4. Go to Pricing tab
5. Click "Add Variation"
6. Fill variation details in grid (Name, Purchase, Selling)
7. Add more variations as needed
8. Click "Save & Close"

### Creating a Combo Product
1. Enter Product Name
2. Set Product Type to "Combo"
3. Select Category, Brand, Unit
4. Go to Pricing tab
5. Click "Add Item"
6. Select product and quantity in grid
7. Add more items as needed
8. Click "Save & Close"

### Adding Product Image
1. Fill basic info and pricing
2. Go to Advanced tab
3. Click "Select Image" or drag image file
4. Preview appears below uploader
5. Image saved as base64 in product data
6. Click "Save & Close"

## Keyboard Shortcuts (DevExtreme)
- **Tab**: Move to next field
- **Shift + Tab**: Move to previous field
- **Enter**: Submit form (on last field)
- **Esc**: Close dropdown/popup
- **Arrow Keys**: Navigate dropdown options

## Mobile Responsiveness
- Form columns adjust automatically
- Tabs stack vertically on small screens
- DataGrid scrolls horizontally if needed
- Touch-friendly input controls
- Responsive button layout

## Error Handling
1. **Client-side Validation**: DevExtreme validation rules
2. **Business Logic Validation**: Custom checks (variations, combo items)
3. **API Error Messages**: Displayed as toast notifications
4. **Network Errors**: Caught and displayed as generic error

## Integration with Existing System
- Uses same API endpoints as Add Product page
- Creates same database structure
- Respects same RBAC permissions
- Maintains multi-tenant isolation
- Compatible with Opening Stock page
- Links back to product list seamlessly

## Tips for Best Results
1. **SKU**: Leave empty for auto-generation with business prefix
2. **Margin**: Use margin percentage for quick price calculation
3. **Tax**: Standard VAT (12%) auto-selected for convenience
4. **Variations**: First variation auto-set as default
5. **Image**: Upload clear product images for better POS experience
6. **Stock**: Enable stock management for inventory tracking
7. **Active Status**: Keep checked unless product not ready for sale

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Form not submitting | Check all required fields (*) are filled |
| Selling price not calculating | Ensure both Purchase Price and Margin % are entered |
| Sub-category not showing | Select a parent Category first |
| Variations not saving | Add at least one variation with all required fields |
| Image not uploading | Check file is a valid image format (jpg, png, gif) |
| "Forbidden" error | User lacks PRODUCT_CREATE permission |

## Performance Notes
- Form loads metadata in parallel (categories, brands, units, taxes)
- Image converted to base64 on client side (no server upload during form fill)
- Validation happens on client before API call
- DataGrid handles large variation/combo item lists efficiently

## Comparison with Original Add Product

| Feature | Original | V2 (DevExtreme) |
|---------|----------|-----------------|
| Layout | Single page scroll | Tabbed interface |
| Validation | HTML5 + manual | DevExtreme validation rules |
| Variations | Manual HTML inputs | DataGrid with inline editing |
| Image Upload | Basic file input | FileUploader with preview |
| Loading | Basic spinner | Professional LoadPanel |
| Styling | Tailwind only | DevExtreme + Tailwind |
| UX | Good | Enhanced, more professional |

## Next Steps After Saving
1. **Opening Stock**: Set initial quantities per location
2. **View Product**: Check product details
3. **Edit Product**: Modify any information
4. **Print Labels**: Generate barcode labels
5. **Add to POS**: Product immediately available for transactions

---

**Quick Access**: Click "Add Product V2" in sidebar under Products menu or navigate directly to `/dashboard/products/add-v2`
