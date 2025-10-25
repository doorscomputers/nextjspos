# Unclosed Shift Protection System

## Overview

This document describes the comprehensive unclosed shift protection system implemented to prevent cashiers from starting new shifts without properly closing previous ones. This is critical for:

- **Cash Accountability**: Ensures all shifts are properly reconciled
- **BIR Compliance**: Guarantees daily Z readings are generated
- **Audit Trail**: Maintains complete transaction history
- **Financial Accuracy**: Prevents gaps in sales reporting

## Problem Solved

**Previously:**
1. Cashier opens shift on Day 1
2. Logs out without closing shift (no X reading, no Z reading, no cash reconciliation)
3. Logs in on Day 2
4. System allows starting a NEW shift → Multiple unclosed shifts accumulate
5. Result: Missing cash reconciliations, BIR violations, accountability gaps

**Now:**
- System detects unclosed shifts on login/dashboard load
- Shows prominent warning modal with shift details
- Blocks new shift creation if unclosed shift exists
- Provides dashboard widget showing current shift status
- Offers admin force-close capability for emergencies

---

## Components

### 1. API Endpoint: Check Unclosed Shifts

**Endpoint:** `GET /api/shifts/check-unclosed`

**Purpose:** Check if the current user has any open shifts

**Response:**
```json
{
  "hasUnclosedShift": true,
  "shift": {
    "id": 123,
    "shiftNumber": "SHIFT-20251025-0001",
    "openedAt": "2025-10-24T08:00:00Z",
    "locationName": "Main Store",
    "locationId": 1,
    "beginningCash": 5000.00,
    "systemCash": 12345.67,
    "transactionCount": 45,
    "hoursSinceOpen": 26,
    "daysSinceOpen": 1,
    "isOverdue": true,
    "openingNotes": "Regular opening"
  }
}
```

**Usage:**
- Called on dashboard load
- Called periodically to refresh shift status
- Used by warning modal and dashboard widget

---

### 2. Frontend Component: UnclosedShiftWarning

**File:** `src/components/UnclosedShiftWarning.tsx`

**Purpose:** Modal dialog that appears on dashboard load if unclosed shift detected

**Features:**
- Shows shift details (number, location, duration, financial summary)
- Highlights overdue shifts (>24 hours) in red
- Provides action buttons:
  - "Close This Shift" (recommended) → Navigate to close shift page
  - "Continue Working" → Navigate to POS page
  - "Remind me later" → Dismiss modal (only if not overdue)
- BIR compliance warnings for overdue shifts

