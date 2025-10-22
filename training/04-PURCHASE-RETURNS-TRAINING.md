# Purchase Returns Training
## UltimatePOS Modern - Training Module 04

---

## Training Objectives

By the end of this session, you will be able to:

✅ Understand purchase returns workflow
✅ Create returns from product pages
✅ Search GRNs by product/SKU
✅ Fill return forms accurately
✅ Process return approvals
✅ Track inventory deductions

**Duration:** 30 minutes
**Target Audience:** Branch Managers, Accounting Staff, Warehouse Managers

---

## Slide 1: What is a Purchase Return?

### Definition
A **Purchase Return** is when you send defective, damaged, or incorrect items **BACK TO THE SUPPLIER** for refund, replacement, or credit.

### Direction: YOU → SUPPLIER

```
┌─────────────────────────────────────┐
│   PURCHASE RETURN (You → Supplier)  │
├─────────────────────────────────────┤
│ Your Warehouse  ────►  Supplier     │
│                                     │
│ Sending:                            │
│  • Defective items                  │
│  • Damaged goods                    │
│  • Wrong items received             │
│                                     │
│ Expecting:                          │
│  • Refund                           │
│  • Replacement                      │
│  • Credit note                      │
└─────────────────────────────────────┘
```

---

## Slide 2: Purchase Return vs Supplier Return

### Two Different Transactions!

| Feature | **Purchase Return** | **Supplier Return** |
|---------|---------------------|---------------------|
| **Direction** | You → Supplier | Supplier → You |
| **Who initiates** | You | Supplier |
| **Example** | You send back defective SSD | Supplier picks up warranty item |
| **Inventory** | Deducted from your stock | Added to your stock |
| **Status** | Pending → Approved | Pending → Approved |
| **Create From** | Approved GRN | Serial Number Lookup |

**⚠️ Important:** Don't confuse these two!

---

## Slide 3: When to Create Purchase Return

### Common Scenarios

1. **Defective Product**
   - Item doesn't work properly
   - Functional failure
   - Example: SSD not recognized

2. **Damaged in Transit**
   - Physical damage during shipping
   - Broken packaging
   - Crushed/dented items

3. **Wrong Item Received**
   - Supplier sent different product
   - Wrong model/version
   - Incorrect specifications

4. **Quality Issues**
   - Poor quality
   - Doesn't meet standards
   - Not as described

5. **Overcharge**
   - Charged more than agreed
   - Price mismatch

6. **Expired Products**
   - Past expiration date
   - Short shelf life remaining

---

## Slide 4: Purchase Return Workflow

```
┌────────────────────────────────────────────┐
│      PURCHASE RETURN FLOW                   │
└────────────────────────────────────────────┘

1. Find Defective Product
   ↓
2. Locate Which GRN It Came From
   Method A: Create Return from Product Page ⭐
   Method B: Search GRN by Product/SKU
   ↓
3. Create Return
   - Select GRN
   - Choose items to return
   - Enter quantities
   - Specify condition
   - Choose expected action
   ↓
4. Submit for Approval
   ↓
5. Manager Reviews & Approves
   ↓
6. Inventory Deducted
   ↓
7. Coordinate Pickup with Supplier
   ↓
8. Receive Refund/Replacement/Credit
```

---

## Slide 5: NEW FEATURE: Create Return from Product Page

### The Fastest Way! ⚡

**Before:** Had to manually search through dozens of GRNs
**Now:** System shows all GRNs for that product automatically!

### How It Works

1. **Go to Product Detail Page**
   - Products → List Products
   - Search for defective product
   - Click View icon (👁️)

2. **Click "Create Return" Button**
   - Orange button in top-right
   - Only visible if you have permission

3. **System Shows All Relevant GRNs**
   - Auto-filters approved GRNs
   - Shows only GRNs containing this product
   - Displays recent 20 GRNs

4. **Select the Correct GRN**
   - Review date, supplier, location
   - Click "Select"

