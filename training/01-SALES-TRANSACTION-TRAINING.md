# Sales Transaction Training
## UltimatePOS Modern - Training Module 01

---

## Training Objectives

By the end of this session, you will be able to:

✅ Process customer sales transactions accurately
✅ Handle different payment methods
✅ Apply discounts correctly
✅ Manage customer information
✅ Handle returns and exchanges
✅ Print receipts and X/Z readings

**Duration:** 45 minutes
**Target Audience:** Cashiers, Sales Clerks, Branch Managers

---

## Slide 1: What is a Sales Transaction?

### Definition
A **Sales Transaction** is the process of selling products to customers and recording the sale in the system.

### Key Components
- **Products/Items** - What is being sold
- **Quantity** - How many units
- **Price** - Selling price per unit
- **Customer** - Who is buying (optional)
- **Payment** - How customer pays
- **Receipt** - Proof of purchase

### Why It Matters
✓ Generates revenue for the business
✓ Updates inventory automatically
✓ Creates sales records for reporting
✓ Tracks customer purchase history

---

## Slide 2: Sales Transaction Flow

```
┌─────────────────────────────────────────────────┐
│          SALES TRANSACTION FLOW                 │
└─────────────────────────────────────────────────┘

1. START
   ↓
2. Open Shift / Cash Drawer
   ↓
3. Add Products to Sale
   ↓
4. Apply Discounts (if applicable)
   ↓
5. Select Customer (optional)
   ↓
6. Choose Payment Method
   ↓
7. Process Payment
   ↓
8. Print Receipt
   ↓
9. Give Change (if cash)
   ↓
10. END - Record Sale
```

**Estimated Time per Transaction:** 2-5 minutes

---

## Slide 3: Step 1 - Opening Your Shift

### Before You Can Sell

**You MUST open a shift first!**

### How to Open Shift

1. **Login** with your credentials
2. **Go to:** Dashboard → POS → Open Shift
3. **Count Beginning Cash:**
   - Count all bills and coins in drawer
   - Enter denominations:
     - 1000 peso bills: ___
     - 500 peso bills: ___
     - 200 peso bills: ___
     - 100 peso bills: ___
     - 50 peso bills: ___
     - 20 peso bills: ___
     - 10 peso coins: ___
     - 5 peso coins: ___
     - 1 peso coins: ___
     - 0.25 centavos: ___
4. **Click "Open Shift"**

### Beginning Cash Requirements
- **Minimum:** ₱2,000 (for giving change)
- **Recommended:** ₱5,000
- **Maximum:** ₱20,000

**⚠️ Warning:** Cannot process sales without an open shift!

---

## Slide 4: Step 2 - Accessing POS Screen

### Navigation

**Path 1: Quick Access**
- Dashboard → **"POS"** button (large green button)

**Path 2: Menu Navigation**
- Dashboard → Sales → Point of Sale

### POS Screen Layout

```
┌────────────────────────────────────────────────┐
│ [Logo]  POINT OF SALE        [User: John Doe] │
├────────────────────┬───────────────────────────┤
│                    │                           │
│  PRODUCT SEARCH    │     CART ITEMS           │
│                    │                           │
│  [Search...]       │  1. Item A  ₱100  x 2    │
│                    │  2. Item B  ₱250  x 1    │
│  [Category Filter] │                           │
│                    │  SUBTOTAL:     ₱450      │
│  Product Grid:     │  DISCOUNT:     ₱0        │
│  [Prod A] [Prod B] │  TAX:          ₱54       │
│  [Prod C] [Prod D] │  TOTAL:        ₱504      │
│                    │                           │
│                    │  [Clear] [Hold] [Pay]    │
└────────────────────┴───────────────────────────┘
```

---

## Slide 5: Step 3 - Adding Products to Sale

### Method 1: Barcode Scanner (FASTEST)
1. Scan product barcode
2. Item automatically added to cart
3. Default quantity: 1 unit
4. Scan again to add more units

**Tip:** Place scanner close to cashier for speed

### Method 2: Product Search
1. Type product name in search box
2. Select from dropdown results
3. Click to add to cart

### Method 3: Product Grid
1. Browse category filters
2. Click product tiles
3. Item added to cart

### Method 4: Manual SKU Entry
1. Type SKU code
2. Press Enter
3. Item added to cart

---

## Slide 6: Adjusting Quantities & Prices

### Change Quantity

**Before Adding:**
- Click quantity selector
- Enter desired quantity

**After Adding:**
- Click quantity in cart
- Modify number
- Press Enter

