# Forensic Accounting Report: Supplier Return SR-202510-0001

## Executive Summary

**Investigation Date:** 2025-10-22
**Subject:** Supplier Return SR-202510-0001
**Amount:** ₱1,520.00
**Finding:** Critical accounting gap - Accounts Payable not reduced when supplier return approved

---

## Transaction Details

| Field | Value |
|-------|-------|
| Return Number | SR-202510-0001 |
| Return Date | 2025-10-21 |
| Supplier | GRAND TECH (ID: 11) |
| Location | Main Warehouse (ID: 2) |
| Status | Approved |
| Reason | Defective merchandise |
| Total Amount | ₱1,520.00 |
| Created By | User ID 20 |

### Items Returned

| Product | Variation | Quantity | Unit Cost | Line Total | Condition |
|---------|-----------|----------|-----------|------------|-----------|
| ADATA 512GB 2.5 SSD | Default | 1 | ₱1,520.00 | ₱1,520.00 | Defective |

---

## What Was Recorded ✅

### 1. Inventory Adjustment - CORRECT ✅

The system correctly reduced inventory when the return was approved:

- **ProductHistory Record:** Created with quantity change of -1
- **StockTransaction Record:** Created with type "supplier_return"
- **Physical Stock:** Reduced from 22 to 21 units
- **Balance After:** 21 units at Main Warehouse

**Accounting Impact:**
```
Assets (Inventory): -₱1,520.00 ✅ RECORDED
```

### 2. Stock Movement - CORRECT ✅

The stock operations library (`processSupplierReturn`) correctly:
- Deducted quantity from `variation_location_details`
- Created negative stock transaction
- Updated product history ledger
- Maintained running balance

---

## What Was NOT Recorded ❌

### 1. Accounts Payable Adjustment - MISSING ❌

**CRITICAL GAP:** When the supplier return was approved, the system did NOT reduce the amount owed to the supplier.

**Current AP Status for GRAND TECH:**

| Invoice | Total Amount | Paid Amount | Balance | Status |
|---------|--------------|-------------|---------|--------|
| PO-202510-0001 | ₱1,520.00 | ₱0.00 | ₱1,520.00 | Unpaid |
| PO-202510-0002 | ₱23,000.00 | ₱0.00 | ₱23,000.00 | Unpaid |
| **TOTAL** | **₱24,520.00** | **₱0.00** | **₱24,520.00** | |

**What SHOULD Have Happened:**
- Invoice PO-202510-0001 should be marked as "paid" (₱1,520 credit from return)
- Paid Amount should be ₱1,520.00
- Balance should be ₱0.00
- Payment Status should be "paid"

**Accounting Impact:**
```
Liabilities (Accounts Payable): -₱1,520.00 ❌ NOT RECORDED
```

### 2. Double-Entry Accounting - SYSTEM LIMITATION ❌

**SYSTEM GAP:** The application does not have a General Ledger or Journal Entry system.

**What SHOULD Have Been Posted:**
```
Date: 2025-10-21
Description: Supplier Return SR-202510-0001 - GRAND TECH - Defective merchandise

DR: Accounts Payable - GRAND TECH      ₱1,520.00
CR: Inventory / Returns to Supplier    ₱1,520.00

Explanation:
- Debit to AP: Reduces liability (we owe the supplier ₱1,520 less)
- Credit to Inventory: Reduces asset value (stock physically left our warehouse)
```

### 3. Payment/Credit Record - MISSING ❌

**GAP:** No payment or credit note record was created to track that this return offsets amounts owed.

**What SHOULD Exist:**
- A Payment record with method "supplier_return_credit"
- Reference number: SR-202510-0001
- Amount: ₱1,520.00
- Status: Completed

### 4. Bank Transaction Linkage - DESIGN LIMITATION ❌

**SCHEMA GAP:** The `BankTransaction` table lacks `referenceType` and `referenceId` fields.

- Cannot link bank transactions to supplier returns
- If supplier issues refund check, no way to trace it to the return
- Inconsistent with how other transactions are tracked

---

## Financial Impact Analysis

### Balance Sheet Impact

| Account | Expected Change | Actual Change | Variance |
|---------|----------------|---------------|----------|
| Assets (Inventory) | -₱1,520.00 | -₱1,520.00 | ✅ Correct |
| Liabilities (AP) | -₱1,520.00 | ₱0.00 | ❌ **-₱1,520.00 understated** |

### Net Effect

⚠️ **BALANCE SHEET IS OUT OF BALANCE**

- Assets decreased by ₱1,520
- Liabilities did NOT decrease
- **Net Worth is understated by ₱1,520**

### Practical Impact

