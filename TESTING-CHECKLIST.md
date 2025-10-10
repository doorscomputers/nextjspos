# Testing Checklist for UltimatePOS Modern

## System Status ✅
- ✅ Database: Connected (PCInet Computer Store)
- ✅ Products: 5 products exist
- ✅ Sales: 0 (needs testing)
- ✅ Purchases: 0 (needs testing)
- ✅ Stock Transfers: 55 transfers completed
- ✅ Audit Logs: 221 logs recorded
- ✅ Locations: 4 business locations

## Features Built & Need Testing

### 1. Purchase Workflow ❌ NOT TESTED
**Two-Step Approval System**

**Step 1 - Create Purchase Order:**
1. Login: http://ultimatepos.test/home
2. Go to: Purchases → Create Purchase Order
3. Select: Warehouse location, Supplier
4. Add products and quantities
5. Submit PO
6. **Status**: "ordered"

**Step 2 - Create GRN (Goods Receipt Note):**
1. Go to: Purchase Order detail page
2. Click: "Create GRN"
3. Enter quantities received
4. Add serial numbers if required
5. Submit GRN
6. **Status**: "pending" (inventory NOT added yet)

**Step 3 - Approve GRN:**
1. Go to: Purchases → Goods Received (GRN)
2. Filter: Pending Approval
3. Click: View on a GRN
4. Review details
5. Click: "Approve & Add Inventory"
6. **Result**: Inventory added, status "approved", costs updated

**What to Verify:**
- [ ] Product costs update (weighted average)
- [ ] Inventory added to warehouse location
- [ ] Both encoder and approver tracked
- [ ] Approved GRN cannot be edited
- [ ] Audit logs created for each step

### 2. Sales Workflow ❌ NOT TESTED

**Create Sale:**
1. Go to: Sales → Create
2. Select customer and location
3. Add products
4. Process payment
5. Complete sale

**What to Verify:**
- [ ] Inventory deducts from stock
- [ ] COGS recorded in sale items
- [ ] Sale total calculates correctly
- [ ] Invoice generated

### 3. Customer Returns ❌ NOT TESTED

**From Sales Detail Page:**
1. Go to: Sales → View a sale
2. Click: "Create Return"
3. Select items to return
4. Choose condition:
   - Resellable: Restores stock ✅
   - Damaged/Defective: No restore ❌
5. Submit return

**What to Verify:**
- [ ] Resellable items restore to stock
- [ ] Damaged items don't restore
- [ ] Return tracked with sale reference

### 4. Supplier Returns ❌ NOT TESTED

**From Purchases:**
1. Go to: Supplier Returns → Create
2. Select supplier and items
3. Choose condition (damaged/defective/warranty)
4. Submit return
5. Approve return

**What to Verify:**
- [ ] Stock DEDUCTS from warehouse
- [ ] Serial numbers marked as returned
- [ ] Cannot return more than purchased

### 5. Stock Transfers ✅ TESTED (55 transfers)
- Working correctly
- 221 audit logs confirm full workflow

### 6. Inventory Corrections ❌ NOT TESTED

**Adjust Stock:**
1. Go to: Inventory Corrections
2. Select product and location
3. Choose reason (damage, theft, count error)
4. Enter new quantity
5. Submit correction

**What to Verify:**
- [ ] Stock adjusts correctly
- [ ] Audit trail records reason
- [ ] Requires appropriate permission

### 7. Physical Inventory ❌ NOT TESTED

**Count Stock:**
1. Go to: Physical Inventory
2. Export count sheet
3. Perform physical count
4. Import results
5. Review discrepancies
6. Approve adjustments

**What to Verify:**
- [ ] Export generates correct template
- [ ] Import validates data
- [ ] Adjustments create audit trail

### 8. Reports ❌ NOT TESTED (No Data)

**Profitability & COGS Report:**
- Location: `/dashboard/reports/profitability`
- **Features**:
  - Date range filter
  - Location filter
  - Group by: Product, Category, Location, Date
  - Shows: Revenue, COGS, Gross Profit, Margin

**Net Profit Report:**
- Location: `/dashboard/reports/profit`
- **Features**:
  - Includes operating expenses
  - Shows: Revenue - (COGS + Expenses) = Net Profit
  - Group by: Location, Date, Expense Category

**What to Verify:**
- [ ] COGS calculations correct
- [ ] Profit margins accurate
- [ ] Expense tracking works
- [ ] Charts display properly

## Manual Testing Sequence

### Test 1: Complete Purchase Flow
1. Create a supplier (if none exist)
2. Create Purchase Order for 100 units @ $50 each
3. Create GRN receiving all 100 units
4. Login as different user with approve permission
5. Approve the GRN
6. **Check**: Product cost should be $50
7. **Check**: Warehouse should have 100 units
8. **Check**: Audit logs show both users

### Test 2: Sales Transaction
1. Create a sale for 10 units @ $75 each
2. Complete payment
3. **Check**: Inventory should decrease to 90 units
4. **Check**: COGS should be $50 per unit (from purchase)
5. **Check**: Gross profit should be $250 (10 × ($75 - $50))

### Test 3: Customer Return
1. Return 5 units from above sale
2. Mark as "Resellable"
3. **Check**: Inventory should increase to 95 units
4. **Check**: Return linked to original sale

### Test 4: Supplier Return
1. Return 10 units to supplier as "damaged"
2. Approve the return
3. **Check**: Inventory should decrease to 85 units
4. **Check**: Serial numbers marked as returned

### Test 5: Stock Transfer
1. Transfer 20 units from Warehouse to Branch
2. Complete full workflow (Submit → Check → Approve → Send → Arrive → Verify)
3. **Check**: Warehouse: 65 units, Branch: 20 units

### Test 6: Reports Verification
1. Generate Profitability Report
2. **Check**: Revenue = $750 (10 units × $75)
3. **Check**: COGS = $500 (10 units × $50)
4. **Check**: Gross Profit = $250
5. **Check**: Gross Profit Margin = 33.33%

## Expected Results Summary

After completing all tests above:

**Inventory Position:**
- Warehouse: 65 units
- Branch: 20 units
- **Total**: 85 units

**Financial Summary:**
- Purchases: $5,000 (100 units × $50)
- Sales: $750 (10 units × $75)
- COGS: $500
- Gross Profit: $250
- Returns to Supplier: 10 units worth $500

**Audit Trail:**
- All transactions logged
- Both user roles tracked (encoder + approver)
- Actions timestamped
- IP addresses recorded

## Known Limitations (NOT Bugs)

1. **Combo Products**: Not fully implemented (requires complex BOM system)
2. **Warranty Claims**: Feature exists but needs full workflow testing
3. **Multi-currency**: Schema supports it but UI not built
4. **Advanced Pricing**: Volume discounts, promotions not implemented

## Dashboard Requirements (NEXT TASK)

Based on Laravel UltimatePOS screenshots, dashboard needs:

1. **Metric Cards** (Top Row):
   - Total Sales
   - Net Amount
   - Invoice Due
   - Total Sell Return
   - Total Purchase
   - Purchase Due
   - Total Purchase Return
   - Expense

2. **Charts**:
   - Sales Last 30 Days (line chart)
   - Sales Current Financial Year (line chart)

3. **Tables**:
   - Sales Payment Due
   - Purchase Payment Due
   - Product Stock Alert
   - Sales Order
   - Pending Shipments

4. **Features**:
   - Location filter dropdown
   - Date filter
   - Real-time data
   - Responsive design

---

**Test all features above before proceeding to dashboard development!**
