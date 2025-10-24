# Configurable Transfer Rules - Implementation Plan

## Executive Summary

**Objective:** Enable Super Admins to configure transfer workflow rules per business, replacing hard-coded Separation of Duties (SoD) checks with database-driven, toggleable settings.

**Current Problem:**
- SoD rules are hard-coded in 4+ API endpoints
- All businesses forced to use same strict workflow
- Small businesses (2-3 employees) cannot use transfer system efficiently
- No admin UI to adjust workflow rules
- Code changes required to relax security

**Proposed Solution:**
- Create `TransferRuleSettings` database table
- Build validation utility to check configurable rules
- Provide Super Admin UI to toggle rules per business
- Maintain strict mode as default (backward compatible)
- Full audit trail of rule changes

**Timeline:** 4-5 weeks (part-time) or 2-3 weeks (full-time)

---

## Phase 1: Database Schema (Week 1)

### 1.1 Create TransferRuleSettings Model

**File:** `prisma/schema.prisma`

**Add to schema:**
```prisma
model TransferRuleSettings {
  id         Int      @id @default(autoincrement())
  businessId Int      @unique @map("business_id")
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)

  // Workflow Mode
  workflowMode String @default("full") @map("workflow_mode") @db.VarChar(20)
  // Values: "full" (8-stage), "simple" (3-stage)

  // === SEPARATION OF DUTIES TOGGLES ===

  // Checker must be different from creator
  requireDifferentChecker Boolean @default(true) @map("require_different_checker")

  // Sender must be different from creator and checker
  requireDifferentSender Boolean @default(true) @map("require_different_sender")

  // Receiver must be different from sender
  requireDifferentReceiver Boolean @default(true) @map("require_different_receiver")

  // Completer must be different from creator and sender
  requireDifferentCompleter Boolean @default(true) @map("require_different_completer")

  // === OVERRIDE RULES (Allow creator to perform actions) ===

  // Allow creator to check their own transfer
  allowCreatorToCheck Boolean @default(false) @map("allow_creator_to_check")

  // Allow creator to send their own transfer (after check)
  allowCreatorToSend Boolean @default(false) @map("allow_creator_to_send")

  // Allow creator to complete their own transfer
  allowCreatorToComplete Boolean @default(false) @map("allow_creator_to_complete")

  // === CONSECUTIVE STEP RULES ===

  // Allow checker to also send the transfer
  allowCheckerToSend Boolean @default(false) @map("allow_checker_to_send")

  // Allow sender to also receive/complete the transfer
  allowSenderToReceive Boolean @default(false) @map("allow_sender_to_receive")

  // Allow sender to complete (skip receiver role)
  allowSenderToComplete Boolean @default(false) @map("allow_sender_to_complete")

  // === ADVANCED RULES ===

  // Require user to be physically at location (requires active location tracking)
  requirePhysicalLocationMatch Boolean @default(false) @map("require_physical_location_match")

  // Auto-approve internal transfers (same business, no external parties)
  autoApproveInternalTransfers Boolean @default(false) @map("auto_approve_internal_transfers")

  // Auto-resolve quantity discrepancies within tolerance
  autoResolveMinorDiscrepancies Boolean @default(false) @map("auto_resolve_minor_discrepancies")

  // Discrepancy tolerance percentage (e.g., 2.00 = 2%)
  discrepancyTolerancePercent Decimal @default(0) @map("discrepancy_tolerance_percent") @db.Decimal(5, 2)

  // Minimum time delay between stages (in minutes, 0 = no delay)
  minimumDelayBetweenStages Int @default(0) @map("minimum_delay_between_stages")

  // === AUDIT METADATA ===

  // Who last modified these rules
  lastModifiedBy Int? @map("last_modified_by")

  // Justification for rule changes (required when relaxing security)
  changeJustification String? @map("change_justification") @db.Text

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("transfer_rule_settings")
}
```

**Update Business model:**
```prisma
model Business {
  // ... existing fields ...

  // Add relation
  transferRuleSettings TransferRuleSettings?

  // REMOVE this field (replaced by TransferRuleSettings.workflowMode):
  // transferWorkflowMode String @default("full") @map("transfer_workflow_mode")
}
```

### 1.2 Create Migration

```bash
npx prisma migrate dev --name add_transfer_rule_settings
```

### 1.3 Seed Default Settings

