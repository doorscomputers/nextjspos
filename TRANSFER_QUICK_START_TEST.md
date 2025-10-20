# Stock Transfer Quick Start Test Guide

## 🎯 Goal
Test a complete stock transfer from **Main Warehouse** → **Main Store** using 4 different users

---

## 📋 Prerequisites

✅ 4 Test Users Created (run `node scripts/create-transfer-test-users.mjs`)
✅ Users Assigned to Locations
✅ Product with Stock in Main Warehouse

---

## 👥 The 4 Users You Need

| Step | Username | Role | Password | Location |
|------|----------|------|----------|----------|
| 1 | `warehouse_clerk` | Creator | `password` | Main Warehouse |
| 2 | `warehouse_supervisor` | Checker | `password` | Main Warehouse |
| 3 | `warehouse_manager` | Sender | `password` | Main Warehouse |
| 4 | `store_manager` | Receiver | `password` | Main Store |

---

## 🚀 5-Minute Test (Step by Step)

### **STEP 1: CREATE TRANSFER** (2 minutes)

1. **Logout** (if logged in)
2. **Login** as `warehouse_clerk` / `password`
3. Go to **Transfers** → **Create New Transfer**
4. Verify:
   - ✅ From Location: **Main Warehouse** (auto-selected)
5. Select To Location: **Main Store**
6. Add a product (any product with stock in Main Warehouse)
7. Set quantity (e.g., 10 units)
8. Click **"Create Transfer"**
9. ✅ Status should be: **Draft**
10. **Note the Transfer ID** (e.g., TR-00001)

**Stock Check:**
- ❌ Stock NOT deducted yet from Main Warehouse

---

### **STEP 2: CHECK & APPROVE** (1 minute)

1. **Logout** from `warehouse_clerk`
2. **Login** as `warehouse_supervisor` / `password`
3. Go to **Transfers**
4. Find the transfer you created (TR-00001)
5. Click to open it
6. Click **"Submit for Check"** button (if you see it)
7. Click **"Approve Check"** button
8. ✅ Status should change to: **Checked**

**Stock Check:**
- ❌ Stock STILL NOT deducted from Main Warehouse

**⚠️ Important:** If `warehouse_clerk` tries to check, they'll get an error!

---

### **STEP 3: SEND (Deduct Stock)** (1 minute)

1. **Logout** from `warehouse_supervisor`
2. **Login** as `warehouse_manager` / `password`
3. Go to **Transfers**
4. Find the transfer (TR-00001)
5. Click to open it
6. Click **"Send Transfer"** button
7. ✅ Status should change to: **In Transit**

**Stock Check:**
- 🔴 Stock **DEDUCTED** from Main Warehouse
- Go to Products → Find the product → Check stock at Main Warehouse
- Stock should be reduced by the quantity you transferred

**⚠️ Important:** If `warehouse_clerk` or `warehouse_supervisor` tries to send, they'll get an error!

---

### **STEP 4: RECEIVE (Add Stock)** (1 minute)

1. **Logout** from `warehouse_manager`
2. **Login** as `store_manager` / `password`
3. Go to **Transfers**
4. Find the transfer (TR-00001)
5. Click to open it
6. Click **"Receive Transfer"** button
7. Verify quantities (or adjust if there are missing/damaged items)
8. Click **"Confirm Receipt"**
9. ✅ Status should change to: **Received** or **Completed**

**Stock Check:**
- 🟢 Stock **ADDED** to Main Store
- Go to Products → Find the product → Check stock at Main Store
- Stock should be increased by the quantity you transferred

**⚠️ Important:** Only users assigned to Main Store can receive this transfer!

---

## ✅ Success Criteria

After completing all 4 steps:

| Check | Expected Result |
|-------|-----------------|
| Transfer Status | ✅ Completed/Received |
| Main Warehouse Stock | ✅ Reduced by transfer quantity |
| Main Store Stock | ✅ Increased by transfer quantity |
| Product History | ✅ Shows TRANSFER_OUT and TRANSFER_IN entries |
| 4 Different Users | ✅ Creator ≠ Checker ≠ Sender ≠ Receiver |

---

## 🔍 How to Verify Stock Movement

### Check Product Stock History:
1. Go to **Products**
2. Find the product you transferred
3. Click on the product name
4. Look for **"Stock History"** or **"View History"** tab
5. You should see:
   - 🔴 **TRANSFER_OUT** from Main Warehouse (at SEND step)
   - 🟢 **TRANSFER_IN** to Main Store (at RECEIVE step)

---

## 🎨 Visual Timeline

```
Time  User                  Action              MW Stock    MS Stock
----------------------------------------------------------------------
T0    -                     Initial             100         20
T1    warehouse_clerk       Create (Draft)      100         20  ← No change
T2    warehouse_supervisor  Check (Approve)     100         20  ← No change
T3    warehouse_manager     Send (In Transit)   90          20  ← Deducted -10
T4    store_manager         Receive             90          30  ← Added +10
----------------------------------------------------------------------
Final                                           90          30  ✅
```

---

## ❌ Common Errors

### "You cannot check your own transfer"
- **Cause:** Same user trying to check their own transfer
- **Fix:** Use `warehouse_supervisor` to check, not `warehouse_clerk`

### "You cannot send this transfer"
- **Cause:** Creator or checker trying to send
- **Fix:** Use `warehouse_manager` to send (different from creator and checker)

### "Insufficient stock"
- **Cause:** Not enough stock at Main Warehouse
- **Fix:** Add stock to Main Warehouse first, or reduce transfer quantity

### "You can only receive transfers at locations you are assigned to"
- **Cause:** Wrong user trying to receive
- **Fix:** Use `store_manager` who is assigned to Main Store

### "From Location" is empty
- **Cause:** User not assigned to any location
- **Fix:** Run `node scripts/assign-user-locations.mjs`

---

## 🔄 Test Again (Different Location)

To test **Main Warehouse → Bambang**:

1. Use same users 1-3 (warehouse_clerk, warehouse_supervisor, warehouse_manager)
2. For STEP 4 (Receive), use `bambang_manager` instead of `store_manager`

---

## 📊 Transfer Statuses Explained

| Status | Meaning | Stock Impact |
|--------|---------|--------------|
| `draft` | Created, not submitted | None |
| `pending_check` | Waiting for approval | None |
| `checked` | Approved, ready to send | None |
| `in_transit` | Sent, in delivery | 🔴 Deducted from origin |
| `received` | Completed | 🟢 Added to destination |

---

## 🛠️ Troubleshooting

### Users not showing in dropdown?
Run: `node scripts/assign-user-locations.mjs`

### Roles not working?
Run: `node scripts/create-transfer-roles.mjs`

### Start fresh?
1. Delete test transfers
2. Recreate users: `node scripts/create-transfer-test-users.mjs`

---

## 📖 Need More Details?

See **TRANSFER_WORKFLOW_COMPLETE_GUIDE.md** for:
- Detailed workflow diagrams
- Permission requirements
- Full explanation of each stage
- Role definitions
- Advanced scenarios

---

**Created:** 2025-10-19
**System:** UltimatePOS Modern
**Test Duration:** ~5 minutes
**Users Required:** 4
**Locations Required:** 2