5. **Fill Return Form**
   - Pre-filled with GRN data
   - Add return details

**Time Saved:** 7-10 minutes per return!

---

## Slide 6: Step-by-Step: Create Return from Product

### Step 1: Find the Product

**Navigation:** Dashboard → Products → List Products

**Search Methods:**
- Type product name: "ADATA 512GB"
- Scan barcode
- Enter SKU code

**Click:** View icon (👁️) to open detail page

---

### Step 2: Click "Create Return"

**Button Location:** Top-right corner of product page

```
┌──────────────────────────────────────┐
│  ← Back    ADATA 512GB 2.5" SSD      │
│                                      │
│  [Print] [Edit Product] [Create Return] │
│                            ↑             │
│                     Orange button        │
└──────────────────────────────────────┘
```

**Permission Required:** `purchase_return.create`

**If Button Missing:**
- You don't have permission
- Contact your manager

---

### Step 3: Select GRN from List

**GRN Selection Modal appears:**

```
┌─────────────────────────────────────────┐
│  Select GRN to Create Return            │
│  Showing GRNs containing: ADATA 512GB   │
├─────────────────────────────────────────┤
│                                         │
│  GRN-202510-0025      [approved]        │
│  Date: Oct 15, 2025                     │
│  Supplier: TechCo Supplies              │
│  Location: Main Store                   │
│  Items: ADATA 512GB (Qty: 20)           │
│                          [Select ▶]     │
│  ─────────────────────────────────────  │
│  GRN-202510-0018      [approved]        │
│  Date: Oct 10, 2025                     │
│  ...                                    │
│                                         │
│                    [Cancel]             │
└─────────────────────────────────────────┘
```

**How to Choose:**
✓ Check **date** - when received?
✓ Check **supplier** - which supplier?
✓ Check **location** - which warehouse?
✓ Verify **items** - is your product listed?

---

### Step 4: Fill Return Form

**Required Fields:**

1. **Return Date**
   - Date creating the return
   - Defaults to today

2. **Return Reason** (dropdown)
   - Damaged
   - Wrong Item
   - Quality Issue
   - Overcharge
   - Expired
   - Defective
   - Not as Ordered

3. **Expected Action**
   - **Refund** - Get money back
   - **Replacement** - Exchange for new item
   - **Credit Note** - Account credit for future purchases

4. **Items to Return:**
   - ☑ Check items to return
   - **Quantity** - How many (cannot exceed received qty)
   - **Unit Cost** - Pre-filled from GRN
   - **Condition:**
     - Damaged
     - Defective
     - Wrong Item
     - Quality Issue
   - **Serial Numbers** - If tracked
   - **Notes** - Explain the issue

5. **General Notes** (optional)
   - Additional information
   - Reference numbers
   - Photos attached

---

### Step 5: Submit Return

**Before Submitting:**

✓ Double-check quantities
✓ Verify unit costs
✓ Ensure condition is accurate
✓ Add detailed notes
✓ Record serial numbers (if applicable)

**Click:** "Create Return" button

**System Actions:**
- Assigns return number (e.g., RET-000015)
- Sets status to "Pending"
- Sends notification to approver
- Saves return for approval

**Next:** Wait for manager approval

---

## Slide 7: Method 2: Search GRN by Product/SKU

### When to Use This Method

✓ You remember the GRN number range
✓ You want to see all GRNs from a supplier
✓ You're processing multiple returns from same GRN

### Enhanced GRN Search Features

**NEW:** Search now includes product names and SKUs!

**Path:** Dashboard → Purchases → Goods Received (GRN)

**Search Box Now Searches:**
- ✅ GRN Number
- ✅ PO Number
- ✅ Supplier Name
- ✅ **Product Name** (NEW!)
- ✅ **Variation Name** (NEW!)
- ✅ **SKU** (NEW!)
- ✅ Received By
- ✅ Approved By
- ✅ Status

---

### Example: Search by Product

**Type in search box:** "ADATA 512GB"