**File:** `prisma/seed.ts` (add to existing seed script)

```typescript
// Seed default transfer rules for all existing businesses
const businesses = await prisma.business.findMany()

for (const business of businesses) {
  await prisma.transferRuleSettings.upsert({
    where: { businessId: business.id },
    update: {},
    create: {
      businessId: business.id,
      workflowMode: "full",
      // All SoD checks enabled by default (strict mode)
      requireDifferentChecker: true,
      requireDifferentSender: true,
      requireDifferentReceiver: true,
      requireDifferentCompleter: true,
      allowCreatorToCheck: false,
      allowCreatorToSend: false,
      allowCreatorToComplete: false,
      allowCheckerToSend: false,
      allowSenderToReceive: false,
      allowSenderToComplete: false,
      requirePhysicalLocationMatch: false,
      autoApproveInternalTransfers: false,
      autoResolveMinorDiscrepancies: false,
      discrepancyTolerancePercent: 0,
      minimumDelayBetweenStages: 0,
    }
  })
}

console.log(`Seeded transfer rule settings for ${businesses.length} businesses`)
```

**Run seed:**
```bash
npm run db:seed
```

---

## Phase 2: Validation Utility (Week 2)

### 2.1 Create Validation Utility

**File:** `src/lib/transferRules.ts` (NEW)

```typescript
import { prisma } from './prisma'
import { StockTransfer } from '@prisma/client'

export type TransferAction = 'check' | 'send' | 'receive' | 'complete'

export interface ValidationParams {
  businessId: number
  transfer: StockTransfer
  action: TransferAction
  userId: number
}

export interface ValidationResult {
  allowed: boolean
  reason?: string
  configurable?: boolean
  ruleField?: string
}

/**
 * Validate transfer action against business-specific rules
 * Returns { allowed: true } if action is permitted
 * Returns { allowed: false, reason, ruleField } if blocked
 */
export async function validateTransferAction({
  businessId,
  transfer,
  action,
  userId,
}: ValidationParams): Promise<ValidationResult> {

  // Fetch business transfer rules
  const rules = await prisma.transferRuleSettings.findUnique({
    where: { businessId }
  })

  // Default to strict mode if no rules configured
  if (!rules) {
    return enforceStrictMode(transfer, action, userId)
  }

  // Apply configurable validation based on action
  switch (action) {
    case 'check':
      return validateCheckAction(transfer, userId, rules)

    case 'send':
      return validateSendAction(transfer, userId, rules)

    case 'receive':
      return validateReceiveAction(transfer, userId, rules)

    case 'complete':
      return validateCompleteAction(transfer, userId, rules)

    default:
      return { allowed: true }
  }
}

// === VALIDATION FUNCTIONS BY ACTION ===

function validateCheckAction(
  transfer: StockTransfer,
  userId: number,
  rules: any
): ValidationResult {

  // Rule: Checker must be different from creator
  if (rules.requireDifferentChecker && !rules.allowCreatorToCheck) {
    if (transfer.createdBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy requires a different user to check transfers',
        configurable: true,
        ruleField: 'allowCreatorToCheck'
      }
    }
  }

  return { allowed: true }
}

function validateSendAction(
  transfer: StockTransfer,
  userId: number,
  rules: any
): ValidationResult {

  // Rule 1: Sender must be different from creator
  if (rules.requireDifferentSender && !rules.allowCreatorToSend) {
    if (transfer.createdBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents creator from sending transfers',
        configurable: true,
        ruleField: 'allowCreatorToSend'
      }
    }
  }

  // Rule 2: Sender must be different from checker
  if (rules.requireDifferentSender && !rules.allowCheckerToSend) {
    if (transfer.checkedBy === userId) {
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

function validateReceiveAction(
  transfer: StockTransfer,
  userId: number,
  rules: any
): ValidationResult {

  // Rule 1: Receiver must be different from creator
  if (rules.requireDifferentReceiver) {
    if (transfer.createdBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents creator from receiving transfers',
        configurable: true,
        ruleField: 'requireDifferentReceiver'
      }
    }
  }

  // Rule 2: Receiver must be different from sender
  if (rules.requireDifferentReceiver && !rules.allowSenderToReceive) {
    if (transfer.sentBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents sender from receiving transfers',
        configurable: true,
        ruleField: 'allowSenderToReceive'
      }
    }
  }

  return { allowed: true }
}

function validateCompleteAction(
  transfer: StockTransfer,
  userId: number,
  rules: any
): ValidationResult {

  // Rule 1: Completer must be different from creator
  if (rules.requireDifferentCompleter && !rules.allowCreatorToComplete) {
    if (transfer.createdBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents creator from completing transfers',
        configurable: true,
        ruleField: 'allowCreatorToComplete'
      }
    }
  }

  // Rule 2: Completer must be different from sender
  if (rules.requireDifferentCompleter && !rules.allowSenderToComplete) {
    if (transfer.sentBy === userId) {
      return {
        allowed: false,
        reason: 'Business policy prevents sender from completing transfers',
        configurable: true,
        ruleField: 'allowSenderToComplete'
      }
    }
  }

  return { allowed: true }
}

// === STRICT MODE (Backward Compatibility) ===

function enforceStrictMode(
  transfer: StockTransfer,
  action: TransferAction,
  userId: number
): ValidationResult {

  // Default to strictest possible rules
  switch (action) {
    case 'check':
      if (transfer.createdBy === userId) {
        return {
          allowed: false,
          reason: 'Cannot check your own transfer (default strict mode)',
          configurable: true
        }
      }
      break

    case 'send':
      if (transfer.createdBy === userId) {
        return {
          allowed: false,
          reason: 'Cannot send your own transfer (default strict mode)',
          configurable: true
        }
      }
      if (transfer.checkedBy === userId) {
        return {
          allowed: false,
          reason: 'Cannot send a transfer you checked (default strict mode)',
          configurable: true
        }
      }
      break

    case 'complete':
      if (transfer.createdBy === userId) {
        return {
          allowed: false,
          reason: 'Cannot complete your own transfer (default strict mode)',
          configurable: true
        }
      }
      if (transfer.sentBy === userId) {
        return {
          allowed: false,
          reason: 'Cannot complete a transfer you sent (default strict mode)',
          configurable: true
        }
      }
      break
  }

  return { allowed: true }
}

// === HELPER FUNCTIONS ===

/**
 * Get transfer rules for a business (with caching)
 */
export async function getBusinessTransferRules(businessId: number) {
  return await prisma.transferRuleSettings.findUnique({
    where: { businessId }
  })
}

/**
 * Create default rules for a new business
 */
export async function createDefaultTransferRules(businessId: number) {
  return await prisma.transferRuleSettings.create({
    data: {
      businessId,
      workflowMode: "full",
      requireDifferentChecker: true,
      requireDifferentSender: true,
      requireDifferentReceiver: true,
      requireDifferentCompleter: true,
      allowCreatorToCheck: false,
      allowCreatorToSend: false,
      allowCreatorToComplete: false,
      allowCheckerToSend: false,
      allowSenderToReceive: false,
      allowSenderToComplete: false,
    }
  })
}
```

