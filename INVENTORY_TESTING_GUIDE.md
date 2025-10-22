# 🧪 INVENTORY TESTING GUIDE - UltimatePOS

**Purpose**: Test all inventory IN/OUT movements to ensure accurate stock tracking and audit trails

---

## 📋 DEMO ACCOUNTS FOR TESTING

### **Super Admin** (For Setup & Overview)
- **Username**: `superadmin`
- **Password**: `password`
- **Use**: View everything, check reports, verify stock levels

---

## 🏢 TESTING LOCATIONS

| Location ID | Location Name | Purpose |
|-------------|---------------|---------|
| 1 | Main Store | Retail sales location |
| 2 | Main Warehouse | Purchase receiving, supplier returns |
| 3 | Bambang | Branch retail location |
| 4 | Tuguegarao | Branch retail location |

---

## 🔄 INVENTORY IN/OUT TEST WORKFLOWS

---

### **TEST 1: PURCHASE FLOW** (STOCK IN to Warehouse)

**Purpose**: Items purchased from supplier → Stock INCREASES at warehouse

**Location**: Main Warehouse (ID: 2)

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create PO | Warehouse Clerk | `warehouse_clerk` | `password` | Create purchase order | No stock change |
| 2. Approve & Receive | Warehouse Manager | `warehouse_manager` | `password` | Approve PO and receive GRN | ✅ **+STOCK at Warehouse** |

**Expected Result**:
- Warehouse stock: **+100 units** (or whatever quantity purchased)
- StockTransaction created: `type=purchase`, `qty=+100`
- ProductHistory created: `quantityChange=+100`

---

### **TEST 2: TRANSFER FLOW** (STOCK OUT from Warehouse, STOCK IN to Branch)

**Purpose**: Transfer items from warehouse to branch for sale

**From**: Main Warehouse (ID: 2) → **To**: Main Store (ID: 1)

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create | Warehouse Clerk | `warehouse_clerk` | `password` | Create transfer request | No stock change |
| 2. Check | Warehouse Supervisor | `warehouse_supervisor` | `password` | Check/verify transfer | No stock change |
| 3. Send | Warehouse Manager | `warehouse_manager` | `password` | Approve and send transfer | ✅ **-STOCK at Warehouse** |
| 4. Receive | Main Store Receiver | `mainstore_receiver` | `password` | Receive at destination | ✅ **+STOCK at Main Store** |

**Expected Result**:
- Warehouse stock: **-50 units**
- Main Store stock: **+50 units**
- Total system stock: **0 change** (just moved between locations)
- StockTransaction created at warehouse: `type=transfer_out`, `qty=-50`
- StockTransaction created at store: `type=transfer_in`, `qty=+50`

---

### **TEST 3: SALES FLOW** (STOCK OUT from Store)

**Purpose**: Customer buys item → Stock DECREASES at store

**Location**: Main Store (ID: 1)

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create Sale | Main Store Cashier | `mainstore_cashier` | `password` | Process customer sale | ✅ **-STOCK at Main Store** |

**Expected Result**:
- Main Store stock: **-5 units** (or whatever quantity sold)
- Total system stock: **-5 units** (items left the system)
- StockTransaction created: `type=sale`, `qty=-5`
- ProductHistory created: `quantityChange=-5`

---

### **TEST 4: CUSTOMER RETURN FLOW** (STOCK IN to Store)

**Purpose**: Customer returns item → Stock INCREASES at store (if resellable)

**Location**: Main Store (ID: 1)

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create Return | Main Store Cashier | `mainstore_cashier` | `password` | Process customer return | No stock change (pending) |
| 2. Approve Return | Main Store Manager | `mainstore_manager` | `password` | Approve return | ✅ **+STOCK at Store** (if resellable)<br>❌ **NO STOCK** (if defective) |

**Expected Result for RESELLABLE item**:
- Main Store stock: **+1 unit**
- StockTransaction created: `type=customer_return`, `qty=+1`
- Serial status: `sold` → `returned` (resellable)

