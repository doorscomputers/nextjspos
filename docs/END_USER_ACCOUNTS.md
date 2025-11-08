# End User Testing Accounts - PCInet Computer Trading and Services

## Overview

This document lists all user accounts available for testing the multi-tenant POS system. Each user has specific roles and permissions designed to match real-world job functions across different business locations.

**All passwords are temporary and should be changed after first login in production.**

---

## 🏢 Business Locations

1. **Main Store** - Solano Nueva Vizcaya
2. **Warehouse** - Solano Nueva Vizcaya
3. **Bambang** - Bambang, Nueva Vizcaya
4. **Tuguegarao** - Tuguegarao, Cagayan

---

## 👥 User Accounts by Role

### 🔐 Administrative Accounts

| Username      | Password   | Role                 | Access Level      | Description                                    |
| ------------- | ---------- | -------------------- | ----------------- | ---------------------------------------------- |
| `superadmin`  | `password` | System Administrator | **ALL LOCATIONS** | Full system access - platform owner            |
| `pcinetadmin` | `password` | All Branch Admin     | **ALL LOCATIONS** | Full administrative access across all branches |

**Capabilities**: Complete control over system, users, roles, settings, inventory, sales, purchases, and reports.

---

### 💼 Warehouse & Inventory Management

#### Warehouse Manager

| Username  | Password   | Location      | Role              | Description                                                 |
| --------- | ---------- | ------------- | ----------------- | ----------------------------------------------------------- |
| `Jheiron` | `password` | **Warehouse** | Warehouse Manager | Full warehouse operations - receiving, transfers, inventory |

**Capabilities**:

- ✅ Receive purchase orders
- ✅ Create and manage stock transfers
- ✅ Create inventory corrections (requires approval)
- ✅ View all branch stock levels
- ✅ Quality control operations
- ✅ Supplier returns

**Note**: Cannot approve own inventory corrections (separation of duties) - use `invcorApprover` account to approve.

---

### 🔢 Inventory Correction Accounts (Physical Stock Counting)

**Purpose**: Location-specific users for conducting physical inventory counts with proper approval workflow.

#### Inventory Counters (Create corrections only)

| Username        | Password | Location                | Role              | Description                              |
| --------------- | -------- | ----------------------- | ----------------- | ---------------------------------------- |
| `invcormain`    | `111111` | **Main Store**          | Inventory Counter | Physical stock counter - Main Store only |
| `invcorbambang` | `111111` | **Bambang**             | Inventory Counter | Physical stock counter - Bambang only    |
| `invcortugue`   | `111111` | **Tuguegarao Downtown** | Inventory Counter | Physical stock counter - Tuguegarao only |

**Capabilities**:

- ✅ Create inventory corrections for assigned location only
- ✅ Update pending corrections
- ✅ View products and inventory
- ❌ **CANNOT approve** own corrections (separation of duties)

#### Inventory Correction Approver (Approve only)

| Username         | Password | Location          | Role                          | Description                             |
| ---------------- | -------- | ----------------- | ----------------------------- | --------------------------------------- |
| `invcorApprover` | `111111` | **ALL LOCATIONS** | Inventory Correction Approver | Approves corrections from all locations |

**Capabilities**:

- ✅ Approve inventory corrections from ALL locations
- ✅ Delete corrections if needed
- ✅ View all stock reports
- ❌ **CANNOT create** corrections (separation of duties)

**Workflow Example**:

1. Login as `invcormain` → Count stock → Create correction → Status: Pending
2. Logout, login as `invcorApprover` → Review → Click "Approve" → Inventory updated

---

### 💰 Cashier Accounts (Sales & POS)

**Purpose**: Point-of-sale operations, process customer sales, handle cash.

#### Main Store Cashiers

| Username                | Password   | Location       | Role          | Description                 |
| ----------------------- | ---------- | -------------- | ------------- | --------------------------- |
| `JASMINKATECashierMain` | `password` | **Main Store** | Sales Cashier | POS operations - Main Store |
| `JOJITKATECashierMain`  | `password` | **Main Store** | Sales Cashier | POS operations - Main Store |

#### Bambang Cashiers

| Username                   | Password   | Location    | Role          | Description              |
| -------------------------- | ---------- | ----------- | ------------- | ------------------------ |
| `JASMINKATECashierBambang` | `password` | **Bambang** | Sales Cashier | POS operations - Bambang |
| `JOJITKATECashierBambang`  | `password` | **Bambang** | Sales Cashier | POS operations - Bambang |

#### Tuguegarao Downtown Cashiers

| Username                  | Password   | Location                | Role          | Description                          |
| ------------------------- | ---------- | ----------------------- | ------------- | ------------------------------------ |
| `EricsonChanCashierTugue` | `password` | **Tuguegarao Downtown** | Sales Cashier | POS operations - Tuguegarao Downtown |

**Capabilities**:

