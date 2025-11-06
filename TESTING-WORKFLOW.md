# 🧪 Comprehensive POS System Testing Workflow

## Testing Overview
**Objective**: Verify complete business workflow from purchase to sales with multi-location data isolation

**Test Locations**:
- 🏭 Main Warehouse (Jheiron - Purchase processing)
- 🏪 Main Store (JASMIN/JOJIT - Sales)
- 🏪 Bambang (JASMIN/JOJIT - Sales)
- 🏪 Tuguegarao (Ericson - Sales)

---

## 📝 Test Workflow Sequence

### 1️⃣ PURCHASE ORDERS (Jheiron - Main Warehouse)
**Login**: Jheiron @ Main Warehouse (RFID: 1322311179)

**Test Steps**:
- [ ] Navigate to Purchases → Purchase Orders
- [ ] Create new PO for a supplier (e.g., 10 units of Product A @ 100 each)
- [ ] Save and verify PO status = "Pending"
- [ ] Receive goods (Purchases → Goods Received)
- [ ] Enter serial numbers if applicable
- [ ] Verify inventory increased at Main Warehouse
- [ ] Check Accounts Payable created

**Expected Results**:
✅ Main Warehouse inventory: +10 units
✅ Accounts Payable: 1,000 pesos
✅ Purchase history recorded
✅ Serial numbers tracked (if applicable)

---

### 2️⃣ INVENTORY CORRECTIONS
**Test at**: Main Warehouse, Main Store, Bambang

**Test Steps**:
- [ ] Navigate to Inventory → Inventory Corrections
- [ ] Adjust stock (e.g., +5 units due to found stock)
- [ ] Add reason: "Physical count adjustment"
- [ ] Save correction
- [ ] Check Product History shows correction

**Expected Results**:
✅ Stock adjusted correctly
✅ Product History shows "Correction" transaction
✅ Reason visible in history

---

### 3️⃣ STOCK TRANSFERS - WAREHOUSE TO BRANCHES
**Login**: Jheiron @ Main Warehouse

**Test Scenarios**:

**A) Main Warehouse → Main Store**
- [ ] Create transfer: 5 units of Product A
- [ ] Submit for approval (if required)
- [ ] Approve transfer
- [ ] Send transfer
- [ ] Login as Main Store receiver
- [ ] Receive transfer
- [ ] Verify inventory: Warehouse -5, Main Store +5

**B) Main Warehouse → Bambang**
- [ ] Create transfer: 3 units of Product A
- [ ] Complete transfer workflow
- [ ] Verify inventory: Warehouse -3, Bambang +3

**C) Main Warehouse → Tuguegarao**
- [ ] Create transfer: 2 units of Product A
- [ ] Complete transfer workflow
- [ ] Verify inventory: Warehouse -2, Tuguegarao +2

**Expected Results**:
✅ Main Warehouse final stock: 10 - 5 - 3 - 2 = 0 units
✅ Main Store: 5 units
✅ Bambang: 3 units
✅ Tuguegarao: 2 units
✅ Transfer history complete for all

---

### 4️⃣ STOCK TRANSFERS - BRANCHES TO WAREHOUSE
**Purpose**: Test reverse transfers (return excess stock)

**Test Steps**:
- [ ] Login as Main Store user
- [ ] Create transfer: 2 units back to Main Warehouse
- [ ] Complete workflow
- [ ] Verify: Main Store -2, Warehouse +2

**Expected Results**:
✅ Main Store: 5 - 2 = 3 units
✅ Main Warehouse: 0 + 2 = 2 units

---

### 5️⃣ SUPPLIER RETURNS (Jheiron)
**Login**: Jheiron @ Main Warehouse

**Test Steps**:
- [ ] Navigate to Purchases → Supplier Returns
- [ ] Create return: 1 unit (defective/damaged)
- [ ] Select original purchase order
- [ ] Enter reason: "Defective item"
- [ ] Submit for approval
- [ ] Approve return
- [ ] Verify inventory decreased
- [ ] Check Accounts Payable adjustment

**Expected Results**:
✅ Main Warehouse: 2 - 1 = 1 unit
✅ Accounts Payable reduced by unit cost
✅ Return recorded in purchase history

