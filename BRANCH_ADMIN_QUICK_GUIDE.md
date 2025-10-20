# Branch Admin Role - Quick Reference Guide

**Updated:** 2025-10-19
**Status:** Supervisory Role (No Transactional Operations)

---

## What Changed? (One Sentence)

**Branch Admin can no longer CREATE transactions but can APPROVE all of them.**

---

## Quick Comparison

| Action | Before | After |
|--------|--------|-------|
| Create Sales | ✅ | ❌ (Cashiers only) |
| Create Purchases | ✅ | ❌ (Managers/Accounting) |
| Create Transfers | ✅ | ❌ (Managers only) |
| Approve Purchases | ✅ | ✅ (Primary responsibility) |
| Approve Transfers | ✅ | ✅ (Primary responsibility) |
| Approve Returns | ✅ | ✅ (Primary responsibility) |
| View All Reports | ✅ | ✅ (Full access) |
| Manage Products | ✅ | ✅ (Full CRUD) |
| Manage Users | ✅ | ✅ (Full CRUD) |
| Manage Settings | ✅ | ✅ (Full access) |

---

## What Branch Admin CAN Do (Supervisory Functions)

### ✅ Master Data Management (Full Control)
- Create/edit/delete **Products**
- Create/edit/delete **Categories**, **Brands**, **Units**, **Warranties**
- Create/edit/delete **Customers** and **Suppliers**
- Create/edit/delete **Users** and assign roles
- Create/edit **Business Locations**

### ✅ Approval & Oversight (Primary Responsibility)
- **Approve** all purchase orders
- **Approve** all goods receipts (GRN)
- **Approve** all stock transfers
- **Approve** all inventory corrections
- **Approve** all customer returns
- **Approve** all supplier returns
- **Approve** all payments
- **Approve** large cash transactions
- **Approve** void/cancel requests

### ✅ Reporting & Analytics (Full Access)
- View all **Sales Reports**
- View all **Purchase Reports**
- View all **Inventory Reports**
- View all **Financial Reports**
- View **Profitability Analysis**
- View **Audit Logs**

### ✅ Quality Control
- Conduct **QC Inspections**
- Approve/reject inspection results
- Manage **QC Templates**

### ✅ System Administration
- Edit **Business Settings**
- Manage **Locations**
- View all user **Shifts**
- Generate **BIR Readings** (X and Z)

---

## What Branch Admin CANNOT Do (Operational Work)

### ❌ Sales/POS Operations
- Cannot create POS sales (Cashiers do this)
- Cannot update/delete sales (View only)
- Cannot open/close shifts (Cashiers do this)

### ❌ Purchase Operations
- Cannot create purchase orders (Managers/Accounting do this)
- Cannot create goods receipts/GRN (Warehouse staff do this)
- Cannot create purchase returns (Accounting does this)

### ❌ Inventory Operations
- Cannot create stock transfers (Managers do this)
- Cannot create inventory corrections (Managers do this)

### ❌ Financial Operations
- Cannot create expenses (Managers/Accounting do this)
- Cannot create/edit bank accounts (Accounting does this)
- Cannot create bank transactions (Accounting does this)
- Cannot create accounts payable (Accounting does this)
- Cannot create payments (Accounting does this)

---

## Typical Daily Workflow

### Morning (8:00 AM)
1. Login and check dashboard
2. Review **pending approvals**:
   - Purchase orders waiting for approval
   - Stock transfers pending send/receive
   - Inventory corrections pending review
3. Generate **X Reading** to start day

### During the Day
4. **Approve** purchase orders submitted by Branch Manager
5. **Review and approve** stock transfers between locations
6. **Approve** customer returns processed by cashiers
7. **Monitor** sales performance via reports
8. **Investigate** any inventory discrepancies before approving corrections

### End of Day (6:00 PM)
9. Review all pending approvals and clear queue
10. Generate **Z Reading** for BIR compliance
11. Review **audit logs** for the day
12. Check **profitability reports**

---

## Who Does What Now?

| Task | Who Creates | Who Approves |
|------|------------|--------------|
| **Sales** | Cashier | (No approval needed) |
| **Purchase Orders** | Manager/Accounting | **Branch Admin** |
| **Goods Receipts (GRN)** | Warehouse Staff | **Branch Admin** |
| **Stock Transfers** | Manager | **Branch Admin** |
| **Inventory Corrections** | Manager | **Branch Admin** |
| **Customer Returns** | Cashier | **Branch Admin** |
| **Supplier Returns** | Accounting | **Branch Admin** |
| **Expenses** | Manager/Accounting | (No approval needed) |
| **Payments** | Accounting | **Branch Admin** |
| **Products** | **Branch Admin** | (No approval needed) |
| **Users** | **Branch Admin** | (No approval needed) |

