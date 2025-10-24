# RBAC Roles Quick Reference Guide

## Task-Specific Granular Roles

This document provides a quick reference for all available roles in the UltimatePOS system after the RBAC redesign.

---

## Category 1: Administrative Roles (5 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `SYSTEM_ADMINISTRATOR` | System Administrator | Platform owner with full system access |
| `USER_MANAGER` | User Manager | Managing user accounts and assignments |
| `ROLE_MANAGER` | Role Manager | Creating and managing roles/permissions |
| `LOCATION_MANAGER` | Location Manager | Managing business locations/branches |
| `BUSINESS_SETTINGS_MANAGER` | Business Settings Manager | Configuring business settings |

---

## Category 2: Product & Inventory Roles (7 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `PRODUCT_CATALOG_MANAGER` | Product Catalog Manager | Managing products, categories, brands, units |
| `PRODUCT_VIEWER` | Product Viewer | View-only access to product information |
| `INVENTORY_COUNTER` | Inventory Counter | Conducting physical inventory counts |
| `INVENTORY_ADJUSTER` | Inventory Adjuster | Creating inventory adjustment requests |
| `INVENTORY_APPROVER` | Inventory Approver | Approving inventory corrections |
| `OPENING_STOCK_MANAGER` | Opening Stock Manager | Setting opening stock for products |
| `STOCK_AUDITOR` | Stock Auditor | Viewing stock across all locations |

---

## Category 3: Stock Transfer Roles (5 roles)

**Separation of Duties Implementation**

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `TRANSFER_CREATOR` | Transfer Creator | **ONLY** creating transfer requests |
| `TRANSFER_SENDER` | Transfer Sender | Checking and sending transfers from warehouse |
| `TRANSFER_RECEIVER` | Transfer Receiver | Receiving transfers at destination |
| `TRANSFER_APPROVER` | Transfer Approver | Final verification and completion |
| `TRANSFER_MANAGER` | Transfer Manager | Full transfer workflow access (all steps) |

**Transfer Workflow:**
```
1. TRANSFER_CREATOR → Creates request
2. TRANSFER_SENDER → Checks & sends from warehouse
3. TRANSFER_RECEIVER → Receives at destination
4. TRANSFER_APPROVER → Verifies & completes
```

---

## Category 4: Purchase & Procurement Roles (7 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `PURCHASE_ORDER_CREATOR` | Purchase Order Creator | Creating purchase orders |
| `PURCHASE_ORDER_APPROVER` | Purchase Order Approver | Approving purchase orders |
| `GOODS_RECEIPT_CLERK` | Goods Receipt Clerk | Receiving goods and creating GRNs |
| `GOODS_RECEIPT_APPROVER` | Goods Receipt Approver | Approving goods receipts |
| `QUALITY_INSPECTOR` | Quality Inspector | Conducting QC inspections |
| `QUALITY_APPROVER` | Quality Approver | Approving QC inspection results |
| `SUPPLIER_MANAGER` | Supplier Manager | Managing supplier information |

**Purchase Workflow:**
```
1. PURCHASE_ORDER_CREATOR → Creates PO
2. PURCHASE_ORDER_APPROVER → Approves PO
3. GOODS_RECEIPT_CLERK → Receives goods (GRN)
4. QUALITY_INSPECTOR → QC inspection (if needed)
5. GOODS_RECEIPT_APPROVER → Approves receipt
```

---

## Category 5: Sales & POS Roles (5 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `SALES_CASHIER` | Sales Cashier | Operating POS, processing sales |
| `SALES_SUPERVISOR` | Sales Supervisor | Managing sales, handling voids/refunds |
| `SHIFT_MANAGER` | Shift Manager | Managing cashier shifts |
| `CASH_APPROVER` | Cash Approver | Approving large cash transactions |
| `CUSTOMER_SERVICE_REP` | Customer Service Representative | Managing customer information |

---

## Category 6: Return Roles (4 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `CUSTOMER_RETURN_CREATOR` | Customer Return Creator | Processing customer returns |
| `CUSTOMER_RETURN_APPROVER` | Customer Return Approver | Approving customer returns |
| `SUPPLIER_RETURN_CREATOR` | Supplier Return Creator | Creating supplier return requests |
| `SUPPLIER_RETURN_APPROVER` | Supplier Return Approver | Approving supplier returns |

---

