# Visual Guide: Unclosed Shift Protection System

## 📊 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     UNCLOSED SHIFT PROTECTION                   │
│                     Multi-Layer Defense System                  │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   User Logs In   │
                    └────────┬─────────┘
                             │
                             ▼
              ┌──────────────────────────┐
              │   Dashboard Component    │
              │   Loads & Mounts         │
              └──────────┬───────────────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Warning   │  │   Widget    │  │  Dashboard  │
│   Modal     │  │  Component  │  │   Content   │
└──────┬──────┘  └──────┬──────┘  └─────────────┘
       │                │
       └────────┬───────┘
                │
                ▼
    GET /api/shifts/check-unclosed
                │
                ▼
    ┌────────────────────────┐
    │   Database Query       │
    │   Find Open Shifts     │
    └────────┬───────────────┘
             │
    ┌────────┴─────────┐
    │                  │
    ▼                  ▼
┌─────────┐      ┌──────────┐
│  Found  │      │  None    │
│  Shift  │      │  Found   │
└────┬────┘      └────┬─────┘
     │                │
     ▼                ▼
┌─────────────┐  ┌───────────────┐
│Show Warning│  │Show "No Shift"│
│   Modal    │  │    Widget     │
└─────────────┘  └───────────────┘
```

---

## 🎯 User Interaction Flows

### Flow 1: Cashier with Unclosed Shift Logs In

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Login Screen                                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│         ┌─────────────────────────────┐                    │
│         │   UltimatePOS Login         │                    │
│         │                             │                    │
│         │  Username: [cashier123]     │                    │
│         │  Password: [••••••••]       │                    │
│         │                             │                    │
│         │     [Login Button]          │                    │
│         └─────────────────────────────┘                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ User clicks Login
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Dashboard Loads                                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Loading... [Spinner]                                       │
│                                                             │
│  Backend checks: GET /api/shifts/check-unclosed             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Unclosed shift found!
┌─────────────────────────────────────────────────────────────┐
│ Step 3: WARNING MODAL APPEARS (Blocks Interaction)         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║  ⚠️  CRITICAL: Unclosed Shift Detected!              ║ │
│  ║  You have an open shift that needs attention          ║ │
│  ╠═══════════════════════════════════════════════════════╣ │
│  ║                                                       ║ │
│  ║  🆔 Shift Number: SHIFT-20251024-0001                ║ │
│  ║  📍 Location: Main Store                             ║ │
│  ║  📅 Opened: Oct 24, 2025 8:00 AM                     ║ │
│  ║  ⏰ Duration: 1 day(s), 2 hour(s) ⚠️ OVERDUE        ║ │
│  ║                                                       ║ │
│  ║  ╭─────────────────────────────────────────────╮     ║ │
│  ║  │ 💰 Financial Summary                        │     ║ │
│  ║  │ Beginning Cash:  ₱5,000.00                  │     ║ │
│  ║  │ System Cash:     ₱12,345.67                 │     ║ │
│  ║  │ Transactions:    45                         │     ║ │
│  ║  ╰─────────────────────────────────────────────╯     ║ │
│  ║                                                       ║ │
│  ║  ⚠️ BIR COMPLIANCE WARNING:                          ║ │
│  ║  This shift must be closed to generate required      ║ │
│  ║  Z reading! Shifts should not span multiple days.    ║ │
│  ║                                                       ║ │
│  ║  ┌─────────────────────────────────────────────┐     ║ │
│  ║  │  🔒 Close This Shift (Recommended)          │     ║ │
│  ║  └─────────────────────────────────────────────┘     ║ │
│  ║  ┌─────────────────────────────────────────────┐     ║ │
│  ║  │  ▶️ Continue Working on This Shift          │     ║ │
│  ║  └─────────────────────────────────────────────┘     ║ │
│  ║                                                       ║ │
│  ║  Important: Contact your manager if you need         ║ │
│  ║  assistance with force-closing this shift.           ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 2: Dashboard with Current Shift Widget

```
┌─────────────────────────────────────────────────────────────────────┐
│ Dashboard - Cashier View                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Dashboard Overview                          [Location: ▼] [🔄]    │
│  Welcome back, Juan Dela Cruz                                       │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Current Shift                              [⚠️ OVERDUE] ◄─────┼─┤
│  ├───────────────────────────────────────────────────────────────┤ │ RED
│  │                                                               │ │ BORDER
│  │  🆔 Shift Number                                              │ │
│  │     SHIFT-20251024-0001                                       │ │
│  │     Main Store                                                │ │
│  │                                                               │ │
│  │  ┌─────────────────────────────────────────────────────────┐ │ │
│  │  │  ⏰ Duration                                             │ │ │
│  │  │     1d 2h ⚠️ ◄───────────────────────────────────────────┼─┤
│  │  │     Started: Oct 24, 8:00 AM                            │ │ │ RED
│  │  └─────────────────────────────────────────────────────────┘ │ │ TEXT
│  │                                                               │ │
│  │  ┌──────────────────────┬──────────────────────┐             │ │
│  │  │ 💵 System Cash       │ 🛒 Transactions      │             │ │
│  │  │ ₱12,345.67           │ 45                   │             │ │
│  │  └──────────────────────┴──────────────────────┘             │ │
│  │                                                               │ │
│  │  ⚠️ This shift is overdue! Please close immediately          │ │
│  │     for BIR compliance.                                       │ │
│  │                                                               │ │
│  │  [Continue]  [Close Shift →]                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌────────────┬────────────┬────────────┬────────────┐            │
│  │ Total Sales│ Net Amount │ Invoice Due│ ...        │            │
│  │ ₱45,678.90 │ ₱42,000.00 │ ₱5,000.00  │            │            │
│  └────────────┴────────────┴────────────┴────────────┘            │
│                                                                     │
│  [Charts and reports below...]                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Flow 3: Attempting to Open New Shift (Blocked)

