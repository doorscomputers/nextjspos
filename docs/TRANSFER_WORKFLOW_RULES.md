# Transfer Workflow Rules - DO NOT MODIFY

## ⚠️ CRITICAL SYSTEM - CHANGES REQUIRE FULL TESTING

This document describes the **exact logic** for transfer workflow button visibility. These rules were carefully designed to maintain **workflow separation** and **prevent fraud**.

**Last Verified Working:** 2025-11-11
**Verified By:** Jay (Cross-Location Approver) and Jheiron (Warehouse Manager)

---

## 🎯 Core Principles

### 1. Workflow Separation (SOD - Separation of Duties)
- **Sender** CANNOT mark their own transfer as arrived
- **Sender** CANNOT verify or receive their own transfer
- **Receiver** CANNOT approve or send transfers they will receive
- This prevents fraud and ensures accountability

### 2. Location-Based Access
- Users are assigned to specific locations via `UserLocation` table
- `primaryLocationId` determines which location a user belongs to
- Users can have multiple locations, but only one is "primary"

### 3. ACCESS_ALL_LOCATIONS Permission
- Users with this permission can manage transfers across all locations
- **EXCEPTION:** They CANNOT bypass workflow separation rules
- **EXCEPTION:** Sender at Main Warehouse CANNOT mark arrival at Tuguegarao

---

## 📋 Button Visibility Rules

### Status: DRAFT

**Button:** Submit for Checking