**Expected Result for DEFECTIVE item**:
- Main Store stock: **0 change** (not resellable)
- Item marked as defective
- Serial status: `sold` → `defective`
- Next step: Transfer to warehouse for supplier return

---

### **TEST 5: DEFECTIVE ITEM - TRANSFER TO WAREHOUSE**

**Purpose**: Store found defective item → Transfer to warehouse

**From**: Main Store (ID: 1) → **To**: Main Warehouse (ID: 2)

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create Transfer | Main Store Clerk | `mainstore_clerk` | `password` | Create transfer (notes: "Defective for supplier return") | No stock change |
| 2. Check | Main Store Checker | `mainstore_checker` | `password` | Verify transfer | No stock change |
| 3. Send | Main Store Sender | `mainstore_sender` | `password` | Send transfer | ✅ **-STOCK at Store** |
| 4. Receive | Warehouse Receiver | `warehouse_receiver` | `password` | Receive at warehouse | ✅ **+STOCK at Warehouse** |

**Expected Result**:
- Main Store stock: **-1 unit**
- Warehouse stock: **+1 unit**
- Total system stock: **0 change** (moved between locations)

---

### **TEST 6: SUPPLIER RETURN FLOW** (STOCK OUT from Warehouse)

**Purpose**: Return defective item to supplier → Stock DECREASES at warehouse

**Location**: Main Warehouse (ID: 2)

#### **Method A: With Serial Number**

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Search Serial | Warehouse Clerk | `warehouse_clerk` | `password` | Go to Serial Lookup, search defective serial | No stock change |
| 2. Create Return | Warehouse Clerk | `warehouse_clerk` | `password` | Click "Create Supplier Return" from serial lookup | No stock change (pending) |
| 3. Approve Return | Warehouse Manager | `warehouse_manager` | `password` | Approve supplier return | ✅ **-STOCK at Warehouse** |

#### **Method B: WITHOUT Serial Number (Bulk/Accessories)**

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create Manual Return | Warehouse Clerk | `warehouse_clerk` | `password` | Go to Supplier Returns → "Create Return (Manual)" | No stock change (pending) |
| 2. Approve Return | Warehouse Manager | `warehouse_manager` | `password` | Approve supplier return | ✅ **-STOCK at Warehouse** |

**Expected Result**:
- Warehouse stock: **-1 unit**
- Total system stock: **-1 unit** (item left the system)
- StockTransaction created: `type=supplier_return`, `qty=-1`
- Serial status: `in_stock` → `supplier_return` (removed from circulation)

---

### **TEST 7: INVENTORY CORRECTION FLOW** (Adjust Stock)

**Purpose**: Physical count different from system → Adjust to match reality

**Location**: Any location

| Step | Who | Username | Password | Action | Stock Effect |
|------|-----|----------|----------|--------|--------------|
| 1. Create Correction | Location Clerk | `mainstore_clerk` | `password` | Create inventory correction | No stock change (pending) |
| 2. Approve Correction | Inventory Controller | `inventory_controller` | `password` | Approve correction | ✅ **+STOCK** (if adding)<br>✅ **-STOCK** (if removing) |

**Expected Result**:
- Stock adjusted to match physical count
- StockTransaction created: `type=correction`, `qty=±X`
- ProductHistory created with reason for adjustment

---

## 🧪 COMPLETE TEST SCENARIO (End-to-End)

### **Starting Point**: Empty system (0 stock everywhere)