- ✅ Process sales transactions
- ✅ Open/close cash shifts
- ✅ Handle cash in/out
- ✅ Generate X-Reading and Z-Reading (BIR reports)
- ✅ Process refunds and voids (with approval)
- ✅ View own sales reports
- ❌ Cannot approve large cash transactions
- ❌ Cannot access other locations

---

### 📦 Stock Transfer Receivers

**Purpose**: Receive incoming stock transfers at destination locations.

#### Main Store Transfer Receivers

| Username                         | Password   | Location       | Role              | Description                    |
| -------------------------------- | ---------- | -------------- | ----------------- | ------------------------------ |
| `JASMINKATETransferReceiverMain` | `password` | **Main Store** | Transfer Receiver | Receive transfers - Main Store |
| `JOJITKATETransferReceiverMain`  | `password` | **Main Store** | Transfer Receiver | Receive transfers - Main Store |

#### Bambang Transfer Receivers

| Username                            | Password   | Location    | Role              | Description                 |
| ----------------------------------- | ---------- | ----------- | ----------------- | --------------------------- |
| `JASMINKATETransferReceiverBambang` | `password` | **Bambang** | Transfer Receiver | Receive transfers - Bambang |
| `JOJITKATETransferReceiverBambang`  | `password` | **Bambang** | Transfer Receiver | Receive transfers - Bambang |

#### Tuguegarao Downtown Transfer Receivers

| Username                           | Password   | Location                | Role              | Description                             |
| ---------------------------------- | ---------- | ----------------------- | ----------------- | --------------------------------------- |
| `EricsonChanTransferReceiverTugue` | `password` | **Tuguegarao Downtown** | Transfer Receiver | Receive transfers - Tuguegarao Downtown |

**Capabilities**:

- ✅ View incoming transfers to their location
- ✅ Receive and verify stock transfers
- ✅ Scan serial numbers (if applicable)
- ✅ Update transfer status to "Received"
- ❌ Cannot create or send transfers
- ❌ Cannot access other locations

---

### 💵 Price Management Accounts

**Purpose**: Manage product pricing for specific locations.

| Username          | Password   | Location                | Role          | Description                           |
| ----------------- | ---------- | ----------------------- | ------------- | ------------------------------------- |
| `PriceMgrMain`    | `password` | **Main Store**          | Price Manager | Pricing control - Main Store          |
| `PriceMgrBambang` | `password` | **Bambang**             | Price Manager | Pricing control - Bambang             |
| `PriceMgrTugue`   | `password` | **Tuguegarao Downtown** | Price Manager | Pricing control - Tuguegarao Downtown |

**Capabilities**:

- ✅ View and edit product prices for assigned location
- ✅ Bulk price updates
- ✅ Export price lists
- ✅ View cost prices and profit margins
- ✅ Access pricing settings and alerts
- ✅ View inventory reports
- ❌ Cannot edit inventory quantities
- ❌ Cannot access other locations

---

## 📋 Quick Reference - User Credentials Table

### Administrative & Warehouse

| Username    | Password | Location  |
| ----------- | -------- | --------- |
| superadmin  | password | All       |
| pcinetadmin | password | All       |
| Jheiron     | password | Warehouse |

### Inventory Correction

| Username       | Password | Location            |
| -------------- | -------- | ------------------- |
| invcormain     | 111111   | Main Store          |
| invcorbambang  | 111111   | Bambang             |
| invcortugue    | 111111   | Tuguegarao Downtown |
| invcorApprover | 111111   | All Locations       |

### Cashiers

| Username                 | Password | Location            |
| ------------------------ | -------- | ------------------- |
| JASMINKATECashierMain    | password | Main Store          |
| JOJITKATECashierMain     | password | Main Store          |
| JASMINKATECashierBambang | password | Bambang             |
| JOJITKATECashierBambang  | password | Bambang             |
| EricsonChanCashierTugue  | password | Tuguegarao Downtown |

### Transfer Receivers

| Username                          | Password | Location            |
| --------------------------------- | -------- | ------------------- |
| JASMINKATETransferReceiverMain    | password | Main Store          |
| JOJITKATETransferReceiverMain     | password | Main Store          |
| JASMINKATETransferReceiverBambang | password | Bambang             |
| JOJITKATETransferReceiverBambang  | password | Bambang             |
| EricsonChanTransferReceiverTugue  | password | Tuguegarao Downtown |

### Price Managers

| Username        | Password | Location            |
| --------------- | -------- | ------------------- |
| PriceMgrMain    | password | Main Store          |
| PriceMgrBambang | password | Bambang             |
| PriceMgrTugue   | password | Tuguegarao Downtown |

---

## 🔒 Security & Best Practices

### Password Policy (For Production)

1. **Change default passwords immediately** after first login
2. Use strong passwords (minimum 12 characters, mixed case, numbers, symbols)
3. Never share credentials between multiple people
4. Unique password for each user account
5. Enable two-factor authentication (if available)

### User Account Rules

