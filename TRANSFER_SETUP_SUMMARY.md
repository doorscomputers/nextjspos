# Transfer Workflow Setup - COMPLETE ✅

## 🎉 What Was Done

I've created a complete transfer testing environment for you with:

1. ✅ **4 Transfer Roles** with proper permissions
2. ✅ **5 Test Users** ready to use
3. ✅ **2 Comprehensive Guides** for understanding and testing
4. ✅ **All users assigned** to correct locations

---

## 📌 THE 4-STAGE TRANSFER WORKFLOW

Your transfer system uses **4 STAGES** with **4 DIFFERENT USERS** (separation of duties):

```
CREATE → CHECK → SEND → RECEIVE
(User 1)  (User 2)  (User 3)  (User 4)

Draft     Checked   In Transit   Received
❌ No      ❌ No      🔴 DEDUCT    🟢 ADD
   stock      stock      from         to
   change     change     origin       dest
```

**Key Point:** Stock is **deducted at SEND** and **added at RECEIVE**

---

## 👥 YOUR TEST USERS (All Created!)

### For Main Warehouse (Origin):

| Username | Role | Password | Use For |
|----------|------|----------|---------|
| `warehouse_clerk` | Transfer Creator | `password` | STEP 1: Create |
| `warehouse_supervisor` | Transfer Checker | `password` | STEP 2: Check |
| `warehouse_manager` | Transfer Sender | `password` | STEP 3: Send |

### For Destination Locations:

| Username | Role | Location | Use For |
|----------|------|----------|---------|
| `store_manager` | Transfer Receiver | Main Store | STEP 4: Receive |
| `bambang_manager` | Transfer Receiver | Bambang | STEP 4: Receive |

**All passwords:** `password`

---

## 🚀 HOW TO TEST (Quick Version)

### Test: Main Warehouse → Main Store

1. **Login as `warehouse_clerk`**
   - Go to Transfers → Create New Transfer
   - From: Main Warehouse (auto), To: Main Store
   - Add product, quantity
   - Create → Status: Draft

2. **Logout, Login as `warehouse_supervisor`**
   - Find transfer → Click → Approve Check
   - Status: Checked

3. **Logout, Login as `warehouse_manager`**
   - Find transfer → Click → Send Transfer
   - Status: In Transit
   - 🔴 Stock deducted from Main Warehouse

4. **Logout, Login as `store_manager`**
   - Find transfer → Click → Receive Transfer
   - Status: Received
   - 🟢 Stock added to Main Store

**Total Time:** ~5 minutes

---

## 📚 DOCUMENTATION FILES

### 1. **TRANSFER_QUICK_START_TEST.md** ⭐ START HERE
- Quick 5-minute test guide
- Step-by-step with screenshots-friendly layout
- Common errors and solutions
- Perfect for first-time testing

### 2. **TRANSFER_WORKFLOW_COMPLETE_GUIDE.md**
- Full detailed explanation
- All 4 stages explained
- Role definitions
- Permission requirements
- Visual diagrams
- Multiple test scenarios

---

## 🔧 SCRIPTS AVAILABLE

### Already Run (Setup Complete):
- ✅ `scripts/create-transfer-roles.mjs` - Created 4 roles
- ✅ `scripts/create-transfer-test-users.mjs` - Created 5 users
- ✅ `scripts/assign-user-locations.mjs` - Assigned all users to locations

### If You Need to Re-run:
```bash
# Recreate roles (if needed)
node scripts/create-transfer-roles.mjs

# Recreate test users (if needed)
node scripts/create-transfer-test-users.mjs
```

---

## ✅ VERIFICATION CHECKLIST

Before testing, verify:

- [x] ✅ 4 transfer roles created
- [x] ✅ 5 test users created
- [x] ✅ Users assigned to locations
- [x] ✅ Users assigned to roles
- [ ] ⬜ Product with stock in Main Warehouse (you need to create/import)

