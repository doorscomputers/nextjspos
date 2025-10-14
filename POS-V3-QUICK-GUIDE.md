# 🚀 POS V3 - Quick Reference Guide

## ✅ What's New in V3?

Your POS system has been upgraded with 12 major improvements based on your feedback!

---

## 🔥 KEY FEATURES

### 1. Mixed Payment (Cash + Digital)
**How to use:**
1. Enter cash amount in "Cash Payment" field
2. Select digital method (GCash or Maya)
3. Enter digital amount
4. System shows total paid and change
5. Complete sale

**Example:**
- Total: 5000
- Cash: 3000
- GCash: 2000
- Change: 0 ✓

---

### 2. Digital Payment (GCash/Maya)
**Replaces:** Generic "Card" option

**Features:**
- Select GCash or Maya from dropdown
- Enter amount
- Enter reference number
- **MUST capture receipt photo** 📷
- Cannot checkout without photo

**How to capture:**
1. Click "📷 Capture Receipt"
2. Customer shows receipt on phone
3. Camera opens
4. Click "📸 Capture Photo"
5. Green checkmark appears ✓

---

### 3. Hold & Retrieve Transactions
**Hold** (⏸️ button):
- Saves cart, customer, discounts
- Optional note
- Clears current transaction

**Retrieve** (▶️ button):
- Shows all held transactions
- Click to restore
- Removes from list

**Use when:**
- Customer getting more cash
- Serving multiple customers
- Customer needs approval

---

### 4. Numeric Keypad
**Click on any amount field to open:**
- Cash amount
- Digital amount
- Regular discount amount

**Benefits:**
- Touch-friendly
- Large buttons
- Less errors
- Professional

---

### 5. Regular Discount
**New discount type!**

**Options:**
- No Discount
- Senior Citizen (20%) - needs ID/Name
- PWD (20%) - needs ID/Name
- **Regular Discount** ← NEW! Custom amount

**Use for:**
- Manager approvals
- Promotions
- Loyalty discounts
- Bulk purchases

---

### 6. Freebie Management
**What's new:**
- Freebie total tracked separately
- Shows "Freebie (Not Charged): 300.00"
- Cashier NOT held responsible
- After sale shows: "Not charged - for record keeping only"

**Example:**
```
Subtotal:          30,000.00
Freebie:              300.00 (green - not charged)
Total to Collect:  30,000.00
```

---

### 7. Credit Invoice (Checkbox)
**Changed:** Now a checkbox instead of button

**How to use:**
1. Check "📝 Credit / Charge Invoice"
2. Payment fields hide
3. MUST select customer
4. Complete sale
5. Status: Pending

---

### 8. New UI Improvements
**Category Tabs:**
- Beautiful gradient design
- Blue-50 to Blue-100 background
- Active tab: Blue-600 with white text
- Smooth transitions

**New Customer Button:**
- Prominent blue button
- Easy to spot
- Quick customer creation

**Layout:**
- Wider cart area (550px)
- More products visible
- All buttons visible (no scrolling)
- 4-5 product columns

---

## 📊 QUICK ACTION BUTTONS

Located at bottom of product area:

| Button | Function |
|--------|----------|
| 💵 Cash In | Record cash received |
| 💸 Cash Out | Record cash taken |
| 📋 Save | Save quotation |
| 📂 Load | Load quotation |
| ⏸️ Hold | Hold current transaction |
| ▶️ Retrieve | Retrieve held transaction |

---

## 💰 PAYMENT WORKFLOWS

### Workflow 1: Cash Only
1. Add products
2. Enter cash amount
3. See change
4. Complete sale

### Workflow 2: Mixed Payment
1. Add products
2. Enter cash amount (partial)
3. Select GCash/Maya
4. Enter digital amount (remaining)
5. Enter reference
6. Capture receipt photo
7. Verify total paid >= total due
8. Complete sale

### Workflow 3: Credit Sale
1. Add products
2. Check "Credit / Charge Invoice"
3. Select customer (required)
4. Complete sale
5. No payment recorded
6. Status: Pending

### Workflow 4: With Freebie
1. Add regular products
2. Click 🎁 on freebie items
3. Note freebie total shown separately
4. Total to collect = regular items only
5. Complete sale
6. Message shows freebie value for records

---

## 🎯 COMMON SCENARIOS

### Scenario 1: Customer Pays Partly Cash, Partly GCash
**Total Due: 5000**

1. Customer has 3000 cash + 2000 GCash
2. Enter Cash: 3000
3. Select GCash
4. Enter Digital: 2000
5. Enter GCash Reference
6. Capture receipt photo from customer's phone
7. Verify: Total Paid = 5000, Change = 0
8. Complete Sale ✓

---

### Scenario 2: Customer Doesn't Have Enough Money
**Total Due: 5000**

1. Add products
2. Enter Cash: 3000
3. Click Complete Sale
4. Error: "Insufficient payment. Due: 5000.00, Paid: 3000.00"
5. Options:
   - Add more cash
   - Add digital payment
   - Hold transaction
   - Cancel sale

---

### Scenario 3: Need to Serve Another Customer
**Current customer is undecided**

1. Click "⏸️ Hold"
2. Enter note: "Customer checking prices"
3. Confirm hold
4. Cart clears
5. Serve new customer
6. When first customer returns:
   - Click "▶️ Retrieve"
   - Select transaction
   - Cart restores
   - Complete sale

---

### Scenario 4: Promotional Sale with Freebie
**Buy Laptop, Get Mouse Free**