### 2.2 Write Unit Tests

**File:** `src/lib/__tests__/transferRules.test.ts` (NEW)

```typescript
import { validateTransferAction } from '../transferRules'

describe('Transfer Rules Validation', () => {
  const mockTransfer = {
    id: 1,
    businessId: 1,
    createdBy: 100,
    checkedBy: 200,
    sentBy: 300,
  }

  test('Strict mode: creator cannot send', async () => {
    const result = await validateTransferAction({
      businessId: 999, // Non-existent business (defaults to strict)
      transfer: mockTransfer,
      action: 'send',
      userId: 100 // Same as creator
    })

    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('Cannot send your own transfer')
  })

  test('Relaxed mode: creator CAN send if allowed', async () => {
    // Assume business 1 has allowCreatorToSend = true
    const result = await validateTransferAction({
      businessId: 1,
      transfer: mockTransfer,
      action: 'send',
      userId: 100 // Same as creator
    })

    expect(result.allowed).toBe(true)
  })

  // ... more tests ...
})
```

---

## Phase 3: Refactor Endpoints (Week 3)

### 3.1 Refactor Check Endpoint

**File:** `src/app/api/transfers/[id]/check-approve/route.ts`

**BEFORE:**
```typescript
// Line 89-97 (Hard-coded)
if (transfer.createdBy === parseInt(userId)) {
  return NextResponse.json(
    {
      error: 'Cannot approve your own transfer...',
      code: 'SAME_USER_VIOLATION'
    },
    { status: 403 }
  )
}
```

