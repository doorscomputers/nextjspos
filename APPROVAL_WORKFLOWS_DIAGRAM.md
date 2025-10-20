# Approval Workflows - Visual Guide

## Overview

This document provides visual flowcharts for each approval workflow in UltimatePOS Modern.

---

## 1. Transfer Approval Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    TRANSFER APPROVAL WORKFLOW                    │
└─────────────────────────────────────────────────────────────────┘

Step 1: CREATE TRANSFER REQUEST
┌──────────────┐
│ Branch       │  Creates transfer request:
│ Manager      │  "Move 100 units of Product X"
│              │  From: Main Warehouse → To: Retail Branch A
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Transfer Request     │  Status: PENDING
│ ID: #1234            │
│ Qty: 100 units       │
│ From: Warehouse      │
│ To: Retail Branch A  │
└──────┬───────────────┘
       │
       ▼
Step 2: REVIEW & APPROVE
┌──────────────┐
│ Transfer     │  Reviews request:
│ Approver     │  ✓ Is there enough stock in warehouse?
│              │  ✓ Does Retail Branch A need this stock?
│              │  ✓ Is the quantity reasonable?
└──────┬───────┘
       │
       ├─── APPROVE ────────┐
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ Status:       │
       │            │ APPROVED      │
       │            │ ApprovedBy:   │
       │            │ John Doe      │
       │            │ ApprovedAt:   │
       │            │ 2025-10-18    │
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            Step 3: SEND STOCK
       │            ┌───────────────┐
       │            │ Warehouse     │  Marks as SENT
       │            │ Staff         │  Stock deducted from warehouse
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ Status: SENT  │
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            Step 4: RECEIVE STOCK
       │            ┌───────────────┐
       │            │ Retail        │  Marks as RECEIVED
       │            │ Staff         │  Stock added to Retail Branch A
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ Status:       │
       │            │ COMPLETED     │
       │            │ ✅ Transfer   │
       │            │    Done!      │
       │            └───────────────┘
       │
       └─── REJECT ────────┐
                           │
                           ▼
                   ┌───────────────┐
                   │ Status:       │
                   │ REJECTED      │
                   │ Reason:       │
                   │ "Insufficient │
                   │  stock"       │
                   │ ❌ Transfer   │
                   │    Cancelled  │
                   └───────────────┘
```

**Permissions Required:**
- Create Request: `stock_transfer.create`
- Approve/Reject: `stock_transfer.send`, `stock_transfer.receive`
- Mark as Sent: `stock_transfer.send`
- Mark as Received: `stock_transfer.receive`

---

## 2. GRN Approval Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                      GRN APPROVAL WORKFLOW                       │
│            (Goods Received Note / Purchase Receipt)              │
└─────────────────────────────────────────────────────────────────┘

Step 1: PURCHASE ORDER CREATED
┌──────────────┐
│ Purchasing   │  Creates purchase order:
│ Staff        │  "Buy 200 units of Product Y from Supplier Z"
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Purchase Order       │  Status: APPROVED
│ PO-2025-001          │  Sent to supplier
│ Qty: 200 units       │
│ Supplier: ABC Corp   │
└──────┬───────────────┘
       │
       ▼ (5 days later)
Step 2: GOODS ARRIVE AT WAREHOUSE
┌──────────────┐
│ Warehouse    │  Receives goods from supplier
│ Staff        │  Creates Goods Received Note (GRN)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ GRN Created          │  Status: PENDING
│ GRN-2025-123         │  Qty Received: 200 units
│ Related PO:          │  Qty Ordered: 200 units
│   PO-2025-001        │  Match: ✓
│ Supplier: ABC Corp   │
└──────┬───────────────┘
       │
       ▼
Step 3: QC INSPECTION (Optional)
┌──────────────┐
│ QC           │  Conducts quality inspection:
│ Inspector    │  ✓ Sample 50 units
│              │  ✓ Check quality
│              │  ✓ Found 2 defective (4% defect rate)
└──────┬───────┘
       │
       ├─── QC PASS ────┐
       │                │
       │                ▼
       │        ┌───────────────┐
       │        │ QC Inspection │
       │        │ Status: PASS  │
       │        │ Defect: 4%    │
       │        │ (below 5%     │
       │        │  threshold)   │
       │        └───────┬───────┘
       │                │
       │                ▼
       │        Step 4: GRN APPROVAL
       │        ┌───────────────┐
       │        │ GRN           │  Reviews GRN:
       │        │ Approver      │  ✓ Qty matches PO?
       │        │               │  ✓ QC passed?
       │        │               │  ✓ Serial numbers recorded?
       │        │               │  ✓ Condition acceptable?
       │        └───────┬───────┘
       │                │
       │                ├─── APPROVE ────┐
       │                │                │
       │                │                ▼
       │                │        ┌───────────────┐
       │                │        │ Status:       │
       │                │        │ APPROVED      │
       │                │        │ ApprovedBy:   │
       │                │        │ Jane Smith    │
       │                │        └───────┬───────┘
       │                │                │
       │                │                ▼
       │                │        ┌───────────────┐
       │                │        │ INVENTORY     │
       │                │        │ UPDATED       │
       │                │        │ +200 units    │
       │                │        │ ✅ GRN Done!  │
       │                │        └───────────────┘
       │                │
       │                └─── REJECT ────┐
       │                               │
       │                               ▼
       │                       ┌───────────────┐
       │                       │ Status:       │
       │                       │ REJECTED      │
       │                       │ Reason:       │
       │                       │ "Qty mismatch"│
       │                       │ ❌ GRN        │
       │                       │    Rejected   │
       │                       └───────────────┘
       │
       └─── QC FAIL ────┐
                        │
                        ▼
                ┌───────────────┐
                │ QC Inspection │
                │ Status: FAIL  │
                │ Defect: 12%   │
                │ (above 5%     │
                │  threshold)   │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │ RETURN TO     │
                │ SUPPLIER      │
                │ (Create       │
                │ Supplier      │
                │ Return)       │
                └───────────────┘
```

