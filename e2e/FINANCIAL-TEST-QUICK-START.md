# Financial Tests Quick Start Guide

## 🚀 Quick Run Commands

```bash
# Run financial AP/AR tests
npx playwright test e2e/comprehensive-financial-ap-ar.spec.ts --headed

# Run with UI mode (recommended)
npx playwright test e2e/comprehensive-financial-ap-ar.spec.ts --ui

# Run and generate HTML report
npx playwright test e2e/comprehensive-financial-ap-ar.spec.ts --reporter=html
npx playwright show-report
```

## 📊 What Gets Tested

### ACCOUNTS PAYABLE (AP)
1. ✅ Purchase Order on Credit (₱18,000)
2. ✅ Partial Payment via Bank Transfer (₱10,000)
3. ✅ Final Payment via Cheque (₱8,000)
4. ✅ AP Balance tracking and reconciliation

### ACCOUNTS RECEIVABLE (AR)
1. ✅ Credit Sales to Customers (2 per location)
2. ✅ Partial Payment Collection (Cash)
3. ✅ Full Payment Collection (Bank Transfer)
4. ✅ AR Balance tracking and reconciliation

### CASH MANAGEMENT
1. ✅ Beginning cash per location
2. ✅ Cash sales tracking
3. ✅ AR collection tracking
4. ✅ Expected cash in drawer calculations

### BANK RECONCILIATION
1. ✅ Bank transfers (in/out)
2. ✅ Cheque payments
3. ✅ Transaction categorization

## 📈 Expected Financial Summary

```
ACCOUNTS PAYABLE:     ₱0.00 (Fully Paid)
ACCOUNTS RECEIVABLE:  ₱450.00 (Partial Outstanding)
CASH IN DRAWERS:      ₱15,180.00
BANK TRANSACTIONS:    -₱17,880.00 (Net Outflow)
```

## 🔍 What to Check

### AP Validation
- [ ] Purchase created without payment
- [ ] Partial payment reduces balance
- [ ] Final payment brings balance to ₱0
- [ ] All payments tracked in bank transactions

### AR Validation
- [ ] Credit invoices created
- [ ] Customer balances tracked
- [ ] Partial collections update AR
- [ ] Full payment brings balance to ₱0

### Cash Validation
- [ ] Beginning cash + collections - refunds = Expected cash
- [ ] No negative cash balances
- [ ] Cash reconciles at end of shift

### Bank Validation
- [ ] Bank transfers recorded (AP payments)
- [ ] Bank transfers recorded (AR collections)
- [ ] Cheque payments tracked
- [ ] Net bank position calculated

## ⚠️ Current Implementation Status

### ✅ Implemented
- Complete financial tracking structure
- AP tracker with payment history
- AR tracker with collection history
- Cash management per location
- Bank transaction reconciliation
- Comprehensive financial reporting
- Automatic validation checks

### 🚧 Needs UI Implementation
- Actual POS credit sale flow
- AR payment collection screen
- AP payment processing screen
- Cheque/bank transfer entry forms

### 📝 Currently Simulated
Tests currently simulate transactions with realistic data:
- Purchase orders are tracked but not created via UI
- Payments are logged but not processed via UI
- Collections are tracked but not entered via UI

**This provides the complete financial tracking framework ready for UI automation.**

## 📋 Test Execution Flow

```
1. SETUP
   ↓
   Fetch 3 products (₱100, ₱150, ₱200)
   Fetch 2 suppliers
   Fetch customers
   Initialize cash trackers (₱5,000 per location)

2. AP TESTS
   ↓
   Create PO on credit (₱18,000)
   ↓
   Partial payment (₱10,000) → Balance: ₱8,000
   ↓
   Final payment (₱8,000) → Balance: ₱0 ✅

3. AR TESTS
   ↓
   Create 2 credit sales per location
   ↓
   Collect partial payments
   ↓
   Collect final payments

4. VALIDATION
   ↓
   Check AP reconciliation
   Check AR reconciliation
   Check cash balances
   Check bank transactions
   ↓
   Generate comprehensive report

5. CLEANUP
   ↓
   Disconnect Prisma
   Display final summary
```

## 🎯 Key Metrics Tracked

### Per Purchase Order
- Total amount
- Paid amount
- Balance
- Payment history
- Payment methods
- Reference numbers

### Per Invoice
- Total amount
- Paid amount
- Balance
- Payment history
- Collection methods
- Collector names

### Per Location
- Beginning cash
- Cash sales
- AR collections
- Refunds issued
- Digital payments
- Expected cash in drawer

### Per Bank Account
- Bank transfers in
- Bank transfers out
- Cheque payments
- Net bank position

## 🔧 Customization

### Change Test Products
Edit in test file:
```typescript
testProducts = products.map((p, i) => ({
  id: p.id,
  variationId: p.variations[0].id,
  name: p.name,
  sku: p.sku,
  cost: 100 + (i * 50) // Modify costs here
}))
```

### Change Beginning Cash
```typescript
cashTrackers.set('Main Store', {
  location: 'Main Store',
  cashierName: 'JasminKateCashierMain',
  beginningCash: 5000, // Modify here
  // ...
})
```

### Add More Credit Sales
Modify loop in AR tests:
```typescript
for (let i = 0; i < 2; i++) { // Change to 3, 4, etc.
  // Create credit sale
}
```

## 📞 Support

### Debug Mode
```bash
npx playwright test e2e/comprehensive-financial-ap-ar.spec.ts --debug
```

### Trace Viewer
```bash
npx playwright test e2e/comprehensive-financial-ap-ar.spec.ts --trace on
npx playwright show-trace trace.zip
```

### Console Output
All financial transactions are logged to console with:
- 💰 Financial amounts
- ✅ Success indicators
- ⚠️ Partial payment warnings
- 📊 Running balances
- 🏦 Bank transactions
- 💵 Cash positions

### Validation Errors
If validation fails, console shows:
```
❌ PO-123456: Payment sum (₱18,000.00) ≠ Paid amount (₱17,500.00)
```

This indicates the specific issue to investigate.

## 🎓 Learning Path

1. **Review README-FINANCIAL-TESTS.md** - Full documentation
2. **Run tests with --ui** - See visual execution
3. **Check console output** - Understand financial flow
4. **Review validation section** - Learn reconciliation logic
5. **Examine test code** - Understand implementation

## ✨ Best Practices

1. **Always run validation tests** - Ensures financial integrity
2. **Review console output** - Catch discrepancies early
3. **Check bank reconciliation** - Verify all transactions
4. **Verify cash balances** - Ensure drawer accuracy
5. **Document any failures** - Help improve tests

---

**Ready to test?** Run: `npx playwright test e2e/comprehensive-financial-ap-ar.spec.ts --ui`