**AFTER:**
```typescript
import { validateTransferAction } from '@/lib/transferRules'

// ... existing code ...

// Replace hard-coded check with configurable validation
const validation = await validateTransferAction({
  businessId: parseInt(businessId),
  transfer,
  action: 'check',
  userId: parseInt(userId)
})

if (!validation.allowed) {
  return NextResponse.json(
    {
      error: validation.reason,
      code: 'TRANSFER_RULE_VIOLATION',
      configurable: validation.configurable,
      ruleField: validation.ruleField,
      suggestion: validation.configurable
        ? `Contact Super Admin to adjust ${validation.ruleField} setting`
        : undefined
    },
    { status: 403 }
  )
}

// ... proceed with check logic ...
```

### 3.2 Refactor Send Endpoint

**File:** `src/app/api/transfers/[id]/send/route.ts`

**BEFORE (Lines 95-113):**
```typescript
// Hard-coded checks
if (transfer.createdBy === userIdNumber) { ... }
if (transfer.checkedBy === userIdNumber) { ... }
```

**AFTER:**
```typescript
import { validateTransferAction } from '@/lib/transferRules'

// Replace BOTH hard-coded checks with single validation call
const validation = await validateTransferAction({
  businessId: businessIdNumber,
  transfer,
  action: 'send',
  userId: userIdNumber
})

if (!validation.allowed) {
  return NextResponse.json(
    {
      error: validation.reason,
      code: 'TRANSFER_RULE_VIOLATION',
      configurable: validation.configurable,
      ruleField: validation.ruleField
    },
    { status: 403 }
  )
}
```

### 3.3 Refactor Receive Endpoint

**File:** `src/app/api/transfers/[id]/receive/route.ts`

**Apply same pattern:**
```typescript
const validation = await validateTransferAction({
  businessId: parseInt(businessId),
  transfer,
  action: 'receive',
  userId: parseInt(userId)
})

if (!validation.allowed) {
  return NextResponse.json({ /* ... */ }, { status: 403 })
}
```

### 3.4 Refactor Complete Endpoint

**File:** `src/app/api/transfers/[id]/complete/route.ts`

**Apply same pattern:**
```typescript
const validation = await validateTransferAction({
  businessId: parseInt(businessId),
  transfer,
  action: 'complete',
  userId: parseInt(userId)
})

if (!validation.allowed) {
  return NextResponse.json({ /* ... */ }, { status: 403 })
}
```

---

## Phase 4: Settings API (Week 3-4)

### 4.1 Create Settings Endpoint