---

### 6️⃣ CUSTOMER RETURNS
**Test at**: Each branch location

**Main Store (JASMIN/JOJIT)**:
- [ ] Make a sale first (1 unit)
- [ ] Process customer return
- [ ] Verify inventory increased
- [ ] Check refund issued

**Bambang**:
- [ ] Same as above

**Tuguegarao**:
- [ ] Same as above

**Expected Results**:
✅ Returned stock added back to branch inventory
✅ Refund recorded
✅ Sales adjusted

---

### 7️⃣ SERIAL NUMBER TRACKING
**Full Workflow Test**:

**Step 1: Purchase with Serial Numbers**
- [ ] Login as Jheiron
- [ ] Create PO with serialized products
- [ ] Receive goods, enter serial numbers (e.g., SN001, SN002, SN003)
- [ ] Verify serials recorded

**Step 2: Transfer with Serial Numbers**
- [ ] Transfer SN001 to Main Store
- [ ] Transfer SN002 to Bambang
- [ ] Keep SN003 in warehouse
- [ ] Verify serial tracking updated

**Step 3: Sale with Serial Number**
- [ ] Login as Main Store cashier
- [ ] Sell product with SN001
- [ ] Verify serial marked as "Sold"
- [ ] Check serial lookup shows sale details

**Expected Results**:
✅ Serial numbers tracked through Purchase → Transfer → Sale
✅ Serial lookup shows complete history
✅ Cannot sell same serial twice
✅ Warranty tracking linked to serial

---

### 8️⃣ SALES TRANSACTIONS - PER LOCATION

**🏪 Main Store Sales (JASMIN/JOJIT)**
**RFID**: 3746350884

Test sales sequence:
- [ ] Login with correct RFID
- [ ] Begin shift (record beginning cash)
- [ ] Make Sale 1: 1 unit @ selling price
- [ ] Make Sale 2: 2 units
- [ ] Record cash in/out if needed
- [ ] Verify inventory decreasing per sale
- [ ] Do NOT close shift yet

**Expected Results**:
✅ Sales recorded with correct location
✅ Inventory decreased: 3 - 3 = 0 units at Main Store
✅ Cash drawer balance updated

---

**🏪 Bambang Sales (JASMIN/JOJIT)**
**RFID**: 1323982619

Test sales sequence:
- [ ] Login with Bambang RFID
- [ ] Begin shift
- [ ] Make Sale 1: 1 unit
- [ ] Verify separate from Main Store sales

**Expected Results**:
✅ Bambang sales separate from Main Store
✅ Inventory: 3 - 1 = 2 units at Bambang
✅ No cross-location data visible

---

**🏪 Tuguegarao Sales (Ericson)**
**RFID**: 1322774315

Test sales sequence:
- [ ] Login as Ericson with Tuguegarao RFID
- [ ] Begin shift
- [ ] Make Sale 1: 1 unit
- [ ] Verify separate from other locations

**Expected Results**:
✅ Tuguegarao sales isolated
✅ Inventory: 2 - 1 = 1 unit at Tuguegarao

---

### 9️⃣ X READING (Mid-Shift Report)
**Test at**: Each location during shift

**For Each Location**:
- [ ] Navigate to POS → X Reading
- [ ] Generate X Reading
- [ ] Verify report shows:
  - All sales made so far
  - Total cash collected
  - Beginning cash
  - Cash in/out transactions
  - Current cash drawer balance
- [ ] Print/Export report

**Expected Results**:
✅ X Reading shows only current shift sales
✅ Total matches actual sales made
✅ Can generate multiple X readings during shift
✅ Does NOT reset counters

---

### 🔟 Z READING (End-of-Day Report)
**Test at**: Each location at shift close

**For Each Location**:
- [ ] Navigate to POS → Z Reading
- [ ] Enter actual cash denominations:
  - 1000 peso bills: X pcs
  - 500 peso bills: X pcs
  - 200 peso bills: X pcs
  - etc.
- [ ] System calculates total physical cash
- [ ] Compare system vs physical cash
- [ ] Check for overage/shortage
- [ ] Generate Z Reading report
- [ ] Close shift

