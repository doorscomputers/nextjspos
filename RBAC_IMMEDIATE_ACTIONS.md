# RBAC Security - Immediate Action Items

**Date**: 2025-11-09
**Priority**: HIGH
**Review Status**: ⚠️ REQUIRES ATTENTION BEFORE PRODUCTION

---

## Executive Summary

The RBAC audit identified **strong security controls** with **3 medium-risk issues** requiring immediate attention.

**Overall Security Rating**: STRONG ✓
**Production Ready**: YES (with conditions below)

---

## Critical Findings (Action Required)

### 1. Warehouse Manager Exempt from SOD Checks ⚠️

**Issue**: The `Warehouse Manager` role currently bypasses ALL Separation of Duties validation.

**Risk**: A single warehouse manager could:
- Create a stock transfer
- Approve the transfer
- Send the transfer
- Receive at destination
- Complete the transfer
- All without any oversight or secondary approval

**Location**: `C:\xampp\htdocs\ultimatepos-modern\src\lib\sodValidation.ts` (line 74)

**Current Code**:
```typescript
exemptRoles: 'Super Admin,System Administrator,Warehouse Manager'
```

**Recommended Fix**:
```typescript
exemptRoles: 'Super Admin,System Administrator'
```

**Action**: Remove `Warehouse Manager` from default exempt roles. If specific businesses need this exemption, configure it per-business in the database.

**Deadline**: Before production deployment

---

### 2. Verify Permission Checks in API Routes ⚠️

**Issue**: Need to verify that the following API endpoints properly implement permission + SOD validation.

**Endpoints to Verify**:

1. **Purchase Receipt Approval**
   - Path: `/api/purchases/[id]/receipts/[receiptId]/approve/route.ts`
   - Must Check: `PERMISSIONS.PURCHASE_RECEIPT_APPROVE`
   - Must Validate: `validateSOD()` with entityType 'grn', action 'approve'
   - Must Filter: `receipt.purchase.businessId === session.user.businessId`

2. **Stock Transfer Send**
   - Path: `/api/stock-transfers/[id]/send/route.ts`
   - Must Check: `PERMISSIONS.STOCK_TRANSFER_SEND`
   - Must Validate: `validateSOD()` with entityType 'transfer', action 'send'
   - Must Filter: `transfer.businessId === session.user.businessId`

3. **Stock Transfer Receive**
   - Path: `/api/stock-transfers/[id]/receive/route.ts`
   - Must Check: `PERMISSIONS.STOCK_TRANSFER_RECEIVE`
   - Must Validate: `validateSOD()` with entityType 'transfer', action 'receive'
   - Must Filter: `transfer.businessId === session.user.businessId`

**Required Pattern**:
```typescript
import { validateSOD, getUserRoles } from '@/lib/sodValidation';
import { hasPermission } from '@/lib/rbac';

// 1. Check permission
if (!hasPermission(session.user.permissions, PERMISSIONS.STOCK_TRANSFER_SEND)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

// 2. Verify business isolation
if (transfer.businessId !== session.user.businessId) {
  return NextResponse.json({ error: 'Cross-business access denied' }, { status: 403 });
}

// 3. Validate SOD
const userRoles = await getUserRoles(session.user.id);
const sodCheck = await validateSOD({
  businessId: session.user.businessId,
  userId: session.user.id,
  action: 'send',
  entity: transfer,
  entityType: 'transfer',
  userRoles,
});

if (!sodCheck.allowed) {
  return NextResponse.json({
    error: sodCheck.reason,
    code: sodCheck.code,
    suggestion: sodCheck.suggestion
  }, { status: 403 });
}
```

**Action**: Review and verify all three API endpoints implement this pattern.

**Deadline**: Before production deployment

---

### 3. Document Super Admin Cross-Business Policy ⚠️

**Issue**: It's unclear whether Super Admin/System Administrator should be able to approve transactions for businesses they don't belong to.

**Current Behavior**:
- Super Admin has ALL permissions
- Super Admin is exempt from SOD checks
- Super Admin session still contains a specific businessId
- API routes filter by session.user.businessId

**Questions to Answer**:

