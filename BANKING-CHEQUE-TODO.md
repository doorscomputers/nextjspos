# Banking & Cheque Tracking Implementation Plan

## ✅ Already Implemented

### 1. **Bank CRUD System**
- ✅ Menu exists: "Banks" under Purchases menu
- ✅ Page exists: `/dashboard/banks`
- ✅ API exists: `/api/banks` and `/api/banks/[id]`
- ✅ Database model: `Bank` with fields:
  - `bankName`, `accountType`, `accountNumber`
  - `openingBalance`, `openingBalanceDate`
  - `currentBalance` (auto-updated)
  - `isActive` status

### 2. **Bank Transactions**
- ✅ Menu exists: "Bank Transactions" under Purchases menu
- ✅ Database model: `BankTransaction` with:
  - Transaction type tracking
  - Amount and balance after transaction
  - Link to payments and bank accounts
  - Transaction date and number

### 3. **Post-Dated Cheques**
- ✅ Menu exists: "Post-Dated Cheques" under Purchases menu
- ✅ Cheque fields in Payment model:
  - `chequeNumber`, `chequeDate`, `bankName`
  - `isPostDated` flag

### 4. **Permissions**
- ✅ `BANK_VIEW`, `BANK_CREATE`, `BANK_UPDATE`, `BANK_DELETE`
- ✅ `BANK_TRANSACTION_VIEW`, `BANK_TRANSACTION_CREATE`, etc.
- ✅ Already assigned to Super Admin and Admin roles

---

## 🔴 Critical Missing Features (Your Requests)

### 1. **Bank Balance Validation on Payments** ⚠️ HIGH PRIORITY
**Problem:** System allows payments even when bank account has zero or insufficient funds.

**Solution Needed:**
```typescript
// In payment API - check bank balance before processing
if (paymentMethod === 'cheque' || paymentMethod === 'bank_transfer') {
  const bank = await prisma.bank.findFirst({
    where: {
      businessId: session.user.businessId,
      bankName: bankName, // or use bankId
      isActive: true
    }
  })

  if (!bank) {
    return error('Bank account not found')
  }

  if (bank.currentBalance < paymentAmount) {
    return error(`Insufficient funds. Available: ${bank.currentBalance}, Required: ${paymentAmount}`)
  }
}
```

**Files to Update:**
- `/api/payments/route.ts`
- `/api/payments/batch/route.ts`

---

### 2. **Cheque Status Tracking** ⚠️ HIGH PRIORITY
**Problem:** No way to track if cheques have been cleared, bounced, or cancelled. Suppliers complain they didn't receive payment but system shows payment made.

**Solution:**
Add `chequeStatus` field to Payment model:
```prisma
model Payment {
  // ... existing fields ...
  chequeStatus String? @default("issued") @map("cheque_status")
  // Values: "issued", "cleared", "bounced", "cancelled", "void"

  chequeStatusDate DateTime? @map("cheque_status_date") // When status changed
  chequeStatusNotes String? @map("cheque_status_notes") @db.Text
}
```

**Required Actions:**
1. Update database schema
2. Add cheque status update page
3. Create bank reconciliation report
4. Add alerts for bounced cheques

---

### 3. **Cheque Reconciliation Report** ⚠️ HIGH PRIORITY
**Purpose:** Verify all issued cheques with bank statement

**Report Should Show:**
- **Issued Cheques** (with date, supplier, amount, cheque #)
- **Cleared Cheques** (with clearing date)
- **Outstanding Cheques** (issued but not cleared)
- **Bounced Cheques** (for immediate action)
- **Date Range Filter**
- **By Bank Account Filter**

**File to Create:**
- `/dashboard/reports/cheque-reconciliation/page.tsx`
- `/api/reports/cheque-reconciliation/route.ts`

---

### 4. **Bank Balance Display in Payment Forms**
Show current bank balance when selecting payment method:

```tsx
{paymentMethod === 'cheque' && bankName && (
  <div className="bg-blue-50 p-3 rounded border border-blue-200">
    <p className="text-sm">
      <strong>Current Balance:</strong> {formatCurrency(bankBalance)}
    </p>
    {bankBalance < parseFloat(amount) && (
      <p className="text-red-600 text-sm mt-1">
        ⚠️ Insufficient funds!
      </p>
    )}
  </div>
)}
```

---

## 📋 Implementation Priority Order

### **Phase 1: Critical Validations (Do First)**
1. ✅ Add bank balance validation in payment APIs
2. ✅ Display bank balance in payment forms
3. ✅ Block payments if insufficient funds

### **Phase 2: Cheque Tracking**
4. ✅ Add `chequeStatus` field to database
5. ✅ Create cheque status update page
6. ✅ Add "Update Cheque Status" action in payments list

### **Phase 3: Reconciliation & Reporting**
7. ✅ Create cheque reconciliation report
8. ✅ Add bank statement upload feature
9. ✅ Auto-match cleared cheques

### **Phase 4: Alerts & Monitoring**
10. ✅ Alert when cheque bounces
11. ✅ Reminder for post-dated cheques
12. ✅ Dashboard widget for outstanding cheques

---

## 🎯 Expected Benefits

1. **Financial Control**: Prevent overspending with balance validation
2. **Audit Trail**: Complete tracking of all cheques from issue to clearing
3. **Dispute Resolution**: Proof of payment status when suppliers claim non-payment
4. **Cash Flow Management**: Know exactly which cheques are outstanding
5. **Bank Reconciliation**: Match payments with bank statements easily

---

## 📁 Files That Need Updates

### API Files:
- ✅ `/api/payments/route.ts` - Add balance validation
- ✅ `/api/payments/batch/route.ts` - Add balance validation
- ✅ `/api/banks/route.ts` - Verify balance update logic
- ✅ `/api/payments/[id]/update-cheque-status/route.ts` - NEW

### Frontend Files:
- ✅ `/dashboard/payments/new/page.tsx` - Show balance
- ✅ `/dashboard/payments/batch/page.tsx` - Show balance
- ✅ `/dashboard/payments/page.tsx` - Add status column
- ✅ `/dashboard/reports/cheque-reconciliation/page.tsx` - NEW
- ✅ `/dashboard/post-dated-cheques/page.tsx` - Enhance existing

### Database:
- ✅ Add migration for `chequeStatus` fields
- ✅ Add indexes for performance

---

## 🔧 Testing Checklist

### Validation Testing:
- [ ] Try to pay with zero-balance bank
- [ ] Try to pay more than available balance
- [ ] Verify balance updates after payment

### Cheque Tracking:
- [ ] Issue cheque → Status = "issued"
- [ ] Mark as cleared → Status = "cleared"
- [ ] Mark as bounced → Status = "bounced", reverse AP
- [ ] Cancel cheque → Status = "cancelled", reverse AP

### Reconciliation:
- [ ] Generate report with all statuses
- [ ] Filter by date range
- [ ] Filter by bank account
- [ ] Export to Excel/PDF

---

**Next Steps:** Test the transfer feature as requested, then we'll implement these banking validations and cheque tracking features in priority order.
