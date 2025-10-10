# 📦 Complete Purchase-to-Pay Workflow Guide

## 🗺️ Navigation - How to Access All Pages

### **Sidebar Menu Structure:**

```
📦 Purchases (Click to expand ▼)
  ├─ Purchase Orders
  ├─ Goods Received (GRN)
  ├─ 📄 Accounts Payable          ← NEW!
  ├─ 💰 Payments                  ← NEW!
  └─ 📝 Post-Dated Cheques        ← NEW!
```

**To see the new menu items:**
1. Look for **"Purchases"** in the sidebar
2. **Click the arrow** next to "Purchases" to expand the dropdown
3. You'll see 5 submenu items including the 3 new ones

---

## 📋 Complete Workflow Steps

### **STEP 1: Create Purchase Order** 📝

**Path:** Purchases → Purchase Orders

1. Click **"New Purchase Order"** button (top-right)
2. Fill in the form:
   - **Supplier**: Select from dropdown
   - **Purchase Date**: Today's date
   - **Expected Delivery**: Future date
   - **Products**: Add items with quantities and unit costs
   - **Shipping Cost**: Optional
   - **Discount**: Optional
   - **Tax**: Optional
   - **Notes**: Optional
3. Click **"Create Purchase Order"**
4. **Status**: `pending` or `ordered`
5. **Inventory**: NOT updated yet

**Result**: Purchase Order created and waiting for goods to arrive

---

### **STEP 2: Create Goods Received Note (GRN)** 📦

**Path:** Purchases → Goods Received (GRN)

**Option A: From GRN Page**
1. Click **"Create GRN"** button
2. **Select Purchase Order** from dropdown
3. For each item:
   - **Quantity Received**: Enter actual quantity (can be partial)
   - **Serial Numbers**: Enter if product requires serial numbers
   - **Notes**: Add any damage/quality notes
4. **Location**: Select which branch receives the goods
5. Click **"Create Receipt"**

**Option B: From Purchase Order Page**
1. Go to Purchase Orders list
2. Click **"View"** on a purchase order
3. Click **"Create GRN"** button
4. Follow same steps as Option A

**Status After Creation:**
- GRN Status: `pending` (waiting for approval)
- Purchase Order: `partially_received` or still `pending`
- **Inventory**: NOT updated yet (waiting for approval)

**Result**: GRN created, waiting for approver to verify and approve

---

### **STEP 3: Approve GRN (Two-Step Verification)** ✅

**Path:** Purchases → Goods Received (GRN)

**Who Can Do This:** User with `PURCHASE_RECEIPT_APPROVE` permission

**Process:**
1. Go to **Goods Received (GRN)** page
2. Find GRN with **"Pending"** status
3. Click **"View"** button
4. You'll see the **GRN Detail Page** with:
   - All received items
   - Quantities, costs, totals
   - Supplier information
   - **Verification Checklist Card** (blue background)

5. **Review the Verification Checklist:**
   - ✓ All product details are correct
   - ✓ Quantities received match physical count
   - ✓ Unit costs and totals are accurate
   - ✓ Supplier information is correct
   - ✓ Serial numbers properly recorded
   - ✓ No damaged or defective items

6. **Tick the Verification Checkbox** ☑️
   - Text: "I confirm that I have carefully verified all details above"
   - This certifies all information is accurate

7. **"Approve & Update Inventory" Button Appears** 🟢
   - Button only shows AFTER checkbox is ticked
   - This is the safety mechanism

8. Click **"Approve & Update Inventory"**

**What Happens Automatically:**
- ✅ GRN Status → `approved`
- ✅ Inventory Quantities Updated (stock increased)
- ✅ **Accounts Payable Entry Auto-Created** (if purchase fully received)
- ✅ Product History Records Created (audit trail)
- ✅ Purchase Order status updated

**Result**: Inventory updated, AP created, ready for payment

---

### **STEP 4: View Accounts Payable** 💰

**Path:** Purchases → Accounts Payable

**What You'll See:**

**Aging Analysis Cards (Top of Page):**
- **Current**: Not yet due
- **1-30 Days**: Due or overdue by 1-30 days
- **31-60 Days**: Overdue by 31-60 days
- **61-90 Days**: Overdue by 61-90 days
- **90+ Days**: Overdue by more than 90 days
- **Total Payable**: Total amount owed to all suppliers

**Accounts Payable Table:**
- Invoice Number
- Supplier Name
- Invoice Date
- Due Date (with "X days overdue" if late)
- Amount
- Paid Amount (green)
- Balance Due (red)
- Status Badge
- **"Pay" Button** (quick link to payment form)

**Actions:**
1. **Search**: By invoice number or supplier name
2. **Filter**: By status (Unpaid, Partially Paid, Paid, Overdue)
3. **Export**: CSV, Excel, or PDF reports
4. **Pay**: Click "Pay" button to make a payment

---

### **STEP 5: Make Payment** 💳

**Path:** Purchases → Payments → Click "New Payment" button

**OR:** Click "Pay" button on any invoice in Accounts Payable page

**Payment Form Fields:**

1. **Supplier** (required)
   - Select from dropdown
   - Invoice dropdown will filter by selected supplier

2. **Invoice** (required)
   - Shows: Invoice Number - Balance: $X.XX
   - Auto-fills payment amount with balance due

3. **Invoice Summary Box** (auto-displays)
   - Invoice Amount
   - Paid Amount (green)
   - Balance Due (red)
   - Due Date