### Change Price (if permitted)

**Permission Required:** `sell.edit_price`

**Steps:**
1. Click price in cart
2. Enter new price
3. System logs price change
4. Requires manager approval (optional)

**When to Change Price:**
- Bulk purchase discounts
- VIP customers
- Clearance sales
- Price matching

---

## Slide 7: Applying Discounts

### Discount Types

1. **Percentage Discount**
   - Example: 10% off entire sale
   - Calculation: Total × 0.10

2. **Fixed Amount Discount**
   - Example: ₱50 off
   - Deducted from total

3. **Senior Citizen / PWD Discount**
   - 20% discount (Philippine law)
   - Requires valid ID
   - **Must record ID number!**

4. **Employee Discount**
   - Varies by company policy
   - Requires employee ID

### How to Apply Discount

1. Click **"Apply Discount"** button
2. Select discount type
3. Enter discount amount/percentage
4. Enter reason (required)
5. For SC/PWD: Record ID number
6. Click "Apply"

**⚠️ Important:** Manager approval may be required for large discounts!

---

## Slide 8: Adding Customer Information

### Why Add Customer?

✓ Track customer purchase history
✓ Build customer database
✓ Enable loyalty programs
✓ Facilitate returns/exchanges
✓ Send marketing communications

### When to Add Customer

- Regular/loyal customers
- Large purchases
- Business accounts
- Gift registrations
- Warranty registrations

### How to Add Customer

**For Existing Customer:**
1. Click "Select Customer"
2. Search by name/phone/email
3. Select from results

**For New Customer:**
1. Click "Add New Customer"
2. Enter details:
   - Name (required)
   - Mobile (required)
   - Email (optional)
   - Address (optional)
3. Click "Save"

---

## Slide 9: Payment Methods

### Available Payment Methods

| Method | Process | Change Given? |
|--------|---------|---------------|
| **Cash** | Count received, enter amount | ✅ Yes |
| **Credit Card** | Swipe/chip, wait for approval | ❌ No |
| **Debit Card** | PIN entry, process | ❌ No |
| **GCash** | Scan QR, verify payment | ❌ No |
| **PayMaya** | Scan QR, verify payment | ❌ No |
| **Bank Transfer** | Confirm ref number | ❌ No |
| **Credit Account** | Customer owes balance | ❌ No |

### Split Payment
- Can use multiple methods
- Example: ₱500 cash + ₱500 card

---

## Slide 10: Processing Cash Payment

### Step-by-Step Process

1. **Click "Pay" Button**
   - Or press F12 (shortcut)

2. **Select "Cash" Payment Method**

3. **Enter Amount Received**
   - Type the amount customer gave
   - Example: Customer gave ₱1,000

4. **System Calculates Change**
   - Sale Total: ₱504
   - Amount Received: ₱1,000
   - **Change: ₱496**

5. **Confirm Payment**
   - Click "Complete Sale"

6. **Give Change to Customer**
   - Count out ₱496
   - Verify with customer

### Cash Handling Best Practices

✓ Count cash in front of customer
✓ Place received cash on register before giving change
✓ Count change twice before giving
✓ Keep large bills separate until transaction complete
✓ Check for counterfeit bills (₱500 and ₱1,000)

---

## Slide 11: Processing Card Payment

### Credit/Debit Card Process

1. **Click "Pay" Button**

2. **Select Card Payment Method**
   - Credit Card
   - Debit Card

3. **Enter Card Amount**
   - Usually exact amount (no change)

4. **Customer Interaction:**
   - Insert chip / Swipe card
   - Enter PIN (for debit)
   - Sign receipt (for credit, if required)
   - Wait for approval

5. **Approval Received**
   - System shows "Approved"
   - Get approval code
   - Record on receipt

6. **Print Receipts**
   - Customer copy
   - Merchant copy (for records)

### Card Payment Issues

| Problem | Solution |
|---------|----------|
| **Declined** | Ask for different card or cash |
| **No connection** | Use cash or wait for connection |
| **Invalid PIN** | Customer re-enters PIN |
| **Card error** | Clean card chip, try again |

---

## Slide 12: Processing GCash/E-Wallet Payment

### GCash/PayMaya Process

1. **Click "Pay" Button**

2. **Select E-Wallet Method**
   - GCash
   - PayMaya

3. **Generate QR Code**
   - System displays QR code
   - Show to customer

4. **Customer Scans QR**
   - Customer opens app
   - Scans QR code
   - Confirms payment in app

5. **Wait for Notification**
   - Payment notification received
   - Verify amount matches
   - Record reference number