1. **Can Super Admin view transfers from all businesses?**
   - If YES: Add special `businessId === null` or `isSuperAdmin` check in API routes
   - If NO: Keep current businessId filtering (recommended for multi-tenant SaaS)

2. **Can Super Admin approve/send/receive cross-business transfers?**
   - If YES: High security risk, requires special audit logging
   - If NO: Recommended approach for proper tenant isolation

3. **Should there be a separate "Platform Owner" role?**
   - Separate from regular Super Admin
   - Has read-only access to all businesses
   - Cannot modify transactions, only view for support/debugging

**Recommended Policy** (for multi-tenant POS system):
```
- Super Admin can manage USERS, ROLES, and SETTINGS across all businesses
- Super Admin CANNOT approve/modify TRANSACTIONS for other businesses
- Super Admin CAN view (read-only) transactions for support purposes
- For emergency cross-business operations, use database direct access with audit log
```

**Action**: Decide on policy and document in system administrator manual.

**Deadline**: Before production deployment

---

## Verification Checklist

Before deploying to production, complete this checklist:

### Permission Verification
- [ ] `PURCHASE_RECEIPT_APPROVE` permission exists in `src/lib/rbac.ts`
- [ ] `STOCK_TRANSFER_SEND` permission exists in `src/lib/rbac.ts`
- [ ] `STOCK_TRANSFER_RECEIVE` permission exists in `src/lib/rbac.ts`
- [ ] All three permissions are in audit log enum (`src/lib/auditLog.ts`)

### Role Assignment Verification
- [ ] `Goods Receipt Approver` role has only APPROVE permission (not CREATE)
- [ ] `Transfer Sender` role has only SEND permission (not CREATE or APPROVE)
- [ ] `Transfer Receiver` role has only RECEIVE permission (not SEND or APPROVE)
- [ ] `Cross-Location Approver` role has CHECK but NOT SEND/RECEIVE/COMPLETE

### SOD Configuration Verification
- [ ] `BusinessSODSettings` model exists in Prisma schema
- [ ] Default SOD rules are STRICT (all `allow*` fields default to `false`)
- [ ] `enforceTransferSOD` defaults to `true`
- [ ] `enforcePurchaseSOD` defaults to `true`
- [ ] Warehouse Manager removed from default `exemptRoles`

### API Endpoint Verification
- [ ] Purchase receipt approval endpoint checks permission + SOD
- [ ] Stock transfer send endpoint checks permission + SOD
- [ ] Stock transfer receive endpoint checks permission + SOD
- [ ] All endpoints filter by `businessId` for multi-tenant isolation
- [ ] Error responses include SOD error code and user-friendly message

### Database Verification
- [ ] `business_sod_settings` table exists in database
- [ ] Default SOD settings created for test business (via seed or migration)
- [ ] Audit log table captures PURCHASE_RECEIPT_APPROVE actions
- [ ] Audit log table captures STOCK_TRANSFER_SEND actions
- [ ] Audit log table captures STOCK_TRANSFER_RECEIVE actions

### Documentation Verification
- [ ] RBAC audit report reviewed by technical lead
- [ ] Super Admin cross-business policy documented
- [ ] SOD workflow diagrams shared with operations team
- [ ] User training materials include SOD error explanations

---

## Testing Scenarios (Integration Tests)

### Test 1: SOD Violation - Creator Cannot Approve GRN

```typescript
// Test: User creates GRN, then tries to approve it
// Expected: 403 Forbidden with SOD_GRN_CREATOR_CANNOT_APPROVE

test('Creator cannot approve their own GRN', async () => {
  // Create GRN as user 5
  const grn = await createGRN({ userId: 5, purchaseId: 123 });

  // Try to approve as same user 5
  const response = await approveGRN({ userId: 5, grnId: grn.id });

  expect(response.status).toBe(403);
  expect(response.body.code).toBe('SOD_GRN_CREATOR_CANNOT_APPROVE');
  expect(response.body.error).toContain('cannot approve a goods receipt you created');
});
```

### Test 2: SOD Violation - Creator Cannot Send Transfer

