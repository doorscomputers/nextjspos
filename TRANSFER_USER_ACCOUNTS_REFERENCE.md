# Transfer User Accounts - Complete Reference Guide

**Created:** October 19, 2025
**Total Users:** 24 (4 users × 6 locations)
**Password for ALL users:** `password`

---

## 📋 COMPLETE USER LIST BY LOCATION

### 🏢 Main Warehouse

| Username             | Password | Role              | Full Name            | Can Do                    |
|----------------------|----------|-------------------|----------------------|---------------------------|
| warehouse_clerk      | password | Transfer Creator  | Warehouse Clerk      | Create transfers FROM Main Warehouse |
| warehouse_supervisor | password | Transfer Checker  | Warehouse Supervisor | Check/Approve transfers at Main Warehouse |
| warehouse_manager    | password | Transfer Sender   | Warehouse Manager    | Send transfers FROM Main Warehouse (stock deducted) |
| warehouse_receiver   | password | Transfer Receiver | Warehouse Receiver   | Receive transfers TO Main Warehouse (stock added) |

---

### 🏪 Main Store

| Username             | Password | Role              | Full Name             | Can Do                    |
|----------------------|----------|-------------------|-----------------------|---------------------------|
| mainstore_clerk      | password | Transfer Creator  | Main Store Clerk      | Create transfers FROM Main Store |
| mainstore_supervisor | password | Transfer Checker  | Main Store Supervisor | Check/Approve transfers at Main Store |
| store_manager        | password | Transfer Sender   | Main Store Manager    | Send transfers FROM Main Store (stock deducted) |
| mainstore_receiver   | password | Transfer Receiver | Main Store Receiver   | Receive transfers TO Main Store (stock added) |

---

### 📍 Bambang

| Username           | Password | Role              | Full Name         | Can Do                    |
|--------------------|----------|-------------------|-------------------|---------------------------|
| bambang_clerk      | password | Transfer Creator  | Bambang Clerk     | Create transfers FROM Bambang |
| bambang_supervisor | password | Transfer Checker  | Bambang Supervisor | Check/Approve transfers at Bambang |
| bambang_manager    | password | Transfer Sender   | Bambang Manager   | Send transfers FROM Bambang (stock deducted) |
| bambang_receiver   | password | Transfer Receiver | Bambang Receiver  | Receive transfers TO Bambang (stock added) |

---

### 📍 Tuguegarao

| Username          | Password | Role              | Full Name          | Can Do                    |
|-------------------|----------|-------------------|--------------------|---------------------------|
| tugue_clerk       | password | Transfer Creator  | Tuguegarao Clerk     | Create transfers FROM Tuguegarao |
| tugue_supervisor  | password | Transfer Checker  | Tuguegarao Supervisor | Check/Approve transfers at Tuguegarao |
| tugue_manager     | password | Transfer Sender   | Tuguegarao Manager   | Send transfers FROM Tuguegarao (stock deducted) |
| tugue_receiver    | password | Transfer Receiver | Tuguegarao Receiver  | Receive transfers TO Tuguegarao (stock added) |

---

### 📍 Santiago

| Username            | Password | Role              | Full Name           | Can Do                    |
|---------------------|----------|-------------------|---------------------|---------------------------|
| santiago_clerk      | password | Transfer Creator  | Santiago Clerk      | Create transfers FROM Santiago |
| santiago_supervisor | password | Transfer Checker  | Santiago Supervisor | Check/Approve transfers at Santiago |
| santiago_manager    | password | Transfer Sender   | Santiago Manager    | Send transfers FROM Santiago (stock deducted) |
| santiago_receiver   | password | Transfer Receiver | Santiago Receiver   | Receive transfers TO Santiago (stock added) |

---

### 📍 Baguio

| Username          | Password | Role              | Full Name        | Can Do                    |
|-------------------|----------|-------------------|------------------|---------------------------|
| baguio_clerk      | password | Transfer Creator  | Baguio Clerk     | Create transfers FROM Baguio |
| baguio_supervisor | password | Transfer Checker  | Baguio Supervisor | Check/Approve transfers at Baguio |
| baguio_manager    | password | Transfer Sender   | Baguio Manager   | Send transfers FROM Baguio (stock deducted) |
| baguio_receiver   | password | Transfer Receiver | Baguio Receiver  | Receive transfers TO Baguio (stock added) |

---

## 🔄 TRANSFER WORKFLOW (4 STEPS)

