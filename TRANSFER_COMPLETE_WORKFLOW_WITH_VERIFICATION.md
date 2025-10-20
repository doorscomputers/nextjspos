# Complete Transfer Workflow - Origin to Destination

## 🔄 Full Transfer Workflow (7 Stages)

Your system has a **MORE SOPHISTICATED** workflow than the basic 4-stage! Here's the complete flow:

```
ORIGIN LOCATION (Main Warehouse)          DESTINATION LOCATION (Main Store)
========================                  ===========================

Stage 1: CREATE (draft)
  User: warehouse_clerk
  Stock: No change
  ↓

Stage 2: CHECK (pending_check → checked)
  User: warehouse_supervisor
  Stock: No change
  ↓

Stage 3: SEND (checked → in_transit)
  User: warehouse_manager
  Stock: 🔴 DEDUCTED from origin
  ↓
  📦 Transfer in transit...
  ↓
                                          Stage 4: MARK ARRIVED (in_transit → arrived)
                                            User: store_manager (or any receiver)
                                            Stock: No change (still deducted from origin)
                                            ↓

                                          Stage 5: START VERIFICATION (arrived → verifying)
                                            User: store_manager (or any receiver)
                                            Stock: No change
                                            ↓

                                          Stage 6: VERIFY ITEMS (verifying)
                                            User: store_manager (verifies each item)
                                            Stock: No change
                                            ↓

                                          Stage 7: COMPLETE/RECEIVE (verifying → received)
                                            User: store_manager (confirms all items)
                                            Stock: 🟢 ADDED to destination
                                            Status: COMPLETED ✅
```

---

## 👥 WHO DOES WHAT?

### At ORIGIN (Main Warehouse):

| Stage | Who | Role | Permission Required |
|-------|-----|------|---------------------|
| 1. Create | warehouse_clerk | Transfer Creator | `stock_transfer.create` |
| 2. Check | warehouse_supervisor | Transfer Checker | `stock_transfer.check` |
| 3. Send | warehouse_manager | Transfer Sender | `stock_transfer.send` |

### At DESTINATION (Main Store):

| Stage | Who | Role | Permission Required |
|-------|-----|------|---------------------|
| 4. Mark Arrived | **store_manager** | Transfer Receiver | `stock_transfer.receive` |
| 5. Start Verification | **store_manager** (same user OK) | Transfer Receiver | `stock_transfer.verify` |
| 6. Verify Items | **store_manager** (same user OK) | Transfer Receiver | `stock_transfer.verify` |
| 7. Complete | **store_manager** (same user OK) | Transfer Receiver | `stock_transfer.receive` |

**Answer to your question:**
- ✅ **ONE user at destination** (store_manager) can do ALL 4 destination stages
- ✅ The system does NOT require different users at the destination
- ✅ Separation of duties is enforced between **origin and destination**, not within destination

---

## 📋 Detailed Stage Breakdown

### **STAGE 4: Mark Arrived**
- **Endpoint:** `POST /api/transfers/[id]/mark-arrived`
- **Status Change:** `in_transit` → `arrived`
- **Who:** User at destination location with `STOCK_TRANSFER_RECEIVE` permission
- **What Happens:**
  - Destination confirms shipment has physically arrived
  - No stock movement yet
  - Prepares for verification
- **Can be same user?** ✅ YES - Can be same person who does Stage 5, 6, 7

---

### **STAGE 5: Start Verification**
- **Endpoint:** `POST /api/transfers/[id]/start-verification`
- **Status Change:** `arrived` → `verifying`
- **Who:** User at destination location with `STOCK_TRANSFER_VERIFY` permission
- **What Happens:**
  - Begins item-by-item verification process
  - No stock movement yet
  - Unlocks individual item verification
- **Can be same user?** ✅ YES - Can be same person from Stage 4

---

### **STAGE 6: Verify Items** (Can do multiple times)
- **Endpoint:** `POST /api/transfers/[id]/verify-item`
- **Status:** Remains `verifying`
- **Who:** User at destination location with `STOCK_TRANSFER_VERIFY` permission
- **What Happens:**
  - Verify each item individually
  - Record actual quantities received
  - Note discrepancies (damaged, missing items)
  - Can verify items one at a time or all at once
- **Can be same user?** ✅ YES - Same person does all items

---

### **STAGE 7: Complete/Receive**
- **Endpoint:** `POST /api/transfers/[id]/receive` OR `POST /api/transfers/[id]/complete`
- **Status Change:** `verifying` → `received` (or `completed`)
- **Who:** User at destination location with `STOCK_TRANSFER_RECEIVE` permission
- **What Happens:**
  - 🟢 **Stock ADDED to destination location**
  - Serial numbers updated to new location
  - Transfer marked as complete
  - Creates ProductHistory `TRANSFER_IN` entry
- **Can be same user?** ✅ YES - Same person from Stages 4, 5, 6

---

## 🔐 Separation of Duties Rules

### ✅ REQUIRED Separation:
1. Creator ≠ Checker (at origin)
2. Creator ≠ Sender (at origin)
3. Checker ≠ Sender (at origin)
4. **ALL origin users ≠ Receiver** (origin ≠ destination)

