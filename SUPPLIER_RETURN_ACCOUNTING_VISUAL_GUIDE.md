# Supplier Return Accounting - Visual Guide

## The Complete Picture: What SHOULD Happen

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SUPPLIER RETURN APPROVAL WORKFLOW (CORRECT)                            │
└─────────────────────────────────────────────────────────────────────────┘

Step 1: User Creates Supplier Return
┌────────────────────────────────────────────┐
│ Supplier Return SR-202510-0001             │
│ ────────────────────────────────────────   │
│ Supplier: GRAND TECH                       │
│ Item: ADATA 512GB 2.5 SSD                  │
│ Quantity: 1                                │
│ Unit Cost: ₱1,520.00                       │
│ Reason: Defective                          │
│ Status: PENDING                            │
└────────────────────────────────────────────┘
                    ↓
Step 2: Manager/Admin Approves Return
┌────────────────────────────────────────────┐
│ [Approve Button Clicked]                   │
│                                            │
│ Triggers: POST /api/supplier-returns/1/approve
└────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  DATABASE TRANSACTION (All or Nothing)                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ✅ STEP A: Deduct Inventory (CURRENTLY WORKING)                        │
│  ───────────────────────────────────────────────────────────────        │
│  1. VariationLocationDetails                                            │
│     BEFORE: qty_available = 22                                          │
│     AFTER:  qty_available = 21  (-1)                                    │
│                                                                          │
│  2. StockTransaction                                                    │
│     CREATE: {                                                           │
│       type: 'supplier_return',                                          │
│       quantity: -1,                                                     │
│       balanceQty: 21,                                                   │
│       referenceType: 'supplier_return',                                 │
│       referenceId: 1                                                    │
│     }                                                                   │
│                                                                          │
│  3. ProductHistory                                                      │
│     CREATE: {                                                           │
│       transactionType: 'supplier_return',                               │
│       quantityChange: -1,                                               │
│       balanceQuantity: 21,                                              │
│       unitCost: 1520.00,                                                │
│       referenceId: 1                                                    │
│     }                                                                   │
│                                                                          │
│  ❌ STEP B: Update Accounts Payable (CURRENTLY MISSING!)               │
│  ───────────────────────────────────────────────────────────────        │
│  4. AccountsPayable (Invoice PO-202510-0001)                           │
│     BEFORE: {                                                           │
│       totalAmount: 1520.00,                                             │
│       paidAmount: 0.00,                                                 │
│       balanceAmount: 1520.00,                                           │
│       paymentStatus: 'unpaid'                                           │
│     }                                                                   │
│     AFTER: {                                                            │
│       totalAmount: 1520.00,                                             │
│       paidAmount: 1520.00,      ← Credit from return                    │
│       balanceAmount: 0.00,      ← Fully offset                          │
│       paymentStatus: 'paid'     ← Status updated                        │
│     }                                                                   │
│                                                                          │
│  ❌ STEP C: Create Payment Record (CURRENTLY MISSING!)                 │
│  ───────────────────────────────────────────────────────────────        │
│  5. Payment                                                             │
│     CREATE: {                                                           │
│       supplierId: 11,                                                   │
│       amount: 1520.00,                                                  │
│       paymentMethod: 'supplier_return_credit',                          │
│       referenceNumber: 'SR-202510-0001',                                │
│       status: 'completed',                                              │
│       notes: 'Credit from supplier return - defective'                  │
│     }                                                                   │
│                                                                          │
│  ❌ STEP D: Post Journal Entry (SYSTEM LIMITATION - NO GL MODULE)      │
│  ───────────────────────────────────────────────────────────────        │
│  6. Journal Entry (If GL existed)                                       │
│     DR: Accounts Payable - GRAND TECH    1,520.00                       │
│     CR: Inventory / Returns to Supplier  1,520.00                       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                    ↓
Step 3: Update Return Status
┌────────────────────────────────────────────┐
│ SupplierReturn                             │
│ ────────────────────────────────────────   │
│ status: 'approved' ✅                      │
└────────────────────────────────────────────┘
```

---

## Current State (What IS Happening)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CURRENT BEHAVIOR (INCOMPLETE!)                                         │
└─────────────────────────────────────────────────────────────────────────┘

Approval Clicked → Database Transaction
                           │
                           ├─→ ✅ Inventory Reduced (-1 unit)
                           ├─→ ✅ StockTransaction Created
                           ├─→ ✅ ProductHistory Created
                           │
                           ├─→ ❌ Accounts Payable NOT Updated
                           ├─→ ❌ Payment Record NOT Created
                           └─→ ❌ Journal Entry NOT Posted
                                 (System limitation - no GL)

RESULT:
┌────────────────────────────────────────────────────────────────┐
│  BALANCE SHEET IS OUT OF BALANCE!                             │
│                                                                │
│  Assets (Inventory):      -₱1,520  ✅                         │
│  Liabilities (AP):        ₱0       ❌ Should be -₱1,520       │
│                                                                │
│  NET WORTH: UNDERSTATED BY ₱1,520                             │
└────────────────────────────────────────────────────────────────┘
```

