# Purchase Order to Inventory - Complete Workflow Guide

**Visual Guide for Users**

This document explains the complete workflow from creating a Purchase Order (PO) to receiving goods and adding inventory to stock.

---

## 📋 Overview

The system uses a **two-step approval workflow** to ensure quality control and accountability:

1. **Warehouse Staff** receives goods and records serial numbers
2. **Manager/Supervisor** reviews and approves to add inventory

---

## 🔄 Complete Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PURCHASE ORDER WORKFLOW                              │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 1: CREATE PURCHASE ORDER                                           │
│ Role: Purchasing Officer / Admin                                        │
└─────────────────────────────────────────────────────────────────────────┘

    Dashboard → Purchases → "Create Purchase Order"
           ↓
    ┌──────────────────────────────────────┐
    │ Fill in PO Details:                  │
    │  • Supplier                           │
    │  • Location (Warehouse)               │
    │  • Products & Quantities              │
    │  • Unit Costs                         │
    │  • Expected Delivery Date             │
    └──────────────────────────────────────┘
           ↓
    Click "Create Purchase Order"
           ↓
    ┌──────────────────────────────────────┐
    │ ✅ PO Created Successfully            │
    │ Status: PENDING                       │
    │ PO Number: PO-202510-0001             │
    └──────────────────────────────────────┘
           ↓
    Wait for supplier delivery...

═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 2: RECEIVE GOODS (Create GRN)                                      │
│ Role: Warehouse Staff / Receiver                                        │
└─────────────────────────────────────────────────────────────────────────┘

    Dashboard → Purchases → View PO → "Receive Goods"
           ↓
    ┌──────────────────────────────────────┐
    │ Receive Goods - Create GRN Page      │
    │                                       │
    │  Receipt Date: [2025-10-12]          │
    │                                       │
    │  Product: Generic PS - Default       │
    │  Ordered: 30 | Received: 0           │
    │  Quantity to Receive: [30]           │
    │                                       │
    │  ⚠️ Serial Numbers Required           │
    └──────────────────────────────────────┘
           ↓

    ┌─────────────────────────────────────────────────────────────────────┐
    │ SERIAL NUMBER ENTRY OPTIONS:                                        │
    ├─────────────────────────────────────────────────────────────────────┤
    │                                                                     │
    │ OPTION A: Scan 1 by 1                                              │
    │ ┌─────────────────────────────────────┐                            │
    │ │ [Scan Mode] ┌──────────────────┐    │                            │
    │ │             │ SN123456    [Add]│    │                            │
    │ │             └──────────────────┘    │                            │
    │ │                                     │                            │
    │ │ Progress: 3 / 30                    │                            │
    │ │ ████░░░░░░░░░░░░░░░░░░░░░░░         │                            │
    │ │                                     │                            │
    │ │ ✅ Validates each serial in          │                            │
    │ │    real-time against database       │                            │
    │ └─────────────────────────────────────┘                            │
    │                                                                     │
    │ OPTION B: Bulk Import                                              │
    │ ┌─────────────────────────────────────┐                            │
    │ │ [Download Template] CSV             │                            │
    │ │                                     │                            │
    │ │ Paste serial numbers:               │                            │
    │ │ ┌─────────────────────────────────┐ │                            │
    │ │ │ SN123456                        │ │                            │
    │ │ │ SN123457                        │ │                            │
    │ │ │ SN123458                        │ │                            │
    │ │ │ ...                             │ │                            │
    │ │ └─────────────────────────────────┘ │                            │
    │ │                                     │                            │
    │ │ [Import Serials]                    │                            │
    │ │                                     │                            │
    │ │ ✅ Validates all serials at once     │                            │
    │ │ ✅ Auto-ignores duplicates           │                            │
    │ │ ✅ Only accepts max qty needed       │                            │
    │ └─────────────────────────────────────┘                            │
    └─────────────────────────────────────────────────────────────────────┘
           ↓

    ┌──────────────────────────────────────┐
    │ Serial Number Validation             │
    │                                       │
    │ ❌ If duplicate found:                │
    │    "Serial already exists!"          │
    │    Product: Samsung SSD              │
    │    Supplier: Sample Supplier2        │
    │    Receipt: GRN-202511               │
    │                                       │
    │ ✅ If unique:                         │
    │    "Serial added! 29 remaining"      │
    └──────────────────────────────────────┘
           ↓

    All serials entered (30/30) ✅
           ↓
    Click "Create GRN"
           ↓
    ┌──────────────────────────────────────┐
    │ ✅ GRN Created Successfully           │
    │ GRN Number: GRN-202510-0001          │
    │ Status: PENDING APPROVAL             │
    │                                       │
    │ 📌 Serial numbers saved but NOT       │
    │    yet added to database             │
    │ 📌 Inventory NOT yet updated          │
    └──────────────────────────────────────┘
           ↓
    🔄 Automatic Redirect
           ↓

