# Transfer Rules System - Quick Reference Guide

## Current Separation of Duties (SoD) Enforcement Matrix

### Hard-Coded Rules by Endpoint

| Endpoint | Required Status | Who CANNOT Perform | Location Check | Stock Impact |
|----------|----------------|-------------------|----------------|--------------|
| **CREATE**<br>`POST /transfers` | - | (Anyone with permission) | ✓ fromLocation must be in user's locations | NONE |
| **CHECK**<br>`POST /transfers/[id]/check-approve` | `pending_check` | ✗ Creator | ✓ Must have access to FROM or TO | NONE |
| **SEND**<br>`POST /transfers/[id]/send` | `checked` | ✗ Creator<br>✗ Checker | ✓ Must have access to FROM | **DEDUCT from FROM** |
| **ARRIVE**<br>`POST /transfers/[id]/mark-arrived` | `in_transit` | ✗ Sender | ✓ Must have access to TO | NONE |
| **RECEIVE**<br>`POST /transfers/[id]/receive` | `in_transit` | ✗ Creator<br>✗ Checker<br>✗ Sender | ✓ Must have access to TO | NONE |
| **COMPLETE**<br>`POST /transfers/[id]/complete` | `verified` | ✗ Creator<br>✗ Sender | ✓ Must have access to TO | **ADD to TO** |

### Current SoD Check Logic (Example from /send)

```typescript
// File: src/app/api/transfers/[id]/send/route.ts

// CHECK 1: Cannot send own transfer
if (transfer.createdBy === userIdNumber) {
  return 403 // "Cannot send your own transfer..."
}

// CHECK 2: Cannot send transfer you checked
if (transfer.checkedBy === userIdNumber) {
  return 403 // "Cannot send a transfer you checked..."
}
```

**KEY INSIGHT:** All checks compare `transfer.{role}By` against current `userId`
**LIMITATION:** Rules are HARD-CODED - cannot be toggled per business

---

## Session Structure

```typescript
session.user = {
  id: "123",
  username: "john.doe",
  businessId: "1",
  permissions: [
    "stock_transfer.view",
    "stock_transfer.create",
    "stock_transfer.send",
    // ... more permissions
  ],
  roles: ["Branch Manager"],
  locationIds: [1, 3, 5]  // Assigned locations
}
```

**Available In:**
- API Routes: `const session = await getServerSession(authOptions)`
- Client: `const { data: session } = useSession()`

**Missing:**
- ❌ `activeLocationId` - Current working location
- ❌ `defaultLocationId` - User's primary location

---

## User-Location Assignment

### Current Model
```prisma
model UserLocation {
  userId     Int
  locationId Int
  @@id([userId, locationId])
}
```

**Characteristics:**
- Many-to-Many (user can have multiple locations)
- No "active" location tracked
- Static assignment (persists across sessions)

### Location Access Priority
```
1. Direct UserLocation assignments (highest priority)
2. Role's RoleLocation assignments (fallback)
3. Result: User sees union of both
```

### Access Control in Transfers

**Viewing Transfers:**
```typescript
// Show if user has access to EITHER source OR destination
where.OR = [
  { fromLocationId: { in: userLocationIds } },
  { toLocationId: { in: userLocationIds } }
]
```

**Creating Transfers:**
```typescript
// fromLocationId MUST be in user's assigned locations
if (!userLocationIds.includes(fromLocationId)) {
  return 403 // Forbidden
}
```

**ACCESS_ALL_LOCATIONS Permission:**
- Bypasses location checks
- Typically granted to Super Admin and Branch Admin

---

## Transfer Workflow States

### 8-Stage Full Workflow

```
DRAFT
  ↓ (auto-transition or explicit submit)
PENDING_CHECK
  ↓ (CHECK permission + different user)
CHECKED
  ↓ (SEND permission + different user) ← STOCK DEDUCTED HERE
IN_TRANSIT
  ↓ (RECEIVE permission + different user)
ARRIVED
  ↓ (verify items)
VERIFIED
  ↓ (COMPLETE permission + different user) ← STOCK ADDED HERE
COMPLETED
```

### Critical Points

| Stage | Database Flag | Stock Impact |
|-------|--------------|--------------|
| `in_transit` | `stockDeducted = true` | Stock removed from source |
| `completed` | `stockDeducted = true` | Stock added to destination |

**IMPORTANT:** Stock is IMMUTABLE after deduction except via cancellation or adjustment

---

## Configuration Gap Analysis

### What IS Configurable
- ✅ `Business.transferWorkflowMode`: "full" or "simple"
- ✅ User permissions (via RBAC)
- ✅ User location assignments

### What IS NOT Configurable
- ❌ Separation of Duties rules (hard-coded)
- ❌ Which users can perform which roles
- ❌ Workflow stage requirements
- ❌ Auto-approval conditions
- ❌ Discrepancy tolerance

### Proposed Solution: TransferRuleSettings Table

```prisma
model TransferRuleSettings {
  businessId                   Int     @unique

  // SoD Toggles
  requireDifferentChecker      Boolean @default(true)
  requireDifferentSender       Boolean @default(true)
  requireDifferentCompleter    Boolean @default(true)

  // Allow Creator Overrides
  allowCreatorToSend           Boolean @default(false)
  allowCreatorToComplete       Boolean @default(false)

  // Allow Consecutive Steps
  allowCheckerToSend           Boolean @default(false)
  allowSenderToComplete        Boolean @default(false)
}
```