Every stock transfer requires **4 different people** to complete (Separation of Duties):

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1: CREATE                                              │
│  User: Creator (e.g., warehouse_clerk)                       │
│  Location: Origin (where stock is coming FROM)               │
│  Action: Create transfer, select products, quantities        │
│  Stock Impact: NONE                                          │
│  Status: draft → pending_check                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 2: CHECK/APPROVE                                       │
│  User: Checker (e.g., warehouse_supervisor)                  │
│  Location: Origin (same location as creator)                 │
│  Action: Verify items, quantities, approve transfer          │
│  Stock Impact: NONE                                          │
│  Status: pending_check → checked                             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 3: SEND                                                │
│  User: Sender (e.g., warehouse_manager)                      │
│  Location: Origin (same location as creator/checker)         │
│  Action: Confirm physical shipment                           │
│  Stock Impact: DEDUCTED from origin ✅                       │
│  Status: checked → in_transit                                │
│  Note: This is when stock actually leaves the source!        │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    📦 In Transit 📦
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  STEP 4: RECEIVE                                             │
│  User: Receiver (e.g., mainstore_receiver)                   │
│  Location: Destination (where stock is going TO)             │
│  Action: Confirm receipt of goods                            │
│  Stock Impact: ADDED to destination ✅                       │
│  Status: in_transit → received                               │
│  Note: This is when stock arrives and is added!              │
└─────────────────────────────────────────────────────────────┘
                            ↓
                      ✅ COMPLETE
```

---

## 💡 PRACTICAL USAGE EXAMPLES

### Example 1: Main Warehouse → Main Store (Typical Distribution)

**Scenario:** Main Warehouse needs to send stock to Main Store

**Users Required:**
1. `warehouse_clerk` - Creates the transfer
2. `warehouse_supervisor` - Approves the transfer
3. `warehouse_manager` - Confirms shipment (stock deducted)
4. `mainstore_receiver` - Receives at Main Store (stock added)

**Steps:**
```
1. Login as: warehouse_clerk
   - Go to Transfers > Create Transfer
   - From Location: Main Warehouse (auto-selected)
   - To Location: Main Store
   - Add products and quantities
   - Click "Create Transfer"
   - Logout

2. Login as: warehouse_supervisor
   - Go to Transfers > View transfer
   - Click "Check/Approve Transfer"
   - Verify items
   - Click "Approve"
   - Logout

3. Login as: warehouse_manager
   - Go to Transfers > View transfer
   - Click "Send Transfer"
   - Confirm physical shipment
   - Stock deducted from Main Warehouse ✅
   - Logout

4. Login as: mainstore_receiver
   - Go to Transfers > View transfer
   - Click "Receive Transfer" (quick) OR "Start Verification" (detailed)
   - Confirm receipt
   - Stock added to Main Store ✅
   - Complete!
