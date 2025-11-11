# ⚠️ CRITICAL FILES - DO NOT MODIFY WITHOUT TESTING

## Transfer Workflow System

**Status:** ✅ WORKING (Verified 2025-11-11)

### Critical Files:

#### 1. Transfer Detail Page
**File:** `src/app/dashboard/transfers/[id]/page.tsx`

**Lines:** 700-850 (Workflow button visibility logic)

**What it does:**
- Controls which workflow buttons users see based on their location
- Prevents senders from marking their own transfers as arrived
- Maintains separation of duties (SOD) for fraud prevention

**DO NOT:**
- ❌ Simplify the destination button logic
- ❌ Remove `&& primaryLocationId !== transfer.fromLocationId`
- ❌ Change without running validation tests

**BEFORE ANY CHANGES:**
1. Read: `docs/TRANSFER_WORKFLOW_RULES.md`
2. Run: `npx tsx scripts/test-transfer-workflow-rules.ts`
3. Test manually with Jheiron and Jay accounts

---

### Why This Matters:

**Security Risk:** If broken, senders can mark their own transfers as delivered without actually shipping, leading to:
- Fraudulent inventory records
- Business losses
- Audit trail corruption
- Legal liability

**Last Incident:** 2025-11-11
- **Problem:** Jheiron (sender) could mark his own transfer as arrived
- **Impact:** Workflow separation was broken
- **Fix:** Added `primaryLocationId !== transfer.fromLocationId` check
- **Tested by:** Jay and Jheiron

---

### Testing Checklist:

Before deploying ANY changes to transfer workflow:

- [ ] Run automated tests: `npx tsx scripts/test-transfer-workflow-rules.ts`
- [ ] Test as Jheiron (Main Warehouse, sender with ACCESS_ALL_LOCATIONS)
  - [ ] Can Submit, Approve, Send transfers FROM Main Warehouse ✅
  - [ ] CANNOT Mark Arrived, Verify, Receive his own transfers ✅
- [ ] Test as Jay (no location, ACCESS_ALL_LOCATIONS)
  - [ ] Can manage entire workflow for any transfer ✅
- [ ] Test as regular location users
  - [ ] Origin user sees origin buttons only ✅
  - [ ] Destination user sees destination buttons only ✅
- [ ] Test workflow separation
  - [ ] Sender cannot mark own transfer as arrived ✅
  - [ ] Receiver can mark transfer as arrived ✅

---

### Quick Reference:

**Origin Buttons (Sender Side):**
```typescript
// Simple OR logic - sender should do these
const canSee = (primaryLocationId === fromLocationId) ||
               can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
```

**Destination Buttons (Receiver Side):**
```typescript
// MUST exclude sender - prevent self-marking
const canSee = (primaryLocationId === toLocationId) ||
               (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) &&
                primaryLocationId !== fromLocationId) // ← MANDATORY!
```

---

## Menu Permissions System

**Status:** ✅ WORKING (Verified 2025-11-11)

### Critical Files:

#### 1. Menu Permission API Endpoints
**Files:**
- `src/app/api/settings/menu-permissions/user/[id]/route.ts`
- `src/app/api/settings/menu-permissions/role/[id]/route.ts`
- `src/app/api/admin/active-users/route.ts`

**What they do:**
- Check permissions using `hasPermission()` helper (handles Super Admin)
- Control sidebar menu visibility
- Prevent direct API manipulation

**DO NOT:**
- ❌ Replace `hasPermission()` with direct array checks
- ❌ Remove Super Admin bypass logic
- ❌ Skip permission validation

---

#### 2. User Menu Manager UI
**File:** `src/app/dashboard/settings/user-menu-manager/page.tsx`

**What it does:**
- Allows admins to assign menus to users and roles
- Provides visual interface for menu management

**DO NOT:**
- ❌ Remove the "By User" and "By Role" tabs
- ❌ Break the tree view hierarchy
- ❌ Remove the "Select All" functionality

---

### Documentation:

- **Transfer Workflow:** `docs/TRANSFER_WORKFLOW_RULES.md`
- **Menu Permissions:** `docs/MENU_PERMISSIONS_GUIDE.md`
- **Quick Summary:** `MENU_PERMISSIONS_SUMMARY.md`

---

### Validation Scripts:

**Transfer Workflow:**
```bash
npx tsx scripts/test-transfer-workflow-rules.ts
```

**User Locations:**
```bash
npx tsx scripts/check-jay-location-assignment.ts
```

**Menu Permissions:**
```bash
npx tsx scripts/check-menu-permissions-jayvillalon.ts
```

---

### Emergency Rollback:

If something breaks:

```bash
# Restore transfer workflow
git checkout origin/master -- src/app/dashboard/transfers/[id]/page.tsx

# Restore menu permission API
git checkout origin/master -- src/app/api/settings/menu-permissions/

# Restore active users API
git checkout origin/master -- src/app/api/admin/active-users/route.ts

# Restart development server
npm run dev
```

---

### Contact:

If you need to modify these files:

1. Read the full documentation first
2. Understand why the rules exist
3. Write test cases for your changes
4. Get approval before deploying
5. Test with real user accounts

**Remember:** These rules exist to prevent fraud and maintain data integrity. Always test thoroughly!

---

**Last Updated:** 2025-11-11
**Last Verified By:** Jay (Cross-Location Approver) and Jheiron (Warehouse Manager)
