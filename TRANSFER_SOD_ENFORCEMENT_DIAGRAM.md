# Transfer Separation of Duties - Enforcement Flow Diagram

## Current Hard-Coded Enforcement Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT REQUEST                                      │
│  POST /api/transfers/123/send                                              │
│  Authorization: Bearer {JWT}                                                │
│  Body: { notes: "Sending 50 units to Branch B" }                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 1: Authentication                                   │
│  const session = await getServerSession(authOptions)                       │
│                                                                             │
│  Extract from JWT:                                                          │
│    userId: 123                                                              │
│    businessId: 1                                                            │
│    permissions: ["stock_transfer.send", ...]                               │
│    locationIds: [1, 3, 5]                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 2: Permission Check                                 │
│  if (!user.permissions.includes(PERMISSIONS.STOCK_TRANSFER_SEND)) {       │
│    return 403 "Forbidden - Insufficient permissions"                       │
│  }                                                                          │
│                                                                             │
│  Result: ✅ User has STOCK_TRANSFER_SEND permission                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 3: Fetch Transfer Record                           │
│  const transfer = await prisma.stockTransfer.findFirst({                   │
│    where: {                                                                 │
│      id: 123,                                                               │
│      businessId: 1,        ← Multi-tenant isolation                       │
│      deletedAt: null                                                       │
│    }                                                                        │
│  })                                                                         │
│                                                                             │
│  Transfer Data:                                                             │
│    id: 123                                                                  │
│    status: "checked"                                                       │
│    fromLocationId: 1                                                       │
│    toLocationId: 3                                                         │
│    createdBy: 456        ← Creator user ID                                │
│    checkedBy: 789        ← Checker user ID                                │
│    sentBy: null          ← Not sent yet                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 4: Status Validation                                │
│  if (transfer.status !== 'checked') {                                      │
│    return 400 "Cannot send transfer with status: {status}"                │
│  }                                                                          │
│                                                                             │
│  Result: ✅ Transfer is in 'checked' status                                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 5: Location Access Check                           │
│  if (!hasAccessAllLocations) {                                             │
│    const userLocation = await prisma.userLocation.findFirst({             │
│      where: {                                                               │
│        userId: 123,                                                         │
│        locationId: transfer.fromLocationId  ← Must have access to source  │
│      }                                                                      │
│    })                                                                       │
│    if (!userLocation) return 403 "No access to origin location"           │
│  }                                                                          │
│                                                                             │
│  Result: ✅ User has access to location 1 (fromLocationId)                │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          ⚠️  STEP 6: SEPARATION OF DUTIES CHECK #1 (HARD-CODED)           │
│                                                                             │
│  if (transfer.createdBy === userIdNumber) {                                │
│    return 403 {                                                             │
│      error: 'Cannot send your own transfer. A different user must...',    │
│      code: 'SAME_USER_VIOLATION'                                           │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Comparison:                                                                │
│    transfer.createdBy = 456                                                │
│    userIdNumber = 123                                                      │
│                                                                             │
│  Result: ✅ Different user (456 ≠ 123)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          ⚠️  STEP 7: SEPARATION OF DUTIES CHECK #2 (HARD-CODED)           │
│                                                                             │
│  if (transfer.checkedBy === userIdNumber) {                                │
│    return 403 {                                                             │
│      error: 'Cannot send a transfer you checked. A different user...',    │
│      code: 'SAME_USER_VIOLATION'                                           │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Comparison:                                                                │
│    transfer.checkedBy = 789                                                │
│    userIdNumber = 123                                                      │
│                                                                             │
│  Result: ✅ Different user (789 ≠ 123)                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          🔥 STEP 8: CRITICAL STOCK DEDUCTION (Transaction)                 │
│                                                                             │
│  await prisma.$transaction(async (tx) => {                                 │
│    // For each item:                                                        │
│    await transferStockOut({                                                │
│      fromLocationId: 1,                                                    │
│      quantity: 50,                                                         │
│      userId: 123                                                           │
│    })                                                                       │
│                                                                             │
│    // Update transfer status                                               │
│    await tx.stockTransfer.update({                                         │
│      where: { id: 123 },                                                   │
│      data: {                                                                │
│        status: 'in_transit',                                               │
│        stockDeducted: true,      ← CRITICAL FLAG                          │
│        sentBy: 123,               ← Record sender                          │
│        sentAt: new Date()                                                  │
│      }                                                                      │
│    })                                                                       │
│  })                                                                         │
│                                                                             │
│  Result: ✅ Stock deducted, transfer in transit                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEP 9: Audit Log Creation                              │
│  await createAuditLog({                                                     │
│    action: 'transfer_send',                                                │
│    userId: 123,                                                            │
│    entityType: 'STOCK_TRANSFER',                                           │
│    metadata: {                                                              │
│      transferNumber: 'TR-202510-0123',                                    │
│      fromLocationId: 1,                                                    │
│      toLocationId: 3,                                                      │
│      performedBy: 123,                                                     │
│      createdBy: 456,                                                       │
│      checkedBy: 789                                                        │
│    }                                                                        │
│  })                                                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SUCCESS RESPONSE                                    │
│  {                                                                          │
│    message: "Transfer sent - stock deducted from origin location",        │
│    transfer: {                                                              │
│      id: 123,                                                               │
│      status: "in_transit",                                                 │
│      stockDeducted: true,                                                  │
│      sentBy: 123,                                                          │
│      sentAt: "2025-10-23T10:30:00Z"                                       │
│    }                                                                        │
│  }                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Proposed Configurable Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STEPS 1-5: Same as Current                              │
│  (Authentication, Permission Check, Fetch Transfer, Status, Location)      │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          ✨ NEW STEP 6: Fetch Business Transfer Rules                      │
│                                                                             │
│  const rules = await prisma.transferRuleSettings.findUnique({             │
│    where: { businessId: 1 }                                                │
│  })                                                                         │
│                                                                             │
│  // Default to strict mode if no rules configured                          │
│  if (!rules) {                                                              │
│    rules = {                                                                │
│      requireDifferentSender: true,                                         │
│      allowCreatorToSend: false,                                            │
│      allowCheckerToSend: false                                             │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Result: Retrieved business-specific rules                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          ✨ NEW STEP 7: Configurable Validation Utility                    │
│                                                                             │
│  import { validateTransferAction } from '@/lib/transferRules'              │
│                                                                             │
│  const validation = await validateTransferAction({                         │
│    businessId: 1,                                                          │
│    transfer: transfer,                                                     │
│    action: 'send',                                                         │
│    userId: 123,                                                            │
│    rules: rules                                                            │
│  })                                                                         │
│                                                                             │
│  // Validation logic:                                                       │
│  if (rules.requireDifferentSender) {                                       │
│    if (!rules.allowCreatorToSend && transfer.createdBy === userId) {      │
│      return {                                                               │
│        allowed: false,                                                     │
│        reason: 'Business policy prevents creator from sending',           │
│        configurable: true  ← Indicates admin can change this             │
│      }                                                                      │
│    }                                                                        │
│                                                                             │
│    if (!rules.allowCheckerToSend && transfer.checkedBy === userId) {      │
│      return {                                                               │
│        allowed: false,                                                     │
│        reason: 'Business policy prevents checker from sending',           │
│        configurable: true                                                  │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  return { allowed: true }                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          🔀 DECISION POINT: Validation Result                              │
│                                                                             │
│  if (!validation.allowed) {                                                │
│    return 403 {                                                             │
│      error: validation.reason,                                             │
│      code: 'TRANSFER_RULE_VIOLATION',                                      │
│      configurable: validation.configurable,                                │
│      currentRules: {                                                        │
│        allowCreatorToSend: rules.allowCreatorToSend,                       │
│        allowCheckerToSend: rules.allowCheckerToSend                        │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  // If validation passes, continue to stock deduction...                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│          STEPS 8-9: Same as Current                                        │
│  (Stock Deduction Transaction + Audit Log)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Comparison: Hard-Coded vs. Configurable

### Current Hard-Coded Approach
```typescript
// File: src/app/api/transfers/[id]/send/route.ts (Lines 95-113)

// ❌ HARD-CODED: Cannot be changed without code deployment
if (transfer.createdBy === userIdNumber) {
  return NextResponse.json({
    error: 'Cannot send your own transfer...',
    code: 'SAME_USER_VIOLATION'
  }, { status: 403 })
}

if (transfer.checkedBy === userIdNumber) {
  return NextResponse.json({
    error: 'Cannot send a transfer you checked...',
    code: 'SAME_USER_VIOLATION'
  }, { status: 403 })
}
```

**Problems:**
- ❌ Same logic for all businesses (no customization)
- ❌ Small businesses with 2 employees blocked
- ❌ Requires code changes to adjust rules
- ❌ No admin UI to toggle rules

### Proposed Configurable Approach
```typescript
// File: src/lib/transferRules.ts (New utility)

export async function validateTransferAction({
  businessId,
  transfer,
  action,
  userId,
  rules
}: ValidationParams): Promise<ValidationResult> {

  // ✅ CONFIGURABLE: Loaded from database
  if (rules.requireDifferentSender) {
    if (!rules.allowCreatorToSend && transfer.createdBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents creator from sending transfers',
        configurable: true,
        ruleField: 'allowCreatorToSend'
      }
    }

    if (!rules.allowCheckerToSend && transfer.checkedBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents checker from sending transfers',
        configurable: true,
        ruleField: 'allowCheckerToSend'
      }
    }
  }

  return { allowed: true }
}
```

**Benefits:**
- ✅ Different rules per business
- ✅ Admin can toggle via UI
- ✅ No code changes needed
- ✅ Audit trail of rule changes

---

## SoD Enforcement Matrix by Endpoint

### CHECK Endpoint
```
Current User ID: 123

Transfer State:
  createdBy: 456

SoD Check:
  if (456 === 123) → ❌ Block
  else             → ✅ Allow
```

### SEND Endpoint
```
Current User ID: 123

Transfer State:
  createdBy: 456
  checkedBy: 789

SoD Checks:
  if (456 === 123) → ❌ Block (creator cannot send)
  if (789 === 123) → ❌ Block (checker cannot send)
  else             → ✅ Allow
```

### COMPLETE Endpoint
```
Current User ID: 123

Transfer State:
  createdBy: 456
  checkedBy: 789
  sentBy: 101

SoD Checks:
  if (456 === 123) → ❌ Block (creator cannot complete)
  if (101 === 123) → ❌ Block (sender cannot complete)
  else             → ✅ Allow
```

---

## User Scenario Examples

### Scenario A: Strict Compliance (Current Behavior)
```
Business: Large Financial Institution
Rules:
  requireDifferentChecker: true
  requireDifferentSender: true
  allowCreatorToSend: false
  allowCheckerToSend: false

Workflow:
  User A (Creator):   Creates transfer    → ✅ Allowed
  User A:             Tries to check      → ❌ Blocked (same user)
  User B (Manager):   Checks transfer     → ✅ Allowed
  User B:             Tries to send       → ❌ Blocked (checker cannot send)
  User C (Warehouse): Sends transfer      → ✅ Allowed
  User C:             Tries to complete   → ❌ Blocked (sender cannot complete)
  User D (Receiver):  Completes transfer  → ✅ Allowed

Minimum Required Staff: 4 users (or 3 if sender can complete)
```

### Scenario B: Relaxed Mode (Small Business)
```
Business: Family-Owned Shop
Rules:
  requireDifferentChecker: false
  requireDifferentSender: false
  allowCreatorToSend: true
  allowCheckerToSend: true

Workflow:
  User A (Owner):  Creates transfer  → ✅ Allowed
  User A:          Checks transfer   → ✅ Allowed (rule disabled)
  User A:          Sends transfer    → ✅ Allowed (creator can send)
  User B (Staff):  Completes         → ✅ Allowed

Minimum Required Staff: 2 users (or even 1 if all rules disabled)
```

### Scenario C: Moderate Security (Retail Chain)
```
Business: 10-Location Retail Chain
Rules:
  requireDifferentChecker: true
  requireDifferentSender: true
  allowCreatorToSend: false
  allowCheckerToSend: false
  allowSenderToComplete: true

Workflow:
  User A (Branch Mgr): Creates transfer   → ✅ Allowed
  User A:              Tries to check     → ❌ Blocked
  User B (Assistant):  Checks transfer    → ✅ Allowed
  User B:              Tries to send      → ❌ Blocked
  User C (Warehouse):  Sends transfer     → ✅ Allowed
  User C:              Completes transfer → ✅ Allowed (sender can complete)

Minimum Required Staff: 3 users
```

---

## Key Insight: Database-Driven vs. Code-Driven Enforcement

### Current (Code-Driven)
```
┌──────────────────┐
│   Route Handler  │
│   (send.ts)      │
│                  │
│  Hard-coded:     │
│  if (createdBy   │
│    === userId)   │
│    return 403    │
│                  │
│  No configuration│
└──────────────────┘
```

### Proposed (Database-Driven)
```
┌──────────────────┐      ┌──────────────────────┐
│   Route Handler  │──────│ TransferRuleSettings │
│   (send.ts)      │      │ (Database Table)     │
│                  │      │                      │
│  Calls:          │      │ businessId: 1        │
│  validateAction  │◄─────│ allowCreatorToSend:  │
│  (utility)       │      │   false              │
│                  │      │ allowCheckerToSend:  │
│  Returns:        │      │   false              │
│  allowed: bool   │      └──────────────────────┘
│  reason: string  │
└──────────────────┘
         ↓
    ┌─────────┐
    │   UI    │ ← Admin can toggle rules
    │ Settings│
    └─────────┘
```

---

## Implementation Impact Map

### Files to Modify
```
✏️  src/app/api/transfers/[id]/check-approve/route.ts
   Replace: Hard-coded checks
   With: validateTransferAction(businessId, transfer, 'check', userId)

✏️  src/app/api/transfers/[id]/send/route.ts
   Replace: Lines 95-113
   With: validateTransferAction(businessId, transfer, 'send', userId)

✏️  src/app/api/transfers/[id]/complete/route.ts
   Replace: Hard-coded checks
   With: validateTransferAction(businessId, transfer, 'complete', userId)

✏️  src/app/api/transfers/[id]/receive/route.ts
   Replace: Hard-coded checks
   With: validateTransferAction(businessId, transfer, 'receive', userId)
```

### New Files to Create
```
📄 prisma/migrations/XXX_add_transfer_rule_settings.sql
   Create table: transfer_rule_settings

📄 src/lib/transferRules.ts
   Export: validateTransferAction(), getBusinessRules()

📄 src/app/api/settings/transfer-rules/route.ts
   Endpoints: GET (view rules), PUT (update rules)

📄 src/app/dashboard/settings/transfer-rules/page.tsx
   UI: Settings form with toggle switches
```

---

## Audit Trail Enhancement

### Current Audit Log
```json
{
  "action": "transfer_send",
  "userId": 123,
  "entityType": "STOCK_TRANSFER",
  "metadata": {
    "transferNumber": "TR-202510-0123",
    "fromLocationId": 1,
    "toLocationId": 3
  }
}
```

### Proposed Enhanced Audit Log
```json
{
  "action": "transfer_send",
  "userId": 123,
  "entityType": "STOCK_TRANSFER",
  "metadata": {
    "transferNumber": "TR-202510-0123",
    "fromLocationId": 1,
    "toLocationId": 3,
    "sodValidation": {
      "creatorId": 456,
      "checkerId": 789,
      "currentUserId": 123,
      "rulesApplied": {
        "allowCreatorToSend": false,
        "allowCheckerToSend": false,
        "requireDifferentSender": true
      },
      "validationResult": "allowed"
    }
  }
}
```

**Benefits:**
- Clear audit trail of which rules were enforced
- Can reconstruct whether rule changes affected past decisions
- Supports compliance investigations

---

**Document Version:** 1.0
**Last Updated:** 2025-10-23
**Purpose:** Visual reference for SoD enforcement architecture
