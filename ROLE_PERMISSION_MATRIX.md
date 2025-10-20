# Complete Role Permission Matrix

**Updated:** 2025-10-19
**Version:** 2.0 (Post Branch Admin Reconfiguration)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Full CRUD (Create, Read, Update, Delete) |
| 👁️ | View Only (Read) |
| ✔️ | Approve/Execute (Supervisory action) |
| 🔒 | Own records only (limited access) |
| ❌ | No Access |

---

## 1. SALES & POS OPERATIONS

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **Create Sales** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **View Sales** | ✅ | 👁️ (all) | 👁️ (all) | 👁️ (all) | 🔒 (own) |
| **Update Sales** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Delete Sales** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Void Sales** | ✅ | ✔️ | ✔️ | ❌ | ✔️ (create) |
| **Refund/Returns** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Open Shift** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Close Shift** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **View All Shifts** | ✅ | 👁️ | 👁️ | ❌ | 🔒 (own) |
| **Cash In/Out** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Cash Count** | ✅ | ❌ | ✅ | ❌ | ✅ |
| **Approve Large Cash** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **X Reading** | ✅ | ✔️ | ✔️ | ❌ | ✔️ |
| **Z Reading** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Freebies Add** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **Freebies Approve** | ✅ | ✔️ | ✔️ | ❌ | ❌ |

---

## 2. PURCHASE MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **Create Purchase Order** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **View Purchase Orders** | ✅ | 👁️ | 👁️ | 👁️ | ❌ |
| **Update Purchase Order** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Delete Purchase Order** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Approve Purchase Order** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Receive Purchase** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **View Purchase Cost** | ✅ | 👁️ | ❌ | 👁️ | ❌ |
| **Create GRN** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **View GRN** | ✅ | 👁️ | 👁️ | 👁️ | ❌ |
| **Approve GRN** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Create Purchase Return** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **View Purchase Return** | ✅ | 👁️ | 👁️ | 👁️ | ❌ |
| **Update Purchase Return** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Approve Purchase Return** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Create Purchase Amendment** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Approve Purchase Amendment** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Reject Purchase Amendment** | ✅ | ✔️ | ❌ | ❌ | ❌ |

---

## 3. INVENTORY MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **Create Stock Transfer** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **View Stock Transfer** | ✅ | 👁️ | 👁️ | ❌ | ❌ |
| **Check Transfer** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Send Transfer** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Receive Transfer** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Verify Transfer** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Complete Transfer** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Cancel Transfer** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Create Inventory Correction** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **View Inventory Correction** | ✅ | 👁️ | 👁️ | ❌ | ❌ |
| **Update Inventory Correction** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Approve Inventory Correction** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Delete Inventory Correction** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Export Physical Inventory** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Import Physical Inventory** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **View Inventory Ledger** | ✅ | 👁️ | 👁️ | 👁️ | ❌ |
| **Export Inventory Ledger** | ✅ | ✔️ | ❌ | ✔️ | ❌ |

---

## 4. PRODUCT MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **Create Product** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **View Product** | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| **Update Product** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Product** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Purchase Price** | ✅ | 👁️ | ❌ | 👁️ | ❌ |
| **Set Opening Stock** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Lock Opening Stock** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Unlock Opening Stock** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **Modify Locked Stock** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **View All Branch Stock** | ✅ | 👁️ | ❌ | ❌ | ❌ |
| **Access Default Selling Price** | ✅ | ✔️ | ✔️ | ❌ | ❌ |

---

## 5. PRODUCT MASTER DATA

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **Categories CRUD** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Brands CRUD** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Units CRUD** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Warranties CRUD** | ✅ | ✅ | 👁️ | ❌ | ❌ |

---

## 6. CUSTOMER & SUPPLIER MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **Create Customer** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **View Customer** | ✅ | ✅ | ✅ | 👁️ | 👁️ |
| **Update Customer** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Delete Customer** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create Supplier** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **View Supplier** | ✅ | ✅ | ✅ | 👁️ | ❌ |
| **Update Supplier** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Delete Supplier** | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 7. RETURNS & REFUNDS

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View Customer Return** | ✅ | 👁️ | ❌ | ❌ | ❌ |
| **Create Customer Return** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Approve Customer Return** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **Delete Customer Return** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **View Supplier Return** | ✅ | 👁️ | ❌ | ❌ | ❌ |
| **Create Supplier Return** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Approve Supplier Return** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **Delete Supplier Return** | ✅ | ✔️ | ❌ | ❌ | ❌ |

---

## 8. QUALITY CONTROL

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View QC Inspection** | ✅ | 👁️ | 👁️ | ❌ | ❌ |
| **Create QC Inspection** | ✅ | ❌ | ✅ | ❌ | ❌ |
| **Conduct QC Inspection** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **Approve QC Inspection** | ✅ | ✔️ | ✔️ | ❌ | ❌ |
| **View QC Template** | ✅ | 👁️ | 👁️ | ❌ | ❌ |
| **Manage QC Template** | ✅ | ✔️ | ❌ | ❌ | ❌ |

---

