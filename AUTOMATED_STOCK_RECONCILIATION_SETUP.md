# Automated Stock Reconciliation Setup Guide

**Last Updated:** November 15, 2025
**Version:** 1.0.0

## Overview

The Automated Stock Reconciliation system performs daily inventory integrity checks and sends email alerts when discrepancies are detected. This ensures your stock levels remain accurate and highlights any issues requiring investigation.

### Key Features

✅ **Automated Daily Checks** - Runs every day at 2:00 AM (off-peak hours)
✅ **Email Alerts** - Notifications sent to designated email when variances found
✅ **Manual Approval Required** - NO automatic fixes without admin review
✅ **Dashboard Widget** - Real-time stock health status on main dashboard
✅ **Zero Performance Impact** - Runs as background cron job
✅ **Full Audit Trail** - All actions logged for compliance

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration Steps](#configuration-steps)
3. [Testing Email Configuration](#testing-email-configuration)
4. [How It Works](#how-it-works)
5. [Dashboard Widget](#dashboard-widget)
6. [Email Alert Format](#email-alert-format)
7. [Manual Reconciliation Workflow](#manual-reconciliation-workflow)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [FAQ](#faq)

---

## Prerequisites

Before setting up automated reconciliation, ensure you have:

- ✅ Super Admin access to the system
- ✅ Email account with SMTP access (Gmail, Outlook, Office365, etc.)
- ✅ Application deployed on Vercel (for cron job execution)
- ✅ Access to environment variable configuration

---

## Configuration Steps

### Step 1: Generate Cron Secret Token

The cron secret protects your reconciliation endpoint from unauthorized access.

**Generate secure token:**
```bash
# On Linux/Mac/WSL
openssl rand -base64 32

# On Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

Copy the generated token - you'll need it in Step 3.

---

### Step 2: Configure SMTP Email Settings

#### Option A: Gmail (Recommended for Most Users)

1. **Enable 2-Factor Authentication** on your Google account
   - Go to: https://myaccount.google.com/security
   - Enable 2-Step Verification

2. **Generate App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and your device
   - Copy the 16-character password (remove spaces)

3. **Note your settings:**
   - SMTP Host: `smtp.gmail.com`
   - SMTP Port: `587`
   - SMTP Secure: `false` (TLS)
   - SMTP User: Your Gmail address (e.g., `yourname@gmail.com`)
   - SMTP Password: The App Password you just generated

#### Option B: Outlook/Hotmail

- SMTP Host: `smtp-mail.outlook.com`
- SMTP Port: `587`
- SMTP Secure: `false` (TLS)
- SMTP User: Your Outlook email address
- SMTP Password: Your Outlook account password

#### Option C: Office 365

- SMTP Host: `smtp.office365.com`
- SMTP Port: `587`
- SMTP Secure: `false` (TLS)
- SMTP User: Your Office 365 email address
- SMTP Password: Your Office 365 password

---

### Step 3: Add Environment Variables

Add the following to your `.env` file (or Vercel environment variables):

```bash
# ============================================
# AUTOMATED STOCK RECONCILIATION
# ============================================

# Cron Job Security Token (use token from Step 1)
CRON_SECRET="your-secure-token-from-step-1"

# Email Notification Settings
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASSWORD="your-app-password-here"

# Alert recipient email
ALERT_EMAIL_TO="rr3800@gmail.com"

# Optional: Reconciliation Thresholds
RECONCILIATION_ALERT_THRESHOLD_AMOUNT="1000"
RECONCILIATION_ALERT_THRESHOLD_PERCENTAGE="5"
```

**⚠️ IMPORTANT:**
- Replace `your-email@gmail.com` with your actual email
- Replace `your-app-password-here` with the App Password from Step 2
- Replace `rr3800@gmail.com` with the email that should receive alerts

---

### Step 4: Deploy Configuration

#### Local Development:
```bash
# No deployment needed - system uses .env file
```

#### Vercel Production:
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add each variable from Step 3
4. Redeploy your application

---

### Step 5: Verify Cron Job Configuration

The cron job is configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/reconciliation",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule Breakdown:**
- `0 2 * * *` = Every day at 2:00 AM
- Timezone: UTC (adjust for your local timezone)

**To change schedule:**
- `0 8 * * *` = 8:00 AM daily
- `0 */6 * * *` = Every 6 hours
- `0 0 * * 0` = Weekly on Sunday at midnight

---

## Testing Email Configuration

### Method 1: Using Test Endpoint (Recommended)

1. **Login as Super Admin**
2. **Open browser developer tools** (F12)
3. **Run test in console:**
   ```javascript
   fetch('/api/test/email-config')
     .then(res => res.json())
     .then(data => console.log(data))
   ```

4. **Check your email** - you should receive a test email within 1-2 minutes

### Method 2: Manual Cron Trigger (Alternative)

```bash
# Replace with your CRON_SECRET and domain
curl -X GET "https://your-domain.vercel.app/api/cron/reconciliation" \
  -H "Authorization: Bearer your-cron-secret-here"
```

**Expected Response:**
```json
{
  "success": true,
  "executionTime": "1234ms",
  "businessesProcessed": 1,
  "totalVariances": 5,
  "alertsSent": 1,
  "timestamp": "2025-11-15T02:00:00.000Z"
}
```

---

## How It Works

### Daily Workflow

```mermaid
flowchart TD
    A[2:00 AM - Cron Job Starts] --> B[Verify CRON_SECRET]
    B --> C[Fetch All Active Businesses]
    C --> D[For Each Business]
    D --> E[Scan All Locations]
    E --> F[Calculate Expected Stock]
    F --> G{Variances Found?}
    G -->|Yes| H[Generate Email Alert]
    G -->|No| I[Skip Email]
    H --> J[Send to ALERT_EMAIL_TO]
    I --> K[Log Results]
    J --> K
    K --> L[Create Audit Log]
    L --> M[Return Success Response]
```

### Calculation Method

**Expected Stock Formula:**
```
Expected Stock =
  Opening Stock/Last Correction
  + Purchases
  + Transfers In
  + Customer Returns
  - Sales
  - Transfers Out
  - Supplier Returns
  - Adjustments (damaged, expired, missing)
```

**Variance Detection:**
```
Variance = Actual Stock - Expected Stock

If Variance != 0:
  → Generate alert
  → Require manual investigation
```

---

## Dashboard Widget

The Stock Health Widget appears on the main dashboard for users with `REPORT_VIEW` permission.

### Widget Features

**Health Indicators:**
- 🟢 **Excellent (95-100%)** - Few or no variances
- 🟡 **Good (85-94%)** - Minor variances detected
- 🟠 **Fair (70-84%)** - Moderate variances requiring attention
- 🔴 **Critical (<70%)** - Immediate action required

**Real-time Data:**
- System Health Percentage
- Total Variances Count
- Variances Requiring Investigation
- Total Variance Value (₱)

**Actions:**
- View Full Report - Opens reconciliation page
- Refresh - Manual check trigger
- Auto-updates every 5 minutes

---

## Email Alert Format

When variances are detected, you'll receive an HTML email with:

### 1. Summary Section
- Total Variances Count
- Items Requiring Investigation
- System Health Percentage
- Total Variance Value (₱)

### 2. Top 10 Variances Table
Sorted by value impact (highest first):
- Product Name & Variation
- Location
- Expected Stock (from transactions)
- Actual Stock (from system)
- Variance Amount & Percentage
- Financial Impact (₱)

### 3. Action Required
- Clear instruction: Manual review required
- Link to full reconciliation report
- Next steps checklist

### 4. Footer
- Timestamp (Philippine Time)
- Automated alert notice

---

## Manual Reconciliation Workflow

When you receive an alert email:

### Step 1: Review Email
- Check summary statistics
- Identify high-value variances
- Note items requiring investigation

### Step 2: Access Reconciliation Page
1. Login to system
2. Navigate: **Dashboard → Reports → Inventory Reports → Stock Reconciliation**
3. Or click link in email

### Step 3: Investigate Discrepancies
For each variance:
1. Click **"Investigate"** button
2. Review transaction history (last 90 days)
3. Look for:
   - Missing transactions
   - Incorrect quantities
   - Data entry errors
   - System glitches

### Step 4: Fix Verified Variances
**Small Variances (Auto-fix eligible):**
- ≤10 units difference
- ≤5% percentage difference
- ≤₱1,000 value impact
- Click "Auto-Fix Small Variances" button

**Large Variances (Manual fix required):**
- Select variance row
- Click "Investigate" → "Fix Discrepancy"
- Add notes explaining root cause
- Confirm fix
- System creates inventory correction record

### Step 5: Document Root Causes
In audit log notes, record:
- Why the variance occurred
- Corrective action taken
- How to prevent in future

---

## Troubleshooting

### Issue: No Email Received

**Check 1: Verify SMTP Configuration**
```bash
# Run test endpoint
GET /api/test/email-config
```

**Check 2: Spam Folder**
- Check junk/spam folder
- Add sender to safe senders list

**Check 3: Gmail App Password**
- Ensure 2FA is enabled
- Generate new App Password if needed
- Remove spaces from App Password

**Check 4: Firewall/Network**
- Ensure port 587 is not blocked
- Check Vercel function logs for errors

### Issue: Cron Job Not Running

**Check 1: Vercel Deployment**
```bash
# Verify vercel.json includes cron configuration
# Check Vercel dashboard → Cron Jobs tab
```

**Check 2: CRON_SECRET Missing**
- Verify environment variable exists
- Redeploy after adding

**Check 3: Timezone Issues**
- Cron runs in UTC timezone
- 2:00 AM UTC = 10:00 AM Philippine Time
- Adjust schedule if needed

### Issue: "Unauthorized" Error

**Solution:**
- Verify CRON_SECRET matches in:
  - Environment variables
  - Cron job request header
- Regenerate secret if compromised

### Issue: High Email Volume

**Solution:**
- Increase RECONCILIATION_ALERT_THRESHOLD_AMOUNT
- Fix recurring variances
- Schedule physical stock counts

---

## Security Considerations

### 1. Cron Secret Protection
- ✅ Use strong random token (32+ characters)
- ✅ Never commit CRON_SECRET to git
- ✅ Rotate periodically (every 90 days)
- ✅ Restrict access to environment variables

### 2. Email Security
- ✅ Use App Passwords (not main password)
- ✅ Enable 2FA on email account
- ✅ Monitor for suspicious login attempts
- ✅ Use TLS encryption (port 587)

### 3. Access Control
- ✅ Only Super Admin can test email config
- ✅ Only users with REPORT_VIEW see widget
- ✅ Only users with INVENTORY_CORRECTION can fix variances
- ✅ All actions logged in audit trail

### 4. Data Privacy
- ✅ Email alerts contain sensitive inventory data
- ✅ Ensure ALERT_EMAIL_TO is secure
- ✅ Use encrypted email (TLS/SSL)
- ✅ Limit CC/BCC recipients

---

## FAQ

### Q: Will this slow down my application?
**A:** No. Cron jobs run on separate serverless instances and have zero impact on user-facing performance.

### Q: Can I disable auto-fix entirely?
**A:** Yes. Auto-fix only happens if you manually click the button. No automatic fixes occur without admin approval.

### Q: How much does Vercel Cron cost?
**A:** Vercel cron jobs are included in all plans. Hobby plan includes 1 cron job (sufficient for this feature).

### Q: Can I receive alerts on multiple emails?
**A:** Currently supports one recipient. To send to multiple, use an email group/distribution list.

### Q: What if I miss an alert email?
**A:** The Stock Health Widget on dashboard always shows latest status. You can manually run reconciliation anytime.

### Q: Can I run reconciliation more frequently?
**A:** Yes. Modify `vercel.json` cron schedule. However, daily checks are recommended to avoid alert fatigue.

### Q: Does it work offline/locally?
**A:** Email alerts require internet. Cron jobs only work on Vercel. Local development can use manual reconciliation page.

### Q: How long are audit logs kept?
**A:** Indefinitely. All reconciliation actions are permanently logged for compliance.

### Q: Can I export reconciliation reports?
**A:** Yes. Reconciliation page includes CSV export feature for all variances.

### Q: What happens if email sending fails?
**A:** Error is logged, cron continues processing other businesses. Check Vercel function logs for details.

---

## Support

### Documentation
- **Main Docs:** `STOCK-RECONCILIATION-EXPLAINED.md`
- **Technical Docs:** `STOCK_RECONCILIATION_DETECTIVE_IMPLEMENTATION.md`
- **Transaction Safety:** `TRANSACTION_SAFETY_FIXES_APPLIED.md`

### Contact
For technical support or feature requests:
- **Email:** support@igorotech.com
- **GitHub:** https://github.com/igorotech/ultimatepos-modern/issues

---

## Changelog

### Version 1.0.0 (2025-11-15)
- ✅ Initial release
- ✅ Daily automated reconciliation
- ✅ Email notification system
- ✅ Dashboard widget integration
- ✅ Test endpoint for SMTP verification
- ✅ Comprehensive documentation

---

**Configuration Complete!** 🎉

Your automated stock reconciliation system is now ready. You'll receive email alerts daily if any inventory discrepancies are detected.

**Next Steps:**
1. Test email configuration using test endpoint
2. Wait for first scheduled run (2:00 AM UTC)
3. Review dashboard widget for stock health status
4. Set up regular review process for variances

**Remember:** All variances require manual review and approval. No automatic fixes without admin action.