**Permissions Required:**
- Create GRN: `purchase.receipt.create`
- QC Inspection: `qc_inspection.conduct`, `qc_inspection.approve`
- Approve GRN: `purchase.receipt.approve`
- View PO: `purchase.view`

---

## 3. Inventory Correction Approval Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              INVENTORY CORRECTION APPROVAL WORKFLOW              │
└─────────────────────────────────────────────────────────────────┘

Step 1: PHYSICAL COUNT REVEALS DISCREPANCY
┌──────────────┐
│ Inventory    │  Conducts physical count:
│ Staff        │  System shows: 100 units
│              │  Physical count: 95 units
│              │  Variance: -5 units (Missing)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Inventory Correction │  Status: PENDING
│ Request Created      │  Correction: -5 units
│ IC-2025-089          │  Reason: "Physical count variance"
│ Product: Product X   │  Location: Retail Branch A
│ System: 100 units    │
│ Actual: 95 units     │
│ Variance: -5 units   │
└──────┬───────────────┘
       │
       ▼
Step 2: INVESTIGATION
┌──────────────┐
│ Inventory    │  Investigates:
│ Correction   │  ✓ Was physical count accurate?
│ Approver     │  ✓ Check recent sales/transfers
│              │  ✓ Check for theft/damage reports
│              │  ✓ Review security footage
└──────┬───────┘
       │
       ├─── APPROVE ────────┐
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ Status:       │
       │            │ APPROVED      │
       │            │ ApprovedBy:   │
       │            │ Mike Johnson  │
       │            │ Notes:        │
       │            │ "Confirmed    │
       │            │  shrinkage    │
       │            │  via CCTV"    │
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ INVENTORY     │
       │            │ UPDATED       │
       │            │ Old: 100      │
       │            │ New: 95       │
       │            │ ✅ Correction │
       │            │    Applied    │
       │            └───────────────┘
       │
       └─── REJECT ────────┐
                           │
                           ▼
                   ┌───────────────┐
                   │ Status:       │
                   │ REJECTED      │
                   │ Reason:       │
                   │ "Recount      │
                   │  required"    │
                   │ ❌ Correction │
                   │    Rejected   │
                   └───────────────┘
