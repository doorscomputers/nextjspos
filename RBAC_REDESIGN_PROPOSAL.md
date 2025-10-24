# RBAC System Redesign: Task-Specific Granular Roles

## Executive Summary

This proposal redesigns the UltimatePOS RBAC system from broad position-based roles (Admin, Manager, Cashier) to **task-specific, granular roles** that clearly describe exactly what each role can do.

### Key Principles

1. **Descriptive Role Names** - Role name explicitly states what the user can do
2. **Minimal Permissions** - Each role has only permissions needed for that specific task
3. **Multiple Role Assignment** - Users can have multiple roles for flexible permission combinations
4. **Clear Separation of Duties** - Different roles for create, approve, receive operations
5. **Easy to Understand** - Anyone can know what a role does just by reading the name

---

## Current Problems

| Current Role | Problem |
|--------------|---------|
| Super Admin | Too broad - has ALL permissions |
| Branch Admin | Vague - what can they actually do? |
| Branch Manager | Unclear - manages what exactly? |
| Accounting Staff | Position-based, not task-based |
| Regular Staff | What does "regular" mean? |
| Regular Cashier | Redundant word "regular" |

---

## New Role Structure

### Category 1: Administrative Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **System Administrator** | Full system access (replaces Super Admin) | All permissions |
| **User Manager** | Creates and manages user accounts | USER_*, ROLE_VIEW |
| **Role Manager** | Creates and manages roles/permissions | ROLE_* |
| **Location Manager** | Manages business locations/branches | LOCATION_* |
| **Business Settings Manager** | Configures business settings | BUSINESS_SETTINGS_* |

### Category 2: Product & Inventory Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Product Catalog Manager** | Creates and manages products | PRODUCT_*, CATEGORY_*, BRAND_*, UNIT_*, WARRANTY_* |
| **Product Viewer** | View-only access to product information | PRODUCT_VIEW |
| **Inventory Counter** | Conducts physical inventory counts | PHYSICAL_INVENTORY_EXPORT, PHYSICAL_INVENTORY_IMPORT |
| **Inventory Adjuster** | Creates inventory adjustment requests | INVENTORY_CORRECTION_VIEW, INVENTORY_CORRECTION_CREATE, INVENTORY_CORRECTION_UPDATE |
| **Inventory Approver** | Approves inventory corrections | INVENTORY_CORRECTION_VIEW, INVENTORY_CORRECTION_APPROVE |
| **Opening Stock Manager** | Sets opening stock for products | PRODUCT_OPENING_STOCK, PRODUCT_LOCK_OPENING_STOCK, PRODUCT_UNLOCK_OPENING_STOCK |
| **Stock Auditor** | Views all stock across locations | PRODUCT_VIEW_ALL_BRANCH_STOCK, INVENTORY_LEDGER_VIEW |

### Category 3: Transfer Roles (Segregation of Duties)

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Transfer Creator** | Creates stock transfer requests | STOCK_TRANSFER_VIEW, STOCK_TRANSFER_CREATE |
| **Transfer Sender** | Checks and sends approved transfers | STOCK_TRANSFER_VIEW, STOCK_TRANSFER_CHECK, STOCK_TRANSFER_SEND |
| **Transfer Receiver** | Receives incoming transfers | STOCK_TRANSFER_VIEW, STOCK_TRANSFER_RECEIVE |
| **Transfer Approver** | Verifies and completes transfers | STOCK_TRANSFER_VIEW, STOCK_TRANSFER_VERIFY, STOCK_TRANSFER_COMPLETE |
| **Transfer Manager** | Full transfer workflow access | STOCK_TRANSFER_* (all transfer permissions) |

