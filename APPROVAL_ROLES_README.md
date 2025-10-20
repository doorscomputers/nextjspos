# Approval Roles System - README

## What This Is

A complete **approval roles system** for UltimatePOS Modern that allows you to assign specialized roles for workflow approvals without granting full administrative access.

## Quick Overview

### 6 Approval Roles Created

1. **Transfer Approver** - Approve inventory transfers between locations
2. **GRN Approver** - Approve Goods Received Notes (purchase receipts)
3. **Inventory Correction Approver** - Approve inventory corrections
4. **Return Approver** - Approve customer/supplier returns
5. **Purchase Approver** - Approve purchase orders
6. **QC Inspector** - Conduct quality control inspections

### Core Principles

- ✅ **View-only** access to related data
- ✅ **Approval-focused** permissions only
- ✅ **Location-aware** (restrict to specific branches)
- ✅ **Multi-role compatible** (users can have multiple roles)
- ✅ **Audit trail** for all actions

---

## Quick Start (3 Steps)

### Step 1: Create the Roles

```bash
node scripts/create-approval-roles.mjs
```

This creates all 6 approval roles for each business in your database.

### Step 2: Assign Roles to Users

**Option A: Interactive (Recommended)**
```bash
node scripts/assign-approval-role.mjs
```

**Option B: Manual (SQL)**
```sql
-- Get role ID
SELECT id FROM roles WHERE name = 'Transfer Approver';

-- Assign to user
INSERT INTO user_roles (user_id, role_id)
VALUES (123, 456);
```

### Step 3: Test It

1. Login as the user with the approval role
2. Navigate to the relevant section (e.g., Transfers)
3. Verify approval options appear
4. Test approve/reject functionality

---

## Documentation

### For End Users

- **Quick Start Guide** → `APPROVAL_ROLES_QUICK_START.md`
- **Visual Workflows** → `APPROVAL_WORKFLOWS_DIAGRAM.md`

### For Administrators

- **Complete Guide** → `APPROVAL_ROLES_GUIDE.md` (6,000+ words)
- **Implementation Summary** → `APPROVAL_ROLES_SUMMARY.md`

### For Developers

- **RBAC System** → `src/lib/rbac.ts`
- **Database Schema** → `prisma/schema.prisma`

---

## Files Included

### Scripts
- ✅ `scripts/create-approval-roles.mjs` - Create roles (Node.js)
- ✅ `scripts/create-approval-roles.sql` - Create roles (SQL)
- ✅ `scripts/assign-approval-role.mjs` - Assign roles interactively

### Documentation
- ✅ `APPROVAL_ROLES_README.md` - This file
- ✅ `APPROVAL_ROLES_QUICK_START.md` - Quick reference
- ✅ `APPROVAL_ROLES_GUIDE.md` - Complete documentation
- ✅ `APPROVAL_ROLES_SUMMARY.md` - Implementation summary
- ✅ `APPROVAL_WORKFLOWS_DIAGRAM.md` - Visual workflows

---

## Example Use Cases

### Scenario 1: Multi-Location Retail Chain

**Problem:** Branch managers shouldn't approve their own transfer requests.

**Solution:**
```
Branch Manager A creates transfer request
↓
Transfer Approver (Warehouse Manager) reviews and approves
↓
Stock is sent and received
```

**Roles Assigned:**
- Branch Manager A: `Branch Manager` role (can create transfers)
- Warehouse Manager: `Transfer Approver` role (can approve transfers)

---

### Scenario 2: Quality Control Workflow

**Problem:** Need QC inspection before accepting goods from suppliers.

**Solution:**
```
Goods arrive from supplier
↓
Warehouse staff creates GRN
↓
QC Inspector conducts inspection
↓
GRN Approver approves receipt (if QC passed)
↓
Inventory is updated
```

**Roles Assigned:**
- Warehouse Staff: `PURCHASE_RECEIPT_CREATE` permission
- QC Inspector: `QC Inspector` role
- Warehouse Manager: `GRN Approver` role

---

### Scenario 3: Cashier with Return Approval

**Problem:** Cashiers need to approve small returns without calling a manager.

**Solution:**
```
Assign both roles to the cashier:
- Regular Cashier (can process sales)
- Return Approver (can approve returns)
```

**Result:** Cashier can handle returns immediately at POS.

---

## Permission Breakdown

### Transfer Approver (13 permissions)
```
dashboard.view
stock_transfer.view
stock_transfer.check
stock_transfer.send
stock_transfer.receive
stock_transfer.verify
stock_transfer.complete
stock_transfer.cancel
location.view
product.view
report.transfer.view
report.transfer.trends
audit_log.view
```

### GRN Approver (11 permissions)
```
dashboard.view
purchase.receipt.view
purchase.receipt.approve
purchase.view
product.view
supplier.view
serial_number.view
serial_number.track
location.view
report.purchase.view
audit_log.view
```

### Inventory Correction Approver (10 permissions)
```
dashboard.view
inventory_correction.view
inventory_correction.approve
product.view
location.view
inventory_ledger.view
report.stock.view
report.stock_alert
view_inventory_reports
audit_log.view
```

### Return Approver (11 permissions)
```
dashboard.view
customer_return.view
customer_return.approve
supplier_return.view
supplier_return.approve
product.view
customer.view
supplier.view
location.view
serial_number.view
audit_log.view
```

### Purchase Approver (8 permissions)
```
dashboard.view
purchase.view
purchase.approve
product.view
supplier.view
location.view
report.purchase.view
audit_log.view
```

