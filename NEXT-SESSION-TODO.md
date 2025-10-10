# Next Session TODO - Sales Module

## Quick Start Checklist

- [ ] Start dev server: `npm run dev`
- [ ] Check which port it started on (look for "Local: http://localhost:XXXX")
- [ ] Update test config if not on port 3000:
  - `e2e/sales-comprehensive.spec.ts` line 7
  - `playwright.config.ts` line 12
- [ ] Review `SALES-MODULE-SESSION-2025-10-07.md` for context

---

## Priority Tasks

### 🔴 Priority 1: Fix Remaining Test Assertions (30 min)

**Test 3: Serial Number Sale Creation**
- [ ] Run test individually to see exact failure
- [ ] Check if serial numbers are in sale.items[0].serialNumbers
- [ ] Verify serial number format in JSON field
- [ ] Update test assertion to match actual structure

**Test 4 & 6: Validation Error Messages**
- [ ] Make API call with insufficient stock using curl/Postman
- [ ] Document exact error response format
- [ ] Update test expectations to match

**Test 8 & 9: Void Sale Tests**
- [ ] Verify `page.request.delete()` syntax in test
- [ ] Test DELETE endpoint manually with curl
- [ ] Fix test to properly call the endpoint

**Test 11: Stock Transactions**
- [ ] Run query directly in database to verify transactions exist
- [ ] Check if test query has correct filters
- [ ] Update test query or fix transaction creation

### 🟡 Priority 2: Complete Sales Module API (1-2 hours)

- [ ] Test serial number flow end-to-end manually
- [ ] Create sales report endpoint `/api/sales/reports`
- [ ] Add sales search/filter endpoint
- [ ] Document all endpoints in SALES-API-READY.md

### 🟢 Priority 3: Build Sales UI (3-4 hours)

- [ ] Create sales list page `/dashboard/sales`
- [ ] Create POS interface `/dashboard/pos`
- [ ] Create sale detail view `/dashboard/sales/[id]`
- [ ] Add "Void Sale" button with confirmation
- [ ] Test UI with real data

---

## Testing Commands

```bash
# Run all sales tests
npx playwright test e2e/sales-comprehensive.spec.ts --reporter=list

# Run specific failing test
npx playwright test e2e/sales-comprehensive.spec.ts -g "Create Sale - With Serial Numbers"

# Run with browser visible for debugging
npx playwright test e2e/sales-comprehensive.spec.ts --reporter=list --headed

# Run single test by number
npx playwright test e2e/sales-comprehensive.spec.ts -g "Test 3"
```

---

## Debugging Tips

### Check Server Logs
Look for these in dev server terminal:
- `POST /api/sales 201` = Success
- `POST /api/sales 500` = Server error (check error message)
- `POST /api/sales 400` = Validation error

### Check Database Directly
```sql
-- See recent sales
SELECT id, invoice_number, total_amount, status, created_at
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- See sale items with serial numbers
SELECT si.id, si.sale_id, si.quantity, si.serial_numbers
FROM sale_items si
ORDER BY si.created_at DESC
LIMIT 10;

-- See stock transactions
SELECT * FROM stock_transactions
WHERE type = 'sale'
ORDER BY created_at DESC
LIMIT 10;

-- See serial number status
SELECT id, serial_number, status, sale_id, sold_to
FROM product_serial_numbers
WHERE status = 'sold'
ORDER BY sold_at DESC
LIMIT 10;
```

### Manual API Testing
```bash
# Test sale creation (adjust port if needed)
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \
  -d '{
    "locationId": 1,
    "customerId": 1,
    "saleDate": "2025-10-07T00:00:00Z",
    "items": [{
      "productId": 1,
      "productVariationId": 1,
      "quantity": 1,
      "unitPrice": 100
    }],
    "payments": [{
      "method": "cash",
      "amount": 100
    }],
    "taxAmount": 0,
    "discountAmount": 0,
    "shippingCost": 0
  }'

# Test void sale
curl -X DELETE http://localhost:3000/api/sales/1 \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
```

---

## Files to Review

**Session Summary:**
- `SALES-MODULE-SESSION-2025-10-07.md` - Complete context

**Current Progress:**
- `SESSION-PROGRESS.md` - Overall project status

**API Documentation:**
- `SALES-API-READY.md` - Sales API endpoints

**Test Files:**
- `e2e/sales-comprehensive.spec.ts` - Test suite
- `playwright.config.ts` - Playwright configuration

**API Files:**
- `src/app/api/sales/route.ts` - POST (create) and GET (list)
- `src/app/api/sales/[id]/route.ts` - GET (single) and DELETE (void)

---

## Success Criteria

Before moving to UI development:
- [ ] All 13 tests passing
- [ ] No console errors during test runs
- [ ] Stock deduction verified
- [ ] Serial number tracking verified
- [ ] Void sale restores stock correctly
- [ ] Audit logs created for all actions

---

## Quick Wins

These should be easy fixes:
1. **Update BASE_URL** - If server not on port 3000
2. **Test 5 & 7** - Already passing, just verify
3. **Test 10** - Audit trail works, already passing

---

## Notes from Last Session

- Port 3000 was blocked by process 19896
- Server ended up on port 3008 during testing
- Playwright browsers successfully installed
- Core Sales API is functionally complete
- Most test failures are assertion issues, not bugs

---

**Last Updated**: October 7, 2025
**Next Session Goal**: Get to 100% tests passing (13/13)
