# Purchase Orders Training
## UltimatePOS Modern - Training Module 02

---

## Training Objectives

By the end of this session, you will be able to:

✅ Create purchase orders accurately
✅ Understand PO approval workflow
✅ Manage supplier relationships
✅ Track PO status
✅ Generate PO reports

**Duration:** 40 minutes
**Target Audience:** Branch Managers, Accounting Staff, Purchasing Agents

---

## Slide 1: What is a Purchase Order?

### Definition
A **Purchase Order (PO)** is an official document sent to suppliers requesting to purchase products at specified quantities and prices.

### Why Use Purchase Orders?

✅ **Legal Protection** - Contractual agreement
✅ **Budget Control** - Authorize spending
✅ **Inventory Planning** - Track incoming stock
✅ **Price Lock** - Agree on prices beforehand
✅ **Audit Trail** - Document all purchases

### PO vs. Direct Purchase

| Purchase Order | Direct Purchase |
|----------------|-----------------|
| Formal request | Immediate buying |
| Requires approval | May not need approval |
| Tracks from request to delivery | No tracking |
| Better for bulk orders | Better for small items |

---

## Slide 2: Purchase Order Workflow

```
┌────────────────────────────────────────────┐
│      PURCHASE ORDER FLOW                    │
└────────────────────────────────────────────┘

1. Check Stock Levels
   ↓
2. Identify Products to Reorder
   ↓
3. Create Purchase Order
   - Select supplier
   - Add products
   - Set quantities
   - Agree on prices
   ↓
4. Submit for Approval
   ↓
5. Manager Reviews & Approves
   ↓
6. Send PO to Supplier
   ↓
7. Supplier Delivers Goods
   ↓
8. Create GRN (Goods Received Note)
   ↓
9. Match GRN to PO
   ↓
10. Process Payment
```

---

## Slide 3: When to Create a Purchase Order

### Triggers for PO Creation

1. **Low Stock Alert**
   - Product falls below reorder point
   - System generates alert

2. **Scheduled Reorder**
   - Weekly/monthly restocking
   - Seasonal inventory buildup

3. **New Product Launch**
   - Introducing new items
   - Initial stock order

4. **Customer Special Order**
   - Customer requests specific item not in stock
   - Create PO to fulfill order

5. **Promotional Events**
   - Sale preparation
   - Holiday stock buildup

---

## Slide 4: Step 1 - Checking Stock Levels

### Before Creating PO

**Always check current stock first!**

### How to Check Stock

1. **Go to:** Dashboard → Reports → Stock Report
2. **Review:**
   - Current stock levels
   - Items below alert quantity
   - Fast-moving items
   - Slow-moving items

3. **Generate Reorder Report:**
   - Dashboard → Reports → Reorder Report
   - Shows items that need restocking

### Reorder Point Calculation

```
Reorder Point = (Average Daily Sales × Lead Time) + Safety Stock

Example:
- Average daily sales: 5 units
- Supplier lead time: 7 days
- Safety stock: 10 units
- Reorder Point = (5 × 7) + 10 = 45 units

Order when stock reaches 45 units!
```

---

## Slide 5: Step 2 - Selecting Supplier

### How to Choose Supplier

**Factors to Consider:**

✓ **Price** - Competitive pricing
✓ **Quality** - Product standards
✓ **Lead Time** - How fast they deliver
✓ **Reliability** - On-time delivery history
✓ **Payment Terms** - Credit period offered
✓ **Minimum Order** - MOQ requirements
✓ **Location** - Shipping distance

### Where to Find Suppliers

1. **Go to:** Dashboard → Suppliers → List Suppliers
2. **Search** by:
   - Supplier name
   - Product category
   - Location

3. **Review Supplier Profile:**
   - Contact information
   - Payment terms
   - Past purchase history
   - Average delivery time

---

## Slide 6: Step 3 - Creating Purchase Order

### Navigation

