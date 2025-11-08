# Inventory Correction User System

## Overview

This document explains the **location-specific inventory correction user system** implemented to ensure accurate and accountable stock counting across multiple business locations.

## Why Location-Specific Users?

### Industry Best Practices

1. **Accountability & Audit Trail**
   - Each physical count is tied to a specific user at a specific location
   - Clear responsibility: "Who counted the stock at Bambang on Dec 15?"
   - Prevents confusion when multiple locations are being counted simultaneously

2. **Prevents Location Errors**
   - Users can ONLY access their assigned location
   - Eliminates risk of accidentally counting Bambang stock while logged in as Main Store
   - Critical for multi-location businesses

3. **Physical Security**
   - Matches real-world workflow: Physical stock counters at each branch
   - User credentials can be shared with on-site staff without exposing other locations
   - Supports segregation of duties (count vs. approve)

4. **Approval Workflow**
   - Separation between "Counters" (inventory correction users) and "Approvers"
   - Matches accounting best practices: person who counts ≠ person who approves
   - Prevents single-person fraud

## User Accounts Created

### Inventory Counter Users (Location-Specific)

| Username | Password | Location | Full Name | Email |
|----------|----------|----------|-----------|-------|
| `invcormain` | `111111` | Main Store | Inventory Counter Main Store | invcormain@pcinetstore.com |
| `invcorbambang` | `111111` | Bambang | Inventory Counter Bambang | invcorbambang@pcinetstore.com |
| `invcortugue` | `111111` | Tuguegarao Downtown | Inventory Counter Tuguegarao | invcortugue@pcinetstore.com |

**Role**: `Inventory Counter`

**Permissions**:
- ✅ `dashboard.view` - Access dashboard
- ✅ `product.view` - View products
- ✅ `inventory_correction.view` - View inventory corrections
- ✅ `inventory_correction.create` - Create inventory corrections
- ✅ `inventory_correction.update` - Update pending corrections
- ❌ `inventory_correction.approve` - **CANNOT APPROVE** (separation of duties)
- ❌ `inventory_correction.delete` - Cannot delete corrections

**Location Access**: Each user is restricted to ONE specific location only.

### Inventory Correction Approver

| Username | Password | Location | Full Name | Email |
|----------|----------|----------|-----------|-------|
| `invcorApprover` | `111111` | **ALL LOCATIONS** | Inventory Correction Approver | approver@pcinetstore.com |

**Role**: `Inventory Correction Approver`

**Permissions**:
- ✅ `dashboard.view` - Access dashboard
- ✅ `product.view` - View products
- ✅ `inventory_correction.view` - View inventory corrections
- ✅ `inventory_correction.approve` - **APPROVE corrections from all locations**
- ✅ `inventory_correction.delete` - Delete corrections if needed
- ✅ `stock_report.view` - View stock reports
- ✅ `view_inventory_reports` - View inventory reports
- ✅ `access_all_locations` - **Access all locations**
- ❌ `inventory_correction.create` - **CANNOT CREATE** (separation of duties)
- ❌ `inventory_correction.update` - Cannot edit corrections

**Location Access**: Has `ACCESS_ALL_LOCATIONS` permission - can see and approve corrections from ALL business locations.

## Workflow Example

### Scenario: Physical Stock Count at Bambang Branch

1. **Login as Counter**
   - Username: `invcorbambang`
   - Password: `111111`
   - User sees ONLY Bambang location in location dropdown

2. **Create Inventory Correction**
   - Navigate to: Inventory → Inventory Corrections → New Correction
   - Select product (e.g., "Dell Inspiron 15 Laptop")
   - Location is auto-selected: **Bambang** (cannot change)
   - Enter physical count: 12 units
   - System Count shows: 8 units
   - Difference: +4 units
   - Reason: "Count Error" or "Found"
   - Click "Create Correction" → Status: **Pending**

3. **Logout and Login as Approver**
   - Username: `invcorApprover`
   - Password: `111111`
   - User can see corrections from ALL locations

4. **Approve Correction**
   - Navigate to: Inventory → Inventory Corrections
   - See all pending corrections from ALL branches
   - Click "Approve" on the Bambang correction
   - Inventory at Bambang is updated: 8 → 12 units
   - Product history records the adjustment with audit trail

## Technical Implementation

### 1. RBAC Roles (`src/lib/rbac.ts`)

```typescript
INVENTORY_COUNTER: {
  name: 'Inventory Counter',
  description: 'Physical stock counter - creates inventory corrections for assigned location only (cannot approve)',
  category: 'Product & Inventory',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.INVENTORY_CORRECTION_VIEW,
    PERMISSIONS.INVENTORY_CORRECTION_CREATE,
    PERMISSIONS.INVENTORY_CORRECTION_UPDATE,
  ],
},

INVENTORY_CORRECTION_APPROVER: {
  name: 'Inventory Correction Approver',
  description: 'Approves inventory corrections from all locations (cannot create)',
  category: 'Product & Inventory',
  permissions: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.PRODUCT_VIEW,
    PERMISSIONS.INVENTORY_CORRECTION_VIEW,
    PERMISSIONS.INVENTORY_CORRECTION_APPROVE,
    PERMISSIONS.INVENTORY_CORRECTION_DELETE,
    PERMISSIONS.STOCK_REPORT_VIEW,
    PERMISSIONS.VIEW_INVENTORY_REPORTS,
    PERMISSIONS.ACCESS_ALL_LOCATIONS,
  ],
},
```

### 2. Database Seed (`prisma/seed.ts`)

