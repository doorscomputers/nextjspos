# Approval Roles Guide - UltimatePOS Modern

## Overview

This guide explains the specialized approval roles created for the UltimatePOS Modern system. These roles are designed for users who need to approve/reject specific workflows without having full administrative access.

## Philosophy

**Approval roles follow these principles:**
- **View-only access** to related data (can see but cannot create/edit/delete)
- **Approval-focused permissions** (can approve/reject specific transactions)
- **Location-aware** (can be restricted to specific branches/locations)
- **Minimal permissions** (only what's needed to make informed approval decisions)
- **Separable from other roles** (users can have multiple roles)

---

## Available Approval Roles

### 1. Transfer Approver

**Purpose:** Approve or reject inventory transfers between business locations.

**Use Case:**
- Branch managers request to transfer stock from warehouse to retail location
- Transfer Approver reviews the request and approves/rejects it
- Can verify inventory levels before approving

**Permissions:**
- `dashboard.view` - Access to dashboard
- `stock_transfer.view` - View all transfer requests
- `stock_transfer.check` - Check transfer details
- `stock_transfer.send` - Mark transfers as sent
- `stock_transfer.receive` - Mark transfers as received
- `stock_transfer.verify` - Verify transfer accuracy
- `stock_transfer.complete` - Complete transfers
- `stock_transfer.cancel` - Cancel transfers
- `location.view` - View location information
- `product.view` - View product details
- `report.transfer.view` - View transfer reports
- `report.transfer.trends` - View transfer trends
- `audit_log.view` - View audit trail

**What they CANNOT do:**
- Create new products
- Edit product details
- Delete transfers created by others
- Modify pricing
- Access financial reports

**Example Workflow:**
```
1. Manager creates transfer request: Main Warehouse → Retail Branch A (100 units of Product X)
2. Transfer Approver receives notification
3. Transfer Approver reviews:
   - Is there enough stock in Main Warehouse?
   - Does Retail Branch A need this stock?
   - Is the quantity reasonable?
4. Transfer Approver approves/rejects the request
5. If approved, warehouse staff sends the stock
6. Transfer Approver marks it as received when stock arrives
```

---

### 2. GRN Approver (Goods Received Note Approver)

**Purpose:** Approve or reject purchase receipts when goods are received from suppliers.

**Use Case:**
- Warehouse receives goods from supplier
- Staff creates a GRN (Goods Received Note)
- GRN Approver verifies the receipt and approves it
- Once approved, inventory is updated

**Permissions:**
- `dashboard.view` - Access to dashboard
- `purchase.receipt.view` - View all GRNs/purchase receipts
- `purchase.receipt.approve` - Approve/reject GRNs
- `purchase.view` - View related purchase orders
- `product.view` - View product details
- `supplier.view` - View supplier information
- `serial_number.view` - View serial numbers
- `serial_number.track` - Track serial numbers
- `location.view` - View location information
- `report.purchase.view` - View purchase reports
- `audit_log.view` - View audit trail

**What they CANNOT do:**
- Create purchase orders
- Edit supplier information
- Modify product pricing
- Delete purchase records
- Access financial/profit reports

**Example Workflow:**
```
1. Purchase order created: Buy 200 units of Product Y from Supplier Z
2. Goods arrive at warehouse
3. Warehouse staff creates GRN for 200 units received
4. GRN Approver reviews:
   - Do quantities match the purchase order?
   - Is the quality acceptable?
   - Are serial numbers recorded (if applicable)?
5. GRN Approver approves the receipt
6. Inventory is automatically updated
```

---

### 3. Inventory Correction Approver

**Purpose:** Approve or reject inventory corrections and adjustments.

**Use Case:**
- Physical count reveals discrepancies
- Staff creates inventory correction request
- Inventory Correction Approver reviews and approves
- Stock levels are adjusted

**Permissions:**
- `dashboard.view` - Access to dashboard
- `inventory_correction.view` - View correction requests
- `inventory_correction.approve` - Approve/reject corrections
- `product.view` - View product details
- `location.view` - View location information
- `inventory_ledger.view` - View inventory movement history
- `report.stock.view` - View stock reports
- `report.stock_alert` - View stock alerts
- `view_inventory_reports` - View inventory reports
- `audit_log.view` - View audit trail

**What they CANNOT do:**
- Create inventory corrections directly
- Edit product details
- Delete correction records
- Access sales/purchase reports
- Modify pricing

**Example Workflow:**
```
1. Physical count shows 95 units but system shows 100 units (5 units missing)
2. Staff creates inventory correction request: -5 units
3. Inventory Correction Approver reviews:
   - Is the variance reasonable?
   - Was a physical count conducted?
   - Are there any theft/damage reports?
4. Approver investigates and approves the correction
5. System updates stock to 95 units
```

---

### 4. Return Approver

**Purpose:** Approve or reject customer returns and supplier returns.

**Use Case:**
- Customer wants to return a product
- Cashier initiates return request
- Return Approver reviews and approves
- Stock is returned to inventory

**Permissions:**
- `dashboard.view` - Access to dashboard
- `customer_return.view` - View customer return requests
- `customer_return.approve` - Approve/reject customer returns
- `supplier_return.view` - View supplier return requests
- `supplier_return.approve` - Approve/reject supplier returns
- `product.view` - View product details
- `customer.view` - View customer information
- `supplier.view` - View supplier information
- `location.view` - View location information
- `serial_number.view` - View serial numbers
- `audit_log.view` - View audit trail

**What they CANNOT do:**
- Create returns directly
- Modify return policies
- Edit customer/supplier details
- Process refunds (requires separate payment permission)
- Delete return records

**Example Workflow (Customer Return):**
```
1. Customer returns defective Product X (within warranty period)
2. Cashier creates customer return request
3. Return Approver reviews:
   - Is product within return period?
   - Is product condition acceptable?
   - Does serial number match original sale?
4. Approver accepts return
5. Stock is returned to inventory (marked as defective)
6. Refund is processed by accounting (separate permission)
```

**Example Workflow (Supplier Return):**
```
1. Quality control finds defective batch of Product Y
2. Staff creates supplier return request
3. Return Approver reviews:
   - Is defect verified by QC?
   - Is return within supplier's terms?
   - What is the batch/lot number?
4. Approver accepts return to supplier
5. Debit note is created
6. Stock is removed from inventory
```

---

### 5. Purchase Approver

**Purpose:** Approve or reject purchase orders before they are sent to suppliers.

**Use Case:**
- Staff creates purchase order
- Purchase Approver reviews budget and necessity
- Approved orders are sent to suppliers

**Permissions:**
- `dashboard.view` - Access to dashboard
- `purchase.view` - View purchase orders
- `purchase.approve` - Approve/reject purchase orders
- `product.view` - View product details
- `supplier.view` - View supplier information
- `location.view` - View location information
- `report.purchase.view` - View purchase reports
- `audit_log.view` - View audit trail

**What they CANNOT do:**
- Create purchase orders
- Edit supplier contracts
- Modify pricing
- Delete purchase records
- Receive goods (requires GRN Approver role)

**Example Workflow:**
```
1. Inventory manager creates purchase order for 500 units ($10,000)
2. Purchase Approver reviews:
   - Is the quantity justified?
   - Is the supplier reliable?
   - Is this within budget?
   - Are prices competitive?
3. Approver accepts/rejects the purchase order
4. If approved, order is sent to supplier
```

---

### 6. QC Inspector (Quality Control Inspector)

**Purpose:** Conduct quality control inspections and approve/reject batches.

**Use Case:**
- Goods arrive from supplier
- QC Inspector conducts inspection using QC templates
- Approves or rejects the batch based on inspection results

**Permissions:**
- `dashboard.view` - Access to dashboard
- `qc_inspection.view` - View inspection requests
- `qc_inspection.conduct` - Conduct inspections
- `qc_inspection.approve` - Approve/reject inspections
- `qc_template.view` - View QC templates/checklists
- `product.view` - View product details
- `purchase.receipt.view` - View related GRNs
- `supplier.view` - View supplier information
- `audit_log.view` - View audit trail

**What they CANNOT do:**
- Create QC templates (requires admin)
- Edit product specifications
- Modify supplier contracts
- Bypass QC process
- Delete inspection records

**Example Workflow:**
```
1. Batch of 1000 units arrives from supplier
2. QC Inspector selects appropriate QC template
3. Inspector conducts inspection:
   - Sample size: 50 units
   - Check dimensions, color, functionality
   - Record defect count: 2 defective units (4% defect rate)
4. Inspector approves batch (below 5% threshold)
5. Batch is approved for GRN processing
```

---

## Installation

### Step 1: Run the Setup Script

```bash
node scripts/create-approval-roles.mjs
```

This will create all 6 approval roles for each business in your database.

### Step 2: Verify Roles Were Created

```bash
npx prisma studio
```

Navigate to the `roles` table and verify the new roles exist.

---

## How to Assign Approval Roles to Users

### Method 1: Via Prisma Studio (GUI)

1. Open Prisma Studio: `npx prisma studio`
2. Navigate to `user_roles` table
3. Click "Add record"
4. Fill in:
   - `user_id`: The ID of the user
   - `role_id`: The ID of the approval role
5. Save

### Method 2: Via UI (Dashboard)

1. Login as Admin
2. Navigate to **Dashboard > Users**
3. Click on a user to edit
4. Assign the approval role(s)
5. Save changes

### Method 3: Via SQL

```sql
-- Get role ID
SELECT id, name FROM roles WHERE name = 'Transfer Approver';

-- Assign role to user
INSERT INTO user_roles (user_id, role_id)
VALUES (123, 456);
```

### Method 4: Via Prisma (Programmatically)

```javascript
import { prisma } from '@/lib/prisma'

// Assign Transfer Approver role to user
await prisma.userRole.create({
  data: {
    userId: 123,
    roleId: 456 // ID of Transfer Approver role
  }
})
```

---

## Location-Based Access Control

### Why Location Access Matters

Approval roles can be restricted to specific locations. For example:
- **Transfer Approver** for Main Warehouse only
- **GRN Approver** for Retail Branch A and B only
- **Return Approver** for all locations

### How to Assign Location Access

#### Option 1: Assign Locations to User

```javascript
// Allow user to access Main Warehouse and Retail Branch A
await prisma.userLocation.createMany({
  data: [
    { userId: 123, locationId: 1 }, // Main Warehouse
    { userId: 123, locationId: 2 }  // Retail Branch A
  ]
})
```

#### Option 2: Assign Locations to Role

```javascript
// Restrict Transfer Approver role to Main Warehouse only
await prisma.roleLocation.create({
  data: {
    roleId: 456, // Transfer Approver role
    locationId: 1 // Main Warehouse
  }
})
```

### Grant Access to All Locations

Assign the `ACCESS_ALL_LOCATIONS` permission to the role or user:

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

## Multi-Role Assignments

Users can have multiple roles. This is useful for flexible access control.

### Example Scenarios

#### Scenario 1: Cashier + Return Approver
```
User: John Doe
Roles:
  - Regular Cashier (can process sales)
  - Return Approver (can approve returns)

Result: John can handle sales AND approve return requests at the POS
```

#### Scenario 2: Branch Manager + All Approvers
```
User: Jane Smith
Roles:
  - Branch Manager
  - Transfer Approver
  - GRN Approver
  - Inventory Correction Approver

Result: Jane has full branch management + all approval capabilities
```

#### Scenario 3: Specialized QC + GRN Approver
```
User: Mike Johnson
Roles:
  - QC Inspector
  - GRN Approver

Result: Mike conducts QC inspections and approves GRNs in one workflow
```

### How to Assign Multiple Roles

```javascript
await prisma.userRole.createMany({
  data: [
    { userId: 123, roleId: 456 }, // Transfer Approver
    { userId: 123, roleId: 457 }, // GRN Approver
    { userId: 123, roleId: 458 }  // Return Approver
  ]
})
```

---

## Permission Inheritance

**How permissions work:**

1. **Role-based permissions**: Inherited from all assigned roles
2. **Direct permissions**: Assigned directly to the user (via `user_permissions`)
3. **Effective permissions**: Union of role-based + direct permissions

**Example:**

```
User: Sarah Lee
Roles:
  - Transfer Approver (has: stock_transfer.view, stock_transfer.approve)
  - GRN Approver (has: purchase.receipt.view, purchase.receipt.approve)

Direct Permissions:
  - report.profitability (assigned directly)

Effective Permissions:
  ✅ stock_transfer.view (from Transfer Approver)
  ✅ stock_transfer.approve (from Transfer Approver)
  ✅ purchase.receipt.view (from GRN Approver)
  ✅ purchase.receipt.approve (from GRN Approver)
  ✅ report.profitability (direct permission)
```

---

## Verification and Testing

### Test Approval Role Assignment

```javascript
// Get user with all permissions
const user = await prisma.user.findUnique({
  where: { id: 123 },
  include: {
    roles: {
      include: {
        role: {
          include: {
            permissions: {
              include: {
                permission: true
              }
            }
          }
        }
      }
    },
    permissions: {
      include: {
        permission: true
      }
    }
  }
})

// Extract all permission names
const rolePermissions = user.roles.flatMap(ur =>
  ur.role.permissions.map(rp => rp.permission.name)
)
const directPermissions = user.permissions.map(up => up.permission.name)
const allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

console.log('User permissions:', allPermissions)
```

### Test Location Access

```javascript
// Check if user has access to a location
const hasAccess = await prisma.userLocation.findUnique({
  where: {
    userId_locationId: {
      userId: 123,
      locationId: 1
    }
  }
})

console.log('Has access:', !!hasAccess)
```

---

## Audit Trail

All approval actions should be logged in the audit trail. This ensures accountability.

### What to Log

- **Transfer approvals**: Who approved, when, which transfer
- **GRN approvals**: Who approved, when, which GRN, which supplier
- **Inventory corrections**: Who approved, when, which correction, reason
- **Return approvals**: Who approved, when, customer/supplier, amount

### How to Log

```javascript
await prisma.auditLog.create({
  data: {
    userId: session.user.id,
    businessId: session.user.businessId,
    action: 'APPROVE_TRANSFER',
    entity: 'Transfer',
    entityId: transferId,
    description: `Approved transfer #${transferId} from ${fromLocation} to ${toLocation}`,
    ipAddress: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    userAgent: req.headers['user-agent']
  }
})
```

---

## Security Considerations

### Best Practices

1. **Separation of Duties**: Don't assign creator AND approver roles to the same user
2. **Location Isolation**: Restrict approvers to specific locations when necessary
3. **Audit Everything**: Log all approval actions with timestamp and user
4. **Review Regularly**: Audit user roles and permissions quarterly
5. **Least Privilege**: Only assign necessary permissions
6. **Strong Authentication**: Require strong passwords for approver accounts

### Anti-Patterns to Avoid

❌ **DON'T:** Assign both Cashier and Return Approver to the same person in the same location
✅ **DO:** Separate these roles or require manager override

❌ **DON'T:** Give approvers create/edit/delete permissions
✅ **DO:** Keep approval roles strictly approval-focused

❌ **DON'T:** Skip audit logging
✅ **DO:** Log every approval action with full context

---

## Troubleshooting

### Issue: User can't see approval options

**Diagnosis:**
```javascript
// Check user permissions
const user = await getServerSession(authOptions)
console.log('Permissions:', user.permissions)
```

**Solution:**
- Verify role is assigned in `user_roles` table
- Verify permissions are assigned in `role_permissions` table
- Check session is refreshed (logout/login)

### Issue: User sees all locations instead of assigned ones

**Diagnosis:**
```javascript
// Check if user has ACCESS_ALL_LOCATIONS
const hasAllAccess = user.permissions.includes('access_all_locations')
console.log('Has all location access:', hasAllAccess)
```

**Solution:**
- Remove `ACCESS_ALL_LOCATIONS` permission if not intended
- Verify `user_locations` table has correct assignments

### Issue: Permission denied errors

**Diagnosis:**
```javascript
// Check API route authorization
import { hasPermission } from '@/lib/rbac'