**Path:** Dashboard → Purchases → Create Purchase Order

### PO Form Fields

**1. Basic Information**
- **Purchase Date** - Today's date (default)
- **Expected Delivery Date** - When you need it
- **Supplier** - Select from dropdown
- **Location** - Which warehouse/store receiving

**2. Reference Information**
- **Reference Number** - Your internal reference (optional)
- **Payment Terms** - Net 30, Net 60, etc.
- **Notes** - Special instructions

**3. Products Section**
- **Product** - Search and select
- **Variation** - Choose size/color/type
- **Quantity** - How many units
- **Unit Cost** - Price per unit
- **Tax** - VAT percentage

---

## Slide 7: Adding Products to PO

### Method 1: Product Search

1. **Click "Add Product"**
2. **Type product name** in search box
3. **Select from results**
4. **Choose variation** (if applicable)
5. **Enter quantity**
6. **Enter unit cost**
7. **Click "Add"**

### Method 2: Import from Template

1. **Click "Use Template"**
2. **Select saved template**
   - Weekly restock template
   - Supplier-specific template
3. **Products auto-fill**
4. **Review and adjust quantities**

### Method 3: Copy from Previous PO

1. **Click "Copy from PO"**
2. **Select previous PO**
3. **Products copied over**
4. **Update quantities/prices**

---

## Slide 8: Setting Quantities & Prices

### How to Determine Quantity

**Formula:**
```
Order Quantity = (Desired Stock Level - Current Stock) + Lead Time Demand

Example:
- Desired stock: 100 units
- Current stock: 30 units
- Lead time demand: 20 units
- Order Quantity = (100 - 30) + 20 = 90 units
```

### Negotiating Prices

**Tips:**
✓ Check last purchase price
✓ Ask for bulk discounts
✓ Compare with other suppliers
✓ Negotiate payment terms for better price
✓ Build long-term relationships

### Price Tracking

System shows:
- **Last purchase price** - What you paid before
- **Current price** - What supplier quotes now
- **% Change** - Price increase/decrease

🚨 **Alert if price increased >10%!**

---

## Slide 9: PO Total Calculation

### Calculation Breakdown

```
┌────────────────────────────────┐
│ PURCHASE ORDER TOTAL           │
├────────────────────────────────┤
│ Product A: 50 units × ₱100 = ₱5,000  │
│ Product B: 20 units × ₱250 = ₱5,000  │
│ Product C: 10 units × ₱500 = ₱5,000  │
├────────────────────────────────┤
│ SUBTOTAL:              ₱15,000 │
│ SHIPPING:               ₱1,000 │
│ DISCOUNT (5%):           -₱750 │
│ TAX (12%):              ₱1,830 │
├────────────────────────────────┤
│ TOTAL:                 ₱17,080 │
└────────────────────────────────┘
```

### Additional Costs

- **Shipping/Freight** - Delivery charges
- **Handling Fees** - Packaging, insurance
- **Import Duties** - For international orders
- **Taxes** - VAT, withholding tax

---

## Slide 10: PO Approval Workflow

### Who Approves?

| PO Amount | Approver | Permission |
|-----------|----------|------------|
| **< ₱10,000** | Branch Manager | `purchase.create` |
| **₱10,000 - ₱50,000** | Regional Manager | `purchase.approve` |
| **> ₱50,000** | Owner/CFO | `purchase.approve` |

### Approval Process

1. **Submitter Creates PO**
   - Status: "Draft"

2. **Submit for Approval**
   - Click "Submit"
   - Status: "Pending"

3. **Approver Reviews**
   - Checks quantities
   - Verifies prices
   - Confirms budget available

4. **Approver Decision:**
   - **Approve** → Status: "Approved"
   - **Reject** → Status: "Rejected"
   - **Request Changes** → Back to draft

---

## Slide 11: Submitting PO for Approval

### Before Submitting

