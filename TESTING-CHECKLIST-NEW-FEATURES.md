# 🧪 Testing Checklist - New Features

## 📋 Overview

Test the following new features that were just implemented:
1. **Cost Visibility Permission** - Control who can see purchase costs
2. **User Profile & Password Change** - Allow users to change their own passwords
3. **Payment & PDC Menus** - Complete purchase-to-pay workflow

---

## ✅ Test 1: Login and Session Refresh

**Purpose:** Verify permissions are loaded correctly after login

### Steps:
1. ✅ **Logout** from current session (click user icon → Sign out)
2. ✅ **Login** as Jheirone (Warehouse Manager)
3. ✅ Wait for dashboard to load

### Expected Results:
- ✅ Dashboard loads successfully
- ✅ User name displayed: "Terre Jheirone Terre"
- ✅ Role shown: "Warehouse Manager"

---

## ✅ Test 2: Purchases Menu - All 5 Submenus

**Purpose:** Verify all purchase submenus are visible

### Steps:
1. ✅ Look at left sidebar
2. ✅ Find "Purchases" menu item
3. ✅ Click the arrow to expand Purchases dropdown
4. ✅ Count the submenu items

### Expected Results:
You should see **EXACTLY 5 submenu items**:
1. ✅ Purchase Orders
2. ✅ Goods Received (GRN)
3. ✅ Accounts Payable
4. ✅ **Payments** ← NEW!
5. ✅ **Post-Dated Cheques** ← NEW!

**❌ If you only see 3 items** → You need to logout and login again!

---

## ✅ Test 3: My Profile Menu Item

**Purpose:** Verify profile page is accessible

### Steps:
1. ✅ Scroll through the left sidebar
2. ✅ Find "My Profile" (should be between "Suppliers" and "Stock Transfers")
3. ✅ Click on "My Profile"
4. ✅ Profile page should load

### Expected Results:
- ✅ "My Profile" menu item exists in sidebar
- ✅ Has a user circle icon (👤)
- ✅ Clicking it opens `/dashboard/profile` page
- ✅ Page shows two main sections:
  - Account Information (read-only)
  - Change Password (form)

---

## ✅ Test 4: Profile Page - Account Information

**Purpose:** Verify user information is displayed correctly

### Steps:
1. ✅ Click "My Profile" in sidebar
2. ✅ Look at "Account Information" section

### Expected Results:
- ✅ **Name:** Jheirone Terre (or your actual name)
- ✅ **Username:** Jheirone
- ✅ **Email:** (your email or "Not set")
- ✅ **Role:** Warehouse Manager

**All fields should be read-only (not editable)**

---

## ✅ Test 5: Password Change - Success Case

**Purpose:** Verify password can be changed successfully

### Steps:
1. ✅ On Profile page, scroll to "Change Password" section
2. ✅ Fill in the form:
   - **Current Password:** (your current password)
   - **New Password:** `newpass123`
   - **Confirm New Password:** `newpass123`
3. ✅ Click "Change Password" button
4. ✅ Wait for response

### Expected Results:
- ✅ Success message appears: "Password changed successfully"
- ✅ Form fields are cleared
- ✅ No errors displayed

### Verify:
5. ✅ Logout
6. ✅ Try logging in with OLD password → Should FAIL
7. ✅ Login with NEW password (`newpass123`) → Should SUCCEED

**⚠️ Important:** Remember to change it back to your original password after testing!

---

## ✅ Test 6: Password Change - Validation Errors

**Purpose:** Verify password validation works

### Test 6.1: Passwords Don't Match
1. ✅ Current Password: (your password)
2. ✅ New Password: `password123`
3. ✅ Confirm Password: `different456`
4. ✅ Click "Change Password"
5. ✅ **Expected:** Error message "New passwords do not match"

### Test 6.2: Wrong Current Password
1. ✅ Current Password: `wrongpassword`
2. ✅ New Password: `newpass123`
3. ✅ Confirm Password: `newpass123`
4. ✅ Click "Change Password"
5. ✅ **Expected:** Error message "Current password is incorrect"

### Test 6.3: Password Too Short
1. ✅ Current Password: (your password)
2. ✅ New Password: `abc` (only 3 characters)
3. ✅ Confirm Password: `abc`
4. ✅ Try to submit
5. ✅ **Expected:** Browser validation prevents submit OR error message

---

## ✅ Test 7: Cost Visibility - WITH Permission

**Purpose:** Verify Warehouse Manager CAN see costs (has permission)

### Steps:
1. ✅ Go to **Purchases → Purchase Orders**
2. ✅ Click "View" on any purchase order
3. ✅ Look at the purchase details page

### Expected Results (WITH permission):
- ✅ **Unit Cost** column is visible for each item
- ✅ **Summary box** on the right shows:
  - Subtotal
  - Tax (if any)
  - Discount (if any)
  - Shipping (if any)
  - Total Amount

### Test GRN Cost Visibility:
4. ✅ Go to **Purchases → Goods Received (GRN)**
5. ✅ Click "View" on any GRN
6. ✅ Check the items table