**You need to:** Ensure you have at least 1 product with stock in Main Warehouse before testing!

---

## 🎯 NEXT STEPS

### 1. Add Stock to Main Warehouse
- Create a product OR
- Import products with stock OR
- Make a purchase and receive it at Main Warehouse

### 2. Start Testing
- Follow **TRANSFER_QUICK_START_TEST.md**
- Login as `warehouse_clerk`
- Create your first transfer

### 3. Verify Stock Movement
After completing the transfer:
- Check product stock at Main Warehouse (should decrease)
- Check product stock at Main Store (should increase)
- View Product History (should show TRANSFER_OUT and TRANSFER_IN)

---

## 📊 ROLES & PERMISSIONS CREATED

### Transfer Creator
- `stock_transfer_view`
- `stock_transfer_create`
- `product_view`

### Transfer Checker
- `stock_transfer_view`
- `stock_transfer_check`
- `product_view`

### Transfer Sender
- `stock_transfer_view`
- `stock_transfer_send`
- `product_view`

### Transfer Receiver
- `stock_transfer_view`
- `stock_transfer_receive`
- `product_view`

---

## 🔄 TESTING DIFFERENT SCENARIOS

### Scenario 1: Main Warehouse → Main Store
Users: warehouse_clerk → warehouse_supervisor → warehouse_manager → **store_manager**

### Scenario 2: Main Warehouse → Bambang
Users: warehouse_clerk → warehouse_supervisor → warehouse_manager → **bambang_manager**

### Scenario 3: Test Partial Receive
- At STEP 4, receiver can input less quantity than sent
- Useful for damaged/missing items

### Scenario 4: Test Serial Numbers
- If product has serial numbers enabled
- Each stage will require serial number selection/verification

---

## ❓ FAQ

### Q: Why 4 different users?
**A:** Separation of duties prevents fraud. One person can't create and approve their own transfer.

### Q: When is stock deducted?
**A:** At STEP 3 (SEND). Not at create or check.

### Q: Can I skip stages?
**A:** No. The workflow enforces all stages in order for audit trail.

### Q: What if I made a mistake?
**A:** You can cancel transfers in Draft or Checked status. Once sent, you need to complete or reject at destination.

### Q: Can the same user do multiple stages?
**A:** No. Each stage requires a DIFFERENT user for separation of duties.

---

## 🛠️ TROUBLESHOOTING

### "From Location" shows "Select origin location"
**Fix:** User not assigned to location. Already fixed by running assign-user-locations script.

### Can't see transfer menu
**Fix:** User needs `stock_transfer_view` permission. Already assigned to test users.

### "You cannot check your own transfer"
**Fix:** This is correct behavior! Use a different user for STEP 2.

### No products to transfer
**Fix:** Create products or import them first. Ensure Main Warehouse has stock.

---

## 📱 PRODUCTION USAGE

When you're ready for production:

1. **Create real users** (not test users)
2. **Assign them to roles:**
   - Store clerks → Transfer Creator
   - Supervisors → Transfer Checker
   - Managers → Transfer Sender + Transfer Receiver
3. **Assign locations** based on where they work
4. **Train staff** on the 4-stage process

---

## 🎓 TRAINING SUMMARY FOR STAFF

**Warehouse Staff:**
1. Clerk creates transfer request
2. Supervisor checks and approves
3. Manager sends (stock deducted)

**Store Staff:**
4. Manager receives (stock added)

**Everyone needs to logout/login between stages!**

---

## 📞 SUPPORT

If you have questions:
1. Check **TRANSFER_QUICK_START_TEST.md** for common issues
2. Check **TRANSFER_WORKFLOW_COMPLETE_GUIDE.md** for detailed explanations
3. Verify user locations and roles are assigned
4. Check product has stock in origin location

---

**Setup Date:** 2025-10-19
**Status:** ✅ READY FOR TESTING
**Next Step:** Follow TRANSFER_QUICK_START_TEST.md
