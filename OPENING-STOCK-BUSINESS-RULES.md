# Opening Stock Business Rules

## ✅ Core Business Logic

### **Opening Stock Can ONLY Be Set When:**

1. ✅ **No transactions exist** for that product variation at that location
   - No sales
   - No purchases
   - No inventory corrections
   - No stock transfers
   - No adjustments

2. ✅ **Stock is not locked** (first-time setup)

3. ✅ **User has permission**: `PRODUCT_OPENING_STOCK`

4. ✅ **User has location access**: Assigned to that location OR has `ACCESS_ALL_LOCATIONS`

---

## 🔒 Once Opening Stock is Set

### **Automatic Locking:**
- Stock record is **immediately locked** (`openingStockLocked = true`)
- Lock timestamp recorded (`openingStockSetAt`)
- User who set it recorded (`openingStockSetBy`)

### **Cannot Be Changed Through Opening Stock:**
- ❌ Edit button disabled or shows error
- ❌ API returns 403 Forbidden
- ↪️ User redirected to **Inventory Corrections** page
- 📋 Must use proper adjustment workflow with audit trail

### **Exception - Unlock Permission:**
Users with `PRODUCT_UNLOCK_OPENING_STOCK` or `PRODUCT_MODIFY_LOCKED_STOCK` can:
- Temporarily unlock stock
- Make emergency corrections
- Stock re-locks automatically after save

---

## 📊 Transaction Check Validation

### **What Happens:**

When user tries to set opening stock, system checks:

```typescript
// Check for ANY transactions at this location for this product variation
const existingTransactions = await prisma.stockTransaction.findFirst({
  where: {
    productVariationId: variationId,
    locationId: locationId,
    businessId: businessId
  }
})

if (existingTransactions) {
  // REJECT: Cannot set opening stock
  return error: "Transactions already exist"
}
```

### **Error Response:**

```json
{
  "error": "Cannot set opening stock. Transactions already exist for this product at this location.",
  "details": "Opening stock can only be set when there are no sales, purchases, corrections, or transfers. Use Inventory Corrections to adjust stock.",
  "redirectTo": "/dashboard/inventory-corrections/new"
}
```

### **User Experience:**
1. User tries to set opening stock
2. System detects existing transactions
3. Error message displayed with clear explanation
4. "Go to Inventory Corrections" button shown
5. User creates correction through proper workflow

---

## 🎯 Correct Workflow Timeline

### **Scenario 1: New Product Setup (Correct)**

```
Day 1:
✅ Add Product "Mouse - Black"
✅ Set Opening Stock: 100 units at Main Store
   → Creates stock_transaction (type: opening_stock)
   → Creates variation_location_details (qtyAvailable: 100, locked: true)
   → Stock history begins

Day 2:
✅ Sale: 5 units
   → Creates stock_transaction (type: sale, qty: -5, balance: 95)
   → Updates variation_location_details (qtyAvailable: 95)

Day 3:
✅ Physical count shows 93 units (2 damaged)
   → Create Inventory Correction
   → Approval workflow
   → Creates stock_transaction (type: adjustment, qty: -2, balance: 93)
   → Updates variation_location_details (qtyAvailable: 93)

✅ RESULT: Complete audit trail from day 1
```

---

### **Scenario 2: Trying to Set Opening Stock After Transactions (Blocked)**

```
Day 1:
✅ Add Product "Keyboard"
✅ Set Opening Stock: 50 units at Downtown Store
   → Stock locked, transaction created

Day 2:
✅ Sale: 3 units
   → Transaction exists

Day 3:
❌ Manager tries to "correct" opening stock to 55
   → BLOCKED! Error: "Transactions already exist"
   → System explains: Use Inventory Corrections
   → Redirects to proper workflow

✅ CORRECT ACTION:
   → Go to Inventory Corrections
   → Create correction: System Count: 47, Physical: 52, Diff: +5
   → Reason: "Found stock in storage"
   → Approval workflow
   → Stock updated with full audit trail

✅ RESULT: Audit trail preserved, no data corruption
```

---

### **Scenario 3: Emergency Unlock (Admin Only)**

```
Day 1:
✅ Opening stock set: 200 units
   → Locked

Day 2:
⚠️ Data entry error discovered - should have been 250 units

Option A (PREFERRED):
✅ Create Inventory Correction
   → System: 200, Physical: 250, Diff: +50
   → Reason: "Correcting initial data entry error"
   → Audit trail shows the correction

Option B (EMERGENCY - Admin only):
✅ Admin unlocks opening stock
   → Requires password verification
   → Requires detailed reason
   → Updates to 250 units
   → Re-locks automatically
   → Unlock action logged in audit trail

✅ RESULT: Either way, change is tracked
```

---

## 🛡️ Why These Rules Exist