## 9. FINANCIAL MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View Accounts Payable** | ✅ | 👁️ | 👁️ | ✅ | ❌ |
| **Create Accounts Payable** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Update Accounts Payable** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Delete Accounts Payable** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **View Payment** | ✅ | 👁️ | 👁️ | ✅ | ❌ |
| **Create Payment** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Approve Payment** | ✅ | ✔️ | ❌ | ✔️ | ❌ |
| **Update Payment** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Delete Payment** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **View Bank** | ✅ | 👁️ | ❌ | ✅ | ❌ |
| **Create Bank** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Update Bank** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Delete Bank** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **View Bank Transaction** | ✅ | 👁️ | 👁️ | ✅ | ❌ |
| **Create Bank Transaction** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Update Bank Transaction** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **Delete Bank Transaction** | ✅ | ❌ | ❌ | ✅ | ❌ |
| **View Expense** | ✅ | 👁️ | ✅ | ✅ | ❌ |
| **Create Expense** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Update Expense** | ✅ | ❌ | ✅ | ✅ | ❌ |
| **Delete Expense** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 10. USER & ROLE MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View Users** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Create Users** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Update Users** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete Users** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Create Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Update Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete Roles** | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 11. BUSINESS & LOCATION MANAGEMENT

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View Business Settings** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Edit Business Settings** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **View Locations** | ✅ | ✅ | 👁️ | ❌ | ❌ |
| **Create Locations** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Update Locations** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Delete Locations** | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Access All Locations** | ✅ | ✔️ | ❌ | ❌ | ❌ |

---

## 12. REPORTS & ANALYTICS

### Sales Reports

| Report | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|--------|------------|--------------|----------------|------------|---------|
| **Sales Report - View** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Daily** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Today** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Sales Report - History** | ✅ | ✅ | ✅ | ❌ | ✅ |
| **Sales Report - Summary** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Journal** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Per Item** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Per Cashier** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Per Location** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Sales Report - Analytics** | ✅ | ✅ | ✅ | ❌ | 🔒 (own) |
| **Sales Report - Customer Analysis** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Sales Report - Payment Method** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Sales Report - Discount Analysis** | ✅ | ✅ | ❌ | ❌ | ❌ |

### Purchase Reports

| Report | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|--------|------------|--------------|----------------|------------|---------|
| **Purchase Report - View** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Purchase Report - Analytics** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Purchase Report - Trends** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Purchase Report - Items** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Purchase Report - History** | ✅ | ✅ | ❌ | ✅ | ❌ |

### Inventory Reports

| Report | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|--------|------------|--------------|----------------|------------|---------|
| **Stock Report - View** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Stock Report - Alert** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Inventory Ledger - View** | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Inventory Ledger - Export** | ✅ | ✔️ | ❌ | ✔️ | ❌ |
| **Inventory Reports - View** | ✅ | ✅ | ❌ | ✅ | ❌ |

### Financial Reports

| Report | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|--------|------------|--------------|----------------|------------|---------|
| **Profit/Loss Report** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Profitability Report** | ✅ | ✅ | ❌ | ✅ | ❌ |
| **Product Purchase History** | ✅ | ✅ | ❌ | ✅ | ❌ |

### Transfer Reports

| Report | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|--------|------------|--------------|----------------|------------|---------|
| **Transfer Report - View** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Transfer Report - Trends** | ✅ | ✅ | ✅ | ❌ | ❌ |

---

## 13. SERIAL NUMBER TRACKING

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View Serial Numbers** | ✅ | 👁️ | ❌ | ❌ | ❌ |
| **Track Serial Numbers** | ✅ | ✔️ | ❌ | ❌ | ❌ |
| **Scan Serial Numbers** | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 14. AUDIT & COMPLIANCE

| Feature | Super Admin | Branch Admin | Branch Manager | Accounting | Cashier |
|---------|------------|--------------|----------------|------------|---------|
| **View Audit Logs** | ✅ | 👁️ | ❌ | ❌ | ❌ |

---

## Role Summary

| Role | Total Permissions | Primary Responsibility |
|------|------------------|----------------------|
| **Super Admin** | ALL | Platform management across all businesses |
| **Branch Admin** | 135 | Supervise operations, approve transactions, manage master data |
| **Branch Manager** | 95 | Daily operations, create transactions, manage inventory |
| **Accounting Staff** | 47 | Financial operations, purchase management, cost tracking |
| **Cashier** | 27 | POS operations, customer service, own sales only |

---

## Key Differences: Branch Admin vs Branch Manager

| Aspect | Branch Admin | Branch Manager |
|--------|-------------|----------------|
| **Philosophy** | Supervisor & Approver | Operator & Creator |
| **Sales** | View only | Create/Edit/Delete |
| **Purchases** | View + Approve | Create/Edit + Approve |
| **Transfers** | View + Approve | Create + Approve |
| **Corrections** | View + Approve | Create + Approve |
| **Products** | Full CRUD | Full CRUD |
| **Categories/Brands** | Full CRUD | View only |
| **Users** | Full CRUD | View only |
| **Settings** | Full access | No access |
| **Financial Reports** | Full access | Limited access |
| **Shifts** | View all | Open/Close own |

---

**Generated:** 2025-10-19
**Version:** 2.0 (Post Reconfiguration)
**Source:** `src/lib/rbac.ts`