### QC Inspector (9 permissions)
```
dashboard.view
qc_inspection.view
qc_inspection.conduct
qc_inspection.approve
qc_template.view
product.view
purchase.receipt.view
supplier.view
audit_log.view
```

---

## Location-Based Access

### Restrict to Specific Locations

```javascript
// Assign user to specific locations
await prisma.userLocation.createMany({
  data: [
    { userId: 123, locationId: 1 }, // Main Warehouse
    { userId: 123, locationId: 2 }  // Retail Branch A
  ]
})
```

### Grant Access to All Locations

```javascript
// Find permission
const permission = await prisma.permission.findUnique({
  where: { name: 'access_all_locations' }
})

// Assign to role
await prisma.rolePermission.create({
  data: {
    roleId: 456,
    permissionId: permission.id
  }
})
```

---

## Troubleshooting

### Issue: User can't see approval options

**Check:**
1. Is role assigned in `user_roles` table?
2. Are permissions assigned in `role_permissions` table?
3. Has user logged out and back in?

**Fix:**
```bash
node scripts/assign-approval-role.mjs
```

---

### Issue: Permission denied errors

**Check:**
1. Does permission name match exactly?
2. Is permission assigned to the role?
3. Does session include updated permissions?

**Fix:**
```javascript
// Verify in code
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
const canApprove = hasPermission(user, PERMISSIONS.STOCK_TRANSFER_SEND)
console.log('Can approve:', canApprove)
```

---

### Issue: User sees all locations

**Check:**
1. Does user have `access_all_locations` permission?
2. Are locations assigned in `user_locations` table?

**Fix:**
```sql
-- Remove all-location access
DELETE FROM role_permissions
WHERE role_id = 456
  AND permission_id = (SELECT id FROM permissions WHERE name = 'access_all_locations');

-- Assign specific locations
INSERT INTO user_locations (user_id, location_id)
VALUES (123, 1), (123, 2);
```

---

## Security Best Practices

### DO ✅

- Separate requestor and approver roles
- Log all approval actions
- Review audit logs regularly
- Use least privilege principle
- Require strong passwords for approvers

### DON'T ❌

- Assign both creator and approver roles to same user for same location
- Give approvers create/edit/delete permissions
- Skip audit logging
- Share approver accounts
- Use weak passwords

---

## Advanced Usage

### Multi-Level Approval

```javascript
// Check approval limits
const approvalLimits = {
  'Transfer Approver': 10000,
  'Branch Manager': 50000,
  'Regional Manager': Infinity
}

const userMaxApproval = Math.max(
  ...user.roles.map(role => approvalLimits[role] || 0)
)

if (transfer.totalValue > userMaxApproval) {
  return NextResponse.json({
    error: 'Requires higher approval authority'
  }, { status: 403 })
}
```

### Conditional Approval

```javascript
// Weekend transfers require manager approval
const isWeekend = [0, 6].includes(new Date().getDay())

if (isWeekend && !hasRole(user, 'Branch Manager')) {
  return NextResponse.json({
    error: 'Weekend transfers require manager approval'
  }, { status: 403 })
}
```

---

## Integration with Existing Code

### API Route Example

```typescript
// src/app/api/transfers/[id]/approve/route.ts

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check permission
  if (!hasPermission(session.user, PERMISSIONS.STOCK_TRANSFER_SEND)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const transferId = parseInt(params.id)
  const { approved, reason } = await req.json()

  try {
    // Update transfer
    const transfer = await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedBy: session.user.id,
        approvedAt: new Date(),
        rejectionReason: approved ? null : reason
      }
    })

    // Log action
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        businessId: session.user.businessId,
        action: approved ? 'APPROVE_TRANSFER' : 'REJECT_TRANSFER',
        entity: 'Transfer',
        entityId: transferId,
        description: approved
          ? `Approved transfer #${transferId}`
          : `Rejected transfer #${transferId}: ${reason}`
      }
    })

    return NextResponse.json({ success: true, transfer })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## Verification

### Check Role Assignment

```sql
-- See which roles a user has
SELECT u.username, r.name as role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.id = 123;
```

### Check Permissions

```sql
-- See all permissions for a role
SELECT r.name as role_name, p.name as permission_name
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE r.name = 'Transfer Approver';
```

### Check Location Access

```sql
-- See which locations a user can access
SELECT u.username, bl.name as location_name
FROM users u
JOIN user_locations ul ON u.id = ul.user_id
JOIN business_locations bl ON ul.location_id = bl.id
WHERE u.id = 123;
```

---

## Support

### Need Help?

1. **Read the docs** → `APPROVAL_ROLES_GUIDE.md`
2. **Check workflows** → `APPROVAL_WORKFLOWS_DIAGRAM.md`
3. **Review code** → `src/lib/rbac.ts`
4. **Check schema** → `prisma/schema.prisma`

### Found a Bug?

1. Check audit logs for clues
2. Verify permissions are assigned correctly
3. Test with Prisma Studio
4. Review API route logic

---

## Next Steps

1. ✅ Run `node scripts/create-approval-roles.mjs`
2. ✅ Verify roles in Prisma Studio
3. ✅ Assign roles to test users
4. ✅ Test approval workflows
5. ✅ Configure location access
6. ✅ Review audit logs
7. ✅ Train users
8. ✅ Monitor and optimize

---

## License

Part of UltimatePOS Modern - Multi-Tenant POS System

---

## Version History

- **v1.0.0** (2025-10-18) - Initial release
  - 6 approval roles created
  - Complete documentation
  - Setup and assignment scripts
  - Visual workflow diagrams

---

**Created:** 2025-10-18
**Author:** UltimatePOS Development Team
**Status:** Production Ready ✅