```

---

### Example 2: Main Store → Bambang (Inter-Branch Support)

**Scenario:** Main Store has excess stock, Bambang needs it

**Users Required:**
1. `mainstore_clerk` - Creates transfer
2. `mainstore_supervisor` - Approves
3. `store_manager` - Sends (stock deducted from Main Store)
4. `bambang_receiver` - Receives (stock added to Bambang)

**Why This Works:**
- ✅ Main Store can transfer to ANY other location
- ✅ Helps balance stock across branches
- ✅ Supports branches when Main Warehouse is out of stock
- ✅ Full audit trail maintained

---

### Example 3: Bambang → Main Warehouse (Consolidation/Returns)

**Scenario:** Bambang has slow-moving stock to return to Main Warehouse

**Users Required:**
1. `bambang_clerk` - Creates transfer
2. `bambang_supervisor` - Approves
3. `bambang_manager` - Sends (stock deducted from Bambang)
4. `warehouse_receiver` - Receives (stock added to Main Warehouse)

**Why This Works:**
- ✅ Branches can send stock BACK to warehouse
- ✅ Useful for consolidation, returns, damaged goods
- ✅ Main Warehouse can receive from ANY location
- ✅ Flexible bi-directional transfers

---

### Example 4: Tuguegarao → Santiago (Direct Branch-to-Branch)

**Scenario:** Santiago is out of stock, Tuguegarao has surplus

**Users Required:**
1. `tugue_clerk` - Creates transfer
2. `tugue_supervisor` - Approves
3. `tugue_manager` - Sends (stock deducted from Tuguegarao)
4. `santiago_receiver` - Receives (stock added to Santiago)

**Why This Works:**
- ✅ Branches can support each other directly
- ✅ No need to go through Main Warehouse
- ✅ Faster response to stock needs
- ✅ Efficient inter-branch cooperation

---

## 🎓 TRAINING GUIDE FOR END USERS

### For CREATORS (Clerks)
**What they do:**
- Create transfer requests from their location
- Select destination location
- Choose products and quantities
- Submit for approval

**Training Points:**
- ✅ Can ONLY create transfers FROM their assigned location
- ✅ Can send to ANY other location (including Main Warehouse)
- ✅ Should verify stock availability before creating
- ✅ Cannot approve their own transfers (separation of duties)

**Common Scenarios:**
1. Regular stock distribution (Warehouse → Branches)
2. Inter-branch support (Branch A → Branch B)
3. Returns/consolidation (Branch → Warehouse)

---

### For CHECKERS (Supervisors)
**What they do:**
- Review transfer requests
- Verify quantities and items
- Approve or reject transfers

**Training Points:**
- ✅ Must verify physical stock exists
- ✅ Check if quantities match requested amounts
- ✅ Cannot check transfers they created
- ✅ Can reject and add notes for issues

**Common Issues to Check:**
1. Stock availability at source location
2. Accuracy of product selection
3. Reasonable quantities requested

---

### For SENDERS (Managers)
**What they do:**
- Confirm physical preparation and shipment
- Mark transfer as sent
- **IMPORTANT:** This deducts stock from source!

**Training Points:**
- ✅ Verify items are physically packed and ready
- ✅ Confirm delivery method/driver
- ✅ **Stock is DEDUCTED when you click SEND**
- ✅ Cannot send transfers they created or checked
- ✅ Cannot undo after sending (serious action!)

**Checklist Before Sending:**
1. ✓ All items packed
2. ✓ Quantities match transfer document
3. ✓ Delivery vehicle/method confirmed
4. ✓ Destination branch notified

---

### For RECEIVERS
**What they do:**
- Mark transfer as arrived
- Verify items received
- Complete transfer (adds stock to destination)

**Training Points:**
- ✅ Can only receive transfers TO their location
- ✅ **Quick Receive:** Accept all items at once
- ✅ **Detailed Verification:** Check items one-by-one
- ✅ **Stock is ADDED when you click RECEIVE**
- ✅ Report discrepancies immediately

**Receiving Options:**

**Option 1: Quick Receive** (Recommended for trusted transfers)
- Click "Receive Transfer"
- All items accepted with sent quantities
- Fast and easy
- Use when: Items match, no damage, trusted source

**Option 2: Detailed Verification** (For high-value or suspect shipments)
- Click "Start Verification"
- Verify each item individually
- Record damaged/missing items
- Click "Complete Transfer"
- Use when: High value, quality check needed, discrepancies expected

---

## 🌐 MULTI-LOCATION SCENARIOS

### Scenario 1: Warehouse Distribution

**Flow:** Main Warehouse → All Branches

**Users:**
- **Origin (Main Warehouse):**
  - warehouse_clerk (creates)
  - warehouse_supervisor (checks)
  - warehouse_manager (sends)

- **Destinations (Each Branch):**
  - mainstore_receiver (receives at Main Store)
  - bambang_receiver (receives at Bambang)
  - tugue_receiver (receives at Tuguegarao)
  - santiago_receiver (receives at Santiago)
  - baguio_receiver (receives at Baguio)

**Use Case:** Weekly stock distribution from central warehouse

---

### Scenario 2: Inter-Branch Support Network

**Flow:** Any Branch ↔ Any Branch

**Example Routes:**
- Main Store → Bambang (excess stock)
- Tuguegarao → Santiago (emergency support)
- Bambang → Main Store (return surplus)
- Baguio → Tuguegarao (rebalancing)

**Key Point:** ANY location can transfer to ANY other location!

---

### Scenario 3: Returns & Consolidation

**Flow:** All Branches → Main Warehouse

**Users:**
- **Origins (Each Branch):**
  - mainstore_clerk → mainstore_supervisor → store_manager
  - bambang_clerk → bambang_supervisor → bambang_manager
  - tugue_clerk → tugue_supervisor → tugue_manager
  - etc.

- **Destination (Main Warehouse):**
  - warehouse_receiver (receives ALL returns)

**Use Cases:**
- Damaged stock returns
- Slow-moving inventory consolidation
- End-of-season returns
- Excess stock rebalancing

---

## 🔒 SECURITY & SEPARATION OF DUTIES

### Why 4 Different Users?

**Fraud Prevention:**
- ❌ One person CANNOT create and approve fake transfers
- ❌ One person CANNOT both send and receive (steal stock)
- ❌ Collusion requires 4 people (much harder!)

**Audit Trail:**
- ✅ Every step recorded with username and timestamp
- ✅ Clear accountability for each action
- ✅ Can trace WHO did WHAT and WHEN
- ✅ BIR-compliant documentation

**Quality Control:**
- ✅ Multiple checkpoints reduce errors
- ✅ Supervisor verification before shipment
- ✅ Receiver verification at destination
- ✅ Catches mistakes early

---

## 📊 INVENTORY IMPACT TIMELINE

```
TIME       STATUS        MAIN WAREHOUSE    MAIN STORE    NOTES
────────────────────────────────────────────────────────────────────
09:00 AM   draft              100            50         Clerk creates transfer (5 units)
09:15 AM   checked            100            50         Supervisor approves
09:30 AM   in_transit          95            50         Manager sends (stock -5) ✅

           📦 In Transit 📦

