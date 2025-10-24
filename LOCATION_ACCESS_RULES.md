# Location Access Rules & Exceptions

## Overview

The POS system enforces location-based access control to ensure data isolation in multi-location businesses. However, certain roles have special access privileges.

---

## Role-Based Access Levels

### 1. 🔴 Super Admin (Platform Owner)
**Access:** ALL locations across ALL businesses
**Location Assignment:** Not required
**Reasoning:** Super Admin owns the platform and needs complete visibility

**Permissions:**
- ✅ View all shifts from any location
- ✅ Generate X/Z readings for any location
- ✅ Access sales data from all locations
- ✅ Manage users and settings for all locations
- ✅ View inventory across all locations

**How it Works:**
```typescript
if (isSuperAdmin) {
  // Automatically gets all locations in business
  userLocationIds = allLocationsInBusiness
}
```

---

### 2. 🟠 All Branch Admin
**Access:** ALL locations within their business
**Location Assignment:** Not required
**Reasoning:** Manages entire business across all branches

**Permissions:**
- ✅ View all shifts from any branch
- ✅ Generate X/Z readings for any branch
- ✅ Access sales data from all branches
- ✅ Manage users within their business
- ✅ View consolidated reports across locations

**Use Cases:**
- Business owner with multiple branches
- Operations manager overseeing all locations
- Accountant needing full financial visibility

---

### 3. 🟡 Branch Manager / Main Branch Manager
**Access:** ONLY assigned locations
**Location Assignment:** **REQUIRED**
**Reasoning:** Manages specific branch(es) only

**Permissions:**
- ✅ View shifts from assigned locations only
- ✅ Generate X/Z readings for assigned locations
- ✅ Access sales data from assigned locations
- ✅ Manage staff at assigned locations

**Restrictions:**
- ❌ Cannot view other branches' data
- ❌ Cannot access unassigned locations

---

### 4. 🟢 Cashier / Regular Staff
**Access:** ONLY assigned location(s)
**Location Assignment:** **REQUIRED**
**Reasoning:** Operates at specific location(s)

**Permissions:**
- ✅ Process sales at assigned location
- ✅ Generate X reading for own shift
- ✅ View own sales history
- ✅ Access inventory at assigned location

**Restrictions:**
- ❌ Cannot view other locations
- ❌ Cannot access other cashiers' data (unless has special permission)

---

## Implementation Details

### Files Modified

1. **X Reading API** - `src/app/api/readings/x-reading/route.ts`
   ```typescript
   // Lines 25-57: Role-based location access
   if (isSuperAdmin || isAllBranchAdmin) {
     // Get ALL locations
   } else {
     // Get only assigned locations
   }
   ```

2. **Z Reading API** - `src/app/api/readings/z-reading/route.ts`
   ```typescript
   // Lines 30-61: Same logic as X Reading
   ```

### Security Considerations

**Multi-Tenant Isolation:**
- Super Admin can only see locations in their business (not other businesses)
- All Branch Admin limited to their business
- Location filtering always includes `businessId` check

**Audit Trail:**
- All access is logged with user ID and role
- Location access is tracked in audit logs
- Permission checks happen on every API call

---

## How to Assign Locations

### For Super Admin / All Branch Admin
**No action needed** - Automatically get access to all locations

### For Managers and Cashiers

#### Option 1: Via UI (When Available)
1. Go to Users management
2. Edit user
3. Select locations to assign
4. Save

#### Option 2: Via Script
```bash
npx tsx scripts/assign-user-location.ts
```

Follow the prompts to assign locations.

---

## Common Scenarios

### Scenario 1: Super Admin Cannot Access Readings
**Problem:** Super Admin seeing "No location assigned" error

**Solution:** ✅ Fixed! Super Admin now automatically gets all locations

**Files Changed:**
- X Reading API
- Z Reading API

---

### Scenario 2: Branch Manager Needs Multiple Locations
**Problem:** Manager oversees 2 branches but only assigned to 1

**Solution:** Assign manager to both locations

**Steps:**
```bash
npx tsx scripts/assign-user-location.ts
# Choose manager username
# Select "all" or choose multiple locations
```

---

### Scenario 3: Cashier Transferred to New Branch
**Problem:** Cashier moved from Branch A to Branch B

