# 🚀 TRANSFER SYSTEM - QUICK START GUIDE

## ✅ EVERYTHING IS READY!

All enhancements (A-E) have been completed successfully. Just login and test!

---

## 🔑 TEST CREDENTIALS

```
Main Warehouse Manager:  warehouse_mgr / password123
Makati Branch Manager:    makati_mgr / password123
Pasig Branch Manager:     pasig_mgr / password123
Cebu Branch Manager:      cebu_mgr / password123
```

---

## 🎯 5-MINUTE TEST FLOW

### Step 1: Login as Warehouse Manager

- URL: `http://localhost:3000/login`
- Username: `warehouse_mgr`
- Password: `password123`

### Step 2: Create Your First Transfer

1. Click **Transfers** in sidebar
2. Click **Create Transfer** button
3. Notice:
   - ✅ "From Location" is **auto-filled with Main Warehouse**
   - ✅ "To Location" excludes Main Warehouse
4. Select **Branch Makati** as destination
5. Add items:
   - Click "Add Item" button
   - Select "Dell Latitude 7490 Laptop"
   - Set quantity: 10 units
   - Notice it shows "Available: 50"
6. Click **Create Transfer**

### Step 3: Complete the Workflow

1. View the transfer you just created
2. Click **Submit for Check** button
3. Click **Approve** button
4. Click **Send** button
   - ✅ Stock is NOW deducted from Main Warehouse
5. Logout

### Step 4: Receive at Destination

1. Login as: `makati_mgr / password123`
2. Go to **Transfers** page
3. Find your incoming transfer
4. Click **Mark Arrived**
5. Click **Start Verification**
6. Verify each item (or adjust quantity if needed)
7. Click **Complete Transfer**
   - ✅ Stock is NOW added to Branch Makati

### Step 5: Verify Stock Levels

1. Go to **Products** page
2. Search for "Laptop"
3. Check stock:
   - Main Warehouse: 40 units (was 50, deducted 10)
   - Branch Makati: 10 units (newly added)

**DONE!** You've completed a full transfer workflow. ✅

---

## 🧪 WHAT TO TEST

### ✅ Auto-Location Assignment

- Login as any branch manager
- Go to Create Transfer
- Verify "From Location" is pre-selected to their branch
- Verify they only see their assigned location(s)

### ✅ Filtered Dropdowns

- Try selecting different "From Locations"
- Verify "To Location" always excludes the selected source
- Try selecting same location (impossible!)

### ✅ Stock Validation

- Try transferring more than available stock
- System should reject with clear error message

### ✅ Cancellation & Stock Restoration

1. Create a transfer
2. Send it (stock gets deducted)
3. Cancel with reason
4. Verify stock is restored to original location

### ✅ Rejection Flow

1. Create a transfer
2. Submit for check
3. Reject it with a reason
4. Verify it returns to draft status
5. Verify no inventory changes occurred

---

## 📦 AVAILABLE TEST PRODUCTS

| Product                     | Initial Stock (Main Warehouse)     |
| --------------------------- | ---------------------------------- |
| Dell Latitude 7490 Laptop   | 50 units                           |
| Logitech MX Master 3 Mouse  | 200 units                          |
| Keychron K8 Keyboard        | 150 units                          |
| Dell 27" UltraSharp Monitor | 30 units (Main), 15 units (Makati) |

---

## 🎨 NEW FEATURES IMPLEMENTED

1. **Smart Auto-Location** - Your location pre-selected automatically
2. **Filtered Dropdowns** - Can't select same location twice
3. **Configurable Workflow** - Simple or Full mode (admin setting)
4. **Perfect Cancellation** - Stock always restored correctly
5. **Partial Receipts** - Adjust quantities at destination

---

## 🐛 IF SOMETHING DOESN'T WORK

### Dev Server Not Running?

```bash
npm run dev
```

### Database Connection Error?

Check `.env` file has correct `DATABASE_URL`

### Users Don't Exist?

Run seed script:

```bash
node scripts/seed-transfer-test-data.js
```

### Permissions Error?

Login as `superadmin / password` first, then test branch users

---

## 📚 FULL DOCUMENTATION

See **TRANSFER-SYSTEM-COMPLETE-REPORT.md** for:

- Complete implementation details
- All API endpoints
- File structure
- Security details
- Production deployment guide

---

## 🎉 READY TO TEST!

**Everything is set up and waiting for you.**

1. Start dev server: `npm run dev`
2. Open browser: `http://localhost:3000`
3. Login with any test user above
4. Create transfers and watch the magic happen!

🔄 To Switch Back to Full Workflow Later:

Run this command:
node set-simple-workflow.js
Then manually update the database or use Prisma Studio to change transfer_workflow_mode back to 'full'.

📁 Files Created/Modified:

1. ✅ src/app/api/business-settings/route.ts - API for getting/setting workflow mode
2. ✅ src/app/dashboard/transfers/[id]/page.tsx - Added simplified workflow logic
3. ✅ set-simple-workflow.js - Script to toggle workflow mode
4. ✅ Database updated - transferWorkflowMode set to 'simple'

**Good luck with testing!** 🚀