**User Experience:**
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  CRITICAL: Unclosed Shift Detected!            │
│                                                     │
│  Shift Number: SHIFT-20251024-0001                 │
│  Location: Main Store                              │
│  Opened: Oct 24, 2025 8:00 AM                      │
│  Duration: 1 day(s), 2 hour(s)  [RED if overdue]  │
│                                                     │
│  Beginning Cash: ₱5,000.00                         │
│  System Cash: ₱12,345.67                           │
│  Transactions: 45                                  │
│                                                     │
│  [🔒 Close This Shift (Recommended)]              │
│  [▶️ Continue Working on This Shift]              │
│  [Remind me later]                                 │
└─────────────────────────────────────────────────────┘
```

---

### 3. Dashboard Widget: CurrentShiftWidget

**File:** `src/components/CurrentShiftWidget.tsx`

**Purpose:** Always-visible widget on dashboard showing current shift status

**States:**

**No Active Shift:**
```
┌─────────────────────────────┐
│ Current Shift  [No Active] │
│                             │
│  🕐 No shift active         │
│  [Start New Shift]          │
└─────────────────────────────┘
```

**Active Shift (Normal):**
```
┌─────────────────────────────┐
│ Current Shift  [✓ Active]  │
│                             │
│ SHIFT-20251025-0001         │
│ Main Store                  │
│                             │
│ Duration: 3h                │
│ Started: 8:00 AM            │
│                             │
│ System Cash: ₱12,345.67     │
│ Transactions: 45            │
│                             │
│ [Continue] [Close Shift]    │
└─────────────────────────────┘
```

**Overdue Shift:**
```
┌─────────────────────────────┐
│ Current Shift [⚠️ OVERDUE] │ [RED BORDER]
│                             │
│ SHIFT-20251024-0001         │
│ Main Store                  │
│                             │
│ Duration: 1d 2h [RED]       │
│ Started: Yesterday 8:00 AM  │
│                             │
│ ⚠️ OVERDUE! Close ASAP     │
│                             │
│ [Continue] [Close Shift]    │
└─────────────────────────────┘
```

**Features:**
- Auto-refreshes every 5 minutes
- Color-coded status (green=active, red=overdue)
- Quick navigation to POS or shift close
- Shows financial and transaction summary

---

### 4. Enhanced Shift Opening Validation

**File:** `src/app/api/shifts/route.ts` (POST)

**Enhancement:** Returns detailed error with unclosed shift info

**Before:**
```json
{
  "error": "You already have an open shift. Please close it before opening a new one."
}
```

**After:**
```json
{
  "error": "You already have an open shift. Please close it before opening a new one.",
  "unclosedShift": {
    "shiftNumber": "SHIFT-20251024-0001",
    "openedAt": "2025-10-24T08:00:00Z",
    "locationName": "Main Store",
    "hoursSinceOpen": 26,
    "daysSinceOpen": 1,
    "isOverdue": true
  }
}
```

**Frontend Handling:**
- Shift opening page shows detailed error message
- Includes shift number, location, duration
- Highlights if shift is overdue
- Suggests immediate action

---

### 5. Admin Force-Close Capability

**Endpoint:** `POST /api/shifts/[id]/force-close`

**Purpose:** Allow managers/admins to close shifts when cashier is unavailable

**Use Cases:**
- Cashier forgot to close shift and is now absent
- Emergency situations requiring shift closure
- Abandoned shifts (employee resigned, terminated)
- Multi-day unclosed shifts requiring correction

**Required Permissions:**
- `SHIFT_VIEW_ALL` (managers and admins only)

**Request Body:**
```json
{
  "reason": "Cashier absent today. Shift needs closing for BIR compliance.",
  "managerPassword": "admin_password_here",
  "autoReconcile": true
}
```

**Parameters:**
- `reason` (required): Detailed explanation (min 10 characters)
- `managerPassword` (required): Password of Branch Manager or Admin
- `autoReconcile` (optional, default true): Use system cash as ending cash

**Response:**
```json
{
  "success": true,
  "message": "Shift force-closed successfully",
  "shift": { ... },
  "variance": {
    "systemCash": 12345.67,
    "endingCash": 12345.67,
    "cashOver": 0,
    "cashShort": 0,
    "isBalanced": true,
    "autoReconciled": true
  }
}
```

**Audit Trail:**
- Force-close is logged with:
  - Original cashier username
  - Reason for force-close
  - Authorizing manager username
  - Auto-reconciliation flag
  - Timestamp
- Closing notes include: `[FORCE-CLOSED BY ADMIN]` prefix
- Full metadata preserved for compliance

**Frontend Implementation:**
- Add "Force Close" button on shift management pages
- Require manager password entry
- Show confirmation dialog with consequences
- Display detailed reason input field

---

## Workflow Diagrams

### Normal Flow (No Unclosed Shift)
```
User Logs In
    ↓
Dashboard Loads
    ↓
Check Unclosed Shifts API
    ↓
No unclosed shift found
    ↓
Dashboard shows "No Active Shift" widget
    ↓
User clicks "Start New Shift"
    ↓
Shift opens successfully
```

### Unclosed Shift Detected
```
User Logs In
    ↓
Dashboard Loads
    ↓
Check Unclosed Shifts API
    ↓
Unclosed shift found!
    ↓
Warning Modal appears (UnclosedShiftWarning)
    ↓
User chooses action:
    ├─ [Close Shift] → Navigate to shift close page
    ├─ [Continue] → Navigate to POS page
    └─ [Remind Later] → Dismiss (only if not overdue)
```

### Attempting to Open New Shift with Unclosed Shift
```
User on "Begin Shift" page
    ↓
Enters beginning cash
    ↓
Clicks "Start Shift"
    ↓
API checks for unclosed shifts
    ↓
Unclosed shift found!
    ↓
API returns 400 error with shift details
    ↓
Frontend shows detailed error message:
"You already have an open shift.

Shift: SHIFT-20251024-0001
Location: Main Store
Opened: Oct 24, 2025 8:00 AM
Duration: 1 day(s)

⚠️ THIS SHIFT IS OVERDUE! Please close it immediately."
```

### Admin Force-Close Flow
```
Manager/Admin on shift management page
    ↓
Identifies unclosed shift needing intervention
    ↓
Clicks "Force Close Shift"
    ↓
System prompts for:
    - Reason (required, min 10 chars)
    - Manager password (required)
    ↓
Manager enters credentials
    ↓
API verifies manager password
    ↓
Shift force-closed with auto-reconciliation
    ↓
Audit log created with full details
    ↓