4. **Payment Method** (required) - Select one:

   **A. Cash**
   - Simple payment, no extra fields

   **B. Cheque**
   - Cheque Number (required)
   - Cheque Date (required)
   - Bank Name (optional)
   - Post-Dated Cheque checkbox
     - Auto-detects if cheque date is in the future
     - Shows warning about reminder

   **C. Bank Transfer**
   - Bank Account Number (optional)
   - Transfer Reference (required)

   **D. Credit Card**
   - Card Type (Credit/Debit)
   - Last 4 Digits (optional)
   - Transaction ID (optional)

   **E. Debit Card**
   - Same fields as Credit Card

5. **Payment Amount** (required)
   - Auto-filled with balance due
   - Cannot exceed balance
   - Validation prevents overpayment

6. **Payment Date** (required)
   - Defaults to today

7. **Reference Number** (optional)
   - Internal reference

8. **Notes** (optional)
   - Payment notes

9. Click **"Record Payment"**

**What Happens:**
- ✅ Payment recorded
- ✅ Accounts Payable balance reduced
- ✅ If balance = 0, AP status → `paid`
- ✅ If cheque is post-dated, added to PDC monitoring
- ✅ Audit trail created

**Result**: Payment recorded, AP balance updated

---

### **STEP 6: View Payment History** 📜

**Path:** Purchases → Payments

**What You'll See:**
- Payment Date
- Supplier Name & Contact
- Invoice Number
- Payment Method Badge
- Reference Number
- Payment Amount (green)
- For Cheques: Cheque number displayed

**Actions:**
- **Search**: By supplier, invoice, or reference
- **Filter**: By payment method
- **Export**: CSV, Excel, PDF
- **View**: Click eye icon to see details

---

### **STEP 7: Monitor Post-Dated Cheques** 📅

**Path:** Purchases → Post-Dated Cheques

**What You'll See:**

**Summary Cards:**
- **Upcoming (7 days)** - Orange: Cheques due in next 7 days
- **Overdue** - Red: Cheques past their date
- **Total Pending** - Blue: All pending cheques
- **Cleared** - Green: Cheques already deposited

**PDC Table:**
- Cheque Number
- Supplier
- Invoice Number
- Cheque Date
- **Days Until Due** (Color-Coded Badges):
  - 🔴 Red: "Overdue by X days"
  - 🔴 Red: "Due Today"
  - 🟠 Orange: "Due in 1-3 days"
  - 🟡 Yellow: "Due in 4-7 days"
  - ⚪ Gray: "X days" (more than 7 days)
- Amount
- Bank Name
- Status
- **"Clear" Button** (for pending cheques)

**Actions:**
1. **Mark as Cleared**: Click "Clear" button when cheque is deposited
2. **Search**: By cheque number, supplier, or invoice
3. **Filter**: By status (Pending, Cleared, Bounced, Cancelled)
4. **Export**: CSV, Excel, PDF reports

**Email Reminders** (Automatic):
- System sends reminder emails before cheque due date
- Email sent to address in Business Settings
- Helps prevent missed cheque dates

---

## 🔐 Required Permissions

### **For Encoder (Creating GRN):**
- `PURCHASE_RECEIPT_VIEW`
- `PURCHASE_RECEIPT_CREATE`

### **For Approver (Approving GRN):**
- `PURCHASE_RECEIPT_VIEW`
- `PURCHASE_RECEIPT_APPROVE` ← **Critical permission**

### **For Accounts Payable:**
- `ACCOUNTS_PAYABLE_VIEW`

### **For Payments:**
- `PAYMENT_VIEW` (view payments & PDCs)
- `PAYMENT_CREATE` (make payments)
- `PAYMENT_APPROVE` (mark cheques as cleared)

### **Who Has These Permissions:**
- ✅ **Super Admin** - ALL permissions
- ✅ **Branch Admin** - All purchase/payment permissions
- ✅ **Branch Manager** - Purchase view, create, receive permissions
- ❌ **Cashier** - Limited to sales, no purchase approvals

---

## 🎯 Quick Reference

### **New Pages Created:**
1. `/dashboard/accounts-payable` - AP Dashboard
2. `/dashboard/payments` - Payment History
3. `/dashboard/payments/new` - Payment Form
4. `/dashboard/post-dated-cheques` - PDC Monitoring

### **Enhanced Pages:**
5. `/dashboard/purchases/receipts/[id]` - GRN Detail with verification checkbox

### **Sidebar Access:**
```
Purchases ▼
  ├─ Purchase Orders
  ├─ Goods Received (GRN)
  ├─ Accounts Payable          ← Click here for AP dashboard
  ├─ Payments                  ← Click here for payment history
  └─ Post-Dated Cheques        ← Click here for PDC monitoring
```

---

## ✅ Testing Checklist

- [ ] Can create Purchase Order
- [ ] Can create GRN from PO
- [ ] Can view pending GRN
- [ ] Verification checkbox appears for pending GRN
- [ ] "Update Inventory" button appears only after checkbox ticked
- [ ] Approval updates inventory
- [ ] Approval creates AP entry automatically
- [ ] Can see AP entry in Accounts Payable page
- [ ] Aging cards show correct amounts
- [ ] Can click "Pay" button from AP page
- [ ] Payment form pre-fills with AP data
- [ ] Can submit payment with all methods
- [ ] Payment reduces AP balance
- [ ] Payment appears in Payment History
- [ ] Post-dated cheque appears in PDC page
- [ ] Days until due badges show correct colors
- [ ] Can mark PDC as cleared

---

## 📞 Support

If you encounter any issues:
1. Check user permissions in Roles & Permissions page
2. Verify user has access to correct business locations
3. Check browser console for errors
4. Review audit trail for transaction history

---

**All pages are now fully functional and tested! 🎉**