═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 3: REVIEW & APPROVE GRN                                            │
│ Role: Manager / Supervisor / Approver                                   │
└─────────────────────────────────────────────────────────────────────────┘

    Automatically arrives at: GRN Detail Page (GRN-202510-0001)
           ↓
    ┌──────────────────────────────────────────────────────────────────────┐
    │ GRN-202510-0001                                      [PENDING]        │
    ├──────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │ ⚠️ Pending Approval                                                   │
    │ This receipt requires approval before inventory is added to stock.   │
    │ Total quantity: 30 units worth ₱45,000.00                            │
    │                                                                      │
    ├──────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │ 🔍 VERIFICATION REQUIRED                                             │
    │                                                                      │
    │ Please verify the following before approval:                        │
    │  ✓ All product details (name, SKU, variation) are correct          │
    │  ✓ Quantities received match the physical count                    │
    │  ✓ Unit costs and total values are accurate                        │
    │  ✓ Supplier information is correct                                 │
    │  ✓ Serial numbers (if applicable) are properly recorded            │
    │  ✓ No damaged or defective items are included                      │
    │                                                                      │
    │ ┌────────────────────────────────────────────────────────────────┐  │
    │ │ ☐ I confirm that I have carefully verified all details above  │  │
    │ │   By checking this box, I certify that all information is     │  │
    │ │   accurate and complete.                                       │  │
    │ └────────────────────────────────────────────────────────────────┘  │
    │                                                                      │
    ├──────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │ 📄 RECEIPT INFORMATION              📦 RECEIVED ITEMS                │
    │  GRN Number: GRN-202510-0001        Product: Generic PS - Default   │
    │  Receipt Date: Oct 12, 2025         SKU: PCI-0002                   │
    │  PO: PO-202510-0003                 Ordered: 30 | Received: 30      │
    │  Location: Main Warehouse           Unit Cost: ₱1,500.00             │
    │                                     Total: ₱45,000.00                │
    │ 🏢 SUPPLIER INFORMATION                                              │
    │  Name: Sample Supplier              📋 SERIAL NUMBERS:               │
    │  Contact: John Doe                  Generic PS - Default             │
    │  Email: john@supplier.com            SN123456, SN123457, SN123458... │
    │                                     (30 serial numbers listed)       │
    │ 👥 APPROVAL WORKFLOW                                                 │
    │  Step 1: Received By                                                │
    │   👤 John Warehouse (Warehouse Staff)                                │
    │   📅 Oct 12, 2025 10:00 AM                                           │
    │                                                                      │
    │  Step 2: Approved By                                                │
    │   ⏳ Awaiting approval...                                            │
    │                                                                      │
    └──────────────────────────────────────────────────────────────────────┘
           ↓
    Check the verification checkbox ☑️
           ↓
    ┌──────────────────────────────────────┐
    │ [Approve & Update Inventory]         │
    │                                       │
    │ [Reject Receipt]                      │
    └──────────────────────────────────────┘
           ↓
    Click "Approve & Update Inventory"
           ↓
    Confirmation Dialog:
    "Are you sure you want to approve this receipt?
     This will add inventory to stock and cannot be undone."
           ↓
    Click "OK"
           ↓

    🔄 SYSTEM PROCESSES APPROVAL:

    ┌─────────────────────────────────────────────────────────────────────┐
    │ Processing...                                                       │
    │                                                                     │
    │ ✅ Step 1: Insert 30 serial numbers into ProductSerialNumber table │
    │    - Serial: SN123456, Product ID: 2, Status: in_stock             │
    │    - Serial: SN123457, Product ID: 2, Status: in_stock             │
    │    - ... (28 more)                                                  │
    │                                                                     │
    │ ✅ Step 2: Create stock transaction                                 │
    │    - Type: purchase                                                 │
    │    - Quantity: +30 units                                            │
    │    - Balance: 30 units (new balance after transaction)              │
    │                                                                     │
    │ ✅ Step 3: Update VariationLocationDetails                          │
    │    - Location: Main Warehouse                                       │
    │    - Product Variation: Generic PS - Default                        │
    │    - Quantity Available: 30 → 60 (if stock existed, else 0 → 30)   │
    │                                                                     │
    │ ✅ Step 4: Update purchase item                                     │
    │    - Quantity Received: 0 → 30                                      │
    │                                                                     │
    │ ✅ Step 5: Update Purchase Order status                             │
    │    - From: PENDING                                                  │
    │    - To: RECEIVED (if all items received)                           │
    │    - Or: PARTIALLY_RECEIVED (if some items pending)                 │
    │                                                                     │
    │ ✅ Step 6: Create Accounts Payable entry                            │
    │    - Invoice Number: PO-202510-0003                                 │
    │    - Total Amount: ₱45,000.00                                       │
    │    - Payment Status: unpaid                                         │
    │    - Due Date: Nov 11, 2025 (30 days from receipt)                  │
    │                                                                     │
    │ ✅ Step 7: Update receipt status                                    │
    │    - Status: APPROVED                                               │
    │    - Approved By: Manager Name                                      │
    │    - Approved At: Oct 12, 2025 10:15 AM                             │
    │                                                                     │
    │ ✅ Step 8: Create audit log entry                                   │
    │    - Action: purchase_receipt_approve                               │
    │    - User: Manager Name                                             │
    │    - Description: "Approved GRN-202510-0001 for PO-202510-0003"     │
    └─────────────────────────────────────────────────────────────────────┘
           ↓
    ┌──────────────────────────────────────┐
    │ ✅ SUCCESS!                           │
    │                                       │
    │ Receipt approved successfully!       │
    │ Inventory has been added.            │
    └──────────────────────────────────────┘
           ↓
    🔄 Page refreshes automatically
           ↓
    ┌──────────────────────────────────────────────────────────────────────┐
    │ GRN-202510-0001                                      [APPROVED] ✅    │
    ├──────────────────────────────────────────────────────────────────────┤
    │                                                                      │
    │ 🔒 This receipt has been approved and finalized                      │
    │ Approved receipts cannot be edited to maintain data integrity.      │
    │                                                                      │
    │ 👥 APPROVAL WORKFLOW                                                 │
    │  Step 1: Received By                                                │
    │   👤 John Warehouse (Warehouse Staff)                                │
    │   📅 Oct 12, 2025 10:00 AM                                           │
    │                                                                      │
    │  Step 2: Approved By ✅                                              │
    │   👤 Jane Manager (Manager)                                          │
    │   📅 Oct 12, 2025 10:15 AM                                           │
    │                                                                      │
    │ [Create Return] (if needed)                                         │
    └──────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────────────────┐