### Category 4: Purchase & Procurement Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Purchase Order Creator** | Creates purchase orders | PURCHASE_VIEW, PURCHASE_CREATE, PURCHASE_UPDATE, SUPPLIER_VIEW |
| **Purchase Order Approver** | Approves purchase orders | PURCHASE_VIEW, PURCHASE_APPROVE |
| **Goods Receipt Clerk** | Receives purchased goods (GRN) | PURCHASE_VIEW, PURCHASE_RECEIVE, PURCHASE_RECEIPT_CREATE, PURCHASE_RECEIPT_VIEW |
| **Goods Receipt Approver** | Approves goods receipts | PURCHASE_RECEIPT_VIEW, PURCHASE_RECEIPT_APPROVE |
| **Quality Inspector** | Conducts QC inspections | QC_INSPECTION_VIEW, QC_INSPECTION_CREATE, QC_INSPECTION_CONDUCT |
| **Quality Approver** | Approves QC inspection results | QC_INSPECTION_VIEW, QC_INSPECTION_APPROVE |
| **Supplier Manager** | Manages supplier information | SUPPLIER_* (all supplier permissions) |

### Category 5: Sales & POS Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Sales Cashier** | Operates POS, processes sales | SELL_VIEW_OWN, SELL_CREATE, SHIFT_OPEN, SHIFT_CLOSE, CASH_IN_OUT, CASH_COUNT, X_READING |
| **Sales Supervisor** | Manages sales, handles voids/refunds | SELL_VIEW, SELL_UPDATE, VOID_CREATE, VOID_APPROVE, CUSTOMER_RETURN_CREATE, CUSTOMER_RETURN_APPROVE |
| **Shift Manager** | Manages cashier shifts | SHIFT_VIEW, SHIFT_VIEW_ALL |
| **Cash Approver** | Approves large cash transactions | CASH_APPROVE_LARGE_TRANSACTIONS |
| **Customer Service Representative** | Manages customer information | CUSTOMER_VIEW, CUSTOMER_CREATE, CUSTOMER_UPDATE |

### Category 6: Return Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Customer Return Creator** | Processes customer returns | CUSTOMER_RETURN_VIEW, CUSTOMER_RETURN_CREATE |
| **Customer Return Approver** | Approves customer returns | CUSTOMER_RETURN_VIEW, CUSTOMER_RETURN_APPROVE |
| **Supplier Return Creator** | Creates supplier return requests | SUPPLIER_RETURN_VIEW, SUPPLIER_RETURN_CREATE |
| **Supplier Return Approver** | Approves supplier returns | SUPPLIER_RETURN_VIEW, SUPPLIER_RETURN_APPROVE |

### Category 7: Financial & Accounting Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Accounts Payable Clerk** | Manages supplier invoices/payments | ACCOUNTS_PAYABLE_*, PAYMENT_VIEW, PAYMENT_CREATE |
| **Payment Approver** | Approves supplier payments | PAYMENT_VIEW, PAYMENT_APPROVE |
| **Expense Recorder** | Records business expenses | EXPENSE_VIEW, EXPENSE_CREATE, EXPENSE_UPDATE |
| **Bank Reconciliation Clerk** | Manages bank transactions | BANK_VIEW, BANK_TRANSACTION_VIEW, BANK_TRANSACTION_CREATE |
| **Financial Viewer** | Views financial data without edit | All VIEW permissions for financial data |

### Category 8: Report Roles

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Sales Report Viewer** | Views sales reports | REPORT_VIEW, REPORT_SALES_*, SALES_REPORT_* |
| **Inventory Report Viewer** | Views inventory reports | REPORT_VIEW, REPORT_STOCK_ALERT, STOCK_REPORT_VIEW, INVENTORY_LEDGER_VIEW |
| **Purchase Report Viewer** | Views purchase reports | REPORT_VIEW, REPORT_PURCHASE_* |
| **Financial Report Viewer** | Views financial reports | REPORT_VIEW, REPORT_PROFIT_LOSS, REPORT_PROFITABILITY |
| **BIR Reading Operator** | Generates BIR readings | X_READING, Z_READING |
| **Report Exporter** | Can export all reports | All REPORT_* permissions + EXPORT permissions |