### Expected Results (WITH permission):
- ✅ **Unit Cost** column is visible
- ✅ **Total** column is visible
- ✅ **Grand Total** in footer is visible

---

## ✅ Test 8: Cost Visibility - WITHOUT Permission

**Purpose:** Verify users without permission CANNOT see costs

### Steps:
1. ✅ Logout from Jheirone
2. ✅ Login as **"staff"** or **"cashier"** (roles without permission)
3. ✅ Go to **Purchases → Purchase Orders** (if they have access)
4. ✅ Click "View" on any purchase order

### Expected Results (WITHOUT permission):
- ❌ **Unit Cost** column is HIDDEN
- ❌ **Summary box** is HIDDEN (no subtotal, tax, total)
- ✅ Other information still visible (product name, quantities, etc.)

**Note:** If staff/cashier doesn't have purchase view permission at all, they won't see the Purchases menu.

---

## ✅ Test 9: Payments Menu

**Purpose:** Verify payments page works

### Steps:
1. ✅ Login as Jheirone
2. ✅ Go to **Purchases → Payments**
3. ✅ Page should load successfully

### Expected Results:
- ✅ "Payments" page title displayed
- ✅ Table showing payment history (may be empty if no payments yet)
- ✅ "New Payment" button visible (if has permission)
- ✅ Search and filter options available

---

## ✅ Test 10: Post-Dated Cheques Menu

**Purpose:** Verify PDC page works

### Steps:
1. ✅ Go to **Purchases → Post-Dated Cheques**
2. ✅ Page should load successfully

### Expected Results:
- ✅ "Post-Dated Cheques" page title displayed
- ✅ Summary cards at top (Upcoming, Overdue, Pending, Cleared)
- ✅ Table showing PDC list (may be empty if no PDCs yet)
- ✅ Search and filter options available

---

## ✅ Test 11: Accounts Payable Menu

**Purpose:** Verify AP page still works (was already there)

### Steps:
1. ✅ Go to **Purchases → Accounts Payable**
2. ✅ Page should load successfully

### Expected Results:
- ✅ "Accounts Payable" page title displayed
- ✅ Aging analysis cards at top (Current, 30 days, 60 days, etc.)
- ✅ Table showing unpaid invoices
- ✅ "Pay" buttons visible for each invoice

---

## 🎯 Summary Checklist

After testing everything above, verify:

### Menu Items:
- ✅ Purchases has 5 submenus (not 3)
- ✅ "My Profile" exists in main sidebar
- ✅ All menu items clickable and functional

### Cost Visibility:
- ✅ Warehouse Manager sees costs (has permission)
- ✅ Staff/Cashier cannot see costs (no permission)
- ✅ Cost columns conditionally shown/hidden

### Password Change:
- ✅ Profile page accessible
- ✅ Account info displays correctly
- ✅ Password change form works
- ✅ Validation prevents incorrect inputs
- ✅ Can login with new password

### Purchase Workflow:
- ✅ All 5 purchase submenus functional
- ✅ Can view purchase orders
- ✅ Can view GRNs
- ✅ Can view accounts payable
- ✅ Can view payments
- ✅ Can view post-dated cheques

---

## 🐛 Troubleshooting

### Issue: Only 3 submenus under Purchases
**Solution:** Logout and login again to refresh session

### Issue: "My Profile" not showing
**Solution:**
1. Refresh browser (Ctrl+R or F5)
2. If still missing, logout and login again
3. Clear browser cache

### Issue: Password change doesn't work
**Solution:**
1. Check browser console for errors (F12)
2. Verify server is running on port 3001
3. Check network tab for API response

### Issue: Costs not hiding for staff
**Solution:**
1. Verify staff role doesn't have `purchase.view_cost` permission
2. Logout and login as staff
3. Check Roles & Permissions page to confirm

---

## 📊 Test Results Summary

Fill this out after testing:

| Test | Status | Notes |
|------|--------|-------|
| 1. Login/Session | ⬜ Pass / ⬜ Fail | |
| 2. Purchases 5 Submenus | ⬜ Pass / ⬜ Fail | |
| 3. My Profile Menu | ⬜ Pass / ⬜ Fail | |
| 4. Account Info Display | ⬜ Pass / ⬜ Fail | |
| 5. Password Change Success | ⬜ Pass / ⬜ Fail | |
| 6. Password Validation | ⬜ Pass / ⬜ Fail | |
| 7. Cost Visible (WITH perm) | ⬜ Pass / ⬜ Fail | |
| 8. Cost Hidden (NO perm) | ⬜ Pass / ⬜ Fail | |
| 9. Payments Page | ⬜ Pass / ⬜ Fail | |
| 10. PDC Page | ⬜ Pass / ⬜ Fail | |
| 11. AP Page | ⬜ Pass / ⬜ Fail | |

---

## 🎉 Success Criteria

**All features are working correctly if:**
- ✅ All 11 tests pass
- ✅ No console errors
- ✅ All menus accessible
- ✅ Password change functional
- ✅ Cost visibility works as expected
- ✅ Session refresh shows all new menus

---

**Good luck with testing! Let me know which tests pass/fail.** 🚀