**Results:**
- All GRNs containing ADATA 512GB products
- Filtered in real-time

**Then:**
1. Click View icon (👁️) on relevant GRN
2. Click "Create Return" button on GRN detail page
3. Fill return form (same as Method 1)

---

## Slide 8: Approving Purchase Returns

### For Managers Only

**Permission:** `purchase_return.approve`

### Approval Process

**Path:** Dashboard → Purchases → Returns

1. **View Pending Returns**
   - Filter by Status: "Pending"
   - See all awaiting approval

2. **Click View Icon (👁️)**
   - Open return detail page

3. **Review Return Information:**
   - ✓ Return reason - valid?
   - ✓ Quantities - correct?
   - ✓ Condition - matches description?
   - ✓ Unit costs - match GRN?
   - ✓ Serial numbers - recorded?

4. **Check Inventory:**
   - Do we have enough stock to deduct?
   - Verify product is still in location

5. **Decide:**
   - **Approve** → Inventory deducted
   - **Reject** → Return cancelled

---

### Approving a Return

**Click:** "Approve Return" button

**What Happens:**

1. **Stock Transaction Created**
   - Type: SUPPLIER_RETURN
   - Quantity: -5 (deducted)
   - Reference: return #RET-000015

2. **Product History Updated**
   - Transaction Type: SUPPLIER_RETURN
   - Quantity Change: -5
   - New Balance: Updated

3. **Inventory Deducted**
   - Location stock reduced
   - Variant quantity updated

4. **Serial Numbers Updated** (if tracked)
   - Status: in_stock → supplier_return
   - Location: Cleared

5. **Return Status Changed**
   - Status: pending → approved

6. **Notifications Sent**
   - Approver gets confirmation
   - Submitter notified
   - Supplier can be notified (optional)

---

## Slide 9: After Approval - Supplier Coordination

### Next Steps

**1. Contact Supplier**
- Email: Send return number and item list
- Phone: Confirm pickup arrangements
- Portal: Upload to supplier system (if available)

**2. Prepare Items**
- Separate returned items
- Tag with return number
- Package properly
- Include documentation

**3. Schedule Pickup**
- Coordinate with supplier
- Arrange pickup date/time
- Prepare receiving area

**4. Document Pickup**
- Get supplier signature
- Record pickup date
- Take photos (optional)
- File paperwork

**5. Track Refund/Replacement**
- Monitor supplier processing
- Follow up if delayed
- Update accounting when received

---

## Slide 10: Return Statuses

### Status Lifecycle

```
pending → approved → completed
   ↓
rejected → cancelled
```

### Status Definitions

| Status | Meaning | Inventory | Next Action |
|--------|---------|-----------|-------------|
| **pending** | Awaiting approval | Not changed | Manager reviews |
| **approved** | Authorized | Deducted | Coordinate pickup |
| **completed** | Refund/replacement received | Deducted | Close return |
| **rejected** | Not approved | Not changed | Revise or cancel |
| **cancelled** | Voided | Not changed | None |

---

## Slide 11: Tracking Returns

### Purchase Returns List

**Path:** Dashboard → Purchases → Returns

### View Options

**Filters:**
- **Status** - Pending, Approved, Completed, Rejected
- **Supplier** - Specific supplier
- **Location** - Which warehouse
- **Date Range** - This week, this month, custom

**Search:**
- Return number (RET-000015)
- Product name
- Supplier name

**Sort:**
- Date (newest first)
- Amount (highest first)
- Status

---

### Return Detail Page

**Information Shown:**

- Return number
- Return date
- Status
- Supplier information
- GRN reference
- Expected action (refund/replacement/credit)
- Items list with quantities and conditions
- Approval history
- Notes

**Actions Available:**
- View original GRN
- Print return document
- Email to supplier
- Approve (if pending, if authorized)
- Cancel (if pending, if authorized)

---

## Slide 12: Common Mistakes to Avoid