1. **Overstated Liabilities:** Books show we owe GRAND TECH ₱24,520 when we actually owe ₱23,000
2. **Cash Flow Errors:** When we pay invoices, we'll overpay by ₱1,520 unless manually adjusted
3. **Supplier Reconciliation Issues:** Supplier statement won't match our AP aging report
4. **Audit Findings:** External auditors will flag the discrepancy
5. **Tax Implications:** Overstated liabilities could affect financial ratios and tax calculations

---

## Root Cause Analysis

### Why This Happened

1. **Code Review: `src/app/api/supplier-returns/[id]/approve/route.ts`**
   - Line 83: Calls `processSupplierReturn()` - reduces inventory ✅
   - **Missing:** No code to update Accounts Payable
   - **Missing:** No code to create payment/credit record
   - **Missing:** No double-entry journal entry

2. **Schema Design Gap:**
   - `AccountsPayable` table is linked to `Purchase`, not `SupplierReturn`
   - No direct relationship between SupplierReturn and AP
   - No mechanism to apply credits to AP balances

3. **Workflow Assumption:**
   - System assumes someone will manually adjust AP entries
   - No automated process to handle return credits
   - No validation that AP was adjusted

---

## Corrective Actions

### Immediate Fix (Current Transaction)

**Script:** `fix-supplier-return-sr-202510-0001.mjs`

This script will:
1. Apply ₱1,520 credit to invoice PO-202510-0001
2. Update paid_amount to ₱1,520.00
3. Update balance_amount to ₱0.00
4. Update payment_status to 'paid'
5. Create a Payment record to document the credit

**To Run:**
```bash
node fix-supplier-return-sr-202510-0001.mjs
```

### Permanent Fix (Prevent Future Issues)

**Required Code Changes:**

#### 1. Enhance Supplier Return Approval Route

File: `src/app/api/supplier-returns/[id]/approve/route.ts`

Add after inventory deduction (line 95):

```typescript
// ADDITION: Update Accounts Payable for the return
// Find AP entries for this supplier
const apEntries = await tx.accountsPayable.findMany({
  where: {
    supplierId: supplierReturn.supplierId,
    businessId: supplierReturn.businessId,
    balanceAmount: { gt: 0 }
  },
  orderBy: { invoiceDate: 'asc' } // Apply to oldest first
})

if (apEntries.length > 0) {
  let remainingCredit = parseFloat(supplierReturn.totalAmount.toString())

  for (const ap of apEntries) {
    if (remainingCredit <= 0) break

    const currentBalance = parseFloat(ap.balanceAmount.toString())
    const creditToApply = Math.min(remainingCredit, currentBalance)
    const newPaidAmount = parseFloat(ap.paidAmount.toString()) + creditToApply
    const newBalance = currentBalance - creditToApply
    const newStatus = newBalance === 0 ? 'paid' : newBalance < parseFloat(ap.totalAmount.toString()) ? 'partial' : 'unpaid'

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

  // Create payment record to track the credit
  await tx.payment.create({
    data: {
      businessId: supplierReturn.businessId,
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
```

#### 2. Add Validation Before Final Approval

Add check to ensure AP will be updated:

```typescript
// Before processing return
const hasOutstandingAP = await tx.accountsPayable.count({
  where: {
    supplierId: supplierReturn.supplierId,
    balanceAmount: { gt: 0 }
  }
})

if (hasOutstandingAP === 0) {
  console.warn(`⚠️  No outstanding AP for supplier ${supplierReturn.supplierId}`)
  // Decision: Either block the approval or create a credit balance
}
```

#### 3. Schema Enhancement (Optional but Recommended)

Add to `schema.prisma`:

```prisma
model SupplierReturnCredit {
  id               Int            @id @default(autoincrement())
  businessId       Int            @map("business_id")
  supplierReturnId Int            @map("supplier_return_id")
  supplierReturn   SupplierReturn @relation(fields: [supplierReturnId], references: [id])
  accountsPayableId Int?          @map("accounts_payable_id")
  accountsPayable   AccountsPayable? @relation(fields: [accountsPayableId], references: [id])
  creditAmount     Decimal        @map("credit_amount") @db.Decimal(22, 4)
  appliedAmount    Decimal        @default(0) @map("applied_amount") @db.Decimal(22, 4)
  balanceAmount    Decimal        @map("balance_amount") @db.Decimal(22, 4)
  status           String         @default("available") @db.VarChar(50) // available, applied, expired
  createdAt        DateTime       @default(now()) @map("created_at")

  @@map("supplier_return_credits")
}
```

This provides:
- Explicit tracking of return credits
- Link between return and AP entries
- Ability to handle excess credits
- Audit trail of credit applications

#### 4. Update BankTransaction Schema

Add reference tracking:

```prisma
model BankTransaction {
  // ... existing fields ...
  referenceType String? @map("reference_type") @db.VarChar(50)
  referenceId   Int?    @map("reference_id")
  // ... rest of fields ...
}
```