1. Add Laptop (30,000) - normal
2. Click 🎁 on Mouse
3. Mouse added with FREE badge
4. Display shows:
   - Subtotal: 30,000
   - Freebie (Not Charged): 300
   - Total: 30,000
5. Collect 30,000 only
6. After sale message:
   - "Freebie Total: 300.00 (Not charged - for record keeping only)"

---

### Scenario 5: Manager Approved Discount
**Manager says give 500 discount**

1. Add products (Subtotal: 10,000)
2. Select Discount: "Regular Discount"
3. Click discount amount field
4. Keypad opens
5. Enter: 500
6. Verify: Total = 9,500
7. Complete sale
8. No ID/Name needed

---

## ⚠️ IMPORTANT REMINDERS

### Digital Payments:
- ✅ MUST capture receipt photo
- ✅ MUST enter reference number
- ✅ Customer must show proof
- ❌ Cannot skip photo capture

### Mixed Payments:
- ✅ Total paid must be >= Total due
- ✅ Can combine Cash + ONE digital method
- ❌ Cannot pay less than total

### Credit Sales:
- ✅ Customer selection is REQUIRED
- ✅ No payment recorded
- ✅ Status will be "Pending"
- ❌ Cannot credit to walk-in

### Freebies:
- ✅ Click 🎁 button to add as freebie
- ✅ Value tracked but NOT charged
- ✅ Inventory still deducted
- ✅ Shows separately in totals

### Hold Transactions:
- ✅ Saved in browser (localStorage)
- ✅ Survives page refresh
- ❌ Not shared between devices
- ❌ Cleared if browser data deleted

---

## 🔢 NUMERIC KEYPAD LAYOUT

```
┌─────┬─────┬─────┐
│  7  │  8  │  9  │
├─────┼─────┼─────┤
│  4  │  5  │  6  │
├─────┼─────┼─────┤
│  1  │  2  │  3  │
├─────┼─────┼─────┤
│  .  │  0  │  ←  │
└─────┴─────┴─────┘
┌───────────┬───────┐
│   Clear   │  OK   │
└───────────┴───────┘
```

**Buttons:**
- **Numbers**: 0-9
- **Decimal**: . (one only)
- **Backspace**: ← (delete last digit)
- **Clear**: Clear all
- **OK**: Confirm value

---

## 📱 DISCOUNT OPTIONS

| Type | Rate | ID Required | Name Required |
|------|------|-------------|---------------|
| None | 0% | ❌ | ❌ |
| Senior Citizen | 20% | ✅ | ✅ |
| PWD | 20% | ✅ | ✅ |
| Regular | Custom | ❌ | ❌ |

---

## 🎨 CATEGORY TABS

**Visual Design:**
- Gradient background
- Blue active state
- White text when active
- Shadow effect
- Smooth transitions

**How to use:**
- Click tab to filter products
- "All Products" shows everything
- Other tabs show category-specific

---

## 💡 PRO TIPS

### Faster Checkout:
1. Use barcode scanner
2. Use numeric keypad for amounts
3. Capture photos quickly
4. Pre-select frequent customers

### For Mixed Payments:
1. Ask customer total they want to pay
2. Ask cash amount
3. Calculate digital needed
4. Enter both amounts
5. Verify total correct

### For Freebies:
1. Add regular items first
2. Add freebies last
3. Verify freebie total correct
4. Explain to customer it's tracked

### For Hold/Retrieve:
1. Add notes for clarity
2. Use for indecisive customers
3. Use when customer forgot card
4. Use for price checks

---

## 🆘 TROUBLESHOOTING

### "Insufficient payment" error
- **Cause**: Total paid < Total due
- **Fix**: Add more cash or digital payment

### "Please capture receipt photo"
- **Cause**: Digital payment without photo
- **Fix**: Click "Capture Receipt", take photo

### "Customer required for credit sales"
- **Cause**: Credit checkbox but no customer
- **Fix**: Select customer or uncheck credit

### Camera not working
- **Cause**: Browser permission denied
- **Fix**: Allow camera access in browser settings

### Keypad not opening
- **Cause**: Clicking wrong area
- **Fix**: Click directly on amount input field

### Change shows negative (red)
- **Cause**: Insufficient payment
- **Fix**: Add more payment until change >= 0

---

## ✅ CHECKLIST FOR CASHIERS

**Before Starting Shift:**
- [ ] Login to system
- [ ] Begin shift with beginning cash
- [ ] Check barcode scanner working
- [ ] Check webcam working

**During Transactions:**
- [ ] Scan/add products correctly
- [ ] Apply discounts if eligible
- [ ] Enter payments accurately
- [ ] Capture digital receipt photos
- [ ] Verify change amount
- [ ] Complete sale

**If Using Hold:**
- [ ] Add note explaining why
- [ ] Inform customer you saved it
- [ ] Remember to retrieve later

**For Digital Payments:**
- [ ] Select correct method (GCash/Maya)
- [ ] Enter reference number
- [ ] ALWAYS capture photo
- [ ] Verify photo captured (green check)

**End of Shift:**
- [ ] Complete all transactions
- [ ] No held transactions remaining
- [ ] Close shift properly
- [ ] Count cash denominations

---

## 📞 NEED HELP?

**For Training:** Review `POS-V3-IMPROVEMENTS-COMPLETE.md`

**For Testing:** Follow 12 test scenarios in complete guide

**For Issues:** Check troubleshooting section above

---

**Version**: POS V3
**Status**: ✅ Production Ready
**Updated**: January 2025

---

**🎉 Happy Selling!**
