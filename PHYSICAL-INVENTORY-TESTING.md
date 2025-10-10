# Physical Inventory Count - Testing Guide

## 🚀 Quick Start

### Step 1: Access the Application

**Dev Server**: http://localhost:3002

### Step 2: Login with Appropriate Role

**Test Accounts with Physical Inventory Access:**
- **Super Admin**: `superadmin` / `password` ✅
- **Branch Admin**: `branchadmin` / `password` ✅
- **Branch Manager**: `branchmanager` / `password` ✅

**Important**: If you were already logged in, **LOG OUT and LOG BACK IN** to load the new permissions!

### Step 3: Navigate to Physical Inventory

After logging in:
1. Look for **"Physical Inventory"** menu item in the left sidebar
2. It appears between "Inventory Corrections" and "Purchases"
3. Click to open the Physical Inventory page

---

## 📋 Complete Testing Workflow

### Test 1: Export Template

**Steps:**
1. Select a location from the dropdown (e.g., "Main Store")
2. Click **"Download Template"** button
3. Wait for Excel file to download

**Expected Result:**
- Excel file downloads with name like: `Physical_Inventory_Main_Store_2025-10-06.xlsx`
- File contains columns:
  - Product ID
  - Variation ID
  - Product Name
  - Variation
  - SKU
  - Current Stock (filled with system values)
  - Physical Count (blank - ready to fill)
- Products sorted alphabetically by name

**Verify:**
- ✅ File downloads successfully
- ✅ Contains inventory data for selected location
- ✅ Physical Count column is empty
- ✅ Current Stock shows correct quantities

---

### Test 2: Fill Physical Count (Manual Step)

**Steps:**
1. Open downloaded Excel file
2. In the "Physical Count" column, enter test counts:
   - For some items: Enter same value as Current Stock (no change)
   - For some items: Enter higher value (e.g., +5 from current)
   - For some items: Enter lower value (e.g., -3 from current)
   - For some items: Leave blank (will be skipped)
3. Save the Excel file

**Example:**
```
Product Name    | Current Stock | Physical Count
Widget A        | 100           | 105           (difference: +5)
Widget B        | 50            | 50            (no change, will skip)
Widget C        | 75            | 70            (difference: -5)
Widget D        | 30            | (blank)       (will skip)
```

---

### Test 3: Import Filled Template

**Steps:**
1. Return to Physical Inventory page
2. Ensure same location is selected
3. Click **"Choose File"** button
4. Select the filled Excel file
5. Click **"Import and Create Corrections"**
6. Wait for processing (should be fast)

**Expected Result:**
- Success message: "Physical inventory imported successfully"
- Summary shows:
  - Total rows processed: (number of rows in Excel)
  - Corrections created: (number of items with differences)
  - Skipped: (items with no change or blank)
  - Errors: (should be empty if data is valid)

**Verify:**
- ✅ Import completes without errors
- ✅ Summary counts are correct
- ✅ Table shows created corrections with:
  - Correction ID
  - System Count (original)
  - Physical Count (entered)
  - Difference (+/- indicator with correct color)
  - Status: "pending"

---

### Test 4: Review Created Corrections

**Steps:**
1. From import results, click **"View All Corrections"** button
2. You'll be redirected to Inventory Corrections page
3. Find the newly created corrections (most recent at top)
4. Click on a correction to view details

**Expected Result:**
- All imported corrections appear in the list
- Each shows:
  - Product name and variation
  - Location
  - System count vs Physical count
  - Difference amount
  - Status: Pending
  - Created by: Your username
  - Timestamp

**Verify:**
- ✅ All corrections created from import are listed
- ✅ Details match what was entered in Excel
- ✅ Reason shows: "Physical inventory count"
- ✅ Remarks includes filename

---

### Test 5: Approve Correction & Verify Stock Update

**Steps:**
1. On Inventory Corrections page, select a correction
2. Click **"Approve"** button (requires approval permission)
3. Confirm approval
4. Check the product's stock level

**Expected Result:**
- Correction status changes to "Approved"
- Stock level updates to Physical Count value
- Stock transaction created in history

**Verify:**
- ✅ Correction approved successfully
- ✅ Product stock updated correctly
- ✅ Stock transaction logged
- ✅ Audit trail created

---

### Test 6: Verify Audit Trail

