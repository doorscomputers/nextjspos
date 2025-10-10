# Opening Stock Lock Security Feature

## Overview

This feature prevents unauthorized manipulation of inventory by automatically locking opening stock after it's set. Users must use the **Inventory Corrections** module to adjust locked stock, ensuring full audit trail and approval workflow.

## 🔒 How It Works

### 1. Auto-Lock Mechanism

**When opening stock is set for the first time:**
- ✅ Stock is immediately locked
- ✅ Timestamp recorded (`openingStockSetAt`)
- ✅ User who set it is recorded (`openingStockSetBy`)
- ✅ Lock status set to `true` (`openingStockLocked`)

**On subsequent edit attempts:**
- ❌ Error: "Opening stock is locked. Use Inventory Corrections to adjust stock."
- ↪️ User redirected to Inventory Corrections page
- 📋 Full audit trail required for any changes

### 2. Permission Levels

| Permission | Role | Capability |
|------------|------|------------|
| `PRODUCT_LOCK_OPENING_STOCK` | Branch Admin, Branch Manager | Can set opening stock (auto-locks) |
| `PRODUCT_UNLOCK_OPENING_STOCK` | Super Admin, Branch Admin | Can unlock opening stock with password |
| `PRODUCT_MODIFY_LOCKED_STOCK` | Super Admin only | Override lock (emergency use) |

### 3. Database Schema

**New fields in `variation_location_details` table:**

```sql
opening_stock_locked     BOOLEAN     DEFAULT false
opening_stock_set_at     DATETIME    NULL
opening_stock_set_by     INT         NULL (Foreign Key to users.id)
```

## 🛡️ Security Features

### Password Verification Required

To unlock opening stock:
1. User must have `PRODUCT_UNLOCK_OPENING_STOCK` permission
2. Must provide current password
3. Must provide reason for unlocking
4. All unlock attempts logged with:
   - User ID and username
   - IP address
   - User agent
   - Timestamp
   - Reason provided

### Audit Trail

Every lock/unlock action creates comprehensive audit log:
- Who performed the action
- When it was performed
- Product and location details
- Current stock quantity
- Reason for unlock (if applicable)
- IP address and user agent

## 📋 Workflow Examples

### Scenario 1: Initial Stock Setup

```
1. Manager sets opening stock for "Mouse - Black" at Downtown branch
   → Quantity: 100 units
   → System AUTO-LOCKS stock
   → Records: Manager, 2025-01-15 10:30 AM

2. Manager tries to edit the same stock
   → ❌ Error: "Opening stock is locked"
   → Message: "Use Inventory Corrections to adjust stock"
   → Button: "Go to Inventory Corrections"
```

### Scenario 2: Stock Adjustment Needed

```
1. Physical count shows 95 units (5 damaged)
   → Navigate to Inventory Corrections
   → Create correction:
      - System Count: 100
      - Physical Count: 95
      - Difference: -5
      - Reason: Damaged
      - Remarks: "Water damage during storage"

2. Supervisor approves correction
   → Stock updated to 95
   → Stock transaction created
   → Full audit trail logged
```

### Scenario 3: Emergency Unlock

```
1. Admin needs to unlock (rare case)
   → Navigate to product opening stock
   → Click "Unlock Opening Stock"
   → Enter password
   → Provide reason: "Correcting data entry error from migration"
   → Submit

2. Stock unlocked temporarily
   → Admin makes correction
   → Stock auto-relocks after save
   → Unlock action logged in audit trail
```

## 🚀 API Endpoints

### Set Opening Stock (Auto-Lock)
```
POST /api/products/{id}/opening-stock

Body: {
  "stockEntries": [
    {
      "locationId": 1,
      "variationId": 5,
      "quantity": 100,
      "purchasePrice": 10.50,
      "sellingPrice": 15.99
    }
  ]
}

Response (Success):
{
  "message": "Opening stock added successfully"
}

Response (Locked):
{
  "error": "Opening stock is locked. Use Inventory Corrections to adjust stock.",
  "locked": true,
  "lockedAt": "2025-01-15T10:30:00Z",
  "redirectTo": "/dashboard/inventory-corrections/new"
}
```

### Unlock Opening Stock
```
POST /api/products/unlock-opening-stock

Body: {
  "productVariationId": 5,
  "locationId": 1,
  "password": "admin_password",
  "reason": "Correcting migration error"
}

Response:
{
  "message": "Opening stock unlocked successfully",
  "warning": "Remember to use Inventory Corrections for stock adjustments"
}
```

## 🎯 Benefits

### 1. **Fraud Prevention**
- Users cannot arbitrarily change inventory numbers
- All changes require approval workflow
- Complete audit trail for accountability

### 2. **Data Integrity**
- Stock counts remain accurate and trustworthy
- Changes tracked through proper channels
- Historical data preserved

### 3. **Compliance**
- Meets accounting standards
- Provides audit trail for financial reporting
- Supports regulatory requirements

### 4. **Accountability**
- Every change has an owner
- Reasons documented
- IP tracking for security

## 🔧 Configuration

### Business Settings (Future Enhancement)

Planned settings to customize behavior:

```typescript
{
  enforceOpeningStockLock: true,        // Enable/disable lock feature
  autoLockOpeningStock: true,            // Auto-lock on first save
  allowUnlockOpeningStock: false,        // Only super admin can unlock
  requireApprovalForCorrections: true,   // Corrections need approval
  stockVarianceAlertThreshold: 10        // Alert if correction > 10%
}
```

## 📊 Reporting

### Audit Reports Available

1. **Opening Stock Lock History**
   - All lock/unlock events
   - User who performed action
   - Timestamps and reasons

2. **Inventory Correction Summary**
   - All corrections by location
   - Approval status
   - Stock variance analysis

3. **User Activity Report**
   - Stock modifications by user
   - Permission usage tracking
   - Security alerts

## ⚠️ Important Notes

1. **After Restart Required**
   - Run `npx prisma generate` to regenerate Prisma client
   - Run `npm run db:push` to apply schema changes
   - Restart dev server with `npm run dev`

2. **Existing Data**
   - All existing stock records will have `openingStockLocked = false`
   - They will auto-lock on next edit
   - Gradually migrates to locked state

3. **Migration Path**
   - New installations: Auto-lock from day 1
   - Existing installations: Lock applies to new entries and edited entries

4. **Best Practices**
   - Set opening stock once during initial setup
   - Use Inventory Corrections for all adjustments
   - Only unlock in true emergencies
   - Always provide detailed reasons for unlocks

## 🐛 Troubleshooting

### Error: "Opening stock is locked"
**Solution:** Use Inventory Corrections module to adjust stock

### Error: "Forbidden - Only administrators can unlock"
**Solution:** Contact your system administrator

### Unlock not working
**Check:**
1. User has `PRODUCT_UNLOCK_OPENING_STOCK` permission
2. Password is correct
3. Check audit logs for failed attempts

## 🔐 Security Considerations

1. **Password Storage**: Passwords hashed with bcrypt
2. **Audit Logging**: All actions logged with IP and user agent
3. **Permission Checks**: Verified on every request
4. **Multi-tenant Isolation**: Business ID verified for all operations
5. **Session Validation**: Authentication required for all endpoints

---

## Implementation Status

✅ Database schema updated
✅ RBAC permissions added
✅ Auto-lock mechanism implemented
✅ Unlock API with password verification
✅ Comprehensive audit logging
✅ Multi-tenant security
⏳ UI updates (pending - will show lock status and unlock button)

**Ready for testing after restart!**
