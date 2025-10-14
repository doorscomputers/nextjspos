# Inventory Ledger - Quick Test Guide

## Quick Start

Run the complete test to verify the Inventory Ledger system:

```bash
node test-ledger-complete.js
```

**Expected Output:**
```
✅ PASSED - Scenario 1 (WITH Correction)
✅ PASSED - Scenario 2 (WITHOUT Correction)
🎉 ALL TESTS PASSED!
```

---

## What This Tests

### Scenario 1: Product WITH Correction
- **Product:** Logitech MX Master 3 Mouse (ID: 10002)
- **Flow:** Correction (+100) → Purchase (+50) → Sale (-20)
- **Expected:** Opening = 100, Final = 130, Variance = 0

### Scenario 2: Product WITHOUT Correction
- **Product:** Dell 27" Monitor (ID: 10004)
- **Flow:** Purchase (+100) → Sale (-25) → Purchase (+50) → Sale (-15)
- **Expected:** Opening = 0, Final = 110, Variance = 0

---

## Key Validation Points

1. **Opening Balance Accuracy**
   - Products with corrections: Opening balance = sum of corrections
   - Products without corrections: Opening balance = 0

2. **Running Balance Calculation**
   - Each transaction updates running balance correctly
   - Purchase receipts: +quantity
   - Sales: -quantity

3. **Variance Check**
   - Variance = 0 means perfect reconciliation
   - Calculated balance matches database balance

4. **Transaction History**
   - All transactions are recorded
   - Chronologically ordered
   - Reference numbers tracked

---

## Test Files

| File | Purpose | Authentication Required |
|------|---------|------------------------|
| `test-ledger-complete.js` | Full test (recommended) | No |
| `test-ledger-cli.js` | Verify existing data | No |
| `test-ledger-simple.js` | API endpoint test | Yes (pending) |

---

## Manual Verification

After running the test, you can manually verify in the database:

```sql
-- Check Mouse (10002) stock
SELECT qtyAvailable FROM variation_location_details
WHERE productVariationId = 10002 AND locationId = 1;
-- Expected: 130

-- Check Monitor (10004) stock
SELECT qtyAvailable FROM variation_location_details
WHERE productVariationId = 10004 AND locationId = 1;
-- Expected: 110

-- Check transactions for Mouse
SELECT * FROM inventory_corrections
WHERE productVariationId = 10002;
-- Expected: 1 correction of +100

SELECT * FROM purchase_receipt_items
WHERE productVariationId = 10002;
-- Expected: 1 receipt of +50

SELECT * FROM sale_items
WHERE productVariationId = 10002;
-- Expected: 1 sale of -20
```

---

## Troubleshooting

### Test Fails with Wrong Balances
**Solution:** Run cleanup to remove old test data:
```javascript
// Included in test-ledger-complete.js
await cleanup();
```

### Decimal Math Issues
**Problem:** JavaScript treats Prisma Decimals as strings
**Solution:** Convert to float before math:
```javascript
const qty = parseFloat(decimal.toString());
```

### Database Connection Issues
**Check:** Ensure `.env` has correct `DATABASE_URL`
```bash
DATABASE_URL="mysql://user:password@localhost:3306/database"
```

---

## Success Criteria

- [ ] Opening Balance = Expected (100 for Mouse, 0 for Monitor)
- [ ] Final Balance = Expected (130 for Mouse, 110 for Monitor)
- [ ] Variance = 0 (perfect reconciliation)
- [ ] All transactions recorded correctly
- [ ] Running balances calculated accurately

---

## Next Steps

After successful test:
1. ✅ Test with your own products
2. ✅ Test with different transaction volumes
3. ✅ Test with multiple locations
4. ✅ Test API endpoint (after authentication setup)
5. ✅ Deploy to production

---

## Support

For issues or questions:
- Review `INVENTORY-LEDGER-TEST-RESULTS.md` for detailed analysis
- Check database schema in `prisma/schema.prisma`
- Review API implementation in `src/app/api/reports/inventory-ledger/route.ts`
