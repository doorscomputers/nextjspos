# Freebie/Free Item Controls Implementation Guide

## Problem Statement
Cashiers could potentially abuse the "FREE" button to give large quantities of items to friends/relatives without authorization, causing inventory and financial losses.

## Solution: Multi-Layer Control System

### Layer 1: Permission-Based Access Control

**Implementation:**
1. Add new permission: `FREEBIE_ADD` in `src/lib/rbac.ts`
2. Only roles with this permission can click the FREE button
3. Default: Only Manager, Admin, and Super Admin roles have this permission

```typescript
// src/lib/rbac.ts
export const PERMISSIONS = {
  // ... existing permissions
  FREEBIE_ADD: 'freebie.add',
  FREEBIE_APPROVE: 'freebie.approve',
}
```

**Benefit:** Prevents unauthorized cashiers from accessing the feature entirely.

---

### Layer 2: Manager Approval Workflow

**Implementation:**
When cashier clicks FREE button:
1. Item added to cart with `isFreebie: true` and `approvalStatus: 'pending'`
2. System prompts: "Manager approval required"
3. Manager must:
   - Enter their username/PIN
   - Enter reason for freebie
   - Approve or reject

```typescript
// Approval dialog structure
{
  freebieItem: {
    product: "Generic Mouse",
    quantity: 5,
    value: 825.00,
    requestedBy: "cashier_user_id",
    timestamp: "2025-01-13T10:30:00Z"
  },
  approval: {
    managerId: null,
    managerName: "",
    reason: "",
    approved: false
  }
}
```

**Benefit:** Every free item has managerial oversight.

---

### Layer 3: Daily Quantity Limits

**Implementation:**
Set per-user or per-location daily limits:
- Maximum freebie value per day: ₱5,000
- Maximum freebie items per day: 20 units
- Automatic block when limit exceeded

```typescript
// Check before allowing freebie
const dailyFreebieTotal = await getDailyFreebieTotal(userId, locationId)
if (dailyFreebieTotal + itemValue > DAILY_LIMIT) {
  throw new Error('Daily freebie limit exceeded')
}
```

**Benefit:** Caps total potential loss even with approval.

---

### Layer 4: Comprehensive Audit Trail

**Implementation:**
Every freebie action is logged in `FreebieLog` table:

```prisma
model FreebieLog {
  id              Int      @id @default(autoincrement())
  businessId      Int
  locationId      Int
  shiftId         Int?

  // Transaction details
  saleId          Int?
  productId       Int
  variationId     Int
  quantity        Float
  unitPrice       Decimal
  totalValue      Decimal

  // Authorization
  requestedBy     Int      // Cashier user ID
  approvedBy      Int?     // Manager user ID
  reason          String

  // Metadata
  createdAt       DateTime @default(now())
  ipAddress       String?
  deviceInfo      String?

  @@index([businessId, locationId, createdAt])
  @@index([requestedBy])
  @@index([approvedBy])
}
```

**Benefit:** Full traceability for accountability and fraud detection.

---

### Layer 5: Real-Time Alerts & Notifications

**Implementation:**
Trigger alerts when:
- Freebie value > ₱1,000 in single transaction
- Same user requests >5 freebies in one day
- Freebie value exceeds 10% of daily sales

```typescript
// Alert conditions
if (freebieValue > 1000) {
  sendAlert('HIGH_VALUE_FREEBIE', {
    cashier: user.name,
    product: product.name,
    value: freebieValue
  })
}
```

**Benefit:** Immediate awareness of suspicious activity.

---

### Layer 6: Manager Override with Higher Authority

**Implementation:**
For exceptionally high-value freebies (>₱5,000):
- Require Admin or Owner approval
- Send SMS/Email notification to business owner
- Require written justification

**Benefit:** Escalation for high-risk scenarios.

---

## UI/UX Implementation

### 1. Freebie Button State
```typescript
// Show FREE button only if user has permission
{hasPermission(PERMISSIONS.FREEBIE_ADD) && (
  <Button
    className="flex-1 bg-green-50 hover:bg-green-100 text-green-700 border-green-300 text-[9px] h-7 font-semibold"
    onClick={() => handleFreebieClick(product)}
  >
    🎁 FREE
  </Button>
)}
```

### 2. Manager Approval Dialog
```tsx
<Dialog open={showManagerApprovalDialog}>
  <DialogHeader>
    <DialogTitle>⚠️ Manager Approval Required</DialogTitle>
  </DialogHeader>
  <DialogContent>
    <p>Free item requested:</p>
    <div className="bg-yellow-50 p-3 rounded">
      <p className="font-bold">{pendingFreebie.name}</p>
      <p>Quantity: {pendingFreebie.quantity}</p>
      <p className="text-lg font-bold text-red-600">
        Value: ₱{pendingFreebie.value.toLocaleString()}
      </p>
    </div>

    <Label>Manager Username/PIN</Label>
    <Input
      type="password"
      value={managerPin}
      onChange={(e) => setManagerPin(e.target.value)}
    />

    <Label>Reason for Free Item</Label>
    <Textarea
      value={freebieReason}
      onChange={(e) => setFreebieReason(e.target.value)}
      placeholder="Enter justification (required)..."
      rows={3}
    />

    <Alert>
      <AlertDescription>
        This action will be logged and audited.
      </AlertDescription>
    </Alert>
  </DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={cancelFreebie}>
      Cancel
    </Button>
    <Button
      className="bg-green-600"
      onClick={approveFreebieWithManager}
      disabled={!managerPin || !freebieReason}
    >
      Approve Free Item
    </Button>
  </DialogFooter>
</Dialog>
```