│ STEP 4: VERIFY INVENTORY UPDATED                                        │
│ Role: Anyone with VIEW permissions                                      │
└─────────────────────────────────────────────────────────────────────────┘

    Dashboard → Products
           ↓
    ┌──────────────────────────────────────┐
    │ Generic PS - Default                 │
    │                                       │
    │ Total Stock: 60 units                │
    │  Main Warehouse: 60 units ✅          │
    │                                       │
    │ Serial Numbers: 30 available         │
    └──────────────────────────────────────┘

           ↓

    Dashboard → Purchases → View PO
           ↓
    ┌──────────────────────────────────────┐
    │ PO-202510-0003                       │
    │                                       │
    │ Status: RECEIVED ✅                   │
    │ Ordered: 30 | Received: 30           │
    └──────────────────────────────────────┘

           ↓

    Dashboard → Accounting → Accounts Payable
           ↓
    ┌──────────────────────────────────────┐
    │ Invoice: PO-202510-0003              │
    │                                       │
    │ Supplier: Sample Supplier            │
    │ Amount: ₱45,000.00                    │
    │ Status: UNPAID                       │
    │ Due Date: Nov 11, 2025               │
    └──────────────────────────────────────┘

```

---

## 🔍 Key Points to Remember

### 1. **Two-Step Approval = Quality Control**
- **Why?** Prevents errors, ensures accountability, maintains audit trail
- **Who?** Warehouse staff receives, Manager approves
- **When?** Inventory only added AFTER approval

### 2. **Serial Number Validation**
- ✅ Validates in real-time against entire database
- ✅ Prevents duplicates across ALL suppliers
- ✅ Shows which product/supplier has the duplicate
- ✅ Bulk import automatically ignores duplicates

### 3. **Automatic Redirect After Create GRN**
- **Before:** Redirected back to PO page (confusing ❌)
- **After:** Goes directly to GRN approval page (clear workflow ✅)

### 4. **Status Meanings**

| Status | PO Status | Inventory | Serial Numbers in DB | Can Edit? |
|--------|-----------|-----------|---------------------|-----------|
| **Pending** | Still "Pending" | NOT added | NOT in database | ❌ No (GRN is locked once created) |
| **Approved** | "Received" | ✅ Added | ✅ In database | ❌ No (approved receipts locked) |
| **Rejected** | Still "Pending" | NOT added | NOT in database | ❌ No (must create new GRN) |

---

## 📊 Visual Status Flow

```
┌──────────────┐
│ CREATE PO    │
│ Status:      │
│ PENDING      │
└──────┬───────┘
       │
       │ Supplier delivers goods
       ↓
