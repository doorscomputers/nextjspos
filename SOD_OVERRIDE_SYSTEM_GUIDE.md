# Separation of Duties (SOD) Override System - Complete Guide

## 🎯 Overview

This system allows **business administrators** to configure Separation of Duties rules through a UI instead of code. This solves the problem where small branches with 1-2 employees get blocked by strict SOD enforcement.

### Before (Hard-Coded):
```typescript
// ❌ PROBLEM: Same validation for ALL businesses
if (transfer.createdBy === userId) {
  return 403 "Cannot send your own transfer"
}
```

### After (Configurable):
```typescript
// ✅ SOLUTION: Business can decide their own rules
const validation = await validateSOD({...})
if (!validation.allowed) {
  // Configurable error with helpful suggestion
  return 403
}
```

---

## 📁 Files Created

### 1. Database Schema
**File:** `prisma/schema.prisma`
- Added `BusinessSODSettings` model with 15+ configurable rules
- Linked to `Business` model as one-to-one relation

### 2. Validation Library
**File:** `src/lib/sodValidation.ts`
- `validateSOD()` - Main validation function
- `getUserRoles()` - Get user's roles for exemption checking
- `createDefaultSODSettings()` - Initialize settings for new business

### 3. API Routes
**File:** `src/app/api/settings/sod-rules/route.ts`
- `GET` - Fetch current SOD settings
- `PUT` - Update SOD settings (with audit log)

### 4. Settings UI Page
**File:** `src/app/dashboard/settings/sod-rules/page.tsx`
- Beautiful UI with toggle switches
- Organized by category (Transfers, Purchases, Returns)
- Real-time save functionality

### 5. Sidebar Menu
**File:** `src/components/Sidebar.tsx`
- Added "SOD Rules (Separation of Duties)" menu item under Settings

### 6. Updated Example Endpoint
**File:** `src/app/api/transfers/[id]/send/route.ts`
- Replaced hard-coded checks with configurable validation

---

## 🚀 How to Use

### Step 1: Apply Database Migration

After restarting your dev server, Prisma will auto-generate the client. Or run manually:

```bash
npx prisma generate
npx prisma db push
```

### Step 2: Access SOD Settings

1. Log in as **Super Admin** or user with `BUSINESS_SETTINGS_VIEW` permission
2. Go to **Settings** > **SOD Rules (Separation of Duties)**
3. Configure rules based on your business size:

#### Small Branch (1-2 employees):
- ✅ Enable "Allow Creator to Send"
- ✅ Enable "Allow Creator to Complete"
- ✅ Enable "Allow Sender to Complete"

#### Large Branch (5+ employees):
- ❌ Keep all strict (defaults)
- Different person for each step

### Step 3: Test the System

1. Create a transfer as User A
2. Try to send it as User A:
   - **Before**: Always blocked
   - **After**: Blocked OR allowed based on settings

---

## 🔧 How to Apply to Other Endpoints

### Transfer Endpoints to Update

Apply the same pattern to these files:

1. ✅ **DONE:** `src/app/api/transfers/[id]/send/route.ts`
2. **TODO:** `src/app/api/transfers/[id]/check-approve/route.ts`
3. **TODO:** `src/app/api/transfers/[id]/receive/route.ts`
4. **TODO:** `src/app/api/transfers/[id]/complete/route.ts`
5. **TODO:** `src/app/api/transfers/[id]/mark-arrived/route.ts`

### Purchase Endpoints to Update

6. **TODO:** `src/app/api/purchases/amendments/[id]/approve/route.ts`
7. **TODO:** `src/app/api/purchases/[id]/approve/route.ts` (if exists)
8. **TODO:** `src/app/api/purchases/receipts/[id]/approve/route.ts` (if exists)

### Return Endpoints to Update

9. **TODO:** `src/app/api/customer-returns/[id]/approve/route.ts` (if exists)
10. **TODO:** `src/app/api/supplier-returns/[id]/approve/route.ts`

---

## 📝 Migration Template

### Step-by-Step for Each Endpoint

#### 1. Add Import

```typescript
// At the top of the file
import { validateSOD, getUserRoles } from '@/lib/sodValidation'
```

#### 2. Find Hard-Coded SOD Check

Look for patterns like:
```typescript
if (transfer.createdBy === userId) {
  return NextResponse.json({ error: '...' }, { status: 403 })
}
```