**Double-check:**
✓ All products added correctly
✓ Quantities accurate
✓ Prices negotiated
✓ Supplier information correct
✓ Delivery date realistic
✓ Total matches budget

### How to Submit

1. **Review PO Summary**
   - Total items
   - Total quantity
   - Total cost

2. **Add Final Notes** (optional)
   - "Urgent - needed by Friday"
   - "Negotiated 5% discount"

3. **Click "Submit for Approval"**

4. **System Actions:**
   - Email sent to approver
   - Status changed to "Pending"
   - PO locked from editing

---

## Slide 12: Reviewing & Approving POs

### For Approvers Only

**Permission:** `purchase.approve`

### How to Review PO

1. **Go to:** Dashboard → Purchases → Pending Approvals

2. **Click on PO** to review

3. **Check:**
   - Supplier reputation
   - Price vs market rate
   - Quantity vs stock levels
   - Budget availability
   - Past performance

4. **Review Supporting Documents:**
   - Quotations
   - Price comparisons
   - Stock reports

---

## Slide 13: Approving a PO

### Approval Steps

1. **Open PO for Review**

2. **Verify All Information**

3. **Click "Approve" Button**

4. **Add Approval Notes** (optional)
   - "Approved - within budget"
   - "Approved - urgent requirement"

5. **Confirm Approval**

6. **System Actions:**
   - Status: "Approved"
   - Email sent to submitter
   - Email sent to supplier (optional)
   - PO number assigned (if not already)

### What Happens After Approval?

✅ PO can now be sent to supplier
✅ Budget reserved for this purchase
✅ Waiting for goods delivery
✅ Can create GRN once received

---

## Slide 14: Sending PO to Supplier

### Methods to Send PO

**Method 1: Email** (Recommended)
1. Click "Email PO"
2. System generates PDF
3. Auto-fills supplier email
4. Customize message (optional)
5. Click "Send"

**Method 2: Print & Fax**
1. Click "Print PO"
2. System generates PDF
3. Print document
4. Fax to supplier

**Method 3: Supplier Portal**
1. Some suppliers have online portals
2. Upload PO to their system
3. Track status online

---

## Slide 15: PO Statuses Explained

### Status Lifecycle

```
Draft → Pending → Approved → Ordered → Received → Closed

or

Draft → Pending → Rejected → Cancelled
```

### Status Definitions

| Status | Meaning | Next Action |
|--------|---------|-------------|
| **Draft** | Being created | Submit for approval |
| **Pending** | Awaiting approval | Manager reviews |
| **Approved** | Can order | Send to supplier |
| **Ordered** | Sent to supplier | Wait for delivery |
| **Partially Received** | Some items delivered | Receive remaining |
| **Received** | All items delivered | Process payment |
| **Closed** | Complete | Archive |
| **Rejected** | Not approved | Revise or cancel |
| **Cancelled** | Voided | None |

---

## Slide 16: Tracking Purchase Orders

### PO Dashboard

**Path:** Dashboard → Purchases → Purchase Orders

### View Options

**1. List View**
- Table of all POs
- Sort by date, supplier, status, amount
- Search by PO number

**2. Calendar View**
- See expected delivery dates
- Color-coded by status

**3. Supplier View**
- Group by supplier
- See all POs with each supplier

### Filters

- **Status** - Show only pending/approved/etc.
- **Date Range** - This week, this month, etc.
- **Supplier** - Specific supplier
- **Location** - Receiving warehouse
- **Amount Range** - ₱10,000 - ₱50,000

---

## Slide 17: Modifying a Purchase Order

### When Can You Edit?

| Status | Can Edit? | How |
|--------|-----------|-----|
| **Draft** | ✅ Yes | Click "Edit" |
| **Pending** | ❌ No | Recall, then edit |
| **Approved** | ❌ No | Create amendment |
| **Ordered** | ❌ No | Create amendment |

### Creating PO Amendment