Success message displayed
```

---

## BIR Compliance Benefits

### Daily Z Reading Enforcement
- System flags shifts open >24 hours as OVERDUE
- Warning modal highlights BIR compliance requirement
- Dashboard widget shows red alert for overdue shifts
- Prevents accumulation of unclosed shifts across multiple days

### Audit Trail Completeness
- Every shift closure logged (normal or force-close)
- Original cashier always identified
- Manager authorization tracked for force-close
- Reason for force-close permanently recorded

### Cash Reconciliation Integrity
- System prevents skipping reconciliation
- Auto-reconciliation option for force-close
- Variance calculation preserved
- Physical cash count enforced (normal close)

---

## User Roles and Permissions

### Cashier / POS Operator
**Permissions:** `SHIFT_OPEN`, `SHIFT_CLOSE`

**Can:**
- View warning about their own unclosed shifts
- Close their own shifts with manager authorization
- Continue working on existing open shift

**Cannot:**
- Start new shift if unclosed shift exists
- Force-close any shifts
- Close other users' shifts

### Branch Manager / Admin
**Permissions:** `SHIFT_VIEW_ALL`, `SHIFT_OPEN`, `SHIFT_CLOSE`

**Can:**
- View all unclosed shifts in their location
- Force-close any shift with password authorization
- Close shifts for absent cashiers
- View all shift history

**Cannot:**
- Bypass password requirement for force-close
- Delete shift records

### Super Admin / All Branch Admin
**Permissions:** All permissions

**Can:**
- View/manage shifts across ALL locations
- Force-close any shift in the business
- Access all audit logs
- Generate compliance reports

---

## Configuration and Customization

### Shift Overdue Threshold
**Current:** 24 hours (1 day)

**Location:**
- API: `src/app/api/shifts/check-unclosed/route.ts` line 66
- Frontend: Calculated based on `daysSinceOpen >= 1`

**To Modify:**
```typescript
// Change threshold to 12 hours
const isOverdue = hoursSinceOpen >= 12

// Or keep daily threshold
const isOverdue = daysSinceOpen >= 1
```

### Auto-Refresh Interval (Dashboard Widget)
**Current:** 5 minutes

**Location:** `src/components/CurrentShiftWidget.tsx` line 30

**To Modify:**
```typescript
// Change to 10 minutes
const interval = setInterval(checkCurrentShift, 10 * 60 * 1000)
```

### Modal Dismissal (Non-Overdue)
**Current:** Allowed for shifts <24 hours

**Location:** `src/components/UnclosedShiftWarning.tsx` line 191

**To Modify:**
```typescript
// Force modal to be non-dismissible for ANY unclosed shift
{!shift.isOverdue && false && ( // Change false to true to always block
  <Button onClick={handleDismiss}>Remind me later</Button>
)}
```

---

## Testing Scenarios

### Scenario 1: Cashier Forgot to Close Yesterday's Shift

**Steps:**
1. Cashier "EricsonChanCashierTugue" opened shift yesterday 8:00 AM
2. Worked full day, made 50 sales
3. Logged out at 5:00 PM WITHOUT closing shift
4. Logs in today 8:00 AM

**Expected Behavior:**
- Dashboard loads
- Warning modal appears immediately
- Modal shows:
  - Shift number from yesterday
  - "1 day(s), 15 hour(s)" duration in RED
  - "CRITICAL: Unclosed Shift Detected!" header
  - BIR compliance warning
- Dashboard widget shows red "OVERDUE" badge
- Attempting to start new shift returns detailed error

**Resolution Options:**
1. Cashier clicks "Close This Shift" → Goes to close shift page → Performs cash count → Manager authorizes → Shift closed with proper Z reading
2. Manager uses force-close → Enters reason → Provides password → System auto-reconciles → Shift closed with audit trail

---

### Scenario 2: Cashier Tries to Open New Shift While One Is Open

**Steps:**
1. Cashier has shift open from 2 hours ago
2. Navigates to "Begin Shift" page
3. Enters beginning cash ₱5,000
4. Clicks "Start Shift"

**Expected Behavior:**
- API returns 400 error
- Error message includes:
  - "You already have an open shift..."
  - Shift number
  - Location
  - Duration (2 hours)
- Frontend displays error in alert box
- Shift is NOT created

**Resolution:**
- Cashier must close existing shift first
- Or continue working on existing shift

---

### Scenario 3: Multi-Day Abandoned Shift

**Steps:**
1. Cashier opened shift Monday 8:00 AM
2. Did not return to work Tuesday or Wednesday (absent)
3. Manager needs to close shift for BIR compliance

**Expected Behavior:**
- Manager accesses shift management page
- Sees shift listed with duration "2 days, 8 hours"
- Clicks "Force Close Shift"
- Prompted for:
  - Reason: "Employee absent. Shift closure required for BIR compliance."
  - Manager password
- Force-close succeeds
- Audit log records:
  - Original cashier username
  - Force-close reason
  - Manager authorization
  - Auto-reconciliation used

**BIR Compliance:**
- Generate Z reading for each business day covered by shift
- Report shows proper end-of-day summaries
- Audit trail complete for inspection

---

## Troubleshooting

### Issue: Warning Modal Not Appearing

**Possible Causes:**
1. User doesn't have `SHIFT_OPEN` permission
2. API endpoint not accessible
3. JavaScript error in component

**Debug Steps:**
```javascript
// Check browser console for errors
// Check network tab for API call to /api/shifts/check-unclosed
// Verify response contains shift data
```

**Fix:**
- Ensure user has `shift.open` permission
- Check that UnclosedShiftWarning component is imported in dashboard
- Verify API route is accessible (not blocked by middleware)

---

### Issue: Force-Close Returns "Forbidden"

**Possible Causes:**
1. User lacks `SHIFT_VIEW_ALL` permission
2. Invalid manager password
3. User not in manager/admin role

**Debug Steps:**
```javascript
// Check user permissions in session
console.log(session.user.permissions)