**Expected Results**:
✅ Z Reading shows ALL sales for the day
✅ Cash count matches system calculation (or shows variance)
✅ Report includes:
  - Total Sales
  - Total Cash
  - Total Credit/Other payments
  - Beginning Cash
  - Cash In/Out
  - Expected Ending Cash
  - Actual Ending Cash
  - Overage/Shortage
✅ Counters RESET after Z Reading
✅ Next shift starts fresh

---

### 1️⃣1️⃣ CASH RECONCILIATION VERIFICATION

**For Each Location**:
- [ ] Review Z Reading report
- [ ] Calculate expected cash:
  ```
  Expected = Beginning Cash + Cash Sales + Cash In - Cash Out
  ```
- [ ] Compare with physical count
- [ ] Investigate any discrepancies
- [ ] Document variances

**Test Scenarios**:

**Scenario A: Perfect Match**
- Expected: 10,000
- Actual: 10,000
- Result: ✅ No variance

**Scenario B: Overage**
- Expected: 10,000
- Actual: 10,500
- Result: ⚠️ +500 overage (investigate)

**Scenario C: Shortage**
- Expected: 10,000
- Actual: 9,800
- Result: ⚠️ -200 shortage (investigate)

---

### 1️⃣2️⃣ CROSS-LOCATION DATA ISOLATION TEST

**Critical Security Test**:

**Test 1: Sales Isolation**
- [ ] Login as Main Store cashier
- [ ] Check sales list - should ONLY see Main Store sales
- [ ] Should NOT see Bambang or Tuguegarao sales

**Test 2: Inventory Isolation**
- [ ] Check stock levels
- [ ] Should only see assigned location stock
- [ ] Should NOT see other locations' stock

**Test 3: Reports Isolation**
- [ ] Generate sales report
- [ ] Should only include own location
- [ ] Should NOT include other locations

**Test 4: Transfer Visibility**
- [ ] View transfers
- [ ] Should see transfers FROM and TO own location
- [ ] Should NOT see transfers between other locations

**Expected Results**:
✅ Complete data isolation between locations
✅ Users only see their location's data
✅ No data leakage or cross-contamination
✅ Admins can see all locations (proper permissions)

---

## 📊 Final Verification Checklist

After completing all tests:

**Inventory Accuracy**:
- [ ] Main Warehouse final stock matches expected
- [ ] Main Store final stock matches expected
- [ ] Bambang final stock matches expected
- [ ] Tuguegarao final stock matches expected
- [ ] All product history entries accurate

**Financial Accuracy**:
- [ ] All sales recorded correctly
- [ ] All purchases recorded correctly
- [ ] Accounts Payable balance correct
- [ ] Cash reconciliation complete for all locations
- [ ] No unexplained variances

**Data Integrity**:
- [ ] Serial numbers tracked correctly
- [ ] Transfer audit trail complete
- [ ] Return transactions recorded
- [ ] Multi-location isolation verified

**Reporting Accuracy**:
- [ ] X Readings accurate for all locations
- [ ] Z Readings accurate for all locations
- [ ] Cash counts match system calculations
- [ ] Sales reports match actual transactions

---

## 🚨 Common Issues to Watch For

1. **RFID Login Issues**
   - Make sure correct RFID is scanned for each location
   - Verify location mismatch blocking works

2. **Inventory Discrepancies**
   - Check if transfers are completed (not stuck in pending)
   - Verify serial number tracking for serialized items

3. **Cash Count Mismatches**
   - Double-check cash in/out entries
   - Verify payment method split (cash vs credit)

4. **Data Isolation Failures**
   - If users see other location's data: CRITICAL BUG
   - Report immediately for fixing

---

## ✅ Success Criteria

All tests pass if:
- ✅ Inventory balances across all locations
- ✅ Cash reconciliation successful (max 1% variance acceptable)
- ✅ Complete audit trail for all transactions
- ✅ Perfect data isolation between locations
- ✅ All reports accurate and matching
- ✅ Serial number tracking working end-to-end

---

**Testing Status**: Track progress using the todo list

Good luck with testing! Report any issues immediately. 🚀