### **1. Data Integrity**
- Opening stock is a **one-time historical record**
- Changing it retroactively corrupts the entire stock history
- Balance calculations become incorrect
- Audit trail breaks

### **2. Audit Compliance**
- Accounting standards require unchangeable opening balances
- All adjustments must be traceable
- Financial reports depend on accurate stock history

### **3. Fraud Prevention**
- Prevents manipulation of inventory records
- Forces use of proper approval workflows
- Creates accountability for all changes

### **4. Stock Accuracy**
- Running balance (opening + transactions) must match reality
- If opening changes but transactions don't, balance is wrong
- System becomes unreliable

---

## 📋 User Guide Summary

### **For Inventory Managers:**

**When setting up NEW products:**
1. ✅ Add product to system
2. ✅ Go to "Set Opening Stock"
3. ✅ Select location(s)
4. ✅ Enter quantities
5. ✅ Save (this locks the stock)

**When adjusting EXISTING products:**
1. ❌ DO NOT try to change opening stock
2. ✅ Go to "Inventory Corrections"
3. ✅ Create correction with reason
4. ✅ Submit for approval
5. ✅ Stock updates after approval

**If you see "Transactions already exist" error:**
- ✅ This is CORRECT behavior
- ✅ It prevents data corruption
- ✅ Use Inventory Corrections instead
- ✅ This maintains proper audit trail

---

## 🧪 Testing Scenarios

### **Test 1: Fresh Product (Should Succeed)**
```
1. Create new product
2. Go to Opening Stock
3. Set quantity: 100
4. Save
Expected: ✅ Success, stock locked
```

### **Test 2: After Sale (Should Fail)**
```
1. Product with opening stock: 100
2. Make a sale: 5 units (balance: 95)
3. Try to change opening stock to 110
Expected: ❌ Error - "Transactions already exist"
```

### **Test 3: After Correction (Should Fail)**
```
1. Product with opening stock: 100
2. Create inventory correction: +10
3. Try to change opening stock
Expected: ❌ Error - "Transactions already exist"
```

### **Test 4: After Purchase (Should Fail)**
```
1. Product with opening stock: 100
2. Receive purchase: +50
3. Try to change opening stock
Expected: ❌ Error - "Transactions already exist"
```

---

## ⚙️ Technical Implementation

### **Database Check:**
```typescript
// Check if ANY stock transactions exist
const existingTransactions = await prisma.stockTransaction.findFirst({
  where: {
    productVariationId: parseInt(variationId),
    locationId: parseInt(locationId),
    businessId: parseInt(businessId)
  }
})

if (existingTransactions) {
  // Block opening stock
  return NextResponse.json({
    error: 'Cannot set opening stock. Transactions already exist...',
    details: 'Use Inventory Corrections to adjust stock.',
    redirectTo: '/dashboard/inventory-corrections/new'
  }, { status: 400 })
}
```

### **Applies To:**
- ✅ Variable products (with variations)
- ✅ Single products (default variation)
- ✅ All locations
- ✅ All business types

---

## 📊 Decision Flow

```
User wants to set/change stock
         |
         v
    Is it a new product with NO transactions?
         |
    YES ↓                    NO →
         |                        |
    Set Opening Stock        Has transactions?
    (One-time setup)              |
         |                   YES ↓
    Auto-lock                     |
         |                   BLOCK Opening Stock
    Create opening_stock          |
    transaction              Show error message
         |                        |
    DONE                     Redirect to →
                             Inventory Corrections
                                  |
                             Create correction
                                  |
                             Approval workflow
                                  |
                             Stock updated
                                  |
                             Audit trail maintained
                                  |
                             DONE
```

---

## 🔧 Configuration

### **Permissions Required:**

| Action | Permission | Who Has It |
|--------|-----------|------------|
| Set opening stock | `PRODUCT_OPENING_STOCK` | Branch Admin, Branch Manager |
| Unlock locked stock | `PRODUCT_UNLOCK_OPENING_STOCK` | Super Admin, Branch Admin |
| Modify locked stock | `PRODUCT_MODIFY_LOCKED_STOCK` | Super Admin only |
| Create corrections | `INVENTORY_CORRECTION_CREATE` | Branch Admin, Branch Manager |
| Approve corrections | `INVENTORY_CORRECTION_APPROVE` | Branch Admin, Super Admin |

---

## ✅ Summary

**The Rule is Simple:**

> **Opening Stock = First Record ONLY**
>
> **All Changes After = Inventory Corrections**

This ensures:
- ✅ Accurate stock tracking
- ✅ Complete audit trail
- ✅ Data integrity
- ✅ Regulatory compliance
- ✅ Fraud prevention

**If transactions exist → Use Inventory Corrections**

**No exceptions** (except emergency unlock by admin with full audit logging)

---

**Implementation Date:** 2025-10-06

**Status:** ✅ Active and Enforced