#### 3. Replace with Configurable Validation

```typescript
// Get user roles (for exemption checking)
const userRoles = await getUserRoles(userIdNumber)

// Validate using business settings
const sodValidation = await validateSOD({
  businessId: businessIdNumber,
  userId: userIdNumber,
  action: 'ACTION_NAME',  // 'check', 'send', 'receive', 'complete', 'approve'
  entity: {
    id: entity.id,
    createdBy: entity.createdBy,
    checkedBy: entity.checkedBy,      // for transfers
    sentBy: entity.sentBy,             // for transfers
    receivedBy: entity.receivedBy,     // for transfers
    requestedBy: entity.requestedBy,   // for amendments/returns
    approvedBy: entity.approvedBy      // for any approval workflow
  },
  entityType: 'ENTITY_TYPE',  // 'transfer', 'purchase', 'amendment', 'grn', 'customer_return', 'supplier_return'
  userRoles
})

if (!sodValidation.allowed) {
  return NextResponse.json(
    {
      error: sodValidation.reason,
      code: sodValidation.code,
      configurable: sodValidation.configurable,
      suggestion: sodValidation.suggestion,
      ruleField: sodValidation.ruleField
    },
    { status: 403 }
  )
}
```

---

## 🎯 Real-World Examples

### Example 1: Transfer Check Endpoint

**File:** `src/app/api/transfers/[id]/check-approve/route.ts`

**Before:**
```typescript
// Hard-coded check
if (transfer.createdBy === userId) {
  return NextResponse.json(
    { error: 'Cannot approve your own transfer' },
    { status: 403 }
  )
}
```

**After:**
```typescript
// Configurable check
const userRoles = await getUserRoles(userIdNumber)
const sodValidation = await validateSOD({
  businessId: businessIdNumber,
  userId: userIdNumber,
  action: 'check',
  entity: {
    id: transfer.id,
    createdBy: transfer.createdBy
  },
  entityType: 'transfer',
  userRoles
})

if (!sodValidation.allowed) {
  return NextResponse.json(
    {
      error: sodValidation.reason,
      code: sodValidation.code,
      suggestion: sodValidation.suggestion
    },
    { status: 403 }
  )
}
```

### Example 2: Amendment Approval

**File:** `src/app/api/purchases/amendments/[id]/approve/route.ts`

**Before:**
```typescript
if (amendment.requestedBy === parseInt(userId)) {
  return NextResponse.json(
    { error: 'Cannot approve your own amendment request' },
    { status: 403 }
  )
}
```

**After:**
```typescript
const userRoles = await getUserRoles(parseInt(userId))
const sodValidation = await validateSOD({
  businessId: parseInt(user.businessId),
  userId: parseInt(userId),
  action: 'approve',
  entity: {
    id: amendment.id,
    requestedBy: amendment.requestedBy
  },
  entityType: 'amendment',
  userRoles
})

if (!sodValidation.allowed) {
  return NextResponse.json(
    {
      error: sodValidation.reason,
      code: sodValidation.code,
      suggestion: sodValidation.suggestion
    },
    { status: 403 }
  )
}
```

---

## 🔍 Testing Scenarios

### Scenario 1: Small Branch (Relaxed Mode)

**Setup:**
- Location has 2 employees: Pedro & Maria
- Admin enables: "Allow Creator to Send", "Allow Creator to Complete"

**Test:**
1. Pedro creates transfer → ✅ Success
2. Pedro tries to send it → ✅ **Now allowed** (previously blocked)
3. Maria receives it → ✅ Success
4. Pedro completes it → ✅ **Now allowed** (previously blocked)

**Result:** Transfer completes with just 2 people!

### Scenario 2: Large Branch (Strict Mode)

**Setup:**
- Location has 6 employees
- Admin keeps all defaults (strict)

**Test:**
1. Pedro creates transfer → ✅ Success
2. Pedro tries to send → ❌ **Blocked** (strict mode)
3. Maria checks → ✅ Success
4. Juan sends → ✅ Success
5. Ana receives → ✅ Success
6. Carlos completes → ✅ Success

**Result:** Requires 4-5 different people for full workflow

---

## ⚙️ Configuration Matrix