```

**Permissions Required:**
- Create Correction: `inventory_correction.create`
- Approve/Reject: `inventory_correction.approve`
- View History: `inventory_ledger.view`

---

## 4. Customer Return Approval Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              CUSTOMER RETURN APPROVAL WORKFLOW                   │
└─────────────────────────────────────────────────────────────────┘

Step 1: CUSTOMER REQUESTS RETURN
┌──────────────┐
│ Customer     │  Wants to return:
│              │  Product: Laptop
│              │  Reason: Defective
│              │  Purchase Date: 2025-10-10
│              │  Serial: LAP-123456
└──────┬───────┘
       │
       ▼
Step 2: CASHIER CREATES RETURN REQUEST
┌──────────────┐
│ Cashier      │  Creates customer return:
└──────┬───────┘  - Verifies serial number
       │          - Checks warranty period
       │          - Inspects product condition
       ▼
┌──────────────────────┐
│ Customer Return      │  Status: PENDING
│ CR-2025-456          │  Product: Laptop
│ Customer: John Doe   │  Serial: LAP-123456
│ Purchase Date:       │  Reason: Defective (screen issue)
│   2025-10-10         │  Condition: Used (8 days old)
│ Return Date:         │  Refund Amount: $1,200
│   2025-10-18         │
└──────┬───────────────┘
       │
       ▼
Step 3: RETURN APPROVAL
┌──────────────┐
│ Return       │  Reviews return:
│ Approver     │  ✓ Within return period? (30 days)
│              │  ✓ Serial number matches original sale?
│              │  ✓ Product condition acceptable?
│              │  ✓ Reason valid?
└──────┬───────┘
       │
       ├─── APPROVE ────────┐
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ Status:       │
       │            │ APPROVED      │
       │            │ ApprovedBy:   │
       │            │ Sarah Lee     │
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ INVENTORY     │
       │            │ UPDATED       │
       │            │ +1 Laptop     │
       │            │ (marked as    │
       │            │  defective)   │
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            Step 4: REFUND PROCESSING
       │            ┌───────────────┐
       │            │ Accounting    │  Processes refund
       │            │ Staff         │  (requires separate
       │            │               │   PAYMENT_CREATE permission)
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ REFUND        │
       │            │ COMPLETED     │
       │            │ Amount: $1,200│
       │            │ Method: Cash  │
       │            │ ✅ Return     │
       │            │    Complete   │
       │            └───────────────┘
       │
       └─── REJECT ────────┐
                           │
                           ▼
                   ┌───────────────┐
                   │ Status:       │
                   │ REJECTED      │
                   │ Reason:       │
                   │ "Outside      │
                   │  return       │
                   │  period"      │
                   │ ❌ Return     │
                   │    Rejected   │
                   └───────────────┘
```

**Permissions Required:**
- Create Return: `customer_return.create`
- Approve/Reject: `customer_return.approve`
- Process Refund: `payment.create`, `payment.approve`

---

## 5. Purchase Order Approval Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              PURCHASE ORDER APPROVAL WORKFLOW                    │
└─────────────────────────────────────────────────────────────────┘

Step 1: CREATE PURCHASE ORDER
┌──────────────┐
│ Inventory    │  Creates purchase order:
│ Manager      │  "Buy 500 units of Product Z"
│              │  Supplier: XYZ Suppliers
│              │  Total: $10,000
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Purchase Order       │  Status: PENDING
│ PO-2025-999          │  Qty: 500 units
│ Product: Product Z   │  Unit Price: $20
│ Supplier: XYZ        │  Total: $10,000
│ Delivery: 2025-10-25 │
└──────┬───────────────┘
       │
       ▼
Step 2: PURCHASE APPROVAL
┌──────────────┐
│ Purchase     │  Reviews purchase order:
│ Approver     │  ✓ Is the quantity justified?
│              │  ✓ Is the supplier reliable?
│              │  ✓ Is this within budget?
│              │  ✓ Are prices competitive?
│              │  ✓ Is there storage space?
└──────┬───────┘
       │
       ├─── APPROVE ────────┐
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ Status:       │
       │            │ APPROVED      │
       │            │ ApprovedBy:   │
       │            │ Tom Wilson    │
       │            └───────┬───────┘
       │                    │
       │                    ▼
       │            ┌───────────────┐
       │            │ PO SENT TO    │
       │            │ SUPPLIER      │
       │            │ Via: Email    │
       │            │ ✅ Order      │
       │            │    Placed     │
       │            └───────┬───────┘
       │                    │
       │                    ▼ (5 days later)
       │            ┌───────────────┐
       │            │ GOODS ARRIVE  │
       │            │ Create GRN    │
       │            │ (see GRN      │
       │            │  workflow)    │
       │            └───────────────┘
       │
       └─── REJECT ────────┐
                           │
                           ▼
                   ┌───────────────┐
                   │ Status:       │
                   │ REJECTED      │
                   │ Reason:       │
                   │ "Over budget" │
                   │ ❌ Order      │
                   │    Cancelled  │
                   └───────────────┘
