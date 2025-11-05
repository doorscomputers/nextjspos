# Inventory Correction Security Implementation Plan

**Project:** UltimatePOS Modern
**Feature:** Inventory Corrections Security & Approval Workflow
**Date:** 2025-11-05
**Status:** Phase 1 In Progress

---

## Executive Summary

Inventory corrections are HIGH RISK operations that can lead to:
- Stock theft/shrinkage concealment
- Financial statement manipulation
- Inventory valuation errors
- Fraud opportunities

This plan implements a phased security approach to protect against these risks while maintaining operational efficiency.

---

## PHASE 1: IMMEDIATE IMPLEMENTATION ✅ IN PROGRESS

**Timeline:** Now
**Goal:** Add basic security controls with minimal disruption

### 1.1 Approval Workflow for High-Value Corrections
- ✅ Add `status` field to corrections (pending/approved/rejected)
- ✅ Corrections > ₱10,000 require approval before inventory update
- ✅ Corrections ≤ ₱10,000 auto-approve (applied immediately)
- ⚠️ **NO SOD validation** - Creator CAN approve their own corrections (by client request due to staffing)

### 1.2 Email & Telegram Notifications
- ✅ Send alert when correction > ₱10,000 is created
- ✅ Send alert when correction > ₱10,000 is approved
- ✅ Include: User, Product, Location, Quantity, Value, Reason

### 1.3 Enhanced Audit Trail
- ✅ Log all corrections with full details
- ✅ Track who created and who approved
- ✅ Record timestamps for create/approve/reject

### Implementation Details:

#### Database Changes:
```prisma
model InventoryCorrection {
  id                    Int       @id @default(autoincrement())
  status                String    @default("approved") // pending, approved, rejected
  approvedBy            Int?      // User ID who approved
  approvedAt            DateTime? // When approved
  rejectionReason       String?   @db.Text // Why rejected
  // ... existing fields
}
```

#### Business Rules:
```typescript
// Value Thresholds
const REQUIRES_APPROVAL_THRESHOLD = 10000 // ₱10,000

// Auto-approve if value < threshold
if (correctionValue < REQUIRES_APPROVAL_THRESHOLD) {
  status = 'approved'
  applyInventoryUpdate()
} else {
  status = 'pending'
  sendNotifications()
}
```

#### Notifications:
- **Telegram:** Instant alert to management group
- **Email:** Detailed summary to finance team
- **Dashboard:** Pending corrections badge count

---

## PHASE 2: NEXT MONTH (NOT YET IMPLEMENTED)

**Timeline:** December 2025
**Goal:** Add advanced fraud detection

### 2.1 Photo Evidence
- Require photo upload for corrections > ₱5,000
- Store photos in cloud storage (S3/Cloudinary)
- Link photos to correction records

### 2.2 Variance Reports Dashboard
- Daily/weekly shrinkage reports
- By location, product, user
- Trend analysis charts

### 2.3 Pattern Detection Alerts
- Same user making many corrections
- Frequent corrections on same product
- Corrections always reducing stock
- Corrections outside business hours
- Large quantity discrepancies

### 2.4 Dual Count Workflow
- Require two independent counts for high-value items
- Both counts must match within tolerance
- Automatic escalation if discrepancy

---

## SECURITY MONITORING

### Red Flags to Watch:
1. ⚠️ High-value corrections (> ₱10,000)
2. ⚠️ Frequent corrections by same user
3. ⚠️ Always negative adjustments (stock reduction)
4. ⚠️ Corrections on fast-moving/high-value items
5. ⚠️ Corrections made outside business hours
6. ⚠️ Large quantity discrepancies

### Recommended Response:
- Immediate investigation for corrections > ₱50,000
- Weekly review meeting for all corrections > ₱10,000
- Monthly variance analysis by location
- Quarterly physical audit by external auditor

---

## ROLE PERMISSIONS

### Current Permissions:
| Role | Create | Approve | Notes |
|------|--------|---------|-------|
| Stock Counter | ✅ | ❌ | Can only create |
| Inventory Controller | ✅ | ❌ | Can only create |
| Warehouse Supervisor | ✅ | ✅ | Can approve up to ₱10k auto, > ₱10k needs manual |
| Warehouse Manager | ✅ | ✅ | Can approve any amount |
| Branch Manager | ✅ | ✅ | Can approve any amount |
| System Administrator | ✅ | ✅ | Can approve any amount |

### Future (Phase 2):
- Add value-based approval limits per role
- Add "high value approval" permission for > ₱50k

---

## TESTING CHECKLIST

### Test Scenarios:
1. Create correction < ₱10,000 → Should auto-approve
2. Create correction > ₱10,000 → Should require approval
3. Create correction > ₱10,000 → Verify Telegram alert sent
4. Create correction > ₱10,000 → Verify Email alert sent
5. Approve pending correction → Verify inventory updated
6. Reject pending correction → Verify no inventory change
7. View audit log → Verify all corrections logged

---

## ROLLBACK PLAN

If issues occur:
1. Disable approval workflow (set threshold to ₱999,999,999)
2. All corrections will auto-approve (current behavior)
3. Notifications will still be sent
4. No data loss - all corrections remain logged

---

## SUCCESS METRICS

### Phase 1 Goals:
- ✅ All corrections > ₱10k reviewed before application
- ✅ 100% notification delivery rate
- ✅ Zero unauthorized high-value corrections
- ✅ Complete audit trail for all corrections

### Phase 2 Goals (Future):
- Reduce shrinkage by 30%
- Detect 95% of suspicious patterns
- 100% photo evidence for high-value corrections
- Zero unapproved corrections > ₱50k

---

## MAINTENANCE

### Daily:
- Monitor pending corrections queue
- Review Telegram/Email alerts

### Weekly:
- Review all corrections > ₱10,000
- Analyze patterns and trends

### Monthly:
- Generate variance report by location
- Executive summary to management

### Quarterly:
- Physical audit by external auditor
- Review and adjust thresholds
- Update security policies

---

## CHANGE LOG

### 2025-11-05
- ✅ Phase 1 Implementation Started
- ✅ Approval workflow added
- ✅ Notifications implemented
- ⚠️ SOD validation skipped (client request)

---

## NOTES

- **Client Request:** Creator can approve their own corrections (no SOD check)
- **Reason:** Limited staff available for approvals
- **Mitigation:** Enhanced notifications and audit trail
- **Recommendation:** Revisit SOD in Phase 2 when staffing improves
