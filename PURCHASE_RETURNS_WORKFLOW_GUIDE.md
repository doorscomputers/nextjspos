# Purchase Returns Workflow Guide

**Version:** 1.0
**Last Updated:** October 21, 2025
**Features:** Create Return from Product Page | Enhanced GRN Search

---

## Table of Contents

1. [Overview](#overview)
2. [Feature 1: Create Return from Product Page](#feature-1-create-return-from-product-page)
3. [Feature 2: Enhanced GRN Search with Product/SKU](#feature-2-enhanced-grn-search-with-productsku)
4. [Permission Requirements](#permission-requirements)
5. [Complete Workflow Examples](#complete-workflow-examples)
6. [Troubleshooting](#troubleshooting)

---

## Overview

This guide covers two new features designed to streamline the Purchase Returns workflow:

| Feature | Purpose | Best For |
|---------|---------|----------|
| **Create Return from Product Page** | Create returns directly from defective product | When you know the product but not which GRN |
| **Enhanced GRN Search** | Search GRNs by product name or SKU | When you need to find GRNs containing specific items |

### Key Benefits

✅ **Faster Return Processing** - No more manual searching through dozens of GRNs
✅ **Reduced Errors** - System automatically shows only relevant GRNs
✅ **Better Visibility** - See all GRNs for a product in one place
✅ **Time Savings** - Cut return creation time from 5-10 minutes to under 2 minutes

---

## Feature 1: Create Return from Product Page

### What It Does

When you find a defective product, you can now create a Purchase Return **directly from the product detail page** without manually searching through GRNs.

### Who Can Use This

| Role | Can Create Returns? | Button Visible? |
|------|---------------------|-----------------|
| Super Admin | ✅ Yes | ✅ Yes |
| Branch Manager | ✅ Yes | ✅ Yes |
| Accounting Staff | ✅ Yes | ✅ Yes |
| Branch Admin | ❌ No (can only approve) | ❌ No |
| Cashier | ❌ No | ❌ No |
| Sales Clerk | ❌ No | ❌ No |
| Warehouse Staff | ❌ No | ❌ No |

### Step-by-Step Instructions

#### Step 1: Navigate to Product

1. Go to **Dashboard** → **Products** → **List Products**
2. Search for the defective product (e.g., "ADATA 512GB SSD")
3. Click the **View** icon (👁️) to open the product detail page

**Alternative Route:**
- Scan the product barcode/serial number
- Use Serial Number Lookup to find the product
- Click through to product detail page

#### Step 2: Click "Create Return" Button

On the product detail page, you'll see an **orange "Create Return" button** in the top-right corner (next to "Edit Product").

```
┌──────────────────────────────────────────────────┐
│  ← Back    ADATA 512GB 2.5" SSD                  │
│                                                   │
│  [Print Standard] [Print Compact] [Edit Product] │
│  [Create Return] ← Orange button                 │
└──────────────────────────────────────────────────┘
```

**What happens when you click:**
- System fetches all approved GRNs that received this product
- GRN Selection Modal opens (see next step)

**If button shows "Loading...":**
- Wait a moment while system searches for GRNs
- This usually takes 1-2 seconds

#### Step 3: Select the Relevant GRN

The **GRN Selection Modal** displays all approved GRNs containing this product.

**Modal Layout:**
```
┌─────────────────────────────────────────────┐
│  Select GRN to Create Return                │
│  Choose which GRN to return: ADATA 512GB    │
├─────────────────────────────────────────────┤
│                                             │
│  GRN-202510-0025        [approved]          │
│  Date: Oct 15, 2025     Supplier: TechCo   │
│  Location: Main Store   Items: 3 (50 units) │
│  Items in this GRN:                         │
│    [ADATA 512GB (Qty: 20)] [Item 2] [Item 3]│
│                             [Select ▶]      │
│  ─────────────────────────────────────────  │
│  GRN-202510-0018        [approved]          │
│  Date: Oct 10, 2025     Supplier: TechCo   │
│  ... (more GRNs)                            │
│                                             │
│                         [Cancel]            │
└─────────────────────────────────────────────┘
```

**How to Choose:**
1. Review the list of GRNs
2. Look at:
   - **Date** - When was the product received?
   - **Supplier** - Which supplier sent it?
   - **Location** - Which warehouse/store?
   - **Items** - Verify your product is listed
3. Click the **[Select]** button on the correct GRN

**If no GRNs appear:**
- This product hasn't been received yet (no approved GRNs)
- Check if you're looking for the right product
- Verify the product has been received through GRN process

#### Step 4: Fill Out Return Details

The **Create Return Modal** opens with the selected GRN pre-filled.

**Required Information:**

1. **Return Date** - Date you're creating the return (defaults to today)

2. **Return Reason** - Select from dropdown:
   - Damaged
   - Wrong Item
   - Quality Issue
   - Overcharge
   - Expired
   - Defective
   - Not as Ordered

3. **Expected Action** - What do you want?
   - Refund (get money back)
   - Replacement (exchange for new item)
   - Credit Note (account credit for future purchases)

4. **Select Items to Return:**
   - Check the checkbox next to items to return
   - Enter **Quantity** to return (cannot exceed received quantity)
   - Enter **Unit Cost** (pre-filled from GRN)
   - Select **Condition**:
     - Damaged
     - Defective
     - Wrong Item
     - Quality Issue
   - Add **Serial Numbers** if applicable
   - Add **Notes** (optional - explain the issue)

5. **General Notes** (optional):
   - Additional information about the return
   - Photos attached reference
   - Any special instructions

#### Step 5: Submit Return

1. Review all entered information
2. Click **"Create Return"** button
3. System creates the return with "pending" status
4. You'll see a success message
5. Return appears in **Purchase Returns** list for approval

**What Happens Next:**
- Return gets a unique number (e.g., `RET-000001`)
- Status is set to **"pending"**
- Manager/Approver can review and approve
- Once approved, inventory will be deducted

---

## Feature 2: Enhanced GRN Search with Product/SKU

### What It Does

The GRN (Goods Received Note) list page now allows you to search by **product names** and **SKUs** in addition to the existing search fields.

### How It Works

The search box now searches across:

| Search Field | Example |
|--------------|---------|
| GRN Number | `GRN-202510-0025` |
| PO Number | `PO-20251015-001` |
| Supplier Name | `TechCo Supplies` |
| **Product Name** ⭐ | `ADATA 512GB SSD` |
| **Variation Name** ⭐ | `512GB` |
| **SKU** ⭐ | `ADATA-512-SSD` |
| Received By | `John Doe` |
| Approved By | `Jane Manager` |
| Status | `approved` |

### Step-by-Step Instructions

#### Step 1: Navigate to GRN List

Go to **Dashboard** → **Purchases** → **Goods Received (GRN)**

#### Step 2: Use the Search Box

1. Locate the search box at the top of the page
2. Type your search term (product name, SKU, or any other field)
3. Results filter automatically as you type

**Examples:**

**Search by Product Name:**
```
Search: "ADATA 512GB"
Results: All GRNs containing ADATA 512GB products
```

**Search by SKU:**
```
Search: "ADATA-512-SSD"
Results: All GRNs containing products with this SKU
```

**Search by Supplier:**
```
Search: "TechCo"
Results: All GRNs from TechCo Supplies
```

**Search by GRN Number:**
```
Search: "GRN-202510-0025"
Results: Specific GRN #25 from October 2025
```

#### Step 3: Review Results

- Matching GRNs appear in the table
- Click **View** icon (👁️) to see GRN details
- From detail page, you can click **"Create Return"** button

---

## Permission Requirements

### Purchase Return Permissions

| Permission | What It Allows |
|------------|----------------|
| `purchase_return.view` | View purchase returns list |
| `purchase_return.create` | Create new purchase returns (see "Create Return" button) |
| `purchase_return.update` | Edit pending returns |
| `purchase_return.delete` | Delete pending returns |
| `purchase_return.approve` | Approve/reject returns |

### How Permissions are Checked

**Product Detail Page:**
```javascript
{can(PERMISSIONS.PURCHASE_RETURN_CREATE) && (
  <button>Create Return</button>
)}
```

**If you don't have permission:**
- Button is **completely hidden** (not just disabled)
- API will return `403 Forbidden` if you try to bypass UI

---

## Complete Workflow Examples

### Example 1: Return Defective ADATA SSD

**Scenario:**
A customer returned an ADATA 512GB SSD because it's not recognized by their computer. You need to return it to the supplier.

**Steps:**

1. **Find the Product:**
   - Go to Products → List Products
   - Search: "ADATA 512GB"
   - Click View icon

2. **Create Return:**
   - Click orange **"Create Return"** button
   - Select GRN from Oct 15, 2025 (TechCo)
   - Click **[Select]**

3. **Fill Details:**
   - Return Date: Today
   - Return Reason: **Defective**
   - Expected Action: **Replacement**
   - Select Item: ADATA 512GB SSD
   - Quantity: 1
   - Condition: **Defective**
   - Serial Number: `SN123456789`
   - Notes: "Customer reported not recognized by system"

4. **Submit:**
   - Click **"Create Return"**
   - Return #RET-000015 created

5. **Get Approval:**
   - Manager reviews in Purchase Returns list
   - Manager clicks "Approve Return"
   - Inventory deducted from Main Store

**Time Saved:** ~7 minutes (vs manual GRN search)

---

### Example 2: Return Damaged Items Using GRN Search

**Scenario:**
During physical inventory, you found 5 damaged "Samsung USB Flash Drives" that need to be returned.

**Steps:**

1. **Find GRN:**
   - Go to Purchases → Goods Received (GRN)
   - Search: "Samsung USB Flash"
   - See GRN-202510-0030 from Oct 18, 2025

2. **View GRN:**
   - Click View icon (👁️)
   - Verify it's the right GRN

3. **Create Return:**
   - Click **"Create Return"** button on GRN detail page
   - Return Reason: **Damaged**
   - Expected Action: **Credit Note**
   - Select Item: Samsung 32GB USB Flash Drive
   - Quantity: 5
   - Condition: **Damaged**
   - Notes: "Found during physical inventory - physical damage to casing"

4. **Submit & Approve:**
   - Create return
   - Get approval
   - Credit note issued by supplier

---

### Example 3: Multiple Products from Same GRN

**Scenario:**
You need to return 3 different items from the same shipment (GRN-202510-0025).

**Approach 1: From Product Page (Recommended if you know all products)**
1. Go to first product → Create Return → Select GRN-202510-0025
2. **Add all 3 items** in the same return form
3. Submit once

**Approach 2: From GRN Page (Faster)**
1. Go to GRN list → Search: "GRN-202510-0025"
2. Click View → Create Return
3. **All items from that GRN** are pre-loaded
4. Select the 3 items you want to return
5. Submit

**Best Practice:**
✅ Use Approach 2 (GRN page) when returning multiple items from the same shipment
✅ Use Approach 1 (Product page) when you're not sure which GRN the item came from

---

## Troubleshooting

### Problem: "Create Return" Button Not Visible

**Possible Causes:**

1. **No Permission** ✗
   - You don't have `purchase_return.create` permission
   - Contact your manager or admin
   - Check: Ask admin to verify your role has the permission

2. **Wrong Role** ✗
   - Cashiers and Sales Clerks cannot create returns
   - Only Branch Managers, Accounting Staff, and Super Admins can
   - Solution: Ask someone with correct role to create it

3. **Logged Out** ✗
   - Your session expired
   - Refresh page and log back in

---

### Problem: "No Approved GRNs Found"

**Possible Causes:**

1. **Product Never Received** ✗
   - This product hasn't been received through any GRN
   - Check if product was manually added to inventory
   - Solution: Cannot create return without GRN (no supplier record)

2. **GRN Not Approved Yet** ✗
   - Product was received but GRN is still "pending" status
   - Returns can only be created from **approved** GRNs
   - Solution: Ask manager to approve the GRN first

3. **Wrong Product** ✗
   - You're looking at a different product/variation
   - Check the SKU and variation name
   - Solution: Search for the correct product

---

### Problem: Search Doesn't Find My Product

**Troubleshooting Steps:**

1. **Check Spelling** ✓
   - Try partial name: "ADATA" instead of "ADATA 512GB SSD"
   - Try SKU instead of product name

2. **Check Filters** ✓
   - Status filter might be set to specific status
   - Date range filter might exclude your GRN
   - Location filter might be set
   - Clear all filters and try again

3. **Verify Product Name** ✓
   - Open the GRN manually
   - Check exact product name spelling
   - Search using that exact spelling

4. **API Issue** ✓
   - Refresh the page (F5)
   - Clear browser cache
   - Try in incognito/private mode

---

### Problem: Cannot Approve Return

**Possible Causes:**

1. **No Approval Permission** ✗
   - You need `purchase_return.approve` permission
   - Check with your manager

2. **Already Approved** ✗
   - Return status is already "approved"
   - Check the status badge on the return

3. **Insufficient Stock** ✗
   - Location doesn't have enough stock to deduct
   - Verify inventory levels first

---

### Problem: Inventory Not Deducted After Approval

**Check:**

1. **Return Status** - Is it actually "approved"?
2. **Location** - Check the correct location's inventory
3. **Product History** - Look for the SUPPLIER_RETURN transaction
4. **Stock Ledger** - Verify the stock transaction was created

**If Issue Persists:**
- Check browser console for errors (F12 → Console)
- Contact system administrator
- Provide Return Number for troubleshooting

---

## Tips & Best Practices

### 🎯 Best Practices

1. **Use Serial Numbers**
   - Always record serial numbers for serialized items
   - Helps track which exact unit was returned
   - Required for warranty claims

2. **Add Detailed Notes**
   - Explain WHY item is being returned
   - Include customer complaints if applicable
   - Reference photos or inspection reports

3. **Choose Correct Condition**
   - **Damaged** - Physical damage (broken, cracked, dented)
   - **Defective** - Doesn't work properly (functional issue)
   - **Wrong Item** - Supplier sent wrong product
   - **Quality Issue** - Poor quality, doesn't meet standards

4. **Verify Quantities**
   - Cannot return more than received quantity
   - Double-check counts before submitting

5. **Act Quickly**
   - Most suppliers have return deadlines (7-30 days)
   - Don't delay returns for damaged items
   - Check supplier return policies

### 💡 Pro Tips

**Tip 1: Bulk Returns**
If returning multiple items from same GRN, create ONE return with all items instead of multiple returns.

**Tip 2: Save Time**
Bookmark frequently used GRN searches (e.g., recent approved GRNs from your main supplier).

**Tip 3: Communication**
Add return number in email/chat when coordinating with supplier pickup.

**Tip 4: Photography**
Take photos of damaged items BEFORE creating return - attach reference in notes.

**Tip 5: Follow Up**
Check Purchase Returns list regularly to track approval status.

---

## Quick Reference Card

### Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Search | Click in search box |
| Clear Search | ESC (when in search box) |
| Navigate Results | ↑ ↓ Arrow keys |
| Open Selected | Enter |

### Common Search Patterns

```
Product:     "ADATA 512GB"
SKU:         "ADATA-512"
Supplier:    "TechCo"
GRN:         "GRN-202510"
Date Range:  Use date picker
Status:      "approved"
```

### Return Reasons Quick Reference

| Reason | Use When |
|--------|----------|
| Damaged | Physical damage during shipping/handling |
| Defective | Item doesn't work properly |
| Wrong Item | Supplier sent incorrect product |
| Quality Issue | Poor quality, doesn't meet standards |
| Overcharge | Price higher than agreed |
| Expired | Product past expiration date |
| Not as Ordered | Different specs than ordered |

---

## Getting Help

### Contact Support

**System Admin:** admin@yourcompany.com
**Manager:** manager@yourcompany.com
**IT Help Desk:** helpdesk@yourcompany.com

### Additional Resources

- [Purchase Returns Policy](link-to-policy)
- [Supplier Return Procedures](link-to-procedures)
- [Inventory Management Guide](link-to-guide)
- [RBAC Permissions Reference](link-to-rbac)

---

## Changelog

### Version 1.0 (October 21, 2025)
- ✅ Initial release
- ✅ Feature 1: Create Return from Product Page
- ✅ Feature 2: Enhanced GRN Search with Product/SKU
- ✅ Permission-based access control
- ✅ Multi-location support

---

**Document Prepared By:** UltimatePOS Modern Development Team
**Document Type:** User Guide
**Intended Audience:** Branch Managers, Accounting Staff, Warehouse Managers

---

*For technical documentation, see: `PURCHASE_RETURNS_TECHNICAL_SPEC.md`*