### Category 9: HR & Scheduling Roles (for employee module)

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Schedule Manager** | Creates employee schedules | SCHEDULE_VIEW, SCHEDULE_CREATE, SCHEDULE_UPDATE, SCHEDULE_ASSIGN |
| **Attendance Manager** | Manages employee attendance | ATTENDANCE_VIEW, ATTENDANCE_MANAGE, ATTENDANCE_EDIT, ATTENDANCE_REPORT |
| **Leave Approver** | Approves leave requests | LEAVE_REQUEST_VIEW_ALL, LEAVE_REQUEST_APPROVE, LEAVE_REQUEST_REJECT |
| **Location Change Approver** | Approves location change requests | LOCATION_CHANGE_REQUEST_VIEW, LOCATION_CHANGE_REQUEST_APPROVE |

### Category 10: Convenience Admin Roles (for common combinations)

| Role Name | Description | Key Permissions |
|-----------|-------------|-----------------|
| **Branch Manager** | Full operational control of a branch | All operational permissions (products, sales, inventory, transfers, reports) - NO user management, NO role management |
| **Warehouse Manager** | Full warehouse operations | All inventory, transfers, receiving, stock management permissions |
| **Accounting Manager** | Full accounting operations | All financial, purchase, payment, expense permissions |
| **Store Supervisor** | Supervises store operations | Sales supervision, inventory viewing, basic approvals |

---

## Permission Mapping

### Transfer Workflow Example (Separation of Duties)

```
┌─────────────────────────────────────────────────────────────┐
│                    TRANSFER WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

Step 1: CREATE TRANSFER
Role: Transfer Creator
Permissions: STOCK_TRANSFER_CREATE
Actions: Draft transfer request, specify items/quantities
↓

Step 2: CHECK & SEND
Role: Transfer Sender (warehouse staff)
Permissions: STOCK_TRANSFER_CHECK, STOCK_TRANSFER_SEND
Actions: Verify physical items, pack, send transfer
↓

Step 3: RECEIVE
Role: Transfer Receiver (receiving location staff)
Permissions: STOCK_TRANSFER_RECEIVE
Actions: Accept delivery, scan items
↓

Step 4: VERIFY & COMPLETE
Role: Transfer Approver (receiving manager)
Permissions: STOCK_TRANSFER_VERIFY, STOCK_TRANSFER_COMPLETE
Actions: Verify quantities, approve final completion
```

### Purchase Workflow Example

```
┌─────────────────────────────────────────────────────────────┐
│                    PURCHASE WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

Step 1: CREATE PURCHASE ORDER
Role: Purchase Order Creator
Permissions: PURCHASE_CREATE
Actions: Create PO, select supplier, add items
↓

Step 2: APPROVE PURCHASE ORDER
Role: Purchase Order Approver
Permissions: PURCHASE_APPROVE
Actions: Review and approve PO
↓

Step 3: RECEIVE GOODS (GRN)
Role: Goods Receipt Clerk
Permissions: PURCHASE_RECEIPT_CREATE, PURCHASE_RECEIVE
Actions: Physical receiving, create GRN, record serial numbers
↓

Step 4: QC INSPECTION (if required)
Role: Quality Inspector
Permissions: QC_INSPECTION_CONDUCT
Actions: Inspect goods, record results
↓

Step 5: APPROVE QC & GRN
Role: Goods Receipt Approver
Permissions: PURCHASE_RECEIPT_APPROVE
Actions: Approve receipt, update stock
```

---

## User Assignment Examples

### Example 1: Small Store Setup
**Single user wears multiple hats**

User: John (Store Owner)
Roles:
- System Administrator
- Sales Cashier
- Purchase Order Creator
- Transfer Creator

### Example 2: Medium-sized Store
**Separation of duties begins**

**Maria** (Store Manager):
- Branch Manager
- Purchase Order Approver
- Inventory Approver
- Transfer Approver

**Pedro** (Cashier):
- Sales Cashier
- Customer Service Representative

**Ana** (Warehouse):
- Transfer Receiver
- Goods Receipt Clerk
- Inventory Counter

### Example 3: Large Multi-Branch Organization
**Full separation of duties**

**Head Office:**
- **Lisa** (System Admin): System Administrator
- **Carlos** (HR Manager): User Manager, Schedule Manager, Attendance Manager
- **Grace** (Finance Manager): Payment Approver, Financial Report Viewer