```

**Permissions Required:**
- Create PO: `purchase.create`
- Approve/Reject: `purchase.approve`
- View Suppliers: `supplier.view`

---

## 6. QC Inspection Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                  QC INSPECTION WORKFLOW                          │
└─────────────────────────────────────────────────────────────────┘

Step 1: BATCH ARRIVES FROM SUPPLIER
┌──────────────────────┐
│ Batch Arrival        │  Batch #: BATCH-2025-789
│                      │  Product: Electronics
│ 1000 units arrived   │  Supplier: TechCorp
│ from supplier        │  Related PO: PO-2025-555
└──────┬───────────────┘
       │
       ▼
Step 2: QC INSPECTION REQUIRED
┌──────────────┐
│ QC           │  Selects QC template:
│ Inspector    │  "Electronics Quality Check"
│              │  Sample size: 50 units (5%)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ QC Inspection        │  Status: IN_PROGRESS
│ QC-2025-123          │  Template: Electronics QC
│ Batch: BATCH-789     │  Sample Size: 50 units
│ Inspector: Mike J.   │
└──────┬───────────────┘
       │
       ▼
Step 3: CONDUCT INSPECTION
┌──────────────┐
│ QC           │  Checks:
│ Inspector    │  ✓ Dimensions: 48/50 pass (96%)
│              │  ✓ Functionality: 49/50 pass (98%)
│              │  ✓ Cosmetic: 47/50 pass (94%)
│              │  ✓ Packaging: 50/50 pass (100%)
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Inspection Results   │  Overall Defect Rate: 4%
│ Dimensional: 96%     │  (2 defective units found)
│ Functional: 98%      │
│ Cosmetic: 94%        │  Threshold: 5%
│ Packaging: 100%      │  Result: PASS ✓
└──────┬───────────────┘
       │
       ├─── PASS (Defect < 5%) ───┐
       │                          │
       │                          ▼
       │                  ┌───────────────┐
       │                  │ Status:       │
       │                  │ APPROVED      │
       │                  │ ApprovedBy:   │
       │                  │ Mike Johnson  │
       │                  │ Defect Rate:  │
       │                  │ 4% (below 5%) │
       │                  └───────┬───────┘
       │                          │
       │                          ▼
       │                  ┌───────────────┐
       │                  │ BATCH         │
       │                  │ ACCEPTED      │
       │                  │ Proceed to    │
       │                  │ GRN approval  │
       │                  │ ✅ QC Pass    │
       │                  └───────────────┘
       │
       └─── FAIL (Defect >= 5%) ──┐
                                  │
                                  ▼
                          ┌───────────────┐
                          │ Status:       │
                          │ REJECTED      │
                          │ ApprovedBy:   │
                          │ Mike Johnson  │
                          │ Defect Rate:  │
                          │ 12% (above 5%)│
                          └───────┬───────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │ BATCH         │
                          │ REJECTED      │
                          │ Create        │
                          │ Supplier      │
                          │ Return        │
                          │ ❌ QC Fail    │
                          └───────────────┘
```

**Permissions Required:**
- Create Inspection: `qc_inspection.create`
- Conduct Inspection: `qc_inspection.conduct`
- Approve/Reject: `qc_inspection.approve`
- View Templates: `qc_template.view`

---

## Multi-Role Collaboration Example

### Scenario: Complete Purchase-to-Stock Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│           COMPLETE PURCHASE-TO-STOCK WORKFLOW                    │
│          (Multi-Role Collaboration Example)                      │
└─────────────────────────────────────────────────────────────────┘

Day 1: Purchase Request
┌──────────────┐
│ Inventory    │  Creates PO: "Buy 1000 units @ $50,000"
│ Manager      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Purchase     │  Reviews and approves PO
│ Approver     │  ✅ APPROVED
└──────┬───────┘
       │
       ▼
    [PO sent to supplier]

Day 5: Goods Arrive
┌──────────────┐
│ Warehouse    │  Receives 1000 units
│ Staff        │  Creates GRN
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ QC           │  Conducts inspection
│ Inspector    │  Defect rate: 3%
│              │  ✅ QC PASS
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ GRN          │  Reviews GRN + QC report
│ Approver     │  Approves receipt
│              │  ✅ GRN APPROVED
└──────┬───────┘
       │
       ▼
    [Inventory updated: +1000 units]

