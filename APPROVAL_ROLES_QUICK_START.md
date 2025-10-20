# Approval Roles - Quick Start Guide

## What Are Approval Roles?

Specialized roles focused **ONLY** on approving/rejecting specific workflows:

1. **Transfer Approver** - Approve inventory transfers between locations
2. **GRN Approver** - Approve Goods Received Notes (purchase receipts)
3. **Inventory Correction Approver** - Approve inventory corrections
4. **Return Approver** - Approve customer/supplier returns
5. **Purchase Approver** - Approve purchase orders
6. **QC Inspector** - Conduct quality control inspections

## Key Principles

✅ **View-only** access to related data (cannot create/edit/delete)
✅ **Approval-focused** permissions (can approve/reject only)
✅ **Location-aware** (can be restricted to specific branches)
✅ **Minimal permissions** (only what's needed)
✅ **Multi-role compatible** (users can have multiple roles)

---

## Quick Installation

### Method 1: Node.js Script (Recommended)

```bash
node scripts/create-approval-roles.mjs
```

### Method 2: SQL Script

```sql
-- Edit the script first: Set @business_id to your business ID
-- Then run:
source scripts/create-approval-roles.sql
```

---

## Assign Role to User

### Interactive Script (Easiest)

```bash
node scripts/assign-approval-role.mjs
```

Follow the prompts to select:
- Business
- User
- Approval role
- (Optional) Specific locations

### Manual Assignment via SQL

```sql
-- Get role ID
SELECT id, name FROM roles WHERE name = 'Transfer Approver';

-- Assign to user
INSERT INTO user_roles (user_id, role_id)
VALUES (123, 456);
```

### Via Prisma

```javascript
await prisma.userRole.create({
  data: {
    userId: 123,
    roleId: 456
  }
})
```

---

## Permission Breakdown

### Transfer Approver

| Permission | Purpose |
|------------|---------|
| `dashboard.view` | Access dashboard |
| `stock_transfer.view` | View transfer requests |
| `stock_transfer.send` | Mark as sent |
| `stock_transfer.receive` | Mark as received |
| `stock_transfer.verify` | Verify transfers |
| `stock_transfer.complete` | Complete transfers |
| `stock_transfer.cancel` | Cancel transfers |
| `location.view` | View locations |
| `product.view` | View products |
| `report.transfer.view` | View transfer reports |
| `audit_log.view` | View audit trail |

**Cannot:** Create products, edit pricing, delete transfers

---

### GRN Approver

| Permission | Purpose |
|------------|---------|
| `dashboard.view` | Access dashboard |
| `purchase.receipt.view` | View GRNs |
| `purchase.receipt.approve` | Approve/reject GRNs |
| `purchase.view` | View purchase orders |
| `product.view` | View products |
| `supplier.view` | View suppliers |
| `serial_number.view` | View serial numbers |
| `serial_number.track` | Track serial numbers |
| `location.view` | View locations |
| `report.purchase.view` | View purchase reports |
| `audit_log.view` | View audit trail |

**Cannot:** Create purchase orders, edit suppliers, modify pricing

---

### Inventory Correction Approver

| Permission | Purpose |
|------------|---------|
| `dashboard.view` | Access dashboard |
| `inventory_correction.view` | View corrections |
| `inventory_correction.approve` | Approve/reject corrections |
| `product.view` | View products |
| `location.view` | View locations |
| `inventory_ledger.view` | View inventory history |
| `report.stock.view` | View stock reports |
| `report.stock_alert` | View stock alerts |
| `view_inventory_reports` | View inventory reports |
| `audit_log.view` | View audit trail |

**Cannot:** Create corrections, edit products, delete records

---

### Return Approver

| Permission | Purpose |
|------------|---------|
| `dashboard.view` | Access dashboard |
| `customer_return.view` | View customer returns |
| `customer_return.approve` | Approve/reject customer returns |
| `supplier_return.view` | View supplier returns |
| `supplier_return.approve` | Approve/reject supplier returns |
| `product.view` | View products |
| `customer.view` | View customers |
| `supplier.view` | View suppliers |
| `location.view` | View locations |
| `serial_number.view` | View serial numbers |
| `audit_log.view` | View audit trail |

**Cannot:** Create returns, process refunds, edit customer/supplier data

---

### Purchase Approver

| Permission | Purpose |
|------------|---------|
| `dashboard.view` | Access dashboard |
| `purchase.view` | View purchase orders |
| `purchase.approve` | Approve/reject purchase orders |
| `product.view` | View products |
| `supplier.view` | View suppliers |
| `location.view` | View locations |
| `report.purchase.view` | View purchase reports |
| `audit_log.view` | View audit trail |

**Cannot:** Create purchase orders, edit suppliers, receive goods

---

### QC Inspector

| Permission | Purpose |
|------------|---------|
| `dashboard.view` | Access dashboard |
| `qc_inspection.view` | View inspections |
| `qc_inspection.conduct` | Conduct inspections |
| `qc_inspection.approve` | Approve/reject inspections |
| `qc_template.view` | View QC templates |
| `product.view` | View products |
| `purchase.receipt.view` | View GRNs |
| `supplier.view` | View suppliers |
| `audit_log.view` | View audit trail |

**Cannot:** Create QC templates, edit products, bypass QC process

---

## Location-Based Access

### Assign User to Specific Locations

```javascript
// Allow user to access Main Warehouse and Retail Branch A
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

## Multi-Role Examples

### Example 1: Cashier + Return Approver
```
User can:
- Process sales (from Cashier role)
- Approve return requests (from Return Approver role)
```

### Example 2: Branch Manager + All Approvers
```
User can:
- Manage branch operations (from Branch Manager role)
- Approve transfers, GRNs, corrections, returns (from Approval roles)
```

### Example 3: QC Inspector + GRN Approver
```
User can:
- Conduct QC inspections (from QC Inspector role)
- Approve GRNs after QC pass (from GRN Approver role)
```

---

## Verification

### Check User Permissions

```javascript
const user = await prisma.user.findUnique({
  where: { id: 123 },
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    }
  }
})