// Verify SHIFT_VIEW_ALL is present
```

**Fix:**
- Grant `shift.view_all` permission to user's role
- Ensure user is assigned Branch Manager, All Branch Admin, or Super Admin role
- Verify correct manager password being used

---

### Issue: Dashboard Widget Not Refreshing

**Possible Causes:**
1. Auto-refresh interval not working
2. API endpoint failing silently
3. Component unmounted/remounted

**Debug Steps:**
```javascript
// Check console for interval logs
// Monitor network tab for periodic API calls
// Verify component lifecycle
```

**Fix:**
- Check interval cleanup in useEffect
- Add error handling to API call
- Ensure component remains mounted

---

## API Reference

### GET /api/shifts/check-unclosed

Check for unclosed shifts for current user

**Authentication:** Required
**Permissions:** None (users can only see their own shifts)

**Response:**
```typescript
{
  hasUnclosedShift: boolean
  shift?: {
    id: number
    shiftNumber: string
    openedAt: string
    locationName: string
    locationId: number
    beginningCash: number
    systemCash: number
    transactionCount: number
    hoursSinceOpen: number
    daysSinceOpen: number
    isOverdue: boolean
    openingNotes?: string
  }
}
```

---

### POST /api/shifts/[id]/force-close

Force-close a shift (managers/admins only)

**Authentication:** Required
**Permissions:** `SHIFT_VIEW_ALL`

**Request:**
```typescript
{
  reason: string // min 10 chars
  managerPassword: string
  autoReconcile?: boolean // default true
}
```

**Response:**
```typescript
{
  success: boolean
  message: string
  shift: CashierShift
  variance: {
    systemCash: number
    endingCash: number
    cashOver: number
    cashShort: number
    isBalanced: boolean
    autoReconciled: boolean
  }
}
```

---

## File Reference

### Created Files
1. `src/app/api/shifts/check-unclosed/route.ts` - API to check unclosed shifts
2. `src/app/api/shifts/[id]/force-close/route.ts` - API for force-close
3. `src/components/UnclosedShiftWarning.tsx` - Warning modal component
4. `src/components/CurrentShiftWidget.tsx` - Dashboard widget component

### Modified Files
1. `src/app/api/shifts/route.ts` - Enhanced error response with shift details
2. `src/app/dashboard/page.tsx` - Added warning modal and widget
3. `src/app/dashboard/shifts/begin/page.tsx` - Enhanced error handling

---

## Future Enhancements

### Automatic Daily Shift Closure
- Cron job to detect shifts open >24 hours
- Send notifications to managers
- Auto-generate Z readings for overdue shifts
- Email alerts for unclosed shifts

### Multi-Shift Dashboard
- View all open shifts across locations
- Bulk force-close capability
- Export unclosed shift reports
- Historical shift closure analytics

### Mobile App Notifications
- Push notifications for unclosed shifts
- SMS alerts for overdue shifts
- In-app reminders before shift end time

### Advanced Reconciliation
- Photo upload for cash denomination count
- Signature capture for manager authorization
- Biometric verification for force-close
- Real-time cash variance alerts

---

## Support and Maintenance

**Documentation Version:** 1.0
**Last Updated:** 2025-10-25
**System Version:** UltimatePOS Modern v2.0

For issues or questions:
1. Check Troubleshooting section above
2. Review audit logs in database (`audit_log` table)
3. Check browser console for errors
4. Contact system administrator

**BIR Compliance Officer:** Ensure this system is used consistently to maintain audit trail integrity and daily Z reading compliance.