02:00 PM   arrived             95            50         Receiver marks arrived
02:15 PM   received            95            55         Receiver completes (+5) ✅

RESULT: Main Warehouse: 100 → 95 (-5)
        Main Store: 50 → 55 (+5)
        Total Inventory: 150 → 150 (No loss!) ✅
```

**Key Points:**
- Stock deducted at SEND (Step 3)
- Stock added at RECEIVE (Step 4)
- Total company inventory stays the same
- Just redistribution between locations

---

## ✅ TESTING CHECKLIST

### Test 1: Basic Warehouse → Store Transfer
- [ ] Login warehouse_clerk, create transfer
- [ ] Login warehouse_supervisor, approve transfer
- [ ] Login warehouse_manager, send transfer
- [ ] Verify Main Warehouse stock decreased
- [ ] Login mainstore_receiver, receive transfer
- [ ] Verify Main Store stock increased
- [ ] Check Inventory Ledger shows TRANSFER_OUT and TRANSFER_IN
- [ ] No variance or discrepancy

### Test 2: Inter-Branch Support (Store → Bambang)
- [ ] Login mainstore_clerk, create transfer to Bambang
- [ ] Login mainstore_supervisor, approve
- [ ] Login store_manager, send
- [ ] Login bambang_receiver, receive
- [ ] Verify stock moved correctly
- [ ] Check ledger at both locations

### Test 3: Return to Warehouse (Bambang → Warehouse)
- [ ] Login bambang_clerk, create transfer to Main Warehouse
- [ ] Login bambang_supervisor, approve
- [ ] Login bambang_manager, send
- [ ] Login warehouse_receiver, receive
- [ ] Verify stock returned to warehouse
- [ ] Check audit trail

### Test 4: Multi-Location Distribution
- [ ] Create transfers from Main Warehouse to 3 different branches
- [ ] Complete all workflows
- [ ] Verify each branch received their stock
- [ ] Verify total company inventory unchanged

---

## 🎯 QUICK REFERENCE CARD

**Password:** `password` (for ALL users)

**Create Transfer:** `{location}_clerk`
**Check Transfer:** `{location}_supervisor`
**Send Transfer:** `{location}_manager` (stock deducted)
**Receive Transfer:** `{location}_receiver` (stock added)

**Examples:**
- Warehouse → `warehouse_clerk`, `warehouse_supervisor`, `warehouse_manager`
- Main Store → `mainstore_clerk`, `mainstore_supervisor`, `store_manager`
- Bambang → `bambang_clerk`, `bambang_supervisor`, `bambang_manager`
- Tuguegarao → `tugue_clerk`, `tugue_supervisor`, `tugue_manager`
- Santiago → `santiago_clerk`, `santiago_supervisor`, `santiago_manager`
- Baguio → `baguio_clerk`, `baguio_supervisor`, `baguio_manager`

**Receivers:** `{location}_receiver` or `warehouse_receiver`, `mainstore_receiver`, `bambang_receiver`, etc.

---

**Total Users:** 24
**Total Locations:** 6
**Roles per Location:** 4 (Creator, Checker, Sender, Receiver)
**Password:** password (all users)
**Status:** ✅ Ready for Testing & Training