// Extract all permissions
const allPermissions = user.roles.flatMap(ur =>
  ur.role.permissions.map(rp => rp.permission.name)
)

console.log('User permissions:', allPermissions)
```

### Check Role Assignment

```sql
-- Check which roles a user has
SELECT u.username, r.name as role_name
FROM users u
JOIN user_roles ur ON u.id = ur.user_id
JOIN roles r ON ur.role_id = r.id
WHERE u.id = 123;
```

---

## Troubleshooting

### Issue: User can't see approval options

**Solution:**
1. Verify role is assigned in `user_roles` table
2. Check permissions in `role_permissions` table
3. Ask user to logout and login again

### Issue: Permission denied errors

**Solution:**
1. Check permission name matches exactly (e.g., `stock_transfer.approve`)
2. Verify permission exists in `permissions` table
3. Check API route uses correct permission constant

### Issue: User sees all locations instead of assigned ones

**Solution:**
1. Remove `access_all_locations` permission from role
2. Assign specific locations in `user_locations` table
3. Verify location filtering logic in API routes

---

## Best Practices

### Security

✅ **Separate duties**: Don't assign creator AND approver to same user
✅ **Audit everything**: Log all approval actions
✅ **Review regularly**: Audit user roles quarterly
✅ **Least privilege**: Only assign necessary permissions

### Anti-Patterns

❌ **DON'T** assign both Cashier and Return Approver to same person in same location
❌ **DON'T** give approvers create/edit/delete permissions
❌ **DON'T** skip audit logging

---

## Next Steps

1. ✅ Run creation script
2. ✅ Verify roles in database
3. ✅ Assign roles to test users
4. ✅ Configure location access
5. ✅ Test approval workflows
6. ✅ Review audit logs
7. ✅ Train users

---

## Support

- **Full Documentation**: See `APPROVAL_ROLES_GUIDE.md`
- **RBAC Reference**: See `src/lib/rbac.ts`
- **Schema Reference**: See `prisma/schema.prisma`

---

**Created:** 2025-10-18
**Version:** 1.0.0