---

## The Fix - Before & After Comparison

### BEFORE FIX (Current Code)

```typescript
// File: src/app/api/supplier-returns/[id]/approve/route.ts
// Lines 74-142

const result = await prisma.$transaction(async (tx) => {
  // For each item, deduct stock
  for (const item of supplierReturn.items) {
    await processSupplierReturn({
      businessId: businessIdNumber,
      productId,
      productVariationId: variationId,
      locationId: supplierReturn.locationId,
      quantity,
      unitCost,
      returnId: supplierReturn.id,
      userId: userIdNumber,
      userDisplayName,
      tx,
    })
  }

  // ❌ MISSING: Update Accounts Payable
  // ❌ MISSING: Create Payment Record

  // Update return status to approved
  const updatedReturn = await tx.supplierReturn.update({
    where: { id: supplierReturn.id },
    data: { status: 'approved' },
  })

  return updatedReturn
})
```

### AFTER FIX (Enhanced Code)

```typescript
// File: src/app/api/supplier-returns/[id]/approve/route.ts
// Lines 74-200 (enhanced)

const result = await prisma.$transaction(async (tx) => {
  // For each item, deduct stock
  for (const item of supplierReturn.items) {
    await processSupplierReturn({
      businessId: businessIdNumber,
      productId,
      productVariationId: variationId,
      locationId: supplierReturn.locationId,
      quantity,
      unitCost,
      returnId: supplierReturn.id,
      userId: userIdNumber,
      userDisplayName,
      tx,
    })
  }

  // ✅ NEW: Update Accounts Payable
  const apEntries = await tx.accountsPayable.findMany({
    where: {
      supplierId: supplierReturn.supplierId,
      businessId: businessIdNumber,
      balanceAmount: { gt: 0 }
    },
    orderBy: { invoiceDate: 'asc' }
  })

  if (apEntries.length > 0) {
    let remainingCredit = parseFloat(supplierReturn.totalAmount.toString())

    for (const ap of apEntries) {
      if (remainingCredit <= 0) break

      const currentBalance = parseFloat(ap.balanceAmount.toString())
      const creditToApply = Math.min(remainingCredit, currentBalance)
      const newPaidAmount = parseFloat(ap.paidAmount.toString()) + creditToApply
      const newBalance = currentBalance - creditToApply
      const newStatus = newBalance === 0 ? 'paid' :
                        newBalance < parseFloat(ap.totalAmount.toString()) ? 'partial' :
                        'unpaid'

      await tx.accountsPayable.update({
        where: { id: ap.id },
        data: {
          paidAmount: newPaidAmount,
          balanceAmount: newBalance,
          paymentStatus: newStatus
        }
      })

      remainingCredit -= creditToApply
    }

    // ✅ NEW: Create Payment Record
    await tx.payment.create({
      data: {
        businessId: businessIdNumber,
        supplierId: supplierReturn.supplierId,
        amount: parseFloat(supplierReturn.totalAmount.toString()),
        paymentDate: supplierReturn.returnDate,
        paymentMethod: 'supplier_return_credit',
        referenceNumber: supplierReturn.returnNumber,
        status: 'completed',
        notes: `Credit from supplier return - ${supplierReturn.returnReason}`,
        createdBy: userIdNumber
      }
    })
  }

  // Update return status to approved
  const updatedReturn = await tx.supplierReturn.update({
    where: { id: supplierReturn.id },
    data: { status: 'approved' },
  })

  return updatedReturn
})
```

---

## Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SUPPLIER RETURN DATA FLOW                                                 │
└────────────────────────────────────────────────────────────────────────────┘

                        [USER INTERFACE]
                              │
                    Create Supplier Return
                              │
                              ▼
                    ┌──────────────────┐
                    │ SupplierReturn   │
                    │   (pending)      │
                    └──────────────────┘
                              │
                    Manager Approves
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │    APPROVAL API ROUTE                   │
        │  /api/supplier-returns/[id]/approve     │
        └─────────────────────────────────────────┘
                              │
                     Start Transaction
                              │
        ┌─────────────────────┴────────────────────────┐
        │                                               │
        ▼                                               ▼