## Category 7: Financial & Accounting Roles (5 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `ACCOUNTS_PAYABLE_CLERK` | Accounts Payable Clerk | Managing supplier invoices/payments |
| `PAYMENT_APPROVER` | Payment Approver | Approving supplier payments |
| `EXPENSE_RECORDER` | Expense Recorder | Recording business expenses |
| `BANK_RECONCILIATION_CLERK` | Bank Reconciliation Clerk | Managing bank transactions |
| `FINANCIAL_VIEWER` | Financial Viewer | View-only financial data access |

---

## Category 8: Report Roles (6 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `SALES_REPORT_VIEWER` | Sales Report Viewer | Viewing sales reports |
| `INVENTORY_REPORT_VIEWER` | Inventory Report Viewer | Viewing inventory reports |
| `PURCHASE_REPORT_VIEWER` | Purchase Report Viewer | Viewing purchase reports |
| `FINANCIAL_REPORT_VIEWER` | Financial Report Viewer | Viewing financial reports |
| `BIR_READING_OPERATOR` | BIR Reading Operator | Generating X/Z readings |
| `REPORT_EXPORTER` | Report Exporter | Exporting all reports to PDF/Excel |

---

## Category 9: HR & Scheduling Roles (4 roles)

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `SCHEDULE_MANAGER` | Schedule Manager | Creating employee schedules |
| `ATTENDANCE_MANAGER` | Attendance Manager | Managing attendance tracking |
| `LEAVE_APPROVER` | Leave Approver | Approving leave requests |
| `LOCATION_CHANGE_APPROVER` | Location Change Approver | Approving location changes |

---

## Category 10: Convenience Admin Roles (4 roles)

**Pre-configured role combinations for common scenarios**

| Role Code | Role Name | Use When |
|-----------|-----------|----------|
| `BRANCH_MANAGER` | Branch Manager | Full operational control of a branch |
| `WAREHOUSE_MANAGER` | Warehouse Manager | Full warehouse operations |
| `ACCOUNTING_MANAGER` | Accounting Manager | Full accounting operations |
| `STORE_SUPERVISOR` | Store Supervisor | Store operations supervision |

---

## Legacy Roles (For Backward Compatibility)

| Role Code | Role Name | Status |
|-----------|-----------|--------|
| `LEGACY_SUPER_ADMIN` | Super Admin (Legacy) | DEPRECATED → Use `SYSTEM_ADMINISTRATOR` |
| `LEGACY_ADMIN` | Admin (Legacy) | DEPRECATED → Use specific task roles |
| `LEGACY_MANAGER` | Manager (Legacy) | DEPRECATED → Use `BRANCH_MANAGER` |
| `LEGACY_CASHIER` | Cashier (Legacy) | DEPRECATED → Use `SALES_CASHIER` |

---

## Total Role Count

- **Task-Specific Roles**: 47
- **Convenience Admin Roles**: 4
- **Legacy Roles**: 4
- **Grand Total**: 55 roles

---

## Common Assignment Scenarios

### Scenario 1: Small Single-Location Store

**Owner/Manager** (wears multiple hats):
- System Administrator
- Sales Cashier
- Transfer Creator
- Purchase Order Creator

**Cashier**:
- Sales Cashier

---

### Scenario 2: Medium Multi-Location Business

**Head Office - Store Manager**:
- Branch Manager
- Transfer Approver
- Purchase Order Approver

**Warehouse - Warehouse Staff**:
- Transfer Sender
- Goods Receipt Clerk
- Inventory Counter

**Branch 1 - Branch Supervisor**:
- Transfer Creator
- Sales Supervisor
- Customer Return Approver

**Branch 1 - Cashiers** (2 people):
- Sales Cashier

**Branch 1 - Receiver**:
- Transfer Receiver

---

### Scenario 3: Large Enterprise Setup

**Head Office - IT Administrator**:
- System Administrator
- User Manager
- Role Manager

**Head Office - Finance Manager**:
- Accounting Manager
- Payment Approver
- Financial Report Viewer

**Head Office - HR Manager**:
- Schedule Manager
- Attendance Manager
- Leave Approver

**Main Warehouse - Warehouse Manager**:
- Warehouse Manager (full access)
- Quality Approver

**Main Warehouse - Receiving Staff** (3 people):
- Goods Receipt Clerk

**Main Warehouse - QC Inspector**:
- Quality Inspector

**Branch Managers** (per branch):
- Store Supervisor
- Transfer Creator
- Transfer Approver
- Inventory Approver

**Branch Cashiers** (per branch, multiple):
- Sales Cashier