```typescript
// Test: User creates transfer, then tries to send it
// Expected: 403 Forbidden with SOD_CREATOR_CANNOT_SEND

test('Creator cannot send their own transfer', async () => {
  // Create transfer as user 7
  const transfer = await createTransfer({ userId: 7, fromLocationId: 1, toLocationId: 2 });

  // Try to send as same user 7
  const response = await sendTransfer({ userId: 7, transferId: transfer.id });

  expect(response.status).toBe(403);
  expect(response.body.code).toBe('SOD_CREATOR_CANNOT_SEND');
});
```

### Test 3: SOD Violation - Cross-Business Access

```typescript
// Test: User from Business A tries to approve transfer from Business B
// Expected: 403 Forbidden (before SOD check)

test('User cannot approve cross-business transfer', async () => {
  // Create transfer in Business 1
  const transfer = await createTransfer({ businessId: 1, userId: 10 });

  // Try to approve as user from Business 2
  const response = await approveTransfer({ userId: 20, businessId: 2, transferId: transfer.id });

  expect(response.status).toBe(403);
  expect(response.body.error).toContain('Cross-business access');
});
```

### Test 4: Exempt Role Bypasses SOD

```typescript
// Test: Super Admin can approve their own GRN (exempt from SOD)
// Expected: 200 OK (SOD bypassed for exempt role)

test('Super Admin bypasses SOD checks', async () => {
  // Create GRN as Super Admin (user 1)
  const grn = await createGRN({ userId: 1, purchaseId: 456, businessId: 1 });

  // Approve as same Super Admin (should succeed due to exemption)
  const response = await approveGRN({ userId: 1, grnId: grn.id });

  expect(response.status).toBe(200);
  expect(grn.approvedBy).toBe(1);
});
```

### Test 5: Valid SOD Workflow

```typescript
// Test: Different users can complete transfer lifecycle
// Expected: 200 OK for all steps

test('Different users can complete transfer workflow', async () => {
  // User 5 creates
  const transfer = await createTransfer({ userId: 5, fromLocationId: 1, toLocationId: 2 });
  expect(transfer.createdBy).toBe(5);

  // User 10 approves
  const approved = await approveTransfer({ userId: 10, transferId: transfer.id });
  expect(approved.status).toBe(200);
  expect(approved.body.checkedBy).toBe(10);

  // User 15 sends
  const sent = await sendTransfer({ userId: 15, transferId: transfer.id });
  expect(sent.status).toBe(200);
  expect(sent.body.sentBy).toBe(15);

  // User 20 receives (at destination)
  const received = await receiveTransfer({ userId: 20, transferId: transfer.id });
  expect(received.status).toBe(200);
  expect(received.body.receivedBy).toBe(20);

  // User 25 completes
  const completed = await completeTransfer({ userId: 25, transferId: transfer.id });
  expect(completed.status).toBe(200);
  expect(completed.body.status).toBe('completed');
});
```

---

## Quick Fix Guide

### Fix 1: Remove Warehouse Manager from Exempt Roles

**File**: `C:\xampp\htdocs\ultimatepos-modern\src\lib\sodValidation.ts`

**Line 74** - Change:
```typescript
// BEFORE:
exemptRoles: 'Super Admin,System Administrator,Warehouse Manager',

// AFTER:
exemptRoles: 'Super Admin,System Administrator',
```

**Then**, for businesses that specifically need Warehouse Manager exemption:
```sql
-- Update specific business SOD settings
UPDATE business_sod_settings
SET exempt_roles = 'Super Admin,System Administrator,Warehouse Manager'
WHERE business_id = [specific_business_id];

-- Document the business justification
INSERT INTO audit_log (action, entity_type, details, user_id)
VALUES (
  'SOD_CONFIG_CHANGE',
  'business_sod_settings',
  'Added Warehouse Manager to exempt roles for Business [ID] - Justification: Small team (3 staff)',
  [admin_user_id]
);
```

### Fix 2: Verify API Endpoints (Example)

**File**: `C:\xampp\htdocs\ultimatepos-modern\src\app\api\stock-transfers\[id]\send\route.ts`

