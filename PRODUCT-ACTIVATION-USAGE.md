# Product Activation/Deactivation - User Guide

## Quick Start

### What is Product Activation?

Product activation/deactivation allows you to control which products appear in transaction forms (sales, purchases, transfers) **without deleting them**.

### Key Concepts

- **Active Product** ✓ - Available for all transactions
- **Inactive Product** ○ - Hidden from transaction forms but visible in product list
- **Soft Deleted Product** ✗ - Completely removed from all views

---

## Using the Feature

### 1. View Product Status

Navigate to: **Dashboard → Products**

Each product shows a status badge:
- 🟢 **Green "Active"** badge = Product is active
- ⚪ **Gray "Inactive"** badge = Product is inactive

Inactive products also have:
- Gray background
- Faded text

---

### 2. Activate/Deactivate a Product

**Requirements:**
- You must have **Product Update** permission
- Typically available to: Super Admin, Admin, Manager

**Steps:**
1. Find the product in the list
2. Look for the toggle switch next to the status badge
3. Click the switch to toggle status
4. Success notification will appear
5. Product status updates immediately

**Toggle Switch Colors:**
- 🟢 Green = Active
- ⚪ Gray = Inactive

---

### 3. Filter Products by Status

Use the **filter dropdown** at the top of the products list:

- **All Products** - Shows both active and inactive
- **Active Only** - Shows only active products
- **Inactive Only** - Shows only inactive products

The list updates automatically when you change the filter.

---

## Common Use Cases

### Scenario 1: Seasonal Products

**Problem:** You sell seasonal items (e.g., winter jackets) that you don't want to appear in summer sales.

**Solution:**
1. At end of season, deactivate seasonal products
2. Products remain in inventory with stock levels intact
3. They won't appear in sales forms
4. Reactivate when season starts again

### Scenario 2: Discontinued Products

**Problem:** Product is discontinued but you still have old stock or historical data.

**Solution:**
1. Deactivate the product
2. Existing stock reports still show inventory
3. Past sales remain in history
4. Product won't appear in new sales
5. When stock is depleted, you can delete it permanently

### Scenario 3: Testing New Products

**Problem:** You want to add a new product but not make it available yet.

**Solution:**
1. Create product as usual (defaults to active)
2. Immediately deactivate it
3. Configure prices, stock, images
4. Activate when ready to sell

### Scenario 4: Bulk Inventory Review

**Problem:** Need to review and clean up old products.

**Solution:**
1. Filter by "Active Only"
2. Identify products not selling
3. Deactivate low-performing items
4. Review inactive products monthly
5. Delete permanently if no longer needed

---

## Transaction Form Behavior

### Sales Forms

**What You See:**
- Only **active products** appear in product dropdown/selection
- Inactive products are automatically filtered out
- Cannot manually add inactive products to sales

### Purchase Forms

**What You See:**
- Only **active products** available
- This prevents purchasing discontinued items

### Transfer Forms

**What You See:**
- Only **active products** can be transferred
- Ensures you only move actively-used inventory

---

## Important Notes

### ✅ What Happens When You Deactivate a Product

- ✓ Product hidden from transaction forms
- ✓ Product visible in product list (with filter)
- ✓ Stock reports still show inventory
- ✓ Historical transactions remain unchanged
- ✓ Can still add opening stock
- ✓ Can reactivate anytime

### ❌ What Does NOT Happen

- ✗ Product is NOT deleted
- ✗ Stock is NOT removed
- ✗ Past transactions NOT affected
- ✗ Product data NOT lost

---

## Permission Requirements

| Role | Can View Status | Can Toggle Status |
|------|----------------|-------------------|
| Super Admin | ✓ Yes | ✓ Yes |
| Admin | ✓ Yes | ✓ Yes |
| Manager | ✓ Yes | ✓ Yes |
| Cashier | ✓ Yes | ✗ No |

**Note:** Users without toggle permission see the status badge but cannot change it.

---

## Tips and Best Practices

### 1. Regular Review
- Review active products monthly
- Deactivate products with no sales in 90+ days
- Keep product list lean and relevant

### 2. Communication
- Inform team when deactivating products
- Update product descriptions with deactivation reason
- Use notes field to track deactivation date

### 3. Seasonal Planning
- Deactivate seasonal products at end of season
- Create calendar reminders to reactivate
- Batch activate/deactivate related products

### 4. Inventory Management
- Deactivate before deleting
- Wait for stock to deplete
- Check for pending orders first

### 5. Reporting
- Filter by "Inactive Only" to see deactivated products
- Export list for review
- Track inactive products with stock

---

## Troubleshooting

### Problem: Cannot see toggle switch

**Possible Causes:**
- You don't have "Product Update" permission
- You're not logged in
- Your role doesn't allow product updates

**Solution:**
- Contact your administrator for permission
- Log in with admin account
- Check your role assignments

---

### Problem: Product still appears in sales form

**Possible Causes:**
- Product is still active (check badge)
- Browser cache not refreshed
- Toggle didn't save properly

**Solution:**
1. Verify product shows "Inactive" badge
2. Refresh the sales form page
3. Clear browser cache if needed
4. Check toggle switch is in off position

---

### Problem: Can't find deactivated product

**Possible Causes:**
- Filter is set to "Active Only"
- Product was deleted, not deactivated
- Searching for wrong product

**Solution:**
1. Change filter to "All Products" or "Inactive Only"
2. Use search bar to find product
3. Check if product was soft-deleted (deletedAt field)

---

### Problem: Need to reactivate many products

**Current Limitation:**
- Must toggle each product individually
- No bulk activate feature yet

**Workaround:**
1. Contact developer to run script
2. Or toggle each product manually
3. Future enhancement: bulk operations

---

## FAQ

**Q: What's the difference between Deactivate and Delete?**

A:
- **Deactivate** = Hide from transactions, keep in system
- **Delete** = Remove completely from system

**Q: Can I deactivate a product with stock?**

A: Yes! Stock levels remain unchanged. The product just won't appear in transaction forms.

**Q: Will deactivating affect my reports?**

A: No. Stock reports, sales history, and analytics still include inactive products.

**Q: Can I reactivate a product later?**

A: Yes! Simply toggle the switch again. Product becomes immediately available.

**Q: What happens to products in my cart when I deactivate them?**

A: This depends on your cart implementation. Best practice: Clear carts or warn users before deactivating.

**Q: Can I set a product to auto-deactivate?**

A: Not currently. This is a potential future enhancement.

**Q: How do I know when a product was deactivated?**

A: Currently, no timestamp is stored. This is a potential future enhancement (activity log).

---

## Developer Integration

### For Developers Building Transaction Forms

When fetching products for sales, purchase, or transfer forms:

```javascript
// ✓ CORRECT - Only active products
const response = await fetch('/api/products?forTransaction=true')

// ✗ WRONG - Includes inactive products
const response = await fetch('/api/products')
```

### API Endpoints

```javascript
// Get all products (with filter)
GET /api/products?active=true     // Active only
GET /api/products?active=false    // Inactive only
GET /api/products                 // All products

// Get products for transactions
GET /api/products?forTransaction=true  // Active only

// Toggle product status
POST /api/products/{id}/toggle-active
```

---

## Support

For additional help:
1. Check the implementation docs: `PRODUCT-ACTIVATION-IMPLEMENTATION.md`
2. Contact your system administrator
3. Refer to the E2E tests for expected behavior

---

**Last Updated:** 2025-10-04
**Feature Version:** 1.0.0