┌────────────────┐                           ┌─────────────────────┐
│  INVENTORY     │                           │  ACCOUNTING         │
│  SUBSYSTEM     │                           │  SUBSYSTEM          │
└────────────────┘                           └─────────────────────┘
        │                                               │
        ├──→ VariationLocationDetails                  ├──→ AccountsPayable
        │    (qty reduced)                              │    (balance reduced)
        │                                               │
        ├──→ StockTransaction                          ├──→ Payment
        │    (negative qty)                             │    (credit record)
        │                                               │
        └──→ ProductHistory                            └──→ [Future: Journal Entry]
             (ledger entry)                                  (DR: AP, CR: Inv)
                              │
                     Commit Transaction
                              │
                              ▼
                    ┌──────────────────┐
                    │ SupplierReturn   │
                    │   (approved)     │
                    └──────────────────┘
                              │
                              ▼
                    [NOTIFICATIONS / AUDIT LOG]
```

---

## Accounts Payable Update Logic (FIFO)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SCENARIO: GRAND TECH has 2 outstanding invoices                          │
└────────────────────────────────────────────────────────────────────────────┘

BEFORE RETURN:
┌─────────────────────────────────────────────────────────────────┐
│ Invoice: PO-202510-0001                                         │
│ Date: 2025-10-01                                                │
│ Total: ₱1,520.00  |  Paid: ₱0.00  |  Balance: ₱1,520.00        │
│ Status: unpaid                                                  │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Invoice: PO-202510-0002                                         │
│ Date: 2025-10-15                                                │
│ Total: ₱23,000.00  |  Paid: ₱0.00  |  Balance: ₱23,000.00      │
│ Status: unpaid                                                  │
└─────────────────────────────────────────────────────────────────┘

SUPPLIER RETURN APPROVED: ₱1,520.00 credit

FIFO APPLICATION (Apply to oldest invoice first):
┌─────────────────────────────────────────────────────────────────┐
│ Step 1: Apply ₱1,520 to PO-202510-0001                         │
│                                                                 │
│ PO-202510-0001:                                                 │
│   Balance: ₱1,520 - ₱1,520 = ₱0.00                             │
│   Paid: ₱0 + ₱1,520 = ₱1,520.00                                │
│   Status: 'paid' ✅                                             │
│                                                                 │
│ Remaining Credit: ₱1,520 - ₱1,520 = ₱0                         │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Step 2: No credit left for PO-202510-0002                      │
│                                                                 │
│ PO-202510-0002: (unchanged)                                     │
│   Balance: ₱23,000.00                                           │
│   Status: 'unpaid'                                              │
└─────────────────────────────────────────────────────────────────┘

AFTER RETURN:
┌─────────────────────────────────────────────────────────────────┐
│ Invoice: PO-202510-0001                                         │
│ Total: ₱1,520.00  |  Paid: ₱1,520.00  |  Balance: ₱0.00        │
│ Status: paid ✅                                                 │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│ Invoice: PO-202510-0002                                         │
│ Total: ₱23,000.00  |  Paid: ₱0.00  |  Balance: ₱23,000.00      │
│ Status: unpaid                                                  │
└─────────────────────────────────────────────────────────────────┘

TOTAL OWED TO GRAND TECH: ₱23,000.00 ✅
(Was ₱24,520, now ₱23,000 after ₱1,520 return)
```

---

## Example: Partial Return Scenario

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SCENARIO: Return ₱2,000 when supplier has invoice for ₱5,000             │
└────────────────────────────────────────────────────────────────────────────┘

BEFORE:
┌──────────────────────────────────────────────────────┐
│ Invoice: PO-202510-0003                              │
│ Total: ₱5,000  |  Paid: ₱0  |  Balance: ₱5,000       │
│ Status: unpaid                                       │
└──────────────────────────────────────────────────────┘

RETURN: ₱2,000

CALCULATION:
creditToApply = Math.min(₱2,000, ₱5,000) = ₱2,000
newPaidAmount = ₱0 + ₱2,000 = ₱2,000
newBalance = ₱5,000 - ₱2,000 = ₱3,000
newStatus = ₱3,000 < ₱5,000 ? 'partial' : 'unpaid' → 'partial'