| Test # | Action | Location | Who | Expected Stock After |
|--------|--------|----------|-----|---------------------|
| **1** | Purchase 100 units | Warehouse | `warehouse_clerk` → `warehouse_manager` | Warehouse: **100** |
| **2** | Transfer 50 to Main Store | Warehouse → Store | `warehouse_clerk/supervisor/manager` → `mainstore_receiver` | Warehouse: **50**, Store: **50** |
| **3** | Transfer 30 to Bambang | Warehouse → Bambang | `warehouse_clerk/supervisor/manager` → `bambang_receiver` | Warehouse: **20**, Store: **50**, Bambang: **30** |
| **4** | Sell 10 units at Main Store | Main Store | `mainstore_cashier` | Warehouse: **20**, Store: **40**, Bambang: **30** |
| **5** | Sell 5 units at Bambang | Bambang | `bambang_cashier` | Warehouse: **20**, Store: **40**, Bambang: **25** |
| **6** | Customer returns 1 (resellable) | Main Store | `mainstore_cashier` → `mainstore_manager` | Warehouse: **20**, Store: **41**, Bambang: **25** |
| **7** | Customer returns 1 (defective) | Main Store | `mainstore_cashier` → `mainstore_manager` | Warehouse: **20**, Store: **41**, Bambang: **25** (no stock added) |
| **8** | Transfer defective to warehouse | Store → Warehouse | `mainstore_clerk/checker/sender` → `warehouse_receiver` | Warehouse: **21**, Store: **40**, Bambang: **25** |
| **9** | Return 1 to supplier | Warehouse | `warehouse_clerk` → `warehouse_manager` | Warehouse: **20**, Store: **40**, Bambang: **25** |

**FINAL STOCK**:
- **Total in system: 85 units**
- **Started with: 100 units**
- **Sold: 15 units** (10 + 5)
- **Lost: 0 units** (customer return defective was returned to supplier)
- **Math**: 100 - 15 = 85 ✅ **CORRECT!**

---

## 📊 HOW TO VERIFY INVENTORY ACCURACY

### **Method 1: Check Stock Summary Report**
1. Login as `superadmin`
2. Go to Reports → Stock Summary
3. Filter by product
4. See stock at each location

### **Method 2: Check Product History**
1. Go to Products → Select product → View History
2. See all stock movements (IN/OUT)
3. Verify running balance matches current stock

### **Method 3: Check Stock Transactions**
1. Go to Reports → Stock Transactions
2. Filter by product and date range
3. See ledger entries (every IN/OUT)
4. Verify balance column shows correct running total

---

## ⚠️ CRITICAL INVENTORY RULES

1. **PURCHASES**: Only at Main Warehouse
2. **SALES**: Only at retail locations (Main Store, Bambang, Tuguegarao)
3. **TRANSFERS**: All locations can transfer
4. **SUPPLIER RETURNS**: Only from Main Warehouse
5. **CUSTOMER RETURNS**: Only at retail locations

---

## 🆘 QUICK REFERENCE: WHO CAN DO WHAT

| Action | Create | Approve/Process | Stock Changes When |
|--------|--------|----------------|-------------------|
| **Purchase** | `warehouse_clerk` | `warehouse_manager` | At approval (GRN receive) |
| **Transfer** | Any location clerk | Checker → Sender → Receiver | At send (source -) and receive (dest +) |
| **Sale** | Cashier at location | Auto-approved | Immediately |
| **Customer Return** | Cashier at location | Location manager | At approval (if resellable) |
| **Supplier Return** | `warehouse_clerk` | `warehouse_manager` | At approval |
| **Inventory Correction** | Location clerk | `inventory_controller` | At approval |

---

## 🎯 TESTING CHECKLIST

Use this checklist to verify everything works:

- [ ] **Purchase**: Stock increases at warehouse
- [ ] **Transfer Send**: Stock decreases at source location
- [ ] **Transfer Receive**: Stock increases at destination
- [ ] **Sale**: Stock decreases at retail location
- [ ] **Customer Return (Resellable)**: Stock increases at location
- [ ] **Customer Return (Defective)**: Stock does NOT increase
- [ ] **Defective Transfer**: Stock moves from branch to warehouse
- [ ] **Supplier Return**: Stock decreases at warehouse
- [ ] **Stock Balance**: Total system stock = Physical reality
- [ ] **Audit Trail**: Every movement has StockTransaction + ProductHistory
- [ ] **Serial Numbers**: Status updates correctly at each step

---

## 📝 NOTES

- All passwords are `password`
- All transactions create audit logs automatically
- Stock consistency is validated after every operation
- If stock mismatch detected, system throws error
- Complete audit trail prevents fraud

---

**Use this guide to systematically test every inventory movement!** 🚀
