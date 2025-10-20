# Transfer Discrepancy Email Alerts

## Overview

Your UltimatePOS system now automatically sends email notifications to administrators and the business owner when inventory discrepancies are detected during transfer verification. This critical security feature helps prevent theft, identify shipping errors, and maintain inventory accuracy.

---

## 🎯 When Alerts Are Sent

An email alert is automatically triggered when:

1. ✅ **All items** in a transfer have been verified
2. ✅ At least **one item** has a quantity discrepancy (sent ≠ received)
3. ✅ Email notifications are **enabled** in configuration

The system sends **ONE consolidated email** with all discrepancies, rather than multiple emails per item.

---

## 📧 Who Receives the Alerts

**Recipients:**
1. **Admin Email (Fixed):** `rr3800@gmail.com` (configured in `EMAIL_ADMIN_RECIPIENTS`)
2. **Business Email:** The email address associated with the business (stored in database)

---

## ⚙️ Configuration

### Required Environment Variables

Add these to your `.env` file:

```bash
# ===================================
# EMAIL CONFIGURATION (Required)
# ===================================

# SMTP Server Settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# From Address
SMTP_FROM=IgoroTechPOS <noreply@igorotechpos.com>

# ===================================
# NOTIFICATION SETTINGS
# ===================================

# Enable/Disable Email Notifications (true/false)
EMAIL_NOTIFICATIONS_ENABLED=true

# Admin Recipients (comma-separated)
EMAIL_ADMIN_RECIPIENTS=rr3800@gmail.com

# Enable Transfer Discrepancy Alerts
EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED=true

# Other Alert Settings (Optional)
EMAIL_ALERT_DISCOUNT_THRESHOLD=1000
EMAIL_ALERT_VOID_ENABLED=true
EMAIL_ALERT_REFUND_ENABLED=true
EMAIL_ALERT_CREDIT_ENABLED=true
EMAIL_ALERT_CASH_OUT_THRESHOLD=5000
EMAIL_ALERT_LOW_STOCK_ENABLED=true

# ===================================
# APP URL (For Email Links)
# ===================================

NEXT_PUBLIC_APP_URL=http://localhost:3000
# In production: NEXT_PUBLIC_APP_URL=https://yourpos.com
```

---

## 🔑 Gmail SMTP Setup

### 1. Enable 2-Step Verification
1. Go to Google Account Settings
2. Security → 2-Step Verification → Turn On

### 2. Generate App Password
1. Go to Google Account Settings
2. Security → 2-Step Verification → App Passwords
3. Select "Mail" and your device
4. Copy the 16-character password
5. Use this password in `SMTP_PASS` (without spaces)

### Example Gmail Configuration:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=yourcompany@gmail.com
SMTP_PASS=abcd efgh ijkl mnop  # 16-character app password
SMTP_FROM=UltimatePOS <noreply@yourcompany.com>
```

---

## 📬 Email Content Example

**Subject:**
`🚨 URGENT: Transfer Discrepancy - TR-202510-0003 (2 items)`

**Email Body Includes:**
- 🔴 **Alert Banner** - Urgent discrepancy notification
- 📊 **Transfer Details** - Transfer number, locations, verifier, timestamp
- 📦 **Discrepant Items Table** - Product, SKU, Sent, Received, Difference, Type
- 📈 **Summary** - Total shortages and overages
- ⚠️ **Recommended Actions** - Investigation checklist
- 🔗 **View Transfer Link** - Direct link to transfer details page

---

## 🧪 Testing the Email System

### Option 1: Use the Test Email Endpoint

Create a test page or API route:

```typescript
// src/app/api/test-email/route.ts
import { sendTestEmail } from '@/lib/email'
import { NextResponse } from 'next/server'

export async function GET() {
  const success = await sendTestEmail('your-email@example.com')
  return NextResponse.json({
    success,
    message: success ? 'Test email sent!' : 'Email not configured'
  })
}
```

Visit: `http://localhost:3000/api/test-email`

### Option 2: Create a Transfer with Discrepancy

1. Create a new transfer
2. Verify items with different quantities than sent
3. Complete verification of ALL items
4. Check your inbox for the email

---

## 🛡️ Security Features