**Steps:**
1. Go to audit log section (if available)
2. Or check database directly:
   ```sql
   SELECT * FROM audit_logs
   WHERE action = 'physical_inventory_import'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

**Expected Audit Log Contains:**
- User who performed import
- Action: `physical_inventory_import`
- Timestamp
- IP address
- User agent
- Metadata with:
  - File name
  - Product details
  - System count, physical count, difference
  - Location info

**Verify:**
- ✅ Audit log entry created for import
- ✅ All metadata captured correctly
- ✅ User and timestamp accurate
- ✅ IP address recorded

---

## 🧪 Additional Test Cases

### Test Case 7: Invalid Data Handling

**Test with:**
1. Modified Product ID (change to non-existent ID)
2. Modified Variation ID (invalid)
3. Empty Physical Count (should skip)
4. Non-numeric Physical Count (should error)

**Expected:**
- Validation errors reported
- Valid rows still processed
- Error details shown clearly

---

### Test Case 8: Location Access Control

**Test as Branch Manager** (limited location access):
1. Try to export from location you DON'T have access to
2. Expected: Error or location not visible in dropdown

**Test as Branch Admin** (all locations):
1. Can export from any location
2. Can import for any location

---

### Test Case 9: Permission Check

**Test as user WITHOUT permissions** (Regular Staff or Cashier):
1. Physical Inventory menu should NOT appear
2. Direct URL access should redirect or show permission error

---

### Test Case 10: Large File Performance

**Test with:**
1. Export location with 1000+ products
2. Fill all physical counts
3. Import

**Expected:**
- Export completes in <5 seconds
- Import processes in <30 seconds
- No timeout errors
- Progress indication (if implemented)

---

## ✅ Success Criteria

All features working correctly if:

- [x] Export generates valid Excel with correct data
- [x] Excel template is easy to fill manually
- [x] Import validates data properly
- [x] Only items with differences create corrections
- [x] Corrections created accurately
- [x] Approval updates stock correctly
- [x] Full audit trail captured
- [x] Permissions enforce access control
- [x] Location filtering works correctly
- [x] Performance acceptable for large files
- [x] Error handling works gracefully
- [x] UI provides clear feedback

---

## 🐛 Common Issues & Solutions

### Issue: Menu item not showing
**Solution:** Log out and log back in to refresh permissions

### Issue: Export button disabled
**Solution:** Select a location from dropdown first

### Issue: Import says "No corrections to process"
**Solution:** Fill Physical Count column with values different from Current Stock

### Issue: Import errors "Location not found"
**Solution:** Use same location for export and import

### Issue: Permission denied
**Solution:** Check user role has PHYSICAL_INVENTORY_EXPORT and PHYSICAL_INVENTORY_IMPORT permissions

---

## 📊 Test Data Setup (Optional)

If you need test data:

1. **Create Products:**
   - Add 10-20 products with variations
   - Set opening stock for a location

2. **Assign Locations:**
   - Ensure Branch Manager has specific location
   - Branch Admin has all locations

3. **Test Different Scenarios:**
   - Products with high stock
   - Products with low stock
   - Products with zero stock
   - Variable products with multiple variations

---

## 📝 Test Report Template

```
### Physical Inventory Count - Test Report

**Date:** ___________
**Tested By:** ___________
**Role Used:** ___________

| Test Case | Status | Notes |
|-----------|--------|-------|
| 1. Export Template | ☐ Pass ☐ Fail | |
| 2. Fill Physical Count | ☐ Pass ☐ Fail | |
| 3. Import Template | ☐ Pass ☐ Fail | |
| 4. Review Corrections | ☐ Pass ☐ Fail | |
| 5. Approve & Stock Update | ☐ Pass ☐ Fail | |
| 6. Audit Trail | ☐ Pass ☐ Fail | |
| 7. Invalid Data Handling | ☐ Pass ☐ Fail | |
| 8. Location Access Control | ☐ Pass ☐ Fail | |
| 9. Permission Check | ☐ Pass ☐ Fail | |
| 10. Performance Test | ☐ Pass ☐ Fail | |

**Issues Found:**
1.
2.
3.

**Overall Assessment:** ☐ Approved ☐ Needs Work
```

---

## 🎯 Quick Test Checklist

**5-Minute Smoke Test:**
1. ☐ Login as Branch Admin
2. ☐ Navigate to Physical Inventory
3. ☐ Export template for Main Store
4. ☐ Open Excel, change 3 quantities
5. ☐ Import filled file
6. ☐ Verify 3 corrections created
7. ☐ Check correction details are correct
8. ☐ Approve one correction
9. ☐ Verify stock updated

**If all pass:** Feature is working! ✅

---

**Happy Testing!** 🎉