const canApprove = hasPermission(user, 'stock_transfer.approve')
console.log('Can approve transfers:', canApprove)
```

**Solution:**
- Verify permission constant name matches database
- Check permission is assigned to the role
- Verify session includes updated permissions

---

## Advanced Scenarios

### Scenario 1: Multi-Level Approval Workflow

```
Transfer Request: Warehouse → Retail (Value: $50,000)

Level 1: Transfer Approver (max $10,000)
  ❌ REJECTED - Exceeds approval limit

Level 2: Branch Manager (max $50,000)
  ✅ APPROVED - Within approval limit

Result: Transfer approved by Branch Manager
```

**Implementation:**
- Add `approvalLimit` field to `user_roles` table
- Check approval limits in API route before allowing approval

### Scenario 2: Conditional Approval Based on Location

```
GRN at Main Warehouse: Requires QC Inspector + GRN Approver
GRN at Retail Branch: Requires GRN Approver only

Implementation:
- Check location settings for QC requirement
- Enforce QC inspection approval before GRN approval if required
```

### Scenario 3: Time-Based Approval Windows

```
Weekend Transfer Requests: Require manager approval
Weekday Transfer Requests: Automatic approval if below $5,000

Implementation:
- Check day of week in approval logic
- Apply different approval rules based on schedule
```

---

## API Integration Examples

### Example 1: Transfer Approval Endpoint

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
    // Update transfer status
    const transfer = await prisma.transfer.update({
      where: { id: transferId },
      data: {
        status: approved ? 'APPROVED' : 'REJECTED',
        approvedBy: session.user.id,
        approvedAt: new Date(),
        rejectionReason: approved ? null : reason
      }
    })

    // Log approval action
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
    console.error('Transfer approval error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## Next Steps

1. ✅ Run the creation script: `node scripts/create-approval-roles.mjs`
2. ✅ Verify roles in Prisma Studio
3. ✅ Assign roles to test users
4. ✅ Test approval workflows
5. ✅ Configure location access if needed
6. ✅ Review audit logs
7. ✅ Train users on approval processes
8. ✅ Monitor and optimize as needed

---

## Support and Resources

- **Prisma Docs**: https://www.prisma.io/docs
- **NextAuth Docs**: https://next-auth.js.org
- **UltimatePOS RBAC**: See `src/lib/rbac.ts`
- **Database Schema**: See `prisma/schema.prisma`

---

**Created:** 2025-10-18
**Version:** 1.0.0
**Author:** UltimatePOS Development Team