### ❌ Mistake 1: Wrong GRN Selected
**Result:** Returning items from wrong receipt
**Solution:** Double-check GRN date, supplier, items

### ❌ Mistake 2: Incorrect Quantities
**Result:** Over-returning or under-returning
**Solution:** Count physical items before creating return

### ❌ Mistake 3: Missing Serial Numbers
**Result:** Can't track which units returned
**Solution:** Always record serial numbers for tracked items

### ❌ Mistake 4: Wrong Condition Selected
**Result:** Supplier disputes
**Solution:** Accurately assess condition (damaged vs defective)

### ❌ Mistake 5: Not Recording Notes
**Result:** Unclear why returning
**Solution:** Add detailed description of issue

### ❌ Mistake 6: Forgetting to Coordinate Pickup
**Result:** Items sit in warehouse
**Solution:** Contact supplier immediately after approval

---

## Slide 13: Best Practices

### Speed & Accuracy

✓ **Use Product Page method** - Fastest way to find GRNs
✓ **Photograph issues** - Document damage/defects
✓ **Record detailed notes** - Explain problems clearly
✓ **Act quickly** - Don't delay returns (supplier deadlines)

### Documentation

✓ **Save original packaging** - Especially for electronics
✓ **Keep all paperwork** - GRN, return docs, emails
✓ **Track communications** - Log supplier responses
✓ **File properly** - Organize by return number

### Supplier Relations

✓ **Be professional** - Don't blame unnecessarily
✓ **Provide evidence** - Photos, test results
✓ **Follow their process** - Each supplier different
✓ **Maintain records** - Track return performance

---

## Slide 14: Permission Requirements

### Who Can Do What?

| Action | Permission | Typical Roles |
|--------|------------|---------------|
| **Create Return** | `purchase_return.create` | Branch Manager, Accounting Staff |
| **View Returns** | `purchase_return.view` | Branch Manager, Accounting, Warehouse Manager |
| **Approve Return** | `purchase_return.approve` | Branch Manager, Branch Admin |
| **Update Return** | `purchase_return.update` | Branch Manager, Accounting Staff |
| **Delete Return** | `purchase_return.delete` | Branch Manager |

### Role Summary

| Role | Create? | Approve? |
|------|---------|----------|
| **Super Admin** | ✅ | ✅ |
| **Branch Manager** | ✅ | ✅ |
| **Accounting Staff** | ✅ | ❌ |
| **Branch Admin** | ❌ | ✅ |
| **Cashier** | ❌ | ❌ |
| **Warehouse Staff** | ❌ | ❌ |

---

## Slide 15: Reports & Analytics

### Available Reports

**1. Purchase Returns Summary**
- Total returns by period
- Amount returned per supplier
- Most returned products

**2. Return Reasons Analysis**
- Breakdown by reason
- Identify quality issues
- Supplier performance

**3. Supplier Performance**
- Return rate per supplier
- Average return value
- Response time

**4. Financial Impact**
- Total refunds received
- Outstanding credits
- Return vs purchase ratio

### How to Generate

**Path:** Dashboard → Reports → Purchase Reports → Returns

**Options:**
- Date range
- Supplier filter
- Status filter
- Export: Excel, PDF

---

## Slide 16: Troubleshooting

### Problem: "Create Return" Button Not Visible

**Causes & Solutions:**

1. **No Permission** ❌
   - Need `purchase_return.create`
   - Contact admin

2. **Wrong Role** ❌
   - Cashiers/Sales Clerks cannot create
   - Ask manager to create

3. **Session Expired** ❌
   - Refresh page
   - Log back in

---

### Problem: "No Approved GRNs Found"

**Causes & Solutions:**

1. **Product Never Received** ❌
   - No GRN exists for this product
   - Cannot create return without GRN

2. **GRN Not Approved** ❌
   - GRN still pending approval
   - Ask manager to approve GRN first

3. **Wrong Product** ❌
   - Looking at different variation
   - Verify exact SKU