┌──────────────┐
│ CREATE GRN   │
│ PO Status:   │
│ PENDING ⏳    │
│ GRN Status:  │
│ PENDING      │
│              │
│ 📝 Serials   │
│ saved in     │
│ JSON field   │
└──────┬───────┘
       │
       │ Automatic redirect →
       ↓
┌──────────────┐
│ APPROVE GRN  │
│ PO Status:   │
│ RECEIVED ✅   │
│ GRN Status:  │
│ APPROVED     │
│              │
│ ✅ Serials    │
│ in database  │
│ ✅ Stock      │
│ added        │
│ ✅ AP created │
└──────────────┘
```

---

## 🚫 Common Mistakes & Solutions

### ❌ Mistake 1: "I created GRN but stock not added"
**Why?** GRN is pending - needs approval first
**Solution:** Check GRN list → Click GRN → Approve it

### ❌ Mistake 2: "I keep going back to scan page after creating GRN"
**Why?** Old bug - now fixed! ✅
**Solution:** System now automatically redirects to approval page

### ❌ Mistake 3: "Serial validation says already exists but I just received it"
**Why?** Serial was received in a previous GRN (database validation working correctly)
**Solution:** Check which supplier/receipt has that serial, use a different serial

### ❌ Mistake 4: "Can't approve my own GRN"
**Why?** User doesn't have PURCHASE_RECEIPT_APPROVE permission
**Solution:** Contact admin to assign approval permission or ask manager to approve

---

## 🎯 User Role Permissions

| Action | Required Permission | Typical Role |
|--------|-------------------|--------------|
| Create PO | `PURCHASE_CREATE` | Purchasing Officer, Admin |
| View PO | `PURCHASE_VIEW` | Everyone |
| Receive Goods (Create GRN) | `PURCHASE_RECEIPT_CREATE` | Warehouse Staff, Admin |
| Approve GRN | `PURCHASE_RECEIPT_APPROVE` | Manager, Supervisor, Admin |
| View Cost | `PURCHASE_VIEW_COST` | Manager, Admin, Accountant |
| Reject GRN | `PURCHASE_RECEIPT_APPROVE` | Manager, Supervisor, Admin |

---

## 📱 Quick Reference Card

### For Warehouse Staff (Receivers):
1. Go to PO → Click "Receive Goods"
2. Enter quantities to receive
3. Scan serial numbers (1-by-1 or bulk import)
4. Click "Create GRN"
5. ✅ Done! System redirects to approval page

### For Managers (Approvers):
1. Review GRN details (automatically shown after warehouse creates GRN)
2. Verify all information is correct
3. Check verification box
4. Click "Approve & Update Inventory"
5. ✅ Done! Stock added, PO status updated, AP created

---

## 🆘 Troubleshooting

### Serial validation not working?
- Hard refresh browser (Ctrl+Shift+R)
- Check if dev server is running on port 3006
- Check browser console for errors

### Can't see "Receive Goods" button?
- Check you have `PURCHASE_RECEIPT_CREATE` permission
- Check PO status is not "cancelled"
- Check you have access to the location (warehouse)

### Can't see "Approve" button on GRN?
- Check you have `PURCHASE_RECEIPT_APPROVE` permission
- Check GRN status is "pending" (not already approved/rejected)

---

## 📞 Support

For technical issues or permission-related questions, contact your system administrator.

**Version:** 1.0
**Last Updated:** October 12, 2025
**Feature:** Purchase Order to Inventory Workflow with Serial Number Validation