6. **Complete Sale**
   - Click "Complete"
   - Print receipt

**⚠️ Important:**
- Always verify payment notification
- Record reference number
- Check exact amount (not rounded)

---

## Slide 13: Hold & Recall Transactions

### When to Use HOLD

- Customer forgot wallet
- Customer needs to compare prices
- Customer left to get more money
- Phone call interruption
- Need to help another customer

### How to HOLD Sale

1. **Click "Hold" Button**
2. **Enter reference note** (optional)
   - Example: "Customer went to ATM"
3. **Click "Save Hold"**
4. Sale saved, can help next customer

### How to RECALL Held Sale

1. **Click "Recall" Button**
2. **Select held transaction from list**
3. **Click "Load"**
4. Transaction restored to cart
5. Continue processing

**Tip:** Held sales expire after 24 hours

---

## Slide 14: Printing Receipts

### Receipt Types

1. **Customer Receipt**
   - Given to customer
   - Shows itemized list
   - Payment details
   - Return policy

2. **Official Receipt (OR)**
   - For BIR compliance
   - Shows TIN, business info
   - Required for businesses

3. **Sales Invoice (SI)**
   - For business customers
   - Shows detailed breakdown
   - Credit terms (if applicable)

### Receipt Contents

```
┌─────────────────────────────────┐
│      ABC STORE PHILIPPINES      │
│   TIN: 123-456-789-000          │
│   Address: 123 Main St.         │
│   Contact: (02) 8123-4567       │
│─────────────────────────────────│
│ Date: Oct 21, 2025  Time: 2:30PM│
│ Cashier: John Doe               │
│ Receipt #: INV-00012345         │
│─────────────────────────────────│
│ ITEM              QTY    AMOUNT │
│ ADATA 512GB SSD    1    ₱4,500 │
│ USB Cable          2      ₱200 │
│─────────────────────────────────│
│ SUBTOTAL:                ₱4,700│
│ DISCOUNT (10%):          -₱470 │
│ VAT (12%):                ₱508 │
│ TOTAL:                   ₱4,738│
│─────────────────────────────────│
│ PAYMENT METHOD: Cash            │
│ AMOUNT PAID: ₱5,000             │
│ CHANGE: ₱262                    │
│─────────────────────────────────│
│ Thank you for your purchase!    │
│ Return Policy: 7 days           │
│ Keep this receipt for warranty  │
└─────────────────────────────────┘
```

---

## Slide 15: Voiding Transactions

### When to VOID

- Cashier error (wrong items scanned)
- Customer changed mind BEFORE payment
- Price mistake
- Wrong quantity entered

**⚠️ Warning:** Cannot void after payment processed!

### How to VOID

**Permission Required:** `void.create`

1. **Click "Void" Button** (before payment)
2. **Enter void reason** (required)
   - Example: "Customer changed mind"
3. **Get manager approval** (if required)
4. **Click "Confirm Void"**
5. Transaction cancelled

### Void Rules

- Must void BEFORE payment
- Manager approval usually required
- All voids are logged
- Cannot be undone

---

## Slide 16: Processing Returns

### Return Types

1. **Same Day Return**
   - Customer immediately returns item
   - Process as regular return

2. **Later Return**
   - Customer comes back days later
   - Requires original receipt
   - Within return period (usually 7 days)

### Return Requirements

✓ Original receipt (required)
✓ Within return period
✓ Item in original condition
✓ Packaging intact (for electronics)
✓ No signs of use

### How to Process Return

1. **Verify Receipt**
   - Check date is within policy
   - Verify items match receipt

2. **Go to Returns Section**
   - Dashboard → Sales → Returns

3. **Select Original Transaction**
   - Search by receipt number
   - Or scan receipt barcode

4. **Select Items to Return**
   - Check items being returned
   - Enter quantities

5. **Choose Refund Method**
   - Cash refund
   - Store credit
   - Exchange

6. **Process Return**
   - Print return receipt
   - Update inventory

---

## Slide 17: X Reading & Z Reading

### What are Readings?

**X Reading** - Mid-shift sales report
- Shows current shift sales
- Does NOT reset counters
- Can be run multiple times

**Z Reading** - End-of-day report
- Shows total daily sales
- RESETS all counters
- Run once at end of day

### When to Run

| Reading | When | Who |
|---------|------|-----|
| **X Reading** | Mid-shift, any time | Cashier |
| **Z Reading** | End of business day | Manager |

### X Reading Process

**Permission:** `reading.x_reading`