### Automatic Discrepancy Detection
The system automatically detects:
- ✅ **Shortages** - Items missing during transfer
- ✅ **Overages** - Extra items received (unusual, requires investigation)

### Email Includes Investigation Checklist:
- Review CCTV footage at both locations
- Interview personnel involved
- Check for damaged or misplaced items
- Document findings for audit trail
- Review packing/verification procedures

---

## 🎨 Email Pattern (Matching Discount Alerts)

This feature follows the **exact same pattern** as your existing discount alert system:

| Feature | Discount Alert (₱1,000+) | Transfer Discrepancy |
|---------|--------------------------|----------------------|
| **Trigger** | Discount > ₱1,000 | Quantity mismatch |
| **Recipients** | Admin + Business Email | Admin + Business Email |
| **Email Type** | Warning (🟠) | Urgent (🔴) |
| **Config** | `EMAIL_ALERT_DISCOUNT_THRESHOLD` | `EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED` |
| **Pattern** | `sendLargeDiscountAlert()` | `sendTransferDiscrepancyAlert()` |

---

## 📊 Data Collected in Email

### Per Discrepant Item:
- Product name and variation
- SKU
- Quantity sent
- Quantity received
- Difference (+/-)
- Discrepancy type (shortage/overage)

### Transfer Metadata:
- Transfer number
- From/To locations
- Verifier name
- Timestamp
- Direct link to transfer

---

## 🔧 Troubleshooting

### Email Not Sending?

**Check:**
1. ✅ `EMAIL_NOTIFICATIONS_ENABLED=true`
2. ✅ `EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED=true`
3. ✅ SMTP credentials are correct
4. ✅ Gmail app password (not regular password)
5. ✅ Check console logs for errors
6. ✅ Verify business email is set in database

### Test with Command:
```bash
# Check console output
node -e "console.log(process.env.EMAIL_NOTIFICATIONS_ENABLED)"
node -e "console.log(process.env.SMTP_USER)"
```

### Common Issues:

**"Email not configured"**
- Missing SMTP settings in `.env`
- Solution: Add all required SMTP variables

**"Authentication failed"**
- Using regular password instead of app password
- Solution: Generate Gmail app password

**"No email received"**
- Check spam/junk folder
- Verify `EMAIL_ADMIN_RECIPIENTS` is correct
- Check business email in database

---

## 💾 Database Requirement

The system fetches the business email from the `Business` table. Ensure your business has an email configured:

```sql
-- Check business email
SELECT id, name, email FROM "businesses" WHERE id = 1;

-- Update business email if needed
UPDATE "businesses" SET email = 'owner@company.com' WHERE id = 1;
```

---

## 📝 Audit Trail

Every discrepancy email is automatically logged:

1. **StockTransfer** - Marked with `hasDiscrepancy = true`
2. **StockTransferItem** - Each item stores `hasDiscrepancy`, `discrepancyNotes`
3. **AuditLog** - Records verification with discrepancy metadata
4. **Email Logs** - Console logs email send status

---

## 🎯 Benefits

✅ **Immediate Notification** - Admins know about issues instantly
✅ **Prevents Fraud** - Discrepancies are flagged and documented
✅ **Data Integrity** - Every discrepancy is logged and traceable
✅ **Investigation Guidance** - Email includes action checklist
✅ **Multi-Recipient** - Both admin and business owner notified
✅ **Professional Format** - Clean, branded email template

---

## 📞 Support

**Configuration File:** `src/lib/email.ts`
**API Endpoint:** `src/app/api/transfers/[id]/verify-item/route.ts`
**Function:** `sendTransferDiscrepancyAlert()`

**Documentation:** This file
**Environment Setup:** `.env` file

---

## ✅ Quick Checklist

Before going live, ensure:

- [ ] SMTP credentials configured
- [ ] Gmail app password generated
- [ ] `EMAIL_NOTIFICATIONS_ENABLED=true`
- [ ] `EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED=true`
- [ ] `EMAIL_ADMIN_RECIPIENTS` includes `rr3800@gmail.com`
- [ ] Business email set in database
- [ ] Test email sent successfully
- [ ] Test transfer discrepancy sent

---

**Status:** ✅ **FULLY IMPLEMENTED AND READY TO USE**

This feature is production-ready and follows industry best practices for inventory security and fraud prevention!