**When to Use:**
- Supplier changed price
- Need more/less quantity
- Product substitution
- Delivery date change

**How to Create Amendment:**
1. Open original PO
2. Click "Create Amendment"
3. Make changes
4. Submit for approval again
5. System tracks changes

---

## Slide 18: Cancelling a Purchase Order

### When to Cancel

- Supplier can't fulfill
- Budget constraints
- Product discontinued
- Ordered by mistake
- Found better supplier

### How to Cancel

**Permission:** `purchase.delete` or Manager approval

1. **Open PO**
2. **Click "Cancel PO"**
3. **Enter cancellation reason** (required)
4. **Notify supplier** (checkbox)
5. **Confirm Cancellation**

### Effects of Cancellation

❌ Cannot be undone
❌ Budget released
✉️ Supplier notified (if selected)
📊 Recorded in history

---

## Slide 19: Common Mistakes to Avoid

### ❌ Mistake 1: Not Checking Stock First
**Result:** Over-ordering, excess inventory
**Solution:** Always check current stock levels

### ❌ Mistake 2: Wrong Quantities
**Result:** Stock shortage or excess
**Solution:** Use reorder formulas, check demand

### ❌ Mistake 3: Not Negotiating Prices
**Result:** Overpaying
**Solution:** Always compare prices, negotiate

### ❌ Mistake 4: Unrealistic Delivery Dates
**Result:** Stock shortages
**Solution:** Confirm with supplier first

### ❌ Mistake 5: Forgetting Payment Terms
**Result:** Cash flow issues
**Solution:** Agree on terms before ordering

### ❌ Mistake 6: Not Getting Approval
**Result:** Unauthorized spending
**Solution:** Follow approval workflow

---

## Slide 20: Best Practices

### Planning

✓ **Order in advance** - Don't wait for stockout
✓ **Maintain safety stock** - Buffer for delays
✓ **Track lead times** - Know supplier delivery times
✓ **Schedule regular orders** - Establish routine

### Supplier Management

✓ **Build relationships** - Regular communication
✓ **Pay on time** - Maintain good credit
✓ **Provide feedback** - Quality issues, late deliveries
✓ **Diversify suppliers** - Don't rely on one

### Cost Control

✓ **Negotiate bulk discounts** - Order larger quantities
✓ **Combine orders** - Reduce shipping costs
✓ **Track price trends** - Monitor market prices
✓ **Review spending** - Monthly PO reports

---

## Slide 21: PO Reports

### Available Reports

**1. Purchase Order Summary**
- Total POs by period
- Amount spent per supplier
- Average PO value

**2. Pending POs Report**
- All awaiting approval
- Aging analysis

**3. Supplier Performance**
- On-time delivery rate
- Quality issues
- Price competitiveness

**4. Budget vs Actual**
- Planned vs actual spending
- Variance analysis

### How to Generate

1. **Go to:** Dashboard → Reports → Purchase Reports
2. **Select report type**
3. **Set date range**
4. **Apply filters** (supplier, location, etc.)
5. **Click "Generate"**
6. **Export:** Excel, PDF, or print

---

## Slide 22: Integration with GRN

### From PO to GRN

**After supplier delivers:**

1. **Open approved PO**
2. **Click "Receive Goods"**
3. **System creates GRN** pre-filled with PO items
4. **Verify quantities received**
5. **Check quality**
6. **Complete GRN**

### GRN automatically:
✅ Links to original PO
✅ Updates PO status
✅ Updates inventory
✅ Triggers payment process

**Next Training:** Module 03 - Goods Received Notes (GRN)

---

## Slide 23: Quiz Time!

### Question 1
**Before creating a PO, you should first:**
A) Contact the supplier
B) Check current stock levels
C) Get approval
D) Print forms

**Answer:** B) Check current stock levels

---

### Question 2
**Who typically approves POs over ₱50,000?**
A) Cashier
B) Branch Manager
C) Owner/CFO
D) Supplier