**Solution:** Update location assignment

**Database:**
```sql
-- Remove old location
DELETE FROM user_locations
WHERE user_id = X AND location_id = OLD_LOCATION_ID;

-- Add new location
INSERT INTO user_locations (user_id, location_id)
VALUES (X, NEW_LOCATION_ID);
```

**Or use script:**
```bash
npx tsx scripts/assign-user-location.ts
```

---

### Scenario 4: Manager Promoted to All Branch Admin
**Problem:** Manager promoted, needs access to all locations

**Solution:**
1. Change role to "All Branch Admin"
2. Remove location assignments (no longer needed)

**Result:** Automatically gets access to all locations

---

## Testing Location Access

### Test 1: Super Admin Access
```bash
# Login as Super Admin
# Go to X Reading
# Should see data from all locations without assignment
✅ Expected: Works without location assignment
```

### Test 2: All Branch Admin Access
```bash
# Login as All Branch Admin
# Go to Readings History
# Should see all locations' readings
✅ Expected: Can filter/view all locations
```

### Test 3: Branch Manager Access
```bash
# Login as Branch Manager with NO location assignment
# Try to access X Reading
❌ Expected: "No location assigned" error

# Assign location
npx tsx scripts/assign-user-location.ts

# Try again
✅ Expected: Can access assigned location's data
```

### Test 4: Cashier Access
```bash
# Login as Cashier
# Go to POS
# Should only see assigned location
✅ Expected: Location dropdown shows only assigned locations
```

---

## Troubleshooting

### Error: "No location assigned"

**For Super Admin/All Branch Admin:**
- ✅ Should never happen (auto-assigned)
- If happens: Check role assignment in database
- Verify user.roles includes "Super Admin" or "All Branch Admin"

**For Managers/Cashiers:**
- ❌ Expected error if no locations assigned
- Solution: Assign locations via script or UI

### User Can't See Expected Locations

**Check:**
1. Role assigned correctly?
2. Locations exist and not deleted?
3. User logged out and back in?
4. Database: `SELECT * FROM user_locations WHERE user_id = X`

---

## Database Schema

### `user_locations` Table
```sql
CREATE TABLE user_locations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  location_id INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);
```

### Role Check Query
```sql
-- Check user's roles
SELECT u.username, r.name as role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.id = ?;

-- Check user's assigned locations
SELECT u.username, bl.name as location_name
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
JOIN business_locations bl ON ul.location_id = bl.id
WHERE u.id = ?;
```

---

## Best Practices

### 1. Role Assignment
- Use Super Admin sparingly (1-2 per business)
- Use All Branch Admin for business owners
- Use Branch Manager for location heads
- Use Cashier for POS operators

### 2. Location Assignment
- Always assign locations to new users (except Super Admin/All Branch Admin)
- Review location assignments quarterly
- Remove assignments when staff leaves
- Update assignments when staff transfers

### 3. Security
- Never bypass location checks for regular users
- Always log location access
- Audit location assignments regularly
- Use least-privilege principle

### 4. Testing
- Test with each role type
- Verify location filtering works
- Check edge cases (no location, multiple locations)
- Ensure audit logs capture access

---

## Related Documentation

- `COMPLETE_FIX_SUMMARY.md` - All fixes implemented
- `READINGS_HISTORY_GUIDE.md` - How to use readings history
- `SHIFT_CLOSE_FIX.md` - Variance calculation fix
- `scripts/assign-user-location.ts` - Location assignment script

---

## Summary

| Role | Location Assignment Required? | Access Level |
|------|------------------------------|--------------|
| Super Admin | ❌ No | All locations (all businesses) |
| All Branch Admin | ❌ No | All locations (their business) |
| Branch Manager | ✅ Yes | Assigned locations only |
| Main Branch Manager | ✅ Yes | Assigned locations only |
| Branch Admin | ✅ Yes | Assigned locations only |
| Cashier | ✅ Yes | Assigned locations only |

**Key Point:** Super Admin and All Branch Admin automatically get access to all locations without needing explicit assignments. All other roles require location assignment.

---

*Last Updated: 2025-10-24*
*Applies to: X Reading, Z Reading, Readings History*