This allows:
- Linking bank transactions to any entity
- Consistent with StockTransaction and ProductHistory
- Enables better audit trails

---

## Testing Recommendations

### Test Cases for Supplier Returns

1. **Full Return of Single Invoice**
   - Create purchase for ₱1,000
   - Return all items
   - Verify AP balance becomes ₱0
   - Verify payment_status becomes 'paid'

2. **Partial Return of Single Invoice**
   - Create purchase for ₱2,000
   - Return items worth ₱500
   - Verify AP balance becomes ₱1,500
   - Verify payment_status becomes 'partial'

3. **Return Exceeds Single Invoice**
   - Invoice A: ₱1,000
   - Invoice B: ₱2,000
   - Return: ₱1,500
   - Verify Invoice A fully paid (₱0 balance)
   - Verify Invoice B partially paid (₱1,500 balance)

4. **Return with No Outstanding AP**
   - All invoices already paid
   - Return items worth ₱500
   - Verify credit balance created
   - Verify can apply to future purchases

5. **Multiple Returns to Same Supplier**
   - Return 1: ₱500
   - Return 2: ₱300
   - Verify both properly credited
   - Verify cumulative effect on AP

---

## Prevention Measures

### 1. Automated Validation

Add to supplier return approval:

```typescript
// After approval, verify balance sheet still balanced
const inventoryChange = await calculateInventoryChange(returnId)
const apChange = await calculateAPChange(returnId)

if (Math.abs(inventoryChange + apChange) > 0.01) {
  throw new Error('Balance sheet does not balance after supplier return!')
}
```

### 2. Reconciliation Reports

Create monthly report:
- List all supplier returns
- Show inventory impact
- Show AP impact
- Flag any discrepancies

### 3. Audit Logging

Enhance audit log to capture:
- Before/after AP balances
- Payment records created
- Any manual adjustments

### 4. User Training

Document the proper workflow:
1. Create supplier return
2. Approve return (triggers inventory AND AP updates)
3. Verify AP balance reduced
4. Process refund if applicable
5. Reconcile supplier statement

---

## Compliance & Audit

### BIR (Bureau of Internal Revenue) Considerations

**Philippines Tax Regulations:**

1. **Debit Memo Required:**
   - Must issue formal debit memo to supplier
   - Document must show reason for return
   - Keep copy for BIR inspection

2. **VAT Implications:**
   - If original purchase had input VAT, must reverse it
   - Cannot claim input VAT on returned goods
   - Must adjust VAT reporting

3. **Record Keeping:**
   - Must maintain supplier return register
   - Link to original purchase invoice
   - Keep for 3 years minimum

### Audit Trail Requirements

The system should track:
- ✅ Who created the return
- ✅ When it was approved
- ❌ **MISSING:** Who adjusted AP (should be automatic)
- ❌ **MISSING:** Double-entry journal entries
- ❌ **MISSING:** Link to original purchase

---

## Recommendations Summary

### Critical (Do Immediately)

1. ✅ Run `fix-supplier-return-sr-202510-0001.mjs` to fix current transaction
2. ⚠️ Modify supplier return approval route to update AP automatically
3. ⚠️ Add validation that AP is updated before approval completes
4. ⚠️ Create Payment record for each return credit

### Important (Do This Sprint)

1. Add `referenceType` and `referenceId` to BankTransaction
2. Create SupplierReturnCredit table for explicit credit tracking
3. Build reconciliation report for supplier returns
4. Add automated balance sheet validation

### Nice to Have (Future Enhancement)

1. Implement full General Ledger / Chart of Accounts
2. Add double-entry journal entry system
3. Generate debit memos automatically
4. Integrate with supplier portals for return approval
5. Add workflow for refund processing

---

## Appendix

### Investigation Scripts

1. **investigate-supplier-return-accounting.mjs** - Full forensic analysis
2. **find-supplier-returns.mjs** - Search all supplier returns
3. **fix-supplier-return-sr-202510-0001.mjs** - Corrective action script

### Related Files

- `src/app/api/supplier-returns/[id]/approve/route.ts` - Approval endpoint
- `src/lib/stockOperations.ts` - Inventory update logic
- `prisma/schema.prisma` - Database schema

### Key Database Tables

- `supplier_returns` - Main return records
- `supplier_return_items` - Line items
- `accounts_payable` - What we owe suppliers
- `payments` - Payment history
- `product_history` - Inventory ledger
- `stock_transactions` - Stock movements

---

**Report Generated:** 2025-10-22
**Prepared By:** Claude (Purchase & Accounts Payable Manager)
**Severity:** CRITICAL - Balance sheet out of balance
**Status:** Awaiting corrective action approval