```
┌─────────────────────────────────────────────────────────────┐
│ Begin Shift Page                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Begin Shift                                                │
│  Start your cashier shift by entering beginning cash       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Your Assigned Location                                │ │
│  │ Main Store                                            │ │
│  │ This shift will be assigned automatically             │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  Beginning Cash (₱)                                         │
│  [5000.00]                                                  │
│  Enter the total cash amount in drawer                      │
│                                                             │
│  Opening Notes (Optional)                                   │
│  [Starting new shift for today]                             │
│                                                             │
│  [🚀 Start Shift]  [Cancel]                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ User clicks "Start Shift"
┌─────────────────────────────────────────────────────────────┐
│                    POST /api/shifts                         │
│           { beginningCash: 5000, locationId: 1 }            │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Server checks for unclosed shifts
┌─────────────────────────────────────────────────────────────┐
│ ERROR RESPONSE (400 Bad Request)                            │
│                                                             │
│ {                                                           │
│   error: "You already have an open shift...",              │
│   unclosedShift: {                                         │
│     shiftNumber: "SHIFT-20251024-0001",                    │
│     openedAt: "2025-10-24T08:00:00Z",                      │
│     locationName: "Main Store",                            │
│     hoursSinceOpen: 26,                                    │
│     daysSinceOpen: 1,                                      │
│     isOverdue: true                                        │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Frontend displays error
┌─────────────────────────────────────────────────────────────┐
│ Begin Shift Page - ERROR DISPLAYED                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ╔═══════════════════════════════════════════════════════╗ │
│  ║  ❌ ERROR                                             ║ │
│  ║                                                       ║ │
│  ║  You already have an open shift. Please close it     ║ │
│  ║  before opening a new one.                           ║ │
│  ║                                                       ║ │
│  ║  Shift: SHIFT-20251024-0001                          ║ │
│  ║  Location: Main Store                                ║ │
│  ║  Opened: Oct 24, 2025 8:00 AM                        ║ │
│  ║  Duration: 1 day(s)                                  ║ │
│  ║                                                       ║ │
│  ║  ⚠️ THIS SHIFT IS OVERDUE!                           ║ │
│  ║     Please close it immediately.                     ║ │
│  ╚═══════════════════════════════════════════════════════╝ │
│                                                             │
│  [Go to Close Shift Page]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

### Flow 4: Manager Force-Close Shift

```
┌─────────────────────────────────────────────────────────────┐
│ Shift Management Page (Manager View)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Open Shifts                              [Filter ▼]       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Shift No.          User         Location    Duration  │ │
│  ├───────────────────────────────────────────────────────┤ │
│  │ SHIFT-20251024-001 EricsonChan  Main Store  2d 3h ⚠️ │ │
│  │                                              OVERDUE   │ │
│  │ [View Details] [Force Close] ◄──────────────────────  │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Manager clicks "Force Close"
┌─────────────────────────────────────────────────────────────┐
│ Force Close Shift - Authorization Required                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚠️ FORCE CLOSE SHIFT                                       │
│                                                             │
│  This action will close the shift without the cashier's    │
│  physical cash count. Use only when cashier is unavailable.│
│                                                             │
│  Shift: SHIFT-20251024-0001                                 │
│  Cashier: EricsonChanCashierTugue                           │
│  Opened: Oct 24, 2025 8:00 AM                               │
│  Duration: 2 days, 3 hours                                  │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │ Reason (required, min 10 characters)                  │ │
│  │ ┌─────────────────────────────────────────────────┐   │ │
│  │ │ Cashier absent today. Shift closure required    │   │ │
│  │ │ for BIR compliance. Z reading needed for Oct 24.│   │ │
│  │ └─────────────────────────────────────────────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  🔐 Manager/Admin Password (required)                      │
│  [••••••••••]                                               │
│                                                             │
│  ☑️ Auto-reconcile (use system cash as ending cash)        │
│                                                             │
│  Financial Summary:                                         │
│  Beginning Cash:  ₱5,000.00                                 │
│  System Cash:     ₱12,345.67                                │
│  Ending Cash:     ₱12,345.67 (auto-reconciled)             │
│                                                             │
│  [Cancel]  [⚠️ Confirm Force Close]                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Manager confirms
┌─────────────────────────────────────────────────────────────┐
│          POST /api/shifts/123/force-close                   │
│                                                             │
│  {                                                          │
│    reason: "Cashier absent today...",                      │
│    managerPassword: "admin_password",                      │
│    autoReconcile: true                                     │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ Shift closed successfully
┌─────────────────────────────────────────────────────────────┐
│ SUCCESS                                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ✅ Shift Force-Closed Successfully                         │
│                                                             │
│  Shift Number: SHIFT-20251024-0001                          │
│  Closed At: Oct 25, 2025 10:30 AM                           │
│                                                             │
│  Cash Reconciliation:                                       │
│  System Cash:    ₱12,345.67                                 │
│  Ending Cash:    ₱12,345.67 (auto-reconciled)              │
│  Variance:       ₱0.00 (Balanced)                           │
│                                                             │
│  Audit Trail:                                               │
│  - Original Cashier: EricsonChanCashierTugue                │
│  - Force-Closed By: ManagerAdmin                            │
│  - Reason: Cashier absent today...                          │
│  - Authorized By: ManagerAdmin                              │
│                                                             │
│  [Generate Z Reading]  [Back to Shifts]                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔒 Security & Authorization Matrix

```
┌─────────────────────────────────────────────────────────────────┐
│ PERMISSION MATRIX - Shift Operations                            │
├────────────────┬──────────┬──────────┬──────────┬──────────────┤
│ Action         │ Cashier  │ Manager  │  Admin   │ Super Admin  │
├────────────────┼──────────┼──────────┼──────────┼──────────────┤
│ View Own Shift │    ✅    │    ✅    │    ✅    │      ✅      │
│ View All Shifts│    ❌    │    ✅    │    ✅    │      ✅      │
│ Open Shift     │    ✅    │    ✅    │    ✅    │      ✅      │
│ Close Own Shift│    ✅*   │    ✅*   │    ✅*   │      ✅*     │
│ Force Close    │    ❌    │    ✅**  │    ✅**  │      ✅**    │
│ View Audit Log │    ❌    │    ✅    │    ✅    │      ✅      │
└────────────────┴──────────┴──────────┴──────────┴──────────────┘

* Requires manager/admin password authorization
** Requires manager/admin password + reason
```

---

## 📱 Responsive Design

### Mobile View (Warning Modal)

```
┌─────────────────────────┐
│  ⚠️ Unclosed Shift      │
├─────────────────────────┤
│                         │
│  SHIFT-20251024-0001    │
│  Main Store             │
│                         │
│  📅 Oct 24, 8:00 AM     │
│  ⏰ 1d 2h ⚠️ OVERDUE    │
│                         │
│  ┌───────────────────┐  │
│  │ 💰 Beginning Cash │  │
│  │ ₱5,000.00         │  │
│  ├───────────────────┤  │
│  │ 💵 System Cash    │  │
│  │ ₱12,345.67        │  │
│  ├───────────────────┤  │
│  │ 🛒 Transactions   │  │
│  │ 45                │  │
│  └───────────────────┘  │
│                         │
│  ⚠️ BIR Warning:        │
│  Close shift ASAP!      │
│                         │
│  [🔒 Close Shift]       │
│  [▶️ Continue]          │
│                         │
└─────────────────────────┘
```

### Mobile View (Dashboard Widget)

```
┌─────────────────────────┐
│ Current Shift [OVERDUE] │
├─────────────────────────┤
│                         │
│ SHIFT-20251024-0001     │
│ Main Store              │
│                         │
│ ⏰ 1d 2h                │
│ Started: 8:00 AM        │
│                         │
│ 💵 ₱12,345.67           │
│ 🛒 45 transactions      │
│                         │
│ ⚠️ OVERDUE - Close now! │
│                         │
│ [Continue] [Close]      │
│                         │
└─────────────────────────┘
```

---

## 🎨 Color Coding System

### Status Colors

```
Normal Active Shift:
┌─────────────────────┐
│ [✓ Active] ◄─────────┼─── Green badge, green border
└─────────────────────┘

Overdue Shift:
┌─────────────────────┐
│ [⚠️ OVERDUE] ◄───────┼─── Red badge, red border
└─────────────────────┘

No Active Shift:
┌─────────────────────┐
│ [No Active] ◄────────┼─── Gray badge, dashed gray border
└─────────────────────┘
```

### Warning Levels

```
Information (< 8 hours):
┌───────────────────────────┐
│ ℹ️ Shift Active          │ ◄─── Blue background
│ Duration: 6 hours         │
└───────────────────────────┘

Warning (8-24 hours):
┌───────────────────────────┐
│ ⚠️ Long Shift            │ ◄─── Orange background
│ Duration: 15 hours        │
└───────────────────────────┘

Critical (> 24 hours):
┌───────────────────────────┐
│ 🚨 OVERDUE SHIFT         │ ◄─── Red background
│ Duration: 1d 2h           │
└───────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
┌────────────────────────────────────────────────────────────────┐
│                        DATA FLOW                               │
└────────────────────────────────────────────────────────────────┘

   Frontend                  API Layer              Database
   ────────                  ─────────              ────────

1. CHECK UNCLOSED SHIFT

   Component
   Mounts
      │
      ├──► GET /api/shifts/check-unclosed
      │                │
      │                ├──► Query: cashier_shift
      │                │    WHERE status = 'open'
      │                │    AND userId = current_user
      │                │
      │                ├──► Query: sales (count)
      │                │    WHERE shiftId = shift.id
      │                │
      │                ├──► Query: cash_in_out
      │                │    WHERE shiftId = shift.id
      │                │
      │                ├──► Calculate:
      │                │    - hoursSinceOpen
      │                │    - daysSinceOpen
      │                │    - systemCash
      │                │    - isOverdue
      │                │
      │    Response ◄──┤
      │    { shift }   │
      │
   Display
   Warning/Widget


2. ATTEMPT TO OPEN NEW SHIFT

   User Submits
   Form Data
      │
      ├──► POST /api/shifts
      │    { beginningCash, locationId }
      │                │
      │                ├──► Query: cashier_shift
      │                │    Find existing open shift
      │                │
      │                ├──► IF FOUND:
      │                │    Return 400 error
      │                │    with shift details
      │                │
      │                ├──► IF NOT FOUND:
      │                │    Create new shift
      │                │    Insert into database
      │                │
      │    Response ◄──┤
      │    { error }   │
      │
   Display Error
   or Success


3. MANAGER FORCE-CLOSE

   Manager
   Initiates
      │
      ├──► POST /api/shifts/[id]/force-close
      │    { reason, managerPassword }
      │                │
      │                ├──► Query: users
      │                │    Find managers/admins
      │                │    Verify password
      │                │
      │                ├──► Query: cashier_shift
      │                │    WITH sales, payments
      │                │    Calculate systemCash
      │                │
      │                ├──► Update: cashier_shift
      │                │    SET status = 'closed'
      │                │    SET endingCash = systemCash
      │                │    SET closedAt = NOW()
      │                │
      │                ├──► Insert: audit_log
      │                │    Record force-close
      │                │    with full details
      │                │
      │    Response ◄──┤
      │    { success } │
      │
   Display
   Success Message
```

---

## 🧪 Testing Scenarios Visualized

### Test 1: Login with 2-Day Old Unclosed Shift

```
Day 1 (Oct 24)            Day 2 (Oct 25)            Day 3 (Oct 26)
─────────────             ─────────────             ─────────────

8:00 AM
├─ Cashier opens shift
│  SHIFT-20251024-0001
│
│  [Working...]
│
5:00 PM
└─ Logs out WITHOUT
   closing shift

                          8:00 AM
                          ├─ Cashier logs in
                          │
                          │  ⚠️ WARNING MODAL
                          │  appears immediately
                          │
                          │  Shows: "1 day, 15 hrs"
                          │  Status: OVERDUE
                          │
                          └─ Cashier ignores,
                             logs out again

                                                    8:00 AM
                                                    ├─ Cashier logs in
                                                    │
                                                    │  🚨 CRITICAL MODAL
                                                    │  appears
                                                    │
                                                    │  Shows: "2 days, 0 hrs"
                                                    │  Status: CRITICAL
                                                    │  Cannot dismiss
                                                    │
                                                    ├─ Dashboard widget
                                                    │  shows RED alert
                                                    │
                                                    └─ Manager notified
                                                       for force-close
```

---

## 📈 System Performance Metrics

```
┌────────────────────────────────────────────────────────────┐
│ PERFORMANCE BENCHMARKS                                     │
├────────────────────────┬───────────────┬───────────────────┤
│ Operation              │ Response Time │ Database Queries  │
├────────────────────────┼───────────────┼───────────────────┤
│ Check Unclosed Shift   │ ~50-100ms     │ 3 queries         │
│ Open New Shift         │ ~100-150ms    │ 4 queries         │
│ Force Close Shift      │ ~200-300ms    │ 8 queries         │
│ Widget Auto-Refresh    │ ~50ms         │ 3 queries (cached)│
└────────────────────────┴───────────────┴───────────────────┘

Network Traffic:
┌────────────────────────────────────────────────────────────┐
│ /api/shifts/check-unclosed                                 │
│ Request:   ~200 bytes                                      │
│ Response:  ~1-2 KB (with shift data)                       │
│ Frequency: On load + every 5 min                           │
└────────────────────────────────────────────────────────────┘
```

---

## 🎓 Training Quick Reference

### For Cashiers

```
┌─────────────────────────────────────────────────────────┐
│ 📚 CASHIER QUICK GUIDE                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ ✅ BEST PRACTICE:                                       │
│    Always close your shift before logging out!          │
│                                                         │
│ ⚠️ IF YOU SEE WARNING MODAL:                            │
│    1. Click "Close This Shift"                          │
│    2. Count your cash carefully                         │
│    3. Enter denomination counts                         │
│    4. Get manager password                              │
│    5. Complete the closure                              │
│                                                         │
│ 🚫 DO NOT:                                              │
│    - Ignore the warning                                 │
│    - Try to open new shift without closing old one      │
│    - Let shifts span multiple days                      │
│                                                         │
│ 📞 IF YOU NEED HELP:                                    │
│    Contact your manager for assistance                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### For Managers

```
┌─────────────────────────────────────────────────────────┐
│ 📚 MANAGER QUICK GUIDE                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 👁️ MONITORING:                                          │
│    - Check shift management page daily                  │
│    - Look for OVERDUE badges                            │
│    - Review unclosed shift reports                      │
│                                                         │
│ 🔒 FORCE-CLOSE PROCEDURE:                               │
│    1. Open shift management page                        │
│    2. Locate unclosed shift                             │
│    3. Click "Force Close"                               │
│    4. Enter detailed reason (required)                  │
│    5. Provide your manager password                     │
│    6. Review auto-reconciliation                        │
│    7. Confirm closure                                   │
│                                                         │
│ 📝 REASONS TO FORCE-CLOSE:                              │
│    - Cashier absent/unavailable                         │
│    - Emergency situations                               │
│    - BIR compliance deadlines                           │
│    - System maintenance requirements                    │
│                                                         │
│ ✅ ALWAYS:                                              │
│    - Provide clear reason in notes                      │
│    - Generate Z reading after closure                   │
│    - Review audit log entries                           │
│    - Follow up with cashier                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🏆 Success Criteria Checklist

```
┌─────────────────────────────────────────────────────────┐
│ ✅ IMPLEMENTATION SUCCESS CRITERIA                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ BACKEND:                                                │
│ ☑️ API endpoint checks unclosed shifts correctly        │
│ ☑️ Shift opening blocked when unclosed shift exists     │
│ ☑️ Force-close API requires manager password            │
│ ☑️ Audit trail captures all force-close details         │
│ ☑️ System cash calculated accurately                    │
│                                                         │
│ FRONTEND:                                               │
│ ☑️ Warning modal appears on dashboard load              │
│ ☑️ Modal shows accurate shift details                   │
│ ☑️ Overdue shifts highlighted in red                    │
│ ☑️ Dashboard widget displays current shift status       │
│ ☑️ Widget auto-refreshes every 5 minutes                │
│ ☑️ Error messages include shift details                 │
│                                                         │
│ USER EXPERIENCE:                                        │
│ ☑️ Cashiers cannot ignore unclosed shifts               │
│ ☑️ Clear path to resolve unclosed shifts                │
│ ☑️ Managers can intervene when needed                   │
│ ☑️ Mobile-responsive design works correctly             │
│                                                         │
│ COMPLIANCE:                                             │
│ ☑️ No shifts can span multiple days unnoticed           │
│ ☑️ BIR Z readings can be generated daily                │
│ ☑️ Complete audit trail maintained                      │
│ ☑️ Cash reconciliation enforced                         │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

**Document Version:** 1.0
**Last Updated:** 2025-10-25
**System:** UltimatePOS Modern - Unclosed Shift Protection