1. **One person, one account** - do not share login credentials
2. **Log out when finished** - especially on shared devices
3. **Report suspicious activity** immediately to administrator
4. **Location-specific users** cannot access other locations (by design)
5. **Separation of duties** enforced (e.g., counters cannot approve own corrections)

### Audit Trail

All actions are logged with:

- User who performed the action
- Date and time
- Location
- What was changed (before/after values)

---

## 📱 Testing Scenarios

### Scenario 1: Complete Sales Transaction (Cashier)

**User**: `JASMINKATECashierMain` / `password`

1. Login → Dashboard
2. Navigate to: **Sales → POS**
3. Open shift (record beginning cash)
4. Add products to cart
5. Process payment (cash, card, or mixed)
6. Print receipt
7. Close shift at end of day
8. Generate Z-Reading report

---

### Scenario 2: Physical Inventory Count Workflow

**Users**: `invcormain` / `111111` AND `invcorApprover` / `111111`

**Step 1 - Count Stock** (as invcormain):

1. Login → Dashboard
2. Navigate to: **Inventory → Inventory Corrections → New Correction**
3. Select product (e.g., "Dell Inspiron 15 Laptop")
4. Location: **Main Store** (auto-selected, cannot change)
5. System Count: Shows current quantity (e.g., 15 units)
6. Physical Count: Enter actual counted quantity (e.g., 12 units)
7. Difference: -3 units (automatic calculation)
8. Reason: "Count Error" or "Missing"
9. Click "Create Correction" → Status: **Pending**
10. Logout

**Step 2 - Approve Correction** (as invcorApprover):

1. Login → Dashboard
2. Navigate to: **Inventory → Inventory Corrections**
3. See corrections from ALL locations
4. Find the Main Store correction created earlier
5. Click green "Approve" button
6. Inventory updated: 15 → 12 units
7. Status: **Approved**
8. Product history records the adjustment

---

### Scenario 3: Stock Transfer Between Locations

**Users**: Warehouse Manager + Transfer Receiver

**Step 1 - Create Transfer** (as Jheiron - Warehouse Manager):

1. Login → Dashboard
2. Navigate to: **Inventory → Stock Transfers → New Transfer**
3. From Location: **Warehouse** (auto-selected)
4. To Location: **Bambang**
5. Add products with quantities
6. Click "Create Transfer" → Status: **Pending**

**Step 2 - Receive Transfer** (as JASMINKATETransferReceiverBambang):

1. Login → Dashboard
2. Navigate to: **Inventory → Stock Transfers**
3. See incoming transfer from Warehouse
4. Click "Receive" button
5. Verify quantities received
6. Click "Confirm Receipt"
7. Inventory at Bambang updated automatically
8. Status: **Completed**

---

### Scenario 4: Price Management

**User**: `PriceMgrMain` / `password`

1. Login → Dashboard
2. Navigate to: **Products → Products List**
3. Select product → Click "Edit Price"
4. Update selling price for Main Store
5. View profit margin calculation
6. Save changes
7. Export price list to Excel

---

## 🆘 Troubleshooting

### Problem: Cannot login

**Solution**:

- Verify username is typed exactly as shown (case-sensitive)
- Check password (default: `password` or `111111` depending on user)
- Contact administrator if account locked

### Problem: Cannot see menu items

**Cause**: User does not have permission for that menu
**Solution**: This is by design - users only see menus they have access to based on their role

### Problem: Cannot access certain location

**Cause**: User is assigned to specific location only
**Solution**: Use correct user for that location (e.g., use `invcorbambang` for Bambang, not `invcormain`)

### Problem: Cannot approve inventory correction

**Cause**: User has "Counter" role, not "Approver" role
**Solution**: Login as `invcorApprover` to approve corrections

### Problem: Warehouse Manager cannot approve corrections

**Cause**: Separation of duties enforced - same person cannot count and approve
**Solution**: Use `invcorApprover` account, OR administrator can assign both roles if needed

---

## 📞 Support Contact

For technical issues or questions:

- **System Administrator**: Contact via email/phone
- **Documentation**: See `/docs` folder for detailed guides
- **Emergency Access**: Super Admin account (`superadmin`)

---

## 📝 Notes for Administrators

### Adding New Users

1. Login as `superadmin` or `pcinetadmin`
2. Navigate to: **Settings → Users → Add User**
3. Fill in user details
4. Assign appropriate role(s)
5. Assign location(s)
6. Set temporary password
7. Instruct user to change password on first login

### Modifying User Permissions

1. Navigate to: **Settings → Users**
2. Find user → Click "Edit"
3. Change role assignments
4. Add/remove location assignments
5. Save changes

### Viewing Audit Logs

1. Navigate to: **Reports → Audit Logs**
2. Filter by user, date range, action type
3. Export for compliance purposes

---

**Document Version**: 1.0
**Last Updated**: 2025-11-08
**System**: PCInet Computer Store - UltimatePOS Modern
**Environment**: Testing/Development