AFTER:
┌──────────────────────────────────────────────────────┐
│ Invoice: PO-202510-0003                              │
│ Total: ₱5,000  |  Paid: ₱2,000  |  Balance: ₱3,000   │
│ Status: partial ✅                                   │
└──────────────────────────────────────────────────────┘
```

---

## Example: Return Exceeds Single Invoice

```
┌────────────────────────────────────────────────────────────────────────────┐
│  SCENARIO: Return ₱3,500 when supplier has two invoices                   │
└────────────────────────────────────────────────────────────────────────────┘

BEFORE:
┌──────────────────────────────────────────────────────┐
│ Invoice A: PO-202510-0004 (older)                    │
│ Total: ₱2,000  |  Paid: ₱0  |  Balance: ₱2,000       │
│ Status: unpaid                                       │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ Invoice B: PO-202510-0005 (newer)                    │
│ Total: ₱4,000  |  Paid: ₱0  |  Balance: ₱4,000       │
│ Status: unpaid                                       │
└──────────────────────────────────────────────────────┘

RETURN: ₱3,500

FIFO APPLICATION:
┌──────────────────────────────────────────────────────┐
│ Step 1: Apply to Invoice A                          │
│ Credit Available: ₱3,500                             │
│ Invoice Balance: ₱2,000                              │
│ Credit Applied: min(₱3,500, ₱2,000) = ₱2,000        │
│                                                      │
│ Invoice A AFTER:                                     │
│ Paid: ₱2,000  |  Balance: ₱0  |  Status: paid ✅    │
│                                                      │
│ Remaining Credit: ₱3,500 - ₱2,000 = ₱1,500          │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ Step 2: Apply remaining to Invoice B                │
│ Credit Available: ₱1,500                             │
│ Invoice Balance: ₱4,000                              │
│ Credit Applied: min(₱1,500, ₱4,000) = ₱1,500        │
│                                                      │
│ Invoice B AFTER:                                     │
│ Paid: ₱1,500  |  Balance: ₱2,500  |  Status: partial │
│                                                      │
│ Remaining Credit: ₱1,500 - ₱1,500 = ₱0              │
└──────────────────────────────────────────────────────┘

AFTER:
┌──────────────────────────────────────────────────────┐
│ Invoice A: PO-202510-0004                            │
│ Total: ₱2,000  |  Paid: ₱2,000  |  Balance: ₱0       │
│ Status: paid ✅                                      │
└──────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────┐
│ Invoice B: PO-202510-0005                            │
│ Total: ₱4,000  |  Paid: ₱1,500  |  Balance: ₱2,500   │
│ Status: partial ✅                                   │
└──────────────────────────────────────────────────────┘

TOTAL OWED: ₱0 + ₱2,500 = ₱2,500 ✅
(Originally ₱6,000, minus ₱3,500 return = ₱2,500)
```

---

## Quick Reference: Database Tables Affected

```
┌─────────────────────────────────────────────────────────────────┐
│  TABLE: supplier_returns                                        │
├─────────────────────────────────────────────────────────────────┤
│  status: 'pending' → 'approved'                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: variation_location_details                              │
├─────────────────────────────────────────────────────────────────┤
│  qty_available: REDUCED by return quantity                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: stock_transactions                                      │
├─────────────────────────────────────────────────────────────────┤
│  NEW RECORD: type='supplier_return', quantity=-1                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: product_history                                         │
├─────────────────────────────────────────────────────────────────┤
│  NEW RECORD: transactionType='supplier_return', qty=-1          │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: accounts_payable (❌ CURRENTLY NOT UPDATED!)           │
├─────────────────────────────────────────────────────────────────┤
│  SHOULD UPDATE:                                                 │
│  - paidAmount: INCREASED by return amount                       │
│  - balanceAmount: REDUCED by return amount                      │
│  - paymentStatus: 'unpaid' → 'partial' or 'paid'               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  TABLE: payments (❌ CURRENTLY NOT CREATED!)                   │
├─────────────────────────────────────────────────────────────────┤
│  SHOULD CREATE:                                                 │
│  - paymentMethod: 'supplier_return_credit'                      │
│  - referenceNumber: supplier return number                      │
│  - amount: return total                                         │
│  - status: 'completed'                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

**Document Purpose:** Visual guide to understand supplier return accounting
**Created:** October 22, 2025
**For:** Developers, Accountants, Auditors
**Related Files:**
- SUPPLIER_RETURN_ACCOUNTING_FORENSIC_REPORT.md (detailed analysis)
- SUPPLIER_RETURN_ACCOUNTING_FIX_SUMMARY.md (executive summary)