**Branch Receivers** (per branch):
- Transfer Receiver

---

## Permission Assignment Best Practices

### Do's
- ✅ Assign multiple specific roles to users based on their actual job functions
- ✅ Use the least privilege principle - give only what's needed
- ✅ Use convenience admin roles (Branch Manager, etc.) for common combinations
- ✅ Review and audit role assignments regularly
- ✅ Document why each user has their specific role assignments

### Don'ts
- ❌ Don't assign System Administrator unless absolutely necessary
- ❌ Don't assign legacy roles to new users
- ❌ Don't violate separation of duties (e.g., don't give same person TRANSFER_CREATOR + TRANSFER_APPROVER)
- ❌ Don't create custom roles when existing ones will work
- ❌ Don't assign roles "just in case" - assign when actually needed

---

## Separation of Duties (SOD) Rules

### Critical SOD Violations to Avoid

**Transfers:**
- ❌ Same user: Transfer Creator + Transfer Approver
- ✅ Different users: One creates, another approves

**Purchases:**
- ❌ Same user: Purchase Order Creator + Purchase Order Approver
- ❌ Same user: Goods Receipt Clerk + Goods Receipt Approver
- ✅ Different users: Separate create/approve responsibilities

**Payments:**
- ❌ Same user: Accounts Payable Clerk + Payment Approver
- ✅ Different users: One creates payments, another approves

**Inventory:**
- ❌ Same user: Inventory Adjuster + Inventory Approver
- ✅ Different users: One adjusts, another approves

---

## Role Search & Filter Guide

### By Function Area
```
Administrative: SYSTEM_ADMINISTRATOR, USER_MANAGER, ROLE_MANAGER...
Transfers: TRANSFER_CREATOR, TRANSFER_SENDER, TRANSFER_RECEIVER...
Purchases: PURCHASE_ORDER_CREATOR, GOODS_RECEIPT_CLERK...
Sales: SALES_CASHIER, SALES_SUPERVISOR...
```

### By Permission Level
```
Create-only: TRANSFER_CREATOR, PURCHASE_ORDER_CREATOR, INVENTORY_ADJUSTER
Approve-only: TRANSFER_APPROVER, PURCHASE_ORDER_APPROVER, PAYMENT_APPROVER
View-only: PRODUCT_VIEWER, FINANCIAL_VIEWER, *_REPORT_VIEWER
Full Access: *_MANAGER roles, SYSTEM_ADMINISTRATOR
```

### By Workflow Step
```
Step 1 (Create): *_CREATOR roles
Step 2 (Process): *_SENDER, *_CLERK, *_RECORDER
Step 3 (Approve): *_APPROVER roles
View/Report: *_VIEWER, *_REPORT_* roles
```

---

## Migration from Old Roles

| Old Role | Recommended New Roles |
|----------|----------------------|
| Super Admin | System Administrator |
| Admin | Branch Manager + User Manager |
| Manager | Store Supervisor + Transfer Approver + Inventory Approver |
| Cashier | Sales Cashier |
| Warehouse Staff | Transfer Receiver + Goods Receipt Clerk |
| Accounting Staff | Accounting Manager OR Accounts Payable Clerk + Payment Approver |

---

## FAQs

**Q: Can a user have multiple roles?**
A: Yes! This is encouraged. Assign multiple specific roles instead of one broad role.

**Q: What's the difference between a "Manager" role and individual roles?**
A: "Manager" roles (Branch Manager, Warehouse Manager, etc.) are convenience roles that combine multiple related permissions. Individual roles are for specific tasks.

**Q: When should I use a convenience admin role vs. individual roles?**
A: Use admin roles for people who truly need all those permissions. Use individual roles for more restricted access.

**Q: How do I know which roles to assign?**
A: List the tasks the person needs to do, then assign roles that match those tasks. Example: "Creates transfers, approves inventory" = Transfer Creator + Inventory Approver

**Q: What if I need a custom combination not covered?**
A: Assign multiple individual roles to create the exact permission set needed.

**Q: Are legacy roles still supported?**
A: Yes, for backward compatibility, but they're deprecated. Migrate to new roles when possible.

---

## Need Help?

1. Check the full [RBAC Redesign Proposal](./RBAC_REDESIGN_PROPOSAL.md) for detailed information
2. Review the permission mappings in `src/lib/rbac.ts`
3. See workflow diagrams in the proposal document
4. Contact system administrator for role assignment assistance

