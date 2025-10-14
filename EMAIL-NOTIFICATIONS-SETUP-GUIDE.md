# 📧 Email Notifications Setup Guide

## Complete Guide to Configuring Email Alerts in UltimatePOS

**Last Updated:** October 14, 2025
**Status:** Production Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [SMTP Configuration](#smtp-configuration)
3. [Gmail Setup (Recommended)](#gmail-setup-recommended)
4. [Other Email Providers](#other-email-providers)
5. [Alert Types](#alert-types)
6. [Testing Your Configuration](#testing-your-configuration)
7. [Troubleshooting](#troubleshooting)

---

## Overview

UltimatePOS includes a comprehensive email notification system that automatically alerts administrators about important events:

- 🚨 **Large Discounts** - When discounts exceed threshold (default: ₱1,000)
- 🚫 **Void Transactions** - When sales are voided
- ↩️ **Refund Transactions** - When refunds are processed
- 💳 **Credit Sales** - When sales are made on credit
- 💰 **Large Cash Outs** - When cash out exceeds threshold (default: ₱5,000)
- 📦 **Low Stock Alerts** - When products reach critical stock levels

---

## SMTP Configuration

### Step 1: Open Your `.env` File

The `.env` file is located in the root directory of your project:
```
C:\xampp\htdocs\ultimatepos-modern\.env
```

### Step 2: Configure SMTP Settings

Your `.env` file now includes the following email configuration:

```env
# Email Configuration (SMTP)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"  # true for 465 (SSL), false for other ports (TLS)
SMTP_USER="your-email@gmail.com"  # Your email address
SMTP_PASS="your-app-password"  # Gmail App Password (NOT your regular password)
SMTP_FROM="UltimatePOS <noreply@yourbusiness.com>"  # Sender name and email

# Email Notification Settings
EMAIL_NOTIFICATIONS_ENABLED="true"
EMAIL_ADMIN_RECIPIENTS="admin@yourbusiness.com,manager@yourbusiness.com"  # Comma-separated

# Alert Thresholds
EMAIL_ALERT_DISCOUNT_THRESHOLD="1000"  # Send alert if discount exceeds this amount
EMAIL_ALERT_VOID_ENABLED="true"  # Alert on void transactions
EMAIL_ALERT_REFUND_ENABLED="true"  # Alert on refund transactions
EMAIL_ALERT_CREDIT_ENABLED="true"  # Alert on credit sales
EMAIL_ALERT_CASH_OUT_THRESHOLD="5000"  # Alert if cash out exceeds this amount
EMAIL_ALERT_LOW_STOCK_ENABLED="true"  # Alert on critical stock levels
```

### Step 3: Update With Your Information

Replace the placeholder values with your actual information:

1. **SMTP_USER** - Your email address
2. **SMTP_PASS** - Your email password or app password (see Gmail setup below)
3. **SMTP_FROM** - How you want emails to appear (e.g., "My Store <noreply@mystore.com>")
4. **EMAIL_ADMIN_RECIPIENTS** - Comma-separated list of email addresses to receive alerts

---

## Gmail Setup (Recommended)

Gmail is the easiest option for most users. Follow these steps:

### Step 1: Enable 2-Factor Authentication

1. Go to your **Google Account** → **Security**
2. Enable **2-Step Verification** if not already enabled
3. You MUST have 2FA enabled to create app passwords

### Step 2: Create an App Password

1. Go to **Google Account** → **Security** → **2-Step Verification**
2. Scroll down to **App passwords**
3. Click **Generate new app password**
4. Select:
   - **App:** Mail
   - **Device:** Other (Custom name) - Enter "UltimatePOS"
5. Click **Generate**
6. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)

### Step 3: Update Your `.env` File

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="youremail@gmail.com"  # Your Gmail address
SMTP_PASS="abcd efgh ijkl mnop"  # The 16-character app password (remove spaces)
SMTP_FROM="My Store <noreply@mystore.com>"
```

**Important Notes:**
- Remove spaces from the app password: `abcdefghijklmnop`
- Use the app password, NOT your regular Gmail password
- If you don't see "App passwords" option, make sure 2FA is enabled

### Step 4: Restart Your Application

After updating `.env`:
```bash
# Stop the server (Ctrl+C)
npm run dev
```

---

## Other Email Providers

### Microsoft Outlook / Hotmail

```env
SMTP_HOST="smtp-mail.outlook.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="youremail@outlook.com"
SMTP_PASS="your-password"
SMTP_FROM="My Store <noreply@mystore.com>"
```

### Office 365

```env
SMTP_HOST="smtp.office365.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="youremail@company.com"
SMTP_PASS="your-password"
SMTP_FROM="My Store <noreply@company.com>"
```

### Yahoo Mail

```env
SMTP_HOST="smtp.mail.yahoo.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="youremail@yahoo.com"
SMTP_PASS="your-app-password"  # Yahoo also requires app password
SMTP_FROM="My Store <noreply@yahoo.com>"
```

### Custom SMTP Server

If you have your own mail server:

```env
SMTP_HOST="mail.yourdomain.com"
SMTP_PORT="587"  # or 465 for SSL
SMTP_SECURE="false"  # true for port 465
SMTP_USER="noreply@yourdomain.com"
SMTP_PASS="your-password"
SMTP_FROM="My Store <noreply@yourdomain.com>"
```

---

## Alert Types

### 1. Large Discount Alert

**Triggered When:** Discount amount exceeds threshold (default: ₱1,000)

**Configuration:**
```env
EMAIL_ALERT_DISCOUNT_THRESHOLD="1000"
```

**Email Content:**
- Sale number
- Discount amount (highlighted in red)
- Discount type (percentage, fixed, etc.)
- Sale total
- Cashier name
- Location
- Timestamp
- Reason (if provided)

**Example:** If a cashier applies a ₱1,500 discount, all admin recipients receive an immediate alert.

---

### 2. Void Transaction Alert

**Triggered When:** A sale is voided

**Configuration:**
```env
EMAIL_ALERT_VOID_ENABLED="true"
```

**Email Content:**
- Sale number
- Voided amount
- Item count
- Cashier name
- Location
- Timestamp
- Void reason

**Example:** Manager voids a ₱5,000 sale, admin receives notification with details.

---

### 3. Refund Transaction Alert

**Triggered When:** A refund is processed

**Configuration:**
```env
EMAIL_ALERT_REFUND_ENABLED="true"
```

**Email Content:**
- Original sale number
- Refund amount
- Item count
- Processed by (cashier)
- Location
- Original sale date
- Refund timestamp
- Refund reason

**Example:** Customer returns items worth ₱3,000, admin is notified of the refund.

---

### 4. Credit Sale Alert

**Triggered When:** A sale is made on credit (not fully paid)

**Configuration:**
```env
EMAIL_ALERT_CREDIT_ENABLED="true"
```

**Email Content:**
- Sale number
- Credit amount
- Customer name
- Cashier name
- Location
- Sale date
- Due date (if set)
- Payment terms

**Example:** Customer buys ₱10,000 worth of goods on credit, admin receives notification.

---

### 5. Large Cash Out Alert

**Triggered When:** Cash out exceeds threshold (default: ₱5,000)

**Configuration:**
```env
EMAIL_ALERT_CASH_OUT_THRESHOLD="5000"
```

**Email Content:**
- Transaction number
- Amount
- Reason
- Cashier name
- Location
- Timestamp
- Approved by (if applicable)

**Example:** Cashier withdraws ₱10,000 from drawer, admin is alerted.

---

### 6. Low Stock Alert

**Triggered When:** Products reach critical stock levels

**Configuration:**
```env
EMAIL_ALERT_LOW_STOCK_ENABLED="true"
```

**Email Content:**
- List of products below reorder point
- Current stock levels
- Reorder points
- Urgency levels (Critical/High/Medium)
- Locations affected
- Link to Purchase Suggestions page

**Example:** 5 products reach critical stock, admin receives consolidated alert with all details.

---

## Configuring Alert Recipients

### Single Recipient

```env
EMAIL_ADMIN_RECIPIENTS="admin@yourbusiness.com"
```

### Multiple Recipients (Comma-separated)

```env
EMAIL_ADMIN_RECIPIENTS="admin@yourbusiness.com,manager@yourbusiness.com,owner@yourbusiness.com"
```

**Important:** No spaces between emails!

---

## Customizing Alert Thresholds

### Adjust Discount Threshold

Change when discount alerts are sent:

```env
# Alert only for discounts above ₱2,000
EMAIL_ALERT_DISCOUNT_THRESHOLD="2000"

# Alert for any discount above ₱500
EMAIL_ALERT_DISCOUNT_THRESHOLD="500"
```

### Adjust Cash Out Threshold

```env
# Alert only for cash outs above ₱10,000
EMAIL_ALERT_CASH_OUT_THRESHOLD="10000"

# Alert for any cash out above ₱1,000
EMAIL_ALERT_CASH_OUT_THRESHOLD="1000"
```

### Disable Specific Alerts

Turn off alerts you don't need:

```env
EMAIL_ALERT_VOID_ENABLED="false"  # Don't send void alerts
EMAIL_ALERT_REFUND_ENABLED="false"  # Don't send refund alerts
EMAIL_ALERT_CREDIT_ENABLED="false"  # Don't send credit alerts
```

### Disable All Notifications

```env
EMAIL_NOTIFICATIONS_ENABLED="false"
```

---

## Testing Your Configuration

### Method 1: Using the API (Recommended)

Once the server is running, test your email configuration:

**API Endpoint:** `POST /api/email/test`

**Request:**
```json
{
  "email": "your-test-email@gmail.com"
}
```

**Using cURL:**
```bash
curl -X POST http://localhost:3002/api/email/test \
  -H "Content-Type: application/json" \
  -d '{"email":"your-test-email@gmail.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Test email sent successfully to your-test-email@gmail.com"
}
```

### Method 2: Check Server Logs

After sending a test email, check your terminal for logs:

```
✅ Email sent: <message-id>
```

If you see errors, check the [Troubleshooting](#troubleshooting) section.

---

## Troubleshooting

### Problem: "Authentication failed" or "Invalid credentials"

**Causes:**
- Using your regular password instead of app password (Gmail)
- Incorrect email/password
- 2FA not enabled (Gmail)

**Solution:**
1. For Gmail: Create an app password (see [Gmail Setup](#gmail-setup-recommended))
2. Double-check your email and password in `.env`
3. Ensure no extra spaces in credentials

---

### Problem: "Connection timeout" or "Cannot connect to SMTP server"

**Causes:**
- Wrong SMTP host or port
- Firewall blocking outgoing connections
- Internet connection issues

**Solution:**
1. Verify SMTP host and port for your provider
2. Try port 465 with `SMTP_SECURE="true"`
3. Check firewall settings
4. Test internet connection

---

### Problem: Emails not being received

**Causes:**
- Emails going to spam folder
- Incorrect recipient email addresses
- Email provider blocking messages

**Solution:**
1. Check spam/junk folder
2. Verify recipient emails in `EMAIL_ADMIN_RECIPIENTS`
3. Add sender email to contacts/safe senders
4. Check email provider's security settings

---

### Problem: "Email not configured" error

**Cause:**
- Missing SMTP settings in `.env`
- Server not restarted after updating `.env`

**Solution:**
1. Verify all required SMTP fields are filled in `.env`
2. Restart the development server:
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

---

### Problem: Alerts not being sent for transactions

**Causes:**
- Notifications disabled in `.env`
- Thresholds set too high
- Specific alert type disabled

**Solution:**
1. Check `EMAIL_NOTIFICATIONS_ENABLED="true"`
2. Verify alert is enabled (e.g., `EMAIL_ALERT_VOID_ENABLED="true"`)
3. Check threshold values match your use case
4. Review transaction amounts against thresholds

---

## Email Templates

All emails use professional HTML templates with:

- ✅ **Branded header** with your business name
- ✅ **Color-coded alerts** (red for critical, yellow for warnings, blue for info)
- ✅ **Detailed information tables**
- ✅ **Professional footer** with timestamp
- ✅ **Mobile-responsive design**
- ✅ **Action buttons** where applicable (e.g., "View Reorder Suggestions")

---

## Best Practices

### Security

1. **Never commit `.env` to Git** - Your file is already in `.gitignore`
2. **Use app passwords** - Don't use your main email password
3. **Limit recipients** - Only send to authorized personnel
4. **Review alerts regularly** - Check spam folder periodically

### Performance

1. **Set appropriate thresholds** - Avoid alert fatigue with too many notifications
2. **Consolidate when possible** - Low stock alerts are sent in batches
3. **Monitor email quota** - Most providers have daily send limits

### Compliance

1. **Include unsubscribe option** - For commercial use
2. **Follow email regulations** - CAN-SPAM Act, GDPR, etc.
3. **Keep audit trail** - Emails serve as documentation

---

## Advanced Configuration

### Multiple Email Accounts

You can set up different email addresses for different alert types by creating custom configurations in your application code.

### Email Scheduling

Consider implementing:
- Daily summary emails (all transactions in one email)
- Weekly reports
- End-of-day reconciliation emails

### Custom Templates

Email templates can be customized in `src/lib/email.ts`:
- Modify HTML structure
- Change colors and styling
- Add your company logo
- Adjust content layout

---

## Integration with Other Features

### Purchase Order Emails

The email system integrates with the Purchase Order module:
- Automatically email POs to suppliers
- Include PDF attachments
- Track email delivery

**See:** `PRINTABLE-PO-AND-EMAIL-COMPLETE.md` for details

### Low Stock Integration

Connects with the Automatic Reorder system:
- Daily low stock digests
- Critical stock immediate alerts
- Links to Purchase Suggestions page

**See:** `AUTOMATIC-REORDER-SYSTEM-ENHANCED.md` for details

---

## Quick Reference

### Required `.env` Variables

```env
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="your-email@gmail.com"
SMTP_PASS="your-app-password"
SMTP_FROM="Store Name <noreply@store.com>"
EMAIL_NOTIFICATIONS_ENABLED="true"
EMAIL_ADMIN_RECIPIENTS="admin@store.com"
```

### Alert Configuration

```env
EMAIL_ALERT_DISCOUNT_THRESHOLD="1000"
EMAIL_ALERT_VOID_ENABLED="true"
EMAIL_ALERT_REFUND_ENABLED="true"
EMAIL_ALERT_CREDIT_ENABLED="true"
EMAIL_ALERT_CASH_OUT_THRESHOLD="5000"
EMAIL_ALERT_LOW_STOCK_ENABLED="true"
```

### Test Email API

```bash
POST /api/email/test
Body: {"email":"test@example.com"}
```

---

## Support

### Common Gmail App Password Steps

1. **Google Account** → **Security**
2. **2-Step Verification** → **App passwords**
3. **Select app:** Mail
4. **Select device:** Other (Custom name) → "UltimatePOS"
5. **Generate** → Copy 16-character code
6. Paste into `SMTP_PASS` in `.env` (remove spaces)

### Email Provider Support

- **Gmail:** https://support.google.com/mail/answer/185833
- **Outlook:** https://support.microsoft.com/en-us/office/pop-imap-and-smtp-settings
- **Office 365:** https://docs.microsoft.com/en-us/exchange/mail-flow-best-practices/how-to-set-up-a-multifunction-device-or-application-to-send-email-using-office-365

---

## Changelog

### Version 1.0 (October 14, 2025)
- ✅ Initial email notification system
- ✅ SMTP configuration in .env
- ✅ Large discount alerts
- ✅ Void transaction alerts
- ✅ Refund transaction alerts
- ✅ Credit sale alerts
- ✅ Large cash out alerts
- ✅ Low stock alerts
- ✅ Test email endpoint
- ✅ Professional HTML templates

---

## Next Steps

1. ✅ **Configure SMTP** - Update `.env` with your email provider details
2. ✅ **Set Recipients** - Add admin email addresses
3. ✅ **Test Configuration** - Send a test email
4. ✅ **Adjust Thresholds** - Set appropriate alert thresholds for your business
5. ✅ **Monitor Alerts** - Check that notifications are being received
6. ✅ **Review Regularly** - Fine-tune thresholds based on business needs

---

**Status:** ✅ COMPLETE - Email notification system ready for production use!

**Documentation:** This guide
**Code:** `src/lib/email.ts`
**API:** `src/app/api/email/test/route.ts`
**Server:** Running on http://localhost:3002

---

*Email Notification System Version 1.0*
*Implemented: October 14, 2025*
*Ready for Production Use*