**Add** these checks:
```typescript
import { validateSOD, getUserRoles } from '@/lib/sodValidation';
import { hasPermission } from '@/lib/rbac';
import { PERMISSIONS } from '@/lib/rbac';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);

  // 1. Authentication
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Permission Check
  if (!hasPermission(session.user.permissions, PERMISSIONS.STOCK_TRANSFER_SEND)) {
    return NextResponse.json({ error: 'Missing permission: STOCK_TRANSFER_SEND' }, { status: 403 });
  }

  // 3. Fetch entity
  const transfer = await prisma.stockTransfer.findUnique({
    where: { id: parseInt(params.id) },
  });

  if (!transfer) {
    return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });
  }

  // 4. Business Isolation Check
  if (transfer.businessId !== session.user.businessId) {
    return NextResponse.json({ error: 'Cross-business access denied' }, { status: 403 });
  }

  // 5. SOD Validation
  const userRoles = await getUserRoles(session.user.id);
  const sodCheck = await validateSOD({
    businessId: session.user.businessId,
    userId: session.user.id,
    action: 'send',
    entity: transfer,
    entityType: 'transfer',
    userRoles,
  });

  if (!sodCheck.allowed) {
    return NextResponse.json({
      error: sodCheck.reason,
      code: sodCheck.code,
      suggestion: sodCheck.suggestion,
      configurable: sodCheck.configurable,
      ruleField: sodCheck.ruleField,
    }, { status: 403 });
  }

  // 6. Execute business logic
  // ... (send transfer logic)
}
```

---

## Summary of RBAC Strengths

The system has excellent security architecture:

1. **Granular Permissions**: 200+ permissions covering all operations
2. **Task-Based Roles**: 30+ specialized roles (Transfer Creator, Transfer Sender, etc.)
3. **Configurable SOD**: Per-business separation of duties rules
4. **Clear Error Messages**: Users understand why actions are blocked
5. **Multi-Tenant Aware**: BusinessId filtering throughout
6. **Comprehensive Audit Trail**: All actions logged

**The three permissions reviewed are well-implemented** with proper SOD controls.

---

## Recommended Role Assignments for Production

### Maximum Security (Large Organization)

**Purchase Receipt Flow**:
- **Purchasing Clerk**: Creates purchase orders
- **Purchasing Manager**: Approves purchase orders
- **Warehouse Receiver**: Creates GRNs when goods arrive
- **Warehouse Supervisor**: Approves GRNs

**Stock Transfer Flow**:
- **Branch Manager**: Creates transfer requests
- **HQ Approver**: Approves transfers (Cross-Location Approver role)
- **Warehouse Picker**: Sends transfers from warehouse
- **Branch Receiver**: Receives transfers at destination
- **Branch Manager**: Completes/verifies transfers

### Balanced Security (Medium Organization)

**Purchase Receipt Flow**:
- **Warehouse Staff**: Creates GRNs (Goods Receipt Clerk role)
- **Warehouse Manager**: Approves GRNs (Goods Receipt Approver role)

**Stock Transfer Flow**:
- **Store Staff**: Creates transfers (Transfer Creator role)
- **Warehouse Staff**: Approves and sends (Transfer Sender role)
- **Store Staff**: Receives at destination (Transfer Receiver role)

### Small Team (Relaxed SOD)

**Combined Roles**:
- **Manager**: Full purchase and transfer access (Branch Manager role)
- **Staff**: Limited operations (Sales Cashier + some inventory permissions)

**SOD Configuration** (in database):
```sql
UPDATE business_sod_settings
SET allow_creator_to_send = true,
    allow_receiver_to_complete = true,
    allow_grn_creator_to_approve = true
WHERE business_id = [small_business_id];
```

**Compensating Controls**:
- Daily owner review of all transactions
- Weekly inventory count
- CCTV monitoring

---

## Questions or Issues?

If you encounter SOD-related errors in production:

1. **Check the error code**: e.g., `SOD_CREATOR_CANNOT_SEND`
2. **Review the suggestion**: Error message includes how to configure override
3. **Evaluate business justification**: Is relaxing SOD appropriate for your team size?
4. **Configure if needed**: Update `business_sod_settings` table
5. **Document the change**: Add entry to audit log with justification

**Support Contact**: System Administrator
**Related Documentation**: `RBAC_SECURITY_AUDIT_REPORT.md`

---

**Action By**: Development Team
**Review By**: Technical Lead + Security Officer
**Approval Required**: Yes (before production deployment)
**Estimated Time**: 2-4 hours for verification + testing