---

## Common Issues & Solutions

### Issue 1: "Cannot send transfer - same user violation"
**Cause:** User trying to send transfer they created or checked
**Current Solution:** Different user must perform action
**Proposed Solution:** Admin can toggle `allowCreatorToSend` or `allowCheckerToSend`

### Issue 2: User at multiple locations - unclear which to use
**Cause:** No active location tracking
**Current Solution:** Manual selection required every time
**Proposed Solution:** Add `User.activeLocationId` + "Switch Location" UI

### Issue 3: Small business with 2 employees cannot use strict workflow
**Cause:** SoD rules require 3+ users
**Current Solution:** No workaround
**Proposed Solution:** Admin can disable SoD requirements

---

## Security Recommendations

### Always Enforce (Cannot be Disabled)
1. ✅ Multi-tenant isolation (`businessId` filter)
2. ✅ Permission-based authorization (RBAC)
3. ✅ Location access validation
4. ✅ Audit logging
5. ✅ Idempotency protection

### Configurable (Can be Relaxed)
1. 🔧 Separation of duties checks
2. 🔧 Workflow stage requirements
3. 🔧 Auto-approval rules

### When Disabling SoD Checks
⚠️ Show warning: "Reducing fraud protection"
📝 Require justification in audit log
📧 Notify business owner
📊 Generate monthly report of same-user completions

---

## Implementation Checklist

### Phase 1: Database Schema
- [ ] Create `TransferRuleSettings` model
- [ ] Add migration: `npx prisma migrate dev`
- [ ] Seed default settings for existing businesses

### Phase 2: Backend Logic
- [ ] Create `src/lib/transferRules.ts` validation utility
- [ ] Refactor `/check-approve` endpoint
- [ ] Refactor `/send` endpoint
- [ ] Refactor `/receive` endpoint
- [ ] Refactor `/complete` endpoint

### Phase 3: Settings API
- [ ] `GET /api/settings/transfer-rules` (Super Admin only)
- [ ] `PUT /api/settings/transfer-rules` (Super Admin only)
- [ ] Add permission: `TRANSFER_RULES_MANAGE`

### Phase 4: UI
- [ ] Settings page: Business Settings → Transfer Rules
- [ ] Toggle switches for each rule
- [ ] Warning modals when disabling security
- [ ] Save confirmation with audit trail

### Phase 5: Active Location
- [ ] Add `User.activeLocationId` field
- [ ] Update login to prompt location selection
- [ ] Create "Switch Location" component
- [ ] Auto-populate transfer forms

---

## Testing Scenarios

### Scenario A: Strict Mode (Default)
```json
{
  "requireDifferentChecker": true,
  "requireDifferentSender": true,
  "allowCreatorToSend": false
}
```
**Test:**
1. User A creates transfer → ✅ Success
2. User A tries to check → ❌ Forbidden (same user)
3. User B checks → ✅ Success
4. User A tries to send → ❌ Forbidden (creator)
5. User B tries to send → ❌ Forbidden (checker)
6. User C sends → ✅ Success

### Scenario B: Relaxed Mode
```json
{
  "requireDifferentChecker": false,
  "requireDifferentSender": false,
  "allowCreatorToSend": true
}
```
**Test:**
1. User A creates transfer → ✅ Success
2. User A checks → ✅ Success (allowed)
3. User A sends → ✅ Success (allowed)
4. User A completes → ✅/❌ (depends on `allowCreatorToComplete`)

---

## Quick API Reference

### Check Current Rules
```bash
GET /api/settings/transfer-rules
Authorization: Bearer {token}

Response:
{
  "businessId": 1,
  "requireDifferentChecker": true,
  "requireDifferentSender": true,
  "allowCreatorToSend": false,
  ...
}
```

### Update Rules (Super Admin Only)
```bash
PUT /api/settings/transfer-rules
Authorization: Bearer {token}
Content-Type: application/json

{
  "allowCreatorToSend": true,
  "justification": "Small business with only 2 employees"
}

Response:
{
  "message": "Transfer rules updated",
  "settings": { ... },
  "auditLogId": 12345
}
```

---

## File Locations

| Component | Path |
|-----------|------|
| Transfer Routes | `src/app/api/transfers/` |
| SoD Checks | `src/app/api/transfers/[id]/{action}/route.ts` |
| RBAC Definitions | `src/lib/rbac.ts` |
| Auth Config | `src/lib/auth.ts` |
| Schema | `prisma/schema.prisma` |
| Stock Operations | `src/lib/stockOperations.ts` |

---

**Quick Lookup:**
- **Hard-coded SoD checks:** Search for `createdBy === userId` in transfer endpoints
- **Location validation:** Look for `userLocation.findMany` queries
- **Permission checks:** Search for `PERMISSIONS.STOCK_TRANSFER_*`
- **Session access:** `getServerSession(authOptions)` in API routes

**Document Version:** 1.0
**Last Updated:** 2025-10-23