**File:** `src/app/api/settings/transfer-rules/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

// GET - Retrieve transfer rules for current business
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.BUSINESS_SETTINGS_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Fetch rules
    const rules = await prisma.transferRuleSettings.findUnique({
      where: { businessId }
    })

    // Return default strict mode if not configured
    if (!rules) {
      return NextResponse.json({
        businessId,
        configured: false,
        defaults: {
          workflowMode: "full",
          requireDifferentChecker: true,
          requireDifferentSender: true,
          requireDifferentReceiver: true,
          requireDifferentCompleter: true,
          allowCreatorToCheck: false,
          allowCreatorToSend: false,
          allowCreatorToComplete: false,
          allowCheckerToSend: false,
          allowSenderToReceive: false,
          allowSenderToComplete: false,
        }
      })
    }

    return NextResponse.json(rules)
  } catch (error) {
    console.error('Error fetching transfer rules:', error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

// PUT - Update transfer rules (Super Admin only)
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const userId = parseInt(user.id)

    // CRITICAL: Only Super Admin or users with explicit permission can modify
    if (
      !user.permissions?.includes(PERMISSIONS.BUSINESS_SETTINGS_EDIT) &&
      !user.roles?.includes('Super Admin')
    ) {
      return NextResponse.json(
        { error: 'Forbidden - Only Super Admin can modify transfer rules' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      workflowMode,
      requireDifferentChecker,
      requireDifferentSender,
      requireDifferentReceiver,
      requireDifferentCompleter,
      allowCreatorToCheck,
      allowCreatorToSend,
      allowCreatorToComplete,
      allowCheckerToSend,
      allowSenderToReceive,
      allowSenderToComplete,
      requirePhysicalLocationMatch,
      autoApproveInternalTransfers,
      autoResolveMinorDiscrepancies,
      discrepancyTolerancePercent,
      minimumDelayBetweenStages,
      changeJustification,
    } = body

    // Require justification when RELAXING security
    const isRelaxingSecurity = (
      allowCreatorToSend ||
      allowCreatorToComplete ||
      allowCheckerToSend ||
      allowSenderToComplete
    )

    if (isRelaxingSecurity && !changeJustification) {
      return NextResponse.json(
        { error: 'Justification required when relaxing security controls' },
        { status: 400 }
      )
    }

    // Upsert rules
    const updatedRules = await prisma.transferRuleSettings.upsert({
      where: { businessId },
      update: {
        workflowMode,
        requireDifferentChecker,
        requireDifferentSender,
        requireDifferentReceiver,
        requireDifferentCompleter,
        allowCreatorToCheck,
        allowCreatorToSend,
        allowCreatorToComplete,
        allowCheckerToSend,
        allowSenderToReceive,
        allowSenderToComplete,
        requirePhysicalLocationMatch,
        autoApproveInternalTransfers,
        autoResolveMinorDiscrepancies,
        discrepancyTolerancePercent,
        minimumDelayBetweenStages,
        lastModifiedBy: userId,
        changeJustification,
      },
      create: {
        businessId,
        workflowMode: workflowMode || 'full',
        requireDifferentChecker: requireDifferentChecker ?? true,
        requireDifferentSender: requireDifferentSender ?? true,
        requireDifferentReceiver: requireDifferentReceiver ?? true,
        requireDifferentCompleter: requireDifferentCompleter ?? true,
        allowCreatorToCheck: allowCreatorToCheck ?? false,
        allowCreatorToSend: allowCreatorToSend ?? false,
        allowCreatorToComplete: allowCreatorToComplete ?? false,
        allowCheckerToSend: allowCheckerToSend ?? false,
        allowSenderToReceive: allowSenderToReceive ?? false,
        allowSenderToComplete: allowSenderToComplete ?? false,
        requirePhysicalLocationMatch: requirePhysicalLocationMatch ?? false,
        autoApproveInternalTransfers: autoApproveInternalTransfers ?? false,
        autoResolveMinorDiscrepancies: autoResolveMinorDiscrepancies ?? false,
        discrepancyTolerancePercent: discrepancyTolerancePercent || 0,
        minimumDelayBetweenStages: minimumDelayBetweenStages || 0,
        lastModifiedBy: userId,
        changeJustification,
      },
    })

    // Create audit log
    await createAuditLog({
      businessId,
      userId,
      username: user.username,
      action: AuditAction.BUSINESS_SETTINGS_UPDATE,
      entityType: EntityType.BUSINESS,
      entityIds: [businessId],
      description: `Updated transfer rules - ${changeJustification || 'No justification provided'}`,
      metadata: {
        settingsType: 'transfer_rules',
        changes: body,
        isRelaxingSecurity,
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      message: 'Transfer rules updated successfully',
      rules: updatedRules,
    })
  } catch (error) {
    console.error('Error updating transfer rules:', error)
    return NextResponse.json(
      { error: 'Failed to update rules', details: error.message },
      { status: 500 }
    )
  }
}
```

---

## Phase 5: Settings UI (Week 4-5)

### 5.1 Create Settings Page

**File:** `src/app/dashboard/settings/transfer-rules/page.tsx` (NEW)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { usePermissions } from '@/hooks/usePermissions'
import { PERMISSIONS } from '@/lib/rbac'

