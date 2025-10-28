# Testing Guide: 3-Level Menu Permissions

## Quick Test Steps

### 1. Access Menu Permissions Page
```
Navigate to: Settings → Menu Permissions
URL: http://localhost:3000/dashboard/settings/menu-permissions
```

### 2. Select a Role
- Click on "Warehouse Manager" (or any role)
- Wait for menus to load

### 3. Verify 3-Level Display
Look for the "Reports" section and verify you see:

```
☑ Reports #
  ├─ ☑ All Reports Hub
  ├─ ☐ Sales Reports #
  │   ├─ ☐ Sales Today
  │   ├─ ☐ Sales History
  │   └─ ☐ Sales Per Cashier
  ├─ ☑ Purchase Reports #
  │   ├─ ☑ Purchase Analytics
  │   ├─ ☑ Purchase Trends
  │   └─ ☑ Purchase Items Report
  ├─ ☑ Inventory Reports #
  │   ├─ ☑ Stock Alert Report
  │   ├─ ☑ Historical Inventory
  │   └─ ☑ Inventory Valuation
  └─ ☑ Transfer Reports #
      ├─ ☑ Transfers Report
      ├─ ☐ Transfer Trends        ← TEST THIS!
      └─ ☑ Transfers per Item
```

### 4. Test Individual Control
1. **Uncheck** "Transfer Trends" (leave others checked)
2. Click **"Save Changes"**
3. Wait for success notification
4. **Log out** of the application
5. **Log back in** as Warehouse Manager user
6. Open sidebar and expand "Reports" → "Transfer Reports"
7. **Verify**: "Transfer Trends" should NOT appear
8. **Verify**: "Transfers Report" and "Transfers per Item" SHOULD appear

### 5. Test # Indicator
**What to verify:**
- Parent menus with children show blue `#` symbol
- Example: "Reports #", "Transfer Reports #"
- Menus without children don't show `#`
- Example: "Transfers Report" (no # symbol)

### 6. Test Visual Indentation
**What to verify:**
- Level 1 (Parents): No indentation, bold text
- Level 2 (Children): Indented 8 units, normal text
- Level 3 (Grandchildren): Indented 16 units, smaller text
- Border line on left connects related items

## Expected Behavior

### Before Fix ❌
- Only 2 levels visible
- Transfer Reports showed:
  ```
  ☑ Transfer Reports
  ```
- No control over individual report items
- Checking "Transfer Reports" enabled ALL sub-items

### After Fix ✅
- Full 3 levels visible
- Transfer Reports shows:
  ```
  ☑ Transfer Reports #
      ├─ ☑ Transfers Report
      ├─ ☐ Transfer Trends        ← Can toggle individually!
      └─ ☑ Transfers per Item
  ```
- Individual control over each report
- Granular permissions

## Complete Test Checklist

- [ ] Menu Permissions page loads without errors
- [ ] Role selection works
- [ ] All 3 levels are visible
- [ ] Blue # indicator appears on parents with children
- [ ] Checkboxes work for all levels
- [ ] Individual grandchildren can be toggled
- [ ] Save button saves changes successfully
- [ ] After logout/login, changes are reflected in sidebar
- [ ] Sidebar respects individual grandchild selections
- [ ] Disabled grandchildren don't appear in sidebar
- [ ] Enabled grandchildren appear in sidebar

## Common Issues

### Issue: Grandchildren not showing in UI
**Solution**: Clear browser cache and refresh page

### Issue: Changes not saving
**Solution**:
1. Check browser console for errors
2. Verify you clicked "Save Changes" button
3. Wait for success notification before navigating away

### Issue: Sidebar still shows disabled menus
**Solution**:
1. **Log out** completely
2. **Log back in** (session must refresh)
3. Check sidebar again

### Issue: # indicator not showing
**Solution**:
1. Verify the menu actually has children in database
2. Refresh the page
3. Re-select the role

## Database Verification

To verify the 3-level structure in database:

```sql
-- Check Transfer Reports hierarchy
SELECT
  m1.name as level1,
  m2.name as level2,
  m3.name as level3
FROM menu_permissions m3
LEFT JOIN menu_permissions m2 ON m3.parentId = m2.id
LEFT JOIN menu_permissions m1 ON m2.parentId = m1.id
WHERE m1.key = 'reports'
  AND m2.key = 'transfer_reports'
ORDER BY m3.order;
```

Expected result:
```
level1  | level2           | level3
--------|------------------|------------------
Reports | Transfer Reports | Transfers Report
Reports | Transfer Reports | Transfer Trends
Reports | Transfer Reports | Transfers per Item
```

## Success Criteria

✅ **Fix is successful when:**
1. All 3 menu levels are visible in UI
2. Individual grandchildren can be toggled on/off
3. Saved changes persist after logout/login
4. Sidebar shows only enabled menus at all levels
5. No TypeScript or runtime errors
6. Visual hierarchy is clear with indentation
7. # indicator shows where appropriate

---

**Test Date**: ____________
**Tested By**: ____________
**Result**: ☐ Pass  ☐ Fail
**Notes**: _______________________________________