1. **Click "Reports"** → **"X Reading"**
2. **Click "Generate"**
3. **Review report:**
   - Total sales
   - Number of transactions
   - Payment methods breakdown
   - Discounts given
4. **Print if needed**

---

## Slide 18: Closing Your Shift

### End of Shift Process

1. **Count Cash in Drawer**
   - Count all bills and coins
   - Enter denominations in system

2. **Compare Counts**
   - System expected: ₱45,230
   - Physical count: ₱45,200
   - Shortage: ₱30

3. **Explain Discrepancies**
   - If shortage/overage exists
   - Enter explanation
   - Manager reviews

4. **Print Shift Report**
   - Total sales for your shift
   - Payment methods
   - Discounts applied
   - Cash count

5. **Submit Cash**
   - Give cash to manager
   - Get receipt

6. **Close Shift in System**
   - Click "Close Shift"
   - Shift locked

---

## Slide 19: Common Mistakes to Avoid

### ❌ Mistake 1: Not Opening Shift
**Result:** Cannot process sales
**Solution:** Always open shift first thing

### ❌ Mistake 2: Wrong Product Scanned
**Result:** Selling wrong item
**Solution:** Double-check product name on screen

### ❌ Mistake 3: Incorrect Quantity
**Result:** Wrong charge
**Solution:** Verify quantity with customer

### ❌ Mistake 4: Wrong Payment Amount
**Result:** Wrong change given
**Solution:** Count cash carefully, enter correct amount

### ❌ Mistake 5: Forgetting to Print Receipt
**Result:** Customer unhappy, no proof of sale
**Solution:** Always offer receipt

### ❌ Mistake 6: Not Recording SC/PWD ID
**Result:** BIR compliance issue
**Solution:** ALWAYS record senior/PWD ID numbers

### ❌ Mistake 7: Giving Wrong Change
**Result:** Cash shortage or overage
**Solution:** Count change twice

### ❌ Mistake 8: Processing Payment Twice
**Result:** Double charging
**Solution:** Wait for confirmation before re-processing

---

## Slide 20: Best Practices

### Speed & Efficiency

✓ Keep frequently sold items within easy reach
✓ Learn product SKUs for fast entry
✓ Use keyboard shortcuts
✓ Keep scanner clean and functional
✓ Organize workspace

### Customer Service

✓ Greet every customer
✓ Smile and maintain eye contact
✓ Explain any delays
✓ Handle complaints professionally
✓ Thank customer after sale

### Cash Handling

✓ Count cash in front of customer
✓ Never leave drawer open unattended
✓ Report counterfeit bills immediately
✓ Keep large bills under drawer
✓ Do small drops when cash builds up

### Accuracy

✓ Double-check quantities
✓ Verify prices on screen
✓ Confirm total with customer
✓ Count change twice
✓ Check payment approval before completing

---

## Slide 21: Keyboard Shortcuts

### Essential Shortcuts

| Key | Action |
|-----|--------|
| **F1** | Search Product |
| **F2** | Add Customer |
| **F3** | Apply Discount |
| **F4** | Hold Transaction |
| **F5** | Recall Transaction |
| **F12** | Process Payment |
| **ESC** | Cancel/Clear |
| **ENTER** | Confirm |
| **Ctrl+Q** | Open Cash Drawer |

**Tip:** Print this and tape near your register!

---

## Slide 22: Handling Special Situations

### Situation 1: System Crash Mid-Sale

**What to Do:**
1. Don't panic
2. Write down cart items on paper
3. Restart system
4. Re-enter sale
5. Inform customer of delay

### Situation 2: Price Dispute

**What to Do:**
1. Stay calm
2. Check shelf price tag
3. If error, honor lower price (up to manager limit)
4. Call manager if large difference
5. Log price discrepancy

### Situation 3: Suspected Shoplifting

**What to Do:**
1. Do NOT confront customer
2. Alert security discreetly
3. Follow company policy
4. Do NOT touch customer
5. Let security handle

### Situation 4: Angry Customer

**What to Do:**
1. Stay calm and professional
2. Listen to complaint
3. Apologize for inconvenience
4. Offer solution
5. Call manager if needed

---

## Slide 23: Quiz Time!

### Question 1
**Before processing any sales, you must:**
A) Count the inventory
B) Open your shift
C) Print reports
D) Clean the register

**Answer:** B) Open your shift

---

### Question 2
**A customer gives you ₱1,000 for a ₱673 purchase. How much change?**
A) ₱227
B) ₱327
C) ₱427
D) ₱337