| Setting | Default | Small Branch | Large Branch |
|---------|---------|--------------|--------------|
| `enforceTransferSOD` | ✅ true | ✅ true | ✅ true |
| `allowCreatorToCheck` | ❌ false | ✅ true | ❌ false |
| `allowCreatorToSend` | ❌ false | ✅ true | ❌ false |
| `allowCheckerToSend` | ❌ false | ✅ true | ❌ false |
| `allowCreatorToComplete` | ❌ false | ✅ true | ❌ false |
| `allowSenderToComplete` | ❌ false | ✅ true | ❌ false |
| `allowReceiverToComplete` | ✅ true | ✅ true | ✅ true |

---

## 🛡️ Role-Based Exemptions

### How It Works

1. Add role names to `exemptRoles` field (comma-separated)
2. Users with those roles **bypass ALL SOD checks**

### Example Configuration

```
exemptRoles: "Super Admin,System Administrator,Owner,Emergency Manager"
```

### Use Cases

- **Super Admin**: Full system access
- **Owner**: Business owner can do anything
- **Emergency Manager**: Temporary role during emergencies/staff shortages

---

## 📊 Audit Trail

All SOD rule changes are logged in the audit log:

```json
{
  "action": "sod_settings_update",
  "userId": 123,
  "entityType": "BUSINESS_SOD_SETTINGS",
  "metadata": {
    "oldSettings": {...},
    "newSettings": {...},
    "updatedFields": ["allowCreatorToSend", "allowCheckerToSend"]
  }
}
```

This provides:
- ✅ Who changed the rules
- ✅ When they changed them
- ✅ What was changed
- ✅ Full compliance trail

---

## 🚨 Error Messages

### User-Friendly Errors

The system provides helpful error messages:

```json
{
  "error": "You cannot send a transfer you created. Business policy requires a different user to send for proper control.",
  "code": "SOD_CREATOR_CANNOT_SEND",
  "configurable": true,
  "suggestion": "Admin can enable 'Allow Creator to Send' in Settings > SOD Rules if your team is small",
  "ruleField": "allowCreatorToSend"
}
```

### Benefits:
- ✅ Clear explanation of why it was blocked
- ✅ Tells admin how to fix it
- ✅ Links to specific setting field

---

## 📋 Checklist for Full Implementation

- [x] Database schema created
- [x] Validation library created
- [x] API routes created
- [x] Settings UI page created
- [x] Sidebar menu item added
- [x] Transfer Send endpoint updated (example)
- [ ] Apply to Transfer Check endpoint
- [ ] Apply to Transfer Receive endpoint
- [ ] Apply to Transfer Complete endpoint
- [ ] Apply to Purchase Amendment approval
- [ ] Apply to Purchase Order approval
- [ ] Apply to GRN approval
- [ ] Apply to Customer Return approval
- [ ] Apply to Supplier Return approval
- [ ] Test with small branch scenario
- [ ] Test with large branch scenario
- [ ] Document in user manual

---

## 🎓 Best Practices

### 1. Default to Strict
Always start with strict SOD enforcement and relax only when needed.

### 2. Review Regularly
Review SOD settings quarterly or when staff changes.

### 3. Document Exceptions
Keep notes on why specific rules were relaxed.

### 4. Use Role Exemptions Sparingly
Only grant exemptions to truly trusted roles.

### 5. Monitor Audit Logs
Regularly review who is changing SOD settings.

---

## ❓ FAQ

### Q: Can I completely disable SOD?
**A:** Yes, toggle `enforceTransferSOD` to OFF. But this is not recommended for compliance.

### Q: What happens to existing transactions?
**A:** SOD rules only apply to NEW actions. Past transactions are unaffected.

### Q: Can users see why they were blocked?
**A:** Yes! The error message includes the reason and suggests how admin can fix it.

### Q: Do rules apply per-location or per-business?
**A:** Per-business. All locations in a business share the same SOD settings.

### Q: What if I have different rules for different locations?
**A:** Currently not supported. You could implement location-specific settings by extending the schema.

---

## 🎉 Success!

You now have a **fully configurable SOD system** that:

✅ Works for both small and large businesses
✅ Can be configured without code changes
✅ Provides helpful error messages
✅ Maintains audit compliance
✅ Supports role-based exemptions

**Next Steps:**
1. Run database migration
2. Configure your business rules in Settings > SOD Rules
3. Apply the validation pattern to remaining endpoints
4. Test thoroughly with different user scenarios

**Need Help?** Check the validation library code in `src/lib/sodValidation.ts` for detailed comments and examples.