export default function TransferRulesSettingsPage() {
  const { data: session } = useSession()
  const { can } = usePermissions()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rules, setRules] = useState<any>(null)
  const [justification, setJustification] = useState('')
  const [showWarning, setShowWarning] = useState(false)

  // Check permission
  if (!can(PERMISSIONS.BUSINESS_SETTINGS_VIEW)) {
    return <div>Access Denied</div>
  }

  useEffect(() => {
    fetchRules()
  }, [])

  async function fetchRules() {
    try {
      const response = await fetch('/api/settings/transfer-rules')
      const data = await response.json()
      setRules(data.configured ? data : data.defaults)
    } catch (error) {
      console.error('Failed to fetch rules:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    // Check if relaxing security
    const isRelaxing = (
      rules.allowCreatorToSend ||
      rules.allowCreatorToComplete ||
      rules.allowCheckerToSend ||
      rules.allowSenderToComplete
    )

    if (isRelaxing && !justification) {
      setShowWarning(true)
      return
    }

    setSaving(true)
    try {
      const response = await fetch('/api/settings/transfer-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...rules,
          changeJustification: justification
        })
      })

      if (response.ok) {
        alert('Settings saved successfully')
        setJustification('')
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Failed to save rules:', error)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Transfer Workflow Rules</h1>

      <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
        <p className="text-sm text-yellow-700">
          ⚠️ Warning: Relaxing these rules reduces fraud protection.
          Only modify if you understand the security implications.
        </p>
      </div>

      {/* Workflow Mode */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Workflow Complexity</h2>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            checked={rules.workflowMode === 'full'}
            onChange={() => setRules({ ...rules, workflowMode: 'full' })}
          />
          <span>Full (8-stage workflow with all checks)</span>
        </label>
        <label className="flex items-center space-x-2">
          <input
            type="radio"
            checked={rules.workflowMode === 'simple'}
            onChange={() => setRules({ ...rules, workflowMode: 'simple' })}
          />
          <span>Simple (3-stage: Draft → Send → Complete)</span>
        </label>
      </section>

      {/* Separation of Duties */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Separation of Duties</h2>

        <div className="space-y-4">
          <ToggleSwitch
            label="Require different user to check transfers"
            checked={rules.requireDifferentChecker}
            onChange={(val) => setRules({ ...rules, requireDifferentChecker: val })}
            description="When enabled, creator cannot check their own transfer"
          />

          <ToggleSwitch
            label="Require different user to send transfers"
            checked={rules.requireDifferentSender}
            onChange={(val) => setRules({ ...rules, requireDifferentSender: val })}
            description="When enabled, creator and checker cannot send transfer"
          />

          <ToggleSwitch
            label="Require different user to receive transfers"
            checked={rules.requireDifferentReceiver}
            onChange={(val) => setRules({ ...rules, requireDifferentReceiver: val })}
            description="When enabled, sender cannot receive transfer"
          />

          <ToggleSwitch
            label="Require different user to complete transfers"
            checked={rules.requireDifferentCompleter}
            onChange={(val) => setRules({ ...rules, requireDifferentCompleter: val })}
            description="When enabled, creator and sender cannot complete transfer"
          />
        </div>
      </section>

      {/* Allow Overrides */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Allow Creator Actions</h2>

        <div className="space-y-4">
          <ToggleSwitch
            label="Allow creator to check their own transfer"
            checked={rules.allowCreatorToCheck}
            onChange={(val) => setRules({ ...rules, allowCreatorToCheck: val })}
            description="⚠️ Reduces fraud protection"
            warning={true}
          />

          <ToggleSwitch
            label="Allow creator to send their own transfer"
            checked={rules.allowCreatorToSend}
            onChange={(val) => setRules({ ...rules, allowCreatorToSend: val })}
            description="⚠️ Reduces fraud protection"
            warning={true}
          />

          <ToggleSwitch
            label="Allow creator to complete their own transfer"
            checked={rules.allowCreatorToComplete}
            onChange={(val) => setRules({ ...rules, allowCreatorToComplete: val })}
            description="⚠️ Reduces fraud protection"
            warning={true}
          />
        </div>
      </section>

      {/* Consecutive Steps */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Allow Consecutive Steps</h2>

        <div className="space-y-4">
          <ToggleSwitch
            label="Allow checker to also send transfer"
            checked={rules.allowCheckerToSend}
            onChange={(val) => setRules({ ...rules, allowCheckerToSend: val })}
            description="Allows same user to check and send"
          />

          <ToggleSwitch
            label="Allow sender to also receive transfer"
            checked={rules.allowSenderToReceive}
            onChange={(val) => setRules({ ...rules, allowSenderToReceive: val })}
            description="Allows same user to send and receive"
          />

          <ToggleSwitch
            label="Allow sender to complete transfer"
            checked={rules.allowSenderToComplete}
            onChange={(val) => setRules({ ...rules, allowSenderToComplete: val })}
            description="Allows sender to skip receiver and complete directly"
          />
        </div>
      </section>

      {/* Justification */}
      {(rules.allowCreatorToSend || rules.allowCreatorToComplete ||
        rules.allowCheckerToSend || rules.allowSenderToComplete) && (
        <section className="mb-8">
          <label className="block text-sm font-medium mb-2">
            Justification (Required when relaxing security)
          </label>
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explain why these rules are being relaxed (e.g., 'Small business with only 2 employees')"
          />
        </section>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={saving || !can(PERMISSIONS.BUSINESS_SETTINGS_EDIT)}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>

      {/* Warning Modal */}
      {showWarning && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg max-w-md">
            <h3 className="text-lg font-bold mb-4">Justification Required</h3>
            <p className="mb-4">
              You are relaxing security controls. Please provide a justification
              explaining why this change is necessary.
            </p>
            <button
              onClick={() => setShowWarning(false)}
              className="bg-gray-600 text-white px-4 py-2 rounded"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// Toggle Switch Component
function ToggleSwitch({ label, checked, onChange, description, warning }) {
  return (
    <div className="flex items-start space-x-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1"
      />
      <div>
        <label className="font-medium">{label}</label>
        <p className={`text-sm ${warning ? 'text-red-600' : 'text-gray-600'}`}>
          {description}
        </p>
      </div>
    </div>
  )
}
```

### 5.2 Add to Sidebar Navigation

**File:** `src/components/Sidebar.tsx`

```typescript
// Add to Business Settings section
{can(PERMISSIONS.BUSINESS_SETTINGS_VIEW) && (
  <MenuItem href="/dashboard/settings/transfer-rules" icon={Settings}>
    Transfer Rules
  </MenuItem>
)}
```

---

## Testing Checklist

### Unit Tests
- [ ] `transferRules.ts` validation logic
- [ ] Default strict mode fallback
- [ ] All action types (check, send, receive, complete)

### Integration Tests
- [ ] Settings API GET/PUT endpoints
- [ ] Authorization checks (Super Admin only)
- [ ] Justification requirement enforcement

### E2E Tests
- [ ] Strict mode: Creator blocked from sending
- [ ] Relaxed mode: Creator allowed to send
- [ ] Settings UI: Toggle switches work
- [ ] Audit log: Rule changes recorded

### Security Tests
- [ ] Non-admin cannot modify rules
- [ ] Cross-business rule access blocked
- [ ] SQL injection attempts blocked

---

## Deployment Plan

### Pre-Deployment
1. ✅ Run all tests (unit, integration, E2E)
2. ✅ Backup production database
3. ✅ Review migration script
4. ✅ Notify users of upcoming changes

### Deployment Steps
1. Deploy database migration
2. Run seed script to create default rules
3. Deploy updated API code
4. Deploy updated UI
5. Verify settings page loads correctly
6. Test transfer workflow with default strict mode

### Post-Deployment
1. Monitor error logs for validation failures
2. Check audit logs for rule changes
3. Gather user feedback on settings UI
4. Document any issues

---

## Rollback Plan

If critical issues occur:

1. **Database Rollback:**
   ```sql
   DROP TABLE transfer_rule_settings;
   ```

2. **Code Rollback:**
   - Revert to previous git commit
   - Re-deploy hard-coded validation endpoints

3. **Data Preservation:**
   - Export `transfer_rule_settings` table before rollback
   - Can re-import after fixing issues

---

## Success Metrics

### Technical Metrics
- ✅ Zero validation errors in production (first week)
- ✅ API response time < 200ms for validation checks
- ✅ 100% test coverage for validation logic

### Business Metrics
- ✅ 50% of businesses review transfer rules (first month)
- ✅ 10% of businesses customize rules to fit workflows
- ✅ 90% reduction in support tickets about transfer restrictions

### User Satisfaction
- ✅ Positive feedback from small business users
- ✅ No security incidents related to relaxed rules
- ✅ Clear audit trail for compliance reviews

---

## Future Enhancements

### Phase 6: Active Location Tracking
- Add `User.activeLocationId` field
- "Switch Location" UI component
- Auto-populate transfer forms from active location

### Phase 7: Advanced Rules
- Time-based restrictions (e.g., no transfers after 6pm)
- Amount-based auto-approval (< $100 skip checks)
- Role-based rule overrides (managers can bypass)

### Phase 8: AI-Powered Suggestions
- Detect fraud patterns and recommend stricter rules
- Suggest workflow optimizations based on usage data
- Predictive transfer approval automation

---

**Document Version:** 1.0
**Status:** Ready for Implementation
**Estimated Effort:** 80-100 hours
**Priority:** High (addresses major user friction point)