**Who can see:**
- Users at **FROM location** (sender's location)
- Users with **ACCESS_ALL_LOCATIONS** permission

**Logic:**
```typescript
const canSee = (primaryLocationId === transfer.fromLocationId) ||
               can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
```

**Why:** Only the sender should submit transfers for approval.

---

### Status: PENDING_CHECK

**Button:** Approve / Reject

**Who can see:**
- Users at **FROM location** (sender's location)
- Users with **ACCESS_ALL_LOCATIONS** permission
- **NOT the creator** (unless SOD settings allow)

**Logic:**
```typescript
const isAssignedToOrigin = (primaryLocationId === transfer.fromLocationId) ||
                           can(PERMISSIONS.ACCESS_ALL_LOCATIONS)

const isCreator = (transfer.createdBy === currentUserId)
const enforceSOD = sodSettings?.enforceTransferSOD ?? true
const allowCreatorToCheck = sodSettings?.allowCreatorToCheck ?? false

const canApprove = isAssignedToOrigin &&
                   (!isCreator || (!enforceSOD || allowCreatorToCheck))
```

**Why:** Approval happens at sender's location, respecting SOD rules.

---

### Status: CHECKED

**Button:** Send Transfer

**Who can see:**
- Users at **FROM location** (sender's location)
- Users with **ACCESS_ALL_LOCATIONS** permission

**Logic:**
```typescript
const canSee = (primaryLocationId === transfer.fromLocationId) ||
               can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
```

**Why:** Only the sender can dispatch transfers.

---

### Status: IN_TRANSIT

**Button:** Mark as Arrived

**Who can see:**
- Users at **TO location** (receiver's location)
- Users with **ACCESS_ALL_LOCATIONS** BUT **NOT at FROM location**

**Logic:**
```typescript
const isAtDestination = (primaryLocationId === transfer.toLocationId) ||
                        (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) &&
                         primaryLocationId !== transfer.fromLocationId)
```

**Why:**
- ✅ Receiver must confirm arrival
- ❌ Sender CANNOT mark their own transfer as arrived (prevents fraud)
- ✅ Cross-location approver can mark arrival IF they're not the sender

**CRITICAL:** This prevents Jheiron at Main Warehouse from marking transfers TO Tuguegarao as arrived.

---

### Status: ARRIVED

**Button:** Start Verification

**Who can see:**
- Users at **TO location** (receiver's location)
- Users with **ACCESS_ALL_LOCATIONS** BUT **NOT at FROM location**

**Logic:**
```typescript
const isAtDestination = (primaryLocationId === transfer.toLocationId) ||
                        (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) &&
                         primaryLocationId !== transfer.fromLocationId)
```

**Why:** Receiver must verify items, sender cannot verify their own shipment.

---

### Status: VERIFIED

**Button:** Receive Transfer (Complete)

**Who can see:**
- Users at **TO location** (receiver's location)
- Users with **ACCESS_ALL_LOCATIONS** BUT **NOT at FROM location**

**Logic:**
```typescript
const isAtDestination = (primaryLocationId === transfer.toLocationId) ||
                        (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) &&
                         primaryLocationId !== transfer.fromLocationId)
```

**Why:** Final receipt must be confirmed by receiver, not sender.

---

## 🧪 Test Cases

### Test Case 1: Normal Flow (Location-Specific Users)

**Setup:**
- User A at Main Warehouse
- User B at Tuguegarao
- Transfer: Main Warehouse → Tuguegarao

**Expected:**
| Status | User A (Sender) Sees | User B (Receiver) Sees |
|--------|---------------------|----------------------|
| Draft | Submit for Check | Nothing |
| Pending Check | Approve/Reject | Nothing |
| Checked | Send Transfer | Nothing |
| In Transit | Nothing | Mark as Arrived |
| Arrived | Nothing | Start Verification |
| Verified | Nothing | Receive Transfer |

---

### Test Case 2: Cross-Location Approver (No Location Assignment)

**Setup:**
- Jay: Has ACCESS_ALL_LOCATIONS, no primaryLocationId
- Transfer: Main Warehouse → Tuguegarao

**Expected:**
| Status | Jay Sees |
|--------|----------|
| Draft | Submit for Check |
| Pending Check | Approve/Reject |
| Checked | Send Transfer |
| In Transit | Mark as Arrived |
| Arrived | Start Verification |
| Verified | Receive Transfer |

**Why:** Jay can manage entire workflow because he's not tied to any location.

---

### Test Case 3: Sender with ACCESS_ALL_LOCATIONS (The Critical Test)

**Setup:**
- Jheiron: At Main Warehouse, has ACCESS_ALL_LOCATIONS
- Transfer: Main Warehouse → Tuguegarao (Jheiron created it)

**Expected:**
| Status | Jheiron Sees |
|--------|--------------|
| Draft | Submit for Check ✅ |
| Pending Check | Approve/Reject ✅ |
| Checked | Send Transfer ✅ |
| In Transit | **NOTHING** ❌ (Cannot mark his own transfer as arrived) |
| Arrived | **NOTHING** ❌ (Cannot verify his own shipment) |
| Verified | **NOTHING** ❌ (Cannot receive his own transfer) |

**CRITICAL:** This is the key test that was breaking. Jheiron MUST NOT see destination buttons.

---

## 🚫 Common Mistakes to Avoid

### ❌ WRONG: Simple ACCESS_ALL_LOCATIONS check

```typescript
// DON'T DO THIS - Allows sender to mark arrival
const canMarkArrived = primaryLocationId === transfer.toLocationId ||
                       can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
```

**Why wrong:** This allows Jheiron at Main Warehouse to mark transfers TO Tuguegarao as arrived.

### ✅ CORRECT: Check sender is not at origin

```typescript
// DO THIS - Prevents sender from marking arrival
const canMarkArrived = primaryLocationId === transfer.toLocationId ||
                       (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) &&
                        primaryLocationId !== transfer.fromLocationId)
```

**Why correct:** This prevents sender from marking their own transfers while allowing cross-location approvers.

---

## 🔒 Protection Rules

### 1. Always Check Both Conditions for Destination Buttons

For Mark Arrived, Verify, and Receive buttons:

```typescript
// Template for destination-side buttons
const isAtDestination = (primaryLocationId === transfer.toLocationId) ||
                        (can(PERMISSIONS.ACCESS_ALL_LOCATIONS) &&
                         primaryLocationId !== transfer.fromLocationId)
```

**Required:** The `&& primaryLocationId !== transfer.fromLocationId` part is MANDATORY.

### 2. Origin Buttons Can Use Simple OR Logic

For Submit, Approve, and Send buttons:

```typescript
// Template for origin-side buttons
const isAtOrigin = (primaryLocationId === transfer.fromLocationId) ||
                   can(PERMISSIONS.ACCESS_ALL_LOCATIONS)
```

**Why:** Origin-side operations don't need sender prevention (sender is SUPPOSED to do these).

### 3. Always Respect SOD Settings

```typescript
// Always check SOD when needed
const enforceSOD = sodSettings?.enforceTransferSOD ?? true
const allowCreatorToCheck = sodSettings?.allowCreatorToCheck ?? false

const canApprove = isAtOrigin &&
                   (!isCreator || (!enforceSOD || allowCreatorToCheck))
```

---

## 📝 Code Location

**File:** `src/app/dashboard/transfers/[id]/page.tsx`

**Function:** Inside the `getActions()` function (around line 700-830)

**Search for:** `// Pending Check → Approve or Reject`

---

## ✅ Verification Checklist

Before deploying changes to transfer workflow:

- [ ] Test with user at Main Warehouse sending to Tuguegarao
- [ ] Verify sender CANNOT see "Mark as Arrived"
- [ ] Test with user at Tuguegarao receiving from Main Warehouse
- [ ] Verify receiver CAN see "Mark as Arrived"
- [ ] Test with Jay (no location, ACCESS_ALL_LOCATIONS)
- [ ] Verify Jay CAN approve AND receive (different transfers)
- [ ] Test with Jheiron (at Main Warehouse, ACCESS_ALL_LOCATIONS)
- [ ] Verify Jheiron CANNOT mark his own transfers as arrived
- [ ] Run validation script: `npx tsx scripts/test-transfer-workflow-rules.ts`

---

## 🆘 If Something Breaks

### Symptoms:
- Sender can mark their own transfer as arrived
- Receiver cannot mark transfer as arrived
- Cross-location approver cannot manage transfers

### Quick Fix:
1. Check the destination button logic in `page.tsx`
2. Ensure it includes: `&& primaryLocationId !== transfer.fromLocationId`
3. Restore from Git: `git checkout origin/master -- src/app/dashboard/transfers/[id]/page.tsx`

### Validation:
```bash
npx tsx scripts/test-transfer-workflow-rules.ts
```

---

## 📚 Related Documentation

- **RBAC Permissions:** `src/lib/rbac.ts`
- **SOD Settings:** Database table `StockTransferSODSettings`
- **Transfer API:** `src/app/api/transfers/`
- **User Locations:** Database table `UserLocation`

---

## 🔐 Security Implications

### Why This Matters:

1. **Fraud Prevention:** Sender cannot falsify delivery confirmation
2. **Accountability:** Clear audit trail of who performed each action
3. **Inventory Accuracy:** Receiver must verify items before accepting
4. **Business Integrity:** Enforces proper business processes

### Risks if Broken:

- ⚠️ Sender could mark transfer as received without actually shipping
- ⚠️ Inventory counts become inaccurate
- ⚠️ Audit trail becomes meaningless
- ⚠️ Business disputes cannot be resolved
- ⚠️ Potential for theft or loss

---

## 📅 Change History

| Date | Change | Reason | Tested By |
|------|--------|--------|-----------|
| 2025-11-11 | Fixed destination buttons to prevent sender self-marking | Jheiron could mark his own transfers as arrived | Jay, Jheiron |
| 2025-11-11 | Added ACCESS_ALL_LOCATIONS support for approvers | Jay couldn't see any workflow buttons | Jay |
| 2025-11-11 | Fixed origin buttons to allow ACCESS_ALL_LOCATIONS | Jay couldn't approve transfers | Jay |

---

**REMEMBER:** These rules exist to prevent fraud and maintain data integrity. Always test thoroughly before modifying!