---

## Permission Count

| Category | Count |
|----------|-------|
| **Total Permissions** | 111 |
| Master Data CRUD | 40 |
| Approval/Supervisory | 25 |
| View/Report Access | 35 |
| System Administration | 11 |

---

## Migration Steps

### For System Administrators

1. **Update Code** (Already Done)
   - File `src/lib/rbac.ts` has been updated
   - New permissions reflect supervisory role

2. **Update Database**
   ```bash
   # Option A: Full re-seed (demo environments)
   npm run db:seed

   # Option B: Targeted update (production)
   node scripts/update-branch-admin-permissions.mjs
   ```

3. **Notify Users**
   - Send email to all Branch Admin users
   - Explain the changes
   - Provide this guide

4. **Ask Users to Logout/Login**
   - Session must be refreshed to get new permissions

5. **Verify in UI**
   - Login as Branch Admin
   - Confirm CREATE buttons are hidden
   - Confirm APPROVE buttons are visible

### For Branch Admin Users

1. **Logout** of the system
2. **Login** again
3. **Notice the changes:**
   - "Create Sale" button is gone (POS page)
   - "Create Purchase" button is gone (Purchases page)
   - "Create Transfer" button is gone (Transfers page)
   - "Approve" buttons are now prominent
4. **Adjust workflow:**
   - Ask Managers to create purchases/transfers
   - You will approve them
   - Continue managing products/users as before

---

## Example Scenarios

### Scenario 1: Need to Order Stock

**BEFORE (Wrong):**
1. Branch Admin creates purchase order
2. Branch Admin approves own purchase order
3. (No oversight!)

**AFTER (Correct):**
1. Branch Manager creates purchase order
2. Branch Admin reviews and approves
3. (Proper separation of duties!)

---

### Scenario 2: Stock Transfer Between Branches

**BEFORE (Wrong):**
1. Branch Admin creates transfer
2. Branch Admin approves transfer
3. (Self-approval!)

**AFTER (Correct):**
1. Branch Manager creates transfer request
2. Branch Admin reviews stock levels and approves
3. Branch Admin marks transfer as sent
4. Receiving location confirms receipt
5. Branch Admin finalizes transfer
6. (Full oversight!)

---

### Scenario 3: Physical Count Shows Discrepancy

**BEFORE (Wrong):**
1. Branch Admin creates correction
2. Branch Admin approves own correction
3. (Risk of manipulation!)

**AFTER (Correct):**
1. Branch Manager creates correction request
2. Branch Admin investigates the discrepancy
3. Branch Admin verifies count records
4. Branch Admin approves or rejects correction
5. (Accountability!)

---

## Benefits of the Change

### For the Business
✅ **Better Security** - Separation of duties prevents fraud
✅ **Clearer Audit Trail** - Who did what is always clear
✅ **Compliance** - Meets SOD (Segregation of Duties) requirements
✅ **Accountability** - Creator and approver are different people

### For Branch Admin
✅ **Clearer Role** - Focus on supervision, not operations
✅ **Less Daily Work** - No need to do transactional data entry
✅ **More Oversight** - Better visibility into all operations
✅ **Strategic Focus** - More time for analysis and decision-making

---

## Troubleshooting

### Problem: I can't create a purchase order anymore

**Solution:** This is correct! Ask your Branch Manager or Accounting Staff to create it. You will approve it.

---

### Problem: I can't create a stock transfer

**Solution:** This is correct! Ask your Branch Manager to create the transfer request. You will approve and manage the send/receive process.

---

### Problem: I can't see the "Approve" button

**Solution:**
1. Logout and login again (refresh session)
2. Check if the transaction is in "Pending Approval" status
3. Verify your role hasn't been changed (check with Super Admin)

---

### Problem: I need to create a product

**Solution:** You still can! Product management is part of your role. Go to Products → Create Product.

---

### Problem: I need to add a new user

**Solution:** You still can! User management is part of your role. Go to Users → Create User.

---

## Need Help?

- **Full Documentation:** `BRANCH_ADMIN_RECONFIGURATION_REPORT.md`
- **Technical Details:** `src/lib/rbac.ts` (lines 437-629)
- **Update Script:** `scripts/update-branch-admin-permissions.mjs`
- **Support:** Contact your system administrator

---

## Summary in 3 Sentences

1. **Branch Admin is now a supervisor role** - you approve work done by others.
2. **You can no longer create transactions** (sales, purchases, transfers) - operational staff do this.
3. **You retain full control** over products, users, settings, and reporting.

---

**Remember:** Your role is to **supervise, approve, and oversee** - not to perform daily transactions.