---

### Problem: Cannot Approve Return

**Causes & Solutions:**

1. **No Approval Permission** ❌
   - Need `purchase_return.approve`
   - Forward to authorized person

2. **Insufficient Stock** ❌
   - Location doesn't have enough inventory
   - Items already sold/transferred

3. **Already Approved** ❌
   - Status already "approved"
   - No action needed

---

## Slide 17: Quiz Time!

### Question 1
**Purchase Return means:**
A) Customer returns item to you
B) You return item to supplier
C) Supplier returns item to you
D) Transfer between stores

**Answer:** B) You return item to supplier

---

### Question 2
**The fastest way to create a return is:**
A) Search all GRNs manually
B) From product detail page
C) Call the supplier
D) Email accounting

**Answer:** B) From product detail page

---

### Question 3
**Expected actions for returns include:**
A) Refund, Replacement, Credit Note
B) Only refund
C) Only replacement
D) Exchange only

**Answer:** A) Refund, Replacement, Credit Note

---

### Question 4
**After return approval, inventory is:**
A) Not changed
B) Increased
C) Deducted
D) Transferred

**Answer:** C) Deducted

---

### Question 5
**Cashiers can create purchase returns:**
A) Yes, always
B) Yes, with approval
C) No, only managers
D) Only on weekends

**Answer:** C) No, only managers

---

## Slide 18: Practice Exercise

### Exercise: Create a Return

**Scenario:**
You received 20 ADATA 512GB SSDs on Oct 15 from TechCo.
Customer bought one, it's defective (not recognized).
Serial Number: SN123456789

**Your Tasks:**
1. Which method to create return?
2. What return reason?
3. What expected action?
4. What condition?
5. What notes to add?

**Answer on next slide!**

---

## Slide 19: Exercise Answer

### Solution

**1. Method:**
✅ **Product detail page** (fastest)
- Go to ADATA 512GB product page
- Click "Create Return"
- Select GRN-202510-0025

**2. Return Reason:**
✅ **Defective**

**3. Expected Action:**
✅ **Replacement** (customer waiting)

**4. Condition:**
✅ **Defective**

**5. Notes:**
```
Customer reported SSD not recognized by computer.
Tested on 3 different computers - same issue.
SN: SN123456789
Customer waiting for replacement.
```

**Additional:**
- Quantity: 1
- Unit Cost: ₱4,500 (from GRN)
- Record serial number: SN123456789

---

## Slide 20: Key Takeaways

### Remember These Points

✅ **Use product page method - it's faster!**
✅ **Record detailed notes about issues**
✅ **Always include serial numbers if tracked**
✅ **Choose correct condition (damaged vs defective)**
✅ **Act quickly - don't delay returns**
✅ **Photograph issues for evidence**
✅ **Coordinate pickup with supplier**
✅ **Track refund/replacement status**

### Critical Success Factors

🔑 **Accuracy in documentation**
🔑 **Timely processing**
🔑 **Good supplier communication**

---

## Slide 21: Additional Resources

### Where to Get Help

📖 **User Guide:** `PURCHASE_RETURNS_WORKFLOW_GUIDE.md`
📧 **Email Support:** returns@yourcompany.com
📞 **Purchasing Manager:** Extension 201
💬 **Accounting:** Extension 301

### Quick References

📄 **Return Reasons Guide**
📄 **Supplier Contact List**
📄 **Return Policy Matrix**

---

## Slide 22: Training Complete!

### Congratulations! 🎉

You've completed the **Purchase Returns Training**

### Next Steps

1. Review this presentation
2. Complete practice exercise
3. Create 2 practice returns (supervised)
4. Get manager sign-off

### Remember

**Proper returns save money and maintain supplier relationships!**

**Good luck!** 🚀

---

**Training Module:** 04 - Purchase Returns
**Version:** 1.0
**Last Updated:** October 21, 2025
**Trainer:** UltimatePOS Training Team
**Duration:** 30 minutes

---