**Warehouse:**
- **Robert** (Warehouse Manager): Transfer Sender, Goods Receipt Clerk, Inventory Approver
- **Elena** (QC): Quality Inspector

**Branch 1:**
- **Diana** (Branch Manager): Sales Supervisor, Transfer Creator, Purchase Order Creator, Inventory Report Viewer
- **Mark** (Cashier): Sales Cashier
- **Sarah** (Receiver): Transfer Receiver

**Branch 2:**
- **James** (Branch Manager): Sales Supervisor, Transfer Creator, Inventory Report Viewer
- **Lucy** (Cashier): Sales Cashier
- **Tom** (Receiver): Transfer Receiver

---

## Migration Strategy

### Phase 1: Add New Roles (No Breaking Changes)
1. Create all new task-specific roles in database
2. Keep existing roles intact
3. Allow both old and new roles to coexist

### Phase 2: User Communication & Training
1. Document all new roles with clear descriptions
2. Provide role selection guide for administrators
3. Create role comparison chart (old vs new)

### Phase 3: Gradual Migration
1. Assign new roles to users alongside existing roles
2. Test new role assignments in staging environment
3. Verify users have correct access

### Phase 4: Deprecation (Optional)
1. Mark old roles as "Legacy" in UI
2. Prevent assignment of legacy roles to new users
3. Eventually remove legacy roles (with warning period)

---

## Database Changes Required

### New Roles Table Structure (NO CHANGES)
Current structure already supports this - no schema changes needed!

### Seed File Updates
Update `prisma/seed.ts` to create new roles and assign permissions

### RBAC.ts Updates
Update `src/lib/rbac.ts` DEFAULT_ROLES constant with new role definitions

---

## Implementation Checklist

- [ ] Update `src/lib/rbac.ts` with new DEFAULT_ROLES
- [ ] Update `prisma/seed.ts` to create new roles
- [ ] Create role migration script for existing users
- [ ] Update role selection UI to group roles by category
- [ ] Add role description tooltips in UI
- [ ] Create role permission matrix documentation
- [ ] Update API authorization checks (verify compatibility)
- [ ] Test all workflows with new roles
- [ ] Create user guide for role assignment
- [ ] Add role search/filter in user management

---

## Benefits

### 1. Clear Understanding
"Transfer Creator" immediately tells you what this role does - no guessing

### 2. Least Privilege Principle
Each role has minimal permissions needed, reducing security risk

### 3. Separation of Duties
Different people handle create, approve, receive - reduces fraud risk

### 4. Flexible Combinations
Users can have multiple specific roles instead of one broad role

### 5. Easy Onboarding
New administrators can quickly understand and assign appropriate roles

### 6. Audit Trail
Clear role names make audit logs more meaningful

### 7. Compliance
Easier to demonstrate SOD (Separation of Duties) for compliance requirements

---

## Role Count Summary

- **Administrative Roles**: 5
- **Product & Inventory Roles**: 7
- **Transfer Roles**: 5
- **Purchase & Procurement Roles**: 7
- **Sales & POS Roles**: 5
- **Return Roles**: 4
- **Financial & Accounting Roles**: 5
- **Report Roles**: 6
- **HR & Scheduling Roles**: 4
- **Convenience Admin Roles**: 4

**Total: 52 granular roles**

(Plus 1 legacy System Administrator = 53 total)

---

## Next Steps

1. Review and approve this proposal
2. Implement new DEFAULT_ROLES in `src/lib/rbac.ts`
3. Update seed file with new roles
4. Create migration script for existing users
5. Update UI for role management
6. Test all workflows
7. Deploy to staging for testing
8. Document and train users
9. Deploy to production

---

## Questions for Consideration

1. Should we keep old roles for backward compatibility?
2. Should we auto-migrate users to new roles or manual assignment?
3. Do we need additional roles for specific business processes?
4. Should some roles be location-specific?
5. Do we need role hierarchies (parent-child relationships)?