**Answer:** B) ₱327

---

### Question 3
**Senior Citizen discount in the Philippines is:**
A) 10%
B) 15%
C) 20%
D) 25%

**Answer:** C) 20%

---

### Question 4
**You should run Z Reading:**
A) Every hour
B) When shift changes
C) Once at end of day
D) Never

**Answer:** C) Once at end of day

---

### Question 5
**If you make an error before payment, you should:**
A) Process it anyway
B) Void the transaction
C) Turn off the computer
D) Ignore it

**Answer:** B) Void the transaction

---

## Slide 24: Practice Exercise

### Exercise: Process This Sale

**Customer purchases:**
- 2× ADATA 512GB SSD @ ₱4,500 each
- 1× USB Cable @ ₱200
- 1× Keyboard @ ₱1,500

**Special conditions:**
- Customer is a Senior Citizen (20% discount)
- ID Number: 1234-5678-9012
- Payment: Cash ₱10,000

**Your task:**
1. Calculate subtotal
2. Apply discount
3. Calculate total
4. Calculate change

**Answer on next slide!**

---

## Slide 25: Exercise Answer

### Calculation

**Step 1: Subtotal**
- ADATA SSD: ₱4,500 × 2 = ₱9,000
- USB Cable: ₱200 × 1 = ₱200
- Keyboard: ₱1,500 × 1 = ₱1,500
- **Subtotal: ₱10,700**

**Step 2: Senior Citizen Discount (20%)**
- Discount: ₱10,700 × 0.20 = ₱2,140
- **After Discount: ₱8,560**

**Step 3: Add VAT (12%)**
- VAT: ₱8,560 × 0.12 = ₱1,027.20
- **Total: ₱9,587.20**

**Step 4: Payment & Change**
- Payment Received: ₱10,000
- **Change: ₱412.80**

**Important:** Record SC ID: 1234-5678-9012

---

## Slide 26: Key Takeaways

### Remember These Points

✅ **Always open shift before selling**
✅ **Double-check quantities and prices**
✅ **Count cash twice**
✅ **Record SC/PWD ID numbers**
✅ **Print receipts for all sales**
✅ **Handle cash securely**
✅ **Be courteous to customers**
✅ **Ask for help when unsure**

### If You Remember Nothing Else...

🔑 **Accuracy over speed**
🔑 **Customer service is key**
🔑 **When in doubt, ask manager**

---

## Slide 27: Questions & Answers

### Common Questions

**Q: What if the barcode won't scan?**
A: Manually enter the SKU or search for product name

**Q: Can I give change from my pocket?**
A: NO! All cash must go through the register

**Q: What if I'm ₱5 short at end of shift?**
A: Small discrepancies (under ₱50) are usually tolerated, but report all discrepancies

**Q: Customer lost their receipt, can they return?**
A: Check with manager - usually need receipt, but exceptions possible

**Q: How long does a held transaction last?**
A: 24 hours, then it's automatically cancelled

---

## Slide 28: Additional Resources

### Where to Get Help

📖 **User Manual:** `PURCHASE_RETURNS_WORKFLOW_GUIDE.md`
📧 **Email Support:** support@yourcompany.com
📞 **Manager:** Extension 101
💬 **IT Help Desk:** Extension 555

### Practice Resources

🎯 **Practice Mode:** Available in system (no real transactions)
📹 **Video Tutorials:** Internal training portal
📝 **Quick Reference Card:** Available at register

---

## Slide 29: Certification

### To Complete This Training

✅ Watch entire presentation
✅ Complete practice exercise
✅ Pass quiz (80% or higher)
✅ Shadowing: 2 hours with experienced cashier
✅ Supervised practice: 1 day

### After Certification

🎓 You are authorized to:
- Process sales transactions
- Handle cash
- Apply discounts
- Process returns
- Run X Reading

❌ You still need approval for:
- Large discounts (over ₱500)
- Manager functions
- Z Reading
- Voiding transactions (in some cases)

---

## Slide 30: Training Complete!

### Congratulations! 🎉

You've completed the **Sales Transaction Training**

### Next Steps

1. Review this presentation
2. Complete practice exercises
3. Schedule shadowing session
4. Ask questions anytime!

### Remember

**You are the face of the company.**
**Every transaction is a chance to create a great customer experience.**

**Good luck!** 🚀

---

**Training Module:** 01 - Sales Transactions
**Version:** 1.0
**Last Updated:** October 21, 2025
**Trainer:** UltimatePOS Training Team
**Duration:** 45 minutes

---