Users are created with:
- Unique usernames
- Password: `111111` (hashed with bcrypt)
- Business association
- Role assignment (Inventory Counter or Approver)
- Location assignment (specific location or ALL locations)

### 3. Location Isolation

**Inventory Counters** (location-specific):
```typescript
await prisma.userLocation.create({
  data: {
    userId: invcorMainUser.id,
    locationId: mainLocation.id, // Restricted to Main Store
  },
})
```

**Inventory Correction Approver** (all locations):
```typescript
// NO userLocation record created
// User has ACCESS_ALL_LOCATIONS permission
// Can see data from all locations in the business
```

## Security Benefits

### Separation of Duties
- **Counter cannot approve** their own counts
- **Approver cannot create** corrections
- Requires two different users for complete workflow

### Location Restriction
- Each counter is "locked" to their physical location
- Impossible to accidentally count wrong location's stock
- Approver has oversight across all locations

### Audit Trail
Every inventory correction records:
- Who created it (counter user)
- Which location
- When it was created
- Who approved it (approver user)
- When it was approved
- Old quantity vs. new quantity
- Reason for correction

## Testing the System

### Test 1: Verify Location Restriction

1. Login as `invcormain` (password: `111111`)
2. Go to Inventory → Inventory Corrections → New Correction
3. Try to select location dropdown
4. **Expected**: Only "Main Store" appears

### Test 2: Verify Counter Cannot Approve

1. Still logged in as `invcormain`
2. Create a pending inventory correction
3. Go to Inventory Corrections list
4. **Expected**: No "Approve" button visible (only View/Edit)

### Test 3: Verify Approver Cannot Create

1. Login as `invcorApprover` (password: `111111`)
2. Try to go to Inventory → Inventory Corrections → New Correction
3. **Expected**: Menu item may be hidden OR button is disabled

### Test 4: Verify Approver Sees All Locations

1. Still logged in as `invcorApprover`
2. Go to Inventory Corrections list
3. **Expected**: See corrections from Main Store, Bambang, Tuguegarao
4. Click "Approve" on any correction
5. **Expected**: Approval succeeds, inventory updated

## How to Add More Locations

If you add a 4th location (e.g., "Solano Branch"):

1. **Create new location** in database via admin panel or seed script
2. **Create new inventory counter user**:
   ```sql
   INSERT INTO users (username, password, email, ...)
   VALUES ('invcorsolano', '$2a$10$...', 'invcorsolano@pcinetstore.com', ...)
   ```
3. **Assign Inventory Counter role**:
   ```sql
   INSERT INTO user_roles (userId, roleId)
   VALUES (new_user_id, inventory_counter_role_id)
   ```
4. **Assign Solano location**:
   ```sql
   INSERT INTO user_locations (userId, locationId)
   VALUES (new_user_id, solano_location_id)
   ```

## Changing Default Password

After seeding, it's recommended to change passwords via:

1. **Login as Super Admin** (`superadmin` / `password`)
2. Go to **Settings → Users**
3. Find each inventory correction user
4. Click "Edit" → Change password to a secure one
5. Communicate new passwords securely to on-site staff

## Best Practices

1. **DO NOT share credentials** between multiple people
2. **Change default passwords** after first login
3. **Use strong passwords** for production environments
4. **Regularly audit** inventory corrections for anomalies
5. **Train staff** on proper stock counting procedures
6. **Review approvals weekly** to catch systemic issues

## Troubleshooting

### Problem: Counter sees all locations
**Cause**: User has `ACCESS_ALL_LOCATIONS` permission
**Fix**: Remove that permission from the role OR ensure user has only ONE location assigned

### Problem: Counter can approve their own corrections
**Cause**: User has `inventory_correction.approve` permission
**Fix**: Remove that permission from the "Inventory Counter" role

### Problem: Approver cannot see some locations
**Cause**: Approver is missing `ACCESS_ALL_LOCATIONS` permission
**Fix**: Add permission to "Inventory Correction Approver" role

## Important: Warehouse Manager Role

**Note**: The **Warehouse Manager** role has been configured to **REQUIRE APPROVAL** for inventory corrections:

- ✅ Can CREATE inventory corrections
- ✅ Can UPDATE pending corrections
- ❌ **CANNOT APPROVE** corrections (separation of duties enforced)

**Flexible Approval Options**:
1. **Use dedicated approver**: Login as `invcorApprover` to approve warehouse corrections
2. **Assign both roles**: Give Jheiron both "Warehouse Manager" AND "Inventory Correction Approver" roles if fully trusted
3. **Super Admin override**: Super Admin can always approve in emergencies

This ensures proper checks and balances even for senior warehouse staff, following accounting best practices.

## Related Files

- **RBAC Configuration**: `src/lib/rbac.ts` (lines 859-886 for inventory roles, 2094-2149 for Warehouse Manager)
- **Database Seed**: `prisma/seed.ts` (lines 365-734)
- **Inventory Correction Form**: `src/app/dashboard/inventory-corrections/new/page.tsx`
- **Inventory Correction List**: `src/app/dashboard/inventory-corrections/page.tsx`
- **Inventory Correction API**: `src/app/api/inventory-corrections/route.ts`

## Summary

This implementation follows **accounting best practices** for inventory control:
- ✅ Separation of duties (count vs. approve) - **ENFORCED FOR ALL USERS INCLUDING WAREHOUSE MANAGER**
- ✅ Location-based access control
- ✅ Complete audit trail
- ✅ Prevention of fraud
- ✅ Accurate responsibility tracking
- ✅ Flexible approval workflows (can assign multiple roles if needed)

The system ensures that **physical inventory counts are accurate, accountable, and properly approved** across all business locations.