**Answer:** C) Owner/CFO

---

### Question 3
**Can you edit a PO after it's approved?**
A) Yes, anytime
B) No, must create amendment
C) Only the supplier can
D) Only within 24 hours

**Answer:** B) No, must create amendment

---

### Question 4
**A PO status changes from Draft to:**
A) Approved
B) Ordered
C) Pending
D) Received

**Answer:** C) Pending

---

### Question 5
**GRN stands for:**
A) General Receipt Number
B) Goods Received Note
C) Guaranteed Return Notice
D) Gross Revenue Notice

**Answer:** B) Goods Received Note

---

## Slide 24: Practice Exercise

### Exercise: Create a Purchase Order

**Scenario:**
You're the purchasing manager. Your ADATA 512GB SSDs are running low.

**Current Stock:** 15 units
**Alert Level:** 20 units
**Desired Stock:** 100 units
**Average Daily Sales:** 5 units
**Supplier Lead Time:** 7 days

**Tasks:**
1. Calculate how many units to order
2. Determine expected delivery date
3. Calculate total cost (Unit cost: ₱4,500)

**Answer on next slide!**

---

## Slide 25: Exercise Answer

### Calculation

**Step 1: Calculate Lead Time Demand**
- Daily sales: 5 units
- Lead time: 7 days
- Lead time demand = 5 × 7 = 35 units

**Step 2: Calculate Order Quantity**
```
Order Qty = (Desired - Current) + Lead Time Demand
Order Qty = (100 - 15) + 35
Order Qty = 85 + 35
Order Qty = 120 units
```

**Step 3: Expected Delivery**
- Today + 7 days = October 28, 2025

**Step 4: Total Cost**
```
120 units × ₱4,500 = ₱540,000
Add tax (12%): ₱540,000 × 1.12 = ₱604,800
Total: ₱604,800
```

**Requires CFO approval (over ₱50,000)!**

---

## Slide 26: Key Takeaways

### Remember These Points

✅ **Always check stock before ordering**
✅ **Calculate quantities using formulas**
✅ **Get proper approvals**
✅ **Negotiate prices and terms**
✅ **Set realistic delivery dates**
✅ **Track PO status**
✅ **Maintain good supplier relationships**
✅ **Link POs to GRNs**

### Critical Success Factors

🔑 **Accurate forecasting**
🔑 **Timely approvals**
🔑 **Clear communication with suppliers**

---

## Slide 27: Additional Resources

### Where to Get Help

📖 **User Manual:** Purchase Orders section
📧 **Email Support:** purchasing@yourcompany.com
📞 **Purchasing Manager:** Extension 201
💬 **Accounting:** Extension 301

### Templates

📄 **Weekly Restock Template**
📄 **Monthly Order Template**
📄 **Supplier Request Form**
📄 **PO Amendment Form**

---

## Slide 28: Certification

### To Complete This Training

✅ Watch entire presentation
✅ Complete practice exercise
✅ Pass quiz (80% or higher)
✅ Create 3 practice POs (supervised)
✅ Review approval workflow

### After Certification

🎓 You are authorized to:
- Create purchase orders
- Submit for approval
- Track PO status
- Communicate with suppliers

❌ You may need additional approval for:
- Approving POs (manager role)
- Cancelling approved POs
- Creating amendments to approved POs

---

## Slide 29: Training Complete!

### Congratulations! 🎉

You've completed the **Purchase Orders Training**

### Next Steps

1. Review this presentation
2. Complete practice exercises
3. Create your first PO (supervised)
4. Proceed to Module 03: Goods Received Notes

### Remember

**Proper purchase planning prevents stockouts and saves money!**

**Good luck!** 🚀

---

**Training Module:** 02 - Purchase Orders
**Version:** 1.0
**Last Updated:** October 21, 2025
**Trainer:** UltimatePOS Training Team
**Duration:** 40 minutes

---