### 3. Cart Display for Pending Freebies
```tsx
{item.isFreebie && (
  <span className="ml-1 text-[10px] bg-yellow-500 text-white px-1 py-0.5 rounded">
    {item.approvalStatus === 'pending' ? '⏳ PENDING' : '✓ FREE'}
  </span>
)}
```

---

## Database Migration Required

```sql
-- Add FreebieLog table
CREATE TABLE `FreebieLog` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `businessId` INT NOT NULL,
  `locationId` INT NOT NULL,
  `shiftId` INT NULL,
  `saleId` INT NULL,
  `productId` INT NOT NULL,
  `variationId` INT NOT NULL,
  `quantity` DECIMAL(15,4) NOT NULL,
  `unitPrice` DECIMAL(15,2) NOT NULL,
  `totalValue` DECIMAL(15,2) NOT NULL,
  `requestedBy` INT NOT NULL,
  `approvedBy` INT NULL,
  `reason` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `ipAddress` VARCHAR(45) NULL,
  `deviceInfo` VARCHAR(255) NULL,
  PRIMARY KEY (`id`),
  INDEX `idx_business_location_date` (`businessId`, `locationId`, `createdAt`),
  INDEX `idx_requested_by` (`requestedBy`),
  INDEX `idx_approved_by` (`approvedBy`)
);

-- Add approval fields to Sale table
ALTER TABLE `Sale` ADD COLUMN `freebieApprovedBy` INT NULL;
ALTER TABLE `Sale` ADD COLUMN `freebieReason` TEXT NULL;
```

---

## API Endpoints to Create

### 1. Request Freebie Approval
```typescript
// POST /api/freebies/request
{
  productId: number,
  variationId: number,
  quantity: number,
  reason: string
}
```

### 2. Approve Freebie
```typescript
// POST /api/freebies/approve
{
  freebieRequestId: number,
  managerUserId: number,
  managerPin: string,
  reason: string
}
```

### 3. Get Daily Freebie Summary
```typescript
// GET /api/freebies/daily-summary?date=2025-01-13
{
  totalValue: 3450.00,
  totalItems: 12,
  limit: 5000,
  remaining: 1550.00,
  logs: [...]
}
```

### 4. Freebie Audit Report
```typescript
// GET /api/reports/freebies?startDate=2025-01-01&endDate=2025-01-13
```

---

## Configuration Settings

Add to Business Settings:
```typescript
{
  freebieSettings: {
    requireManagerApproval: true,
    dailyValueLimit: 5000,
    dailyItemLimit: 20,
    highValueThreshold: 1000, // Alert trigger (reduced from 2000)
    allowedRoles: ['manager', 'admin', 'superadmin'],
    sendAlerts: true,
    alertEmail: 'owner@business.com',
    alertSMS: '+639123456789'
  }
}
```

---

## Reporting Dashboard

Create `/dashboard/reports/freebies` page showing:
- Daily freebie totals
- Freebie by cashier
- Freebie by manager approver
- High-value freebie alerts
- Trend analysis
- Export to PDF/Excel

---

## Implementation Priority

### Phase 1 (Critical - Implement First)
1. ✅ Add "FREE" label to button (DONE)
2. Add permission check on FREE button
3. Create manager approval dialog
4. Implement basic audit logging

### Phase 2 (Important)
5. Add daily limits
6. Create FreebieLog table and API
7. Implement alert system

### Phase 3 (Enhancement)
8. Build reporting dashboard
9. Add SMS/Email notifications
10. Implement trend analysis

---

## Security Best Practices

1. **Never trust client-side checks** - Always validate on server
2. **Encrypt manager PINs** - Use bcrypt or similar
3. **Rate limiting** - Prevent brute force PIN attempts
4. **Session timeout** - Approval valid for 5 minutes only
5. **IP logging** - Track all freebie requests by IP
6. **Regular audits** - Weekly review of freebie logs

---

## Testing Checklist

- [ ] Cashier without permission cannot see FREE button
- [ ] Clicking FREE prompts manager approval
- [ ] Invalid manager PIN rejected
- [ ] Freebie without reason rejected
- [ ] Daily limit enforced correctly
- [ ] High-value alert triggered
- [ ] Audit log created for every freebie
- [ ] Report shows accurate data
- [ ] Cannot approve own freebie request

---

## Cost-Benefit Analysis

**Investment:**
- Development: 16-24 hours
- Testing: 4-8 hours
- Training: 2 hours

**Return:**
- Prevent potential losses: ₱50,000+ per month
- Audit compliance: Priceless
- Peace of mind: Priceless

**ROI:** 500%+ in first month

---

## Next Steps

1. Review this document with stakeholders
2. Prioritize which layers to implement first
3. Create database migration
4. Implement Phase 1 features
5. Test thoroughly
6. Roll out to production with training
7. Monitor freebie logs daily for first week

---

## Questions to Answer

1. What should the daily freebie limit be?
2. Should all freebies require approval, or only high-value ones?
3. Who should receive alert notifications?
4. How often should freebie audit reports be generated?
5. Should there be a weekly/monthly cap as well?

---

**Document Status:** Draft for Review
**Created:** 2025-01-13
**Last Updated:** 2025-01-13