Day 6: Stock Distribution
┌──────────────┐
│ Branch       │  Requests transfer:
│ Manager      │  "Move 200 units to Retail Branch"
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Transfer     │  Reviews and approves transfer
│ Approver     │  ✅ TRANSFER APPROVED
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Warehouse    │  Ships 200 units
│ Staff        │  Marks as SENT
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Retail       │  Receives 200 units
│ Staff        │  Marks as RECEIVED
└──────┬───────┘
       │
       ▼
    [Stock ready for sale at retail branch]

Day 10: Physical Count Discrepancy
┌──────────────┐
│ Inventory    │  Finds -5 units variance
│ Staff        │  Creates correction request
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Inventory    │  Investigates and approves
│ Correction   │  ✅ CORRECTION APPROVED
│ Approver     │
└──────┬───────┘
       │
       ▼
    [Inventory adjusted: -5 units]

Day 15: Customer Return
┌──────────────┐
│ Customer     │  Returns defective unit
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Cashier      │  Creates customer return
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Return       │  Reviews and approves return
│ Approver     │  ✅ RETURN APPROVED
└──────┬───────┘
       │
       ▼
    [Inventory updated: +1 unit (defective)]

SUMMARY:
┌─────────────────────────────────────────────┐
│ Total Roles Involved: 9 different roles     │
│ Total Approvals Required: 5 approval steps  │
│ Final Inventory: 995 units (saleable)       │
│                  1 unit (defective)          │
│ Audit Trail: Complete (all actions logged)  │
└─────────────────────────────────────────────┘
```

**Roles Involved:**
1. Inventory Manager (creates PO)
2. Purchase Approver (approves PO)
3. Warehouse Staff (receives goods, creates GRN)
4. QC Inspector (conducts QC inspection)
5. GRN Approver (approves GRN)
6. Branch Manager (requests transfer)
7. Transfer Approver (approves transfer)
8. Inventory Correction Approver (approves correction)
9. Return Approver (approves customer return)

---

## Permission Flow Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERMISSION FLOW DIAGRAM                       │
└─────────────────────────────────────────────────────────────────┘

USER
 │
 ├── Assigned Roles (via user_roles table)
 │    │
 │    └── Role 1: Transfer Approver
 │         │
 │         └── Role Permissions (via role_permissions table)
 │              │
 │              ├── dashboard.view
 │              ├── stock_transfer.view
 │              ├── stock_transfer.send
 │              └── ... (11 more permissions)
 │
 ├── Direct Permissions (via user_permissions table)
 │    │
 │    └── report.profitability (assigned directly)
 │
 └── Location Access (via user_locations table)
      │
      ├── Location 1: Main Warehouse
      └── Location 2: Retail Branch A

EFFECTIVE PERMISSIONS = Role Permissions + Direct Permissions
EFFECTIVE LOCATIONS = User Locations (or ALL if ACCESS_ALL_LOCATIONS)
```

---

## Audit Trail Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      AUDIT TRAIL FLOW                            │
└─────────────────────────────────────────────────────────────────┘

Every Approval Action Creates Audit Log:

ACTION: Approve Transfer #1234
  │
  ├── userId: 123
  ├── businessId: 1
  ├── action: "APPROVE_TRANSFER"
  ├── entity: "Transfer"
  ├── entityId: 1234
  ├── description: "Approved transfer #1234 from Warehouse to Retail"
  ├── ipAddress: "192.168.1.100"
  ├── userAgent: "Mozilla/5.0..."
  └── createdAt: "2025-10-18 14:30:00"

Audit Log Queries:
┌────────────────────────────────┐
│ Who approved transfer #1234?   │  → Mike Johnson @ 2025-10-18 14:30
│ What did Mike approve today?   │  → 5 transfers, 2 GRNs
│ Who approved the most GRNs?    │  → Sarah Lee (25 GRNs this month)
│ Any suspicious approval times? │  → 3 approvals at 2 AM (flag for review)
└────────────────────────────────┘
```

---

## Summary

All approval workflows follow this pattern:

1. **Request Created** (by staff with create permission)
2. **Review** (by approver with view permission)
3. **Decision** (approve/reject with approval permission)
4. **Action** (inventory update, status change, etc.)
5. **Audit Log** (record who, what, when, why)

**Key Principles:**
- ✅ Separation of duties (different people create and approve)
- ✅ Minimal permissions (approvers can only view + approve)
- ✅ Full audit trail (every action logged)
- ✅ Location awareness (restrict to specific branches)
- ✅ Multi-role support (users can have multiple approver roles)

---

**Created:** 2025-10-18
**Version:** 1.0.0