### ❌ NOT Required:
- ❌ Different users at destination (ONE receiver can do all 4 stages)
- ❌ Different users for mark-arrived vs verify vs complete

**Why?**
- Origin has 3 different people to prevent fraud (creating fake transfers)
- Destination is RECEIVING goods - less fraud risk
- Destination focus is on ACCURACY (verifying what arrived), not fraud prevention

---

## 🎯 Simple Workflow for Testing

### **Simplest Path (Skip Optional Steps):**

**At Origin:**
1. warehouse_clerk → CREATE
2. warehouse_supervisor → CHECK
3. warehouse_manager → SEND

**At Destination:**
4. store_manager → **RECEIVE** (skips arrived/verifying - goes straight to complete)

**Can you skip stages 4, 5, 6?**
- Looking at the receive route (lines 158-163), it checks `if (transfer.status !== 'in_transit')`
- This means you can go **DIRECTLY** from `in_transit` → `received`
- Stages 4, 5, 6 are **OPTIONAL** for detailed verification

---

### **Detailed Path (Use All Stages):**

**At Destination:**
4. store_manager → MARK ARRIVED (`in_transit` → `arrived`)
5. store_manager → START VERIFICATION (`arrived` → `verifying`)
6. store_manager → VERIFY ITEM #1, #2, #3... (remains `verifying`)
7. store_manager → COMPLETE (`verifying` → `received`)

**When to use detailed path?**
- When receiving large shipments
- When you need to verify items over multiple days
- When multiple items need individual inspection
- When tracking damaged/missing items is important

---

## 📝 Testing Instructions

### **Test 1: Simple Workflow (Recommended for First Test)**

1. ✅ warehouse_clerk → Create transfer (2 items)
2. ✅ warehouse_supervisor → Check/Approve
3. ✅ warehouse_manager → Send (stock deducted from Main Warehouse)
4. ✅ **store_manager → Receive** (stock added to Main Store)
   - Go to transfer detail page
   - Click "Receive Transfer" button
   - Enter received quantities (can be same or less than sent)
   - Add notes (optional)
   - Click "Confirm Receipt"
   - **Result:** Transfer status = `received`, stock added to Main Store

**Total users needed:** 4 (3 at origin, 1 at destination)

---

### **Test 2: Detailed Workflow (For Advanced Testing)**

1. ✅ warehouse_clerk → Create
2. ✅ warehouse_supervisor → Check
3. ✅ warehouse_manager → Send
4. ✅ store_manager → Mark Arrived
5. ✅ store_manager → Start Verification
6. ✅ store_manager → Verify Item 1
7. ✅ store_manager → Verify Item 2
8. ✅ store_manager → Complete

**Total users needed:** 4 (same as Test 1)

---

## 🏢 Can Main Warehouse be a Receiver?

### **YES! Main Warehouse can receive transfers too!**

**Example Scenarios:**

#### Scenario 1: Main Store → Main Warehouse (Returns/Pullback)
- **Origin:** Main Store
- **Creator:** store_clerk (new user at Main Store)
- **Checker:** store_supervisor (new user at Main Store)
- **Sender:** store_manager (existing user)
- **Receiver:** warehouse_manager (existing user at Main Warehouse)

#### Scenario 2: Bambang → Main Warehouse (Consolidation)
- **Origin:** Bambang
- **Creator:** bambang_clerk (new user at Bambang)
- **Checker:** bambang_supervisor (new user at Bambang)
- **Sender:** bambang_manager (existing user)
- **Receiver:** warehouse_manager (existing user at Main Warehouse)

**Key Point:**
- ✅ ANY location can be origin OR destination
- ✅ The roles are based on ACTIONS, not locations
- ✅ A "Transfer Receiver" at Main Warehouse is the same role as at Main Store

---

## 🔑 Permission Summary

To complete ONE transfer from Main Warehouse → Main Store:

### Origin Users Need:
- `stock_transfer.view` (all 3 users)
- `stock_transfer.create` (creator only)
- `stock_transfer.check` (checker only)
- `stock_transfer.send` (sender only)

### Destination User Needs:
- `stock_transfer.view`
- `stock_transfer.receive`
- `stock_transfer.verify` (if using detailed workflow)

**All these are already assigned to your test users!** ✅

---

## 💡 Recommendation

**For your testing:**

1. **Use the SIMPLE workflow first:**
   - warehouse_clerk → CREATE
   - warehouse_supervisor → CHECK
   - warehouse_manager → SEND
   - store_manager → **RECEIVE** (one step, skips arrived/verify)

2. **Once that works, try DETAILED workflow** to see item-by-item verification

3. **Test reverse direction:**
   - Create users at Main Store for creating transfers
   - Test Main Store → Main Warehouse
   - Use warehouse_manager to receive

---

## 🐛 Bug Fixed

**I just fixed a bug** in `src/app/api/transfers/[id]/receive/route.ts`:
- **OLD:** Would reject receiving if `stockDeducted = true`
- **NEW:** Accepts both modes (deduct at send OR deduct at receive)
- **Your system:** Uses "deduct at send" mode (stock deducted at Stage 3)

---

**Created:** 2025-10-19
**Status:** ✅ Complete Workflow Documented
**Next Step:** Test the simple receive workflow with store_manager
