# Free Alert Notification Options - SMS & WhatsApp

**Date:** 2025-01-13
**Purpose:** Send discount alerts to admin/owner mobile phone
**Budget:** FREE (No cost solutions)

---

## Overview

When a cashier applies a Regular Discount, the system should send an alert to the admin/owner. This document explores **FREE** options for SMS and WhatsApp notifications.

---

## Option 1: Semaphore SMS (Philippines) - RECOMMENDED

### Details
- **Service:** Semaphore SMS API (Philippine-based)
- **Website:** https://semaphore.co
- **Cost:** ₱0.50 per SMS (NOT free, but cheapest in PH)
- **Free Trial:** 10 FREE SMS credits on signup
- **Best For:** Philippine phone numbers

### Pricing
- ₱500 = 1,000 SMS messages
- ₱1,000 = 2,000 SMS messages
- Very affordable for business use

### Implementation
```typescript
// Install package
npm install semaphore-sms

// API Configuration
const SEMAPHORE_API_KEY = 'your-api-key'
const SEMAPHORE_SENDER = 'YourBusiness'

// Send SMS
async function sendDiscountAlert(amount: number, cashier: string, adminPhone: string) {
  const response = await fetch('https://api.semaphore.co/api/v4/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': SEMAPHORE_API_KEY
    },
    body: JSON.stringify({
      apikey: SEMAPHORE_API_KEY,
      number: adminPhone,
      message: `⚠️ DISCOUNT ALERT\nCashier: ${cashier}\nAmount: ₱${amount.toFixed(2)}\nTime: ${new Date().toLocaleString('en-PH')}`,
      sendername: SEMAPHORE_SENDER
    })
  })
  return response.json()
}
```

---

## Option 2: WhatsApp Business API (FREE with Limits)

### Meta Cloud API (FREE Tier)
- **Website:** https://developers.facebook.com/docs/whatsapp
- **Cost:** 1,000 FREE messages per month
- **Limitations:**
  - Requires Meta Business Account verification
  - 24-hour messaging window (user must initiate first)
  - Template messages only
  - Setup complexity: HIGH

### Implementation Complexity
❌ **Not Recommended** for this use case because:
- Cannot send unsolicited messages
- User must message business first
- Complex setup process
- 1,000 message limit not sufficient for busy stores

---

## Option 3: Telegram Bot API (100% FREE) - BEST FREE OPTION

### Details
- **Service:** Telegram Bot API
- **Website:** https://core.telegram.org/bots
- **Cost:** 100% FREE (unlimited messages)
- **Requirements:**
  - Admin must have Telegram app installed
  - Admin must start a chat with the bot
  - No verification needed
  - Setup: 10 minutes

### Advantages
✅ Completely FREE (unlimited messages)
✅ Instant delivery
✅ Very easy to implement
✅ No monthly limits
✅ Can send images, videos, files
✅ Works on all devices (iOS, Android, Desktop, Web)

### Implementation

#### Step 1: Create Telegram Bot
1. Open Telegram app
2. Search for "@BotFather"
3. Send `/newbot`
4. Follow instructions
5. Copy API Token: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`

#### Step 2: Get Admin Chat ID
1. Admin opens bot and sends `/start`
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Find "chat":{"id":123456789} - this is admin's Chat ID

#### Step 3: Implement in Code

```typescript
// src/lib/telegram.ts

export async function sendTelegramAlert(
  message: string,
  chatId: string = process.env.TELEGRAM_ADMIN_CHAT_ID || ''
) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN

  if (!botToken || !chatId) {
    console.warn('Telegram not configured')
    return
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML'
        })
      }
    )

    const data = await response.json()
    if (!data.ok) {
      console.error('Telegram send failed:', data)
    }
    return data
  } catch (error) {
    console.error('Telegram error:', error)
  }
}

// Usage in POS - Send discount alert
export async function sendDiscountAlert(
  discountAmount: number,
  subtotal: number,
  cashier: string,
  location: string
) {
  const percentage = ((discountAmount / subtotal) * 100).toFixed(1)

  const message = `
⚠️ <b>DISCOUNT ALERT</b>

💰 <b>Amount:</b> ₱${discountAmount.toLocaleString('en-PH', {minimumFractionDigits: 2})}
📊 <b>Percentage:</b> ${percentage}%
🧾 <b>Subtotal:</b> ₱${subtotal.toLocaleString('en-PH', {minimumFractionDigits: 2})}

👤 <b>Cashier:</b> ${cashier}
📍 <b>Location:</b> ${location}
🕐 <b>Time:</b> ${new Date().toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short'
  })}
  `.trim()

  await sendTelegramAlert(message)
}
```

#### Step 4: Environment Variables

```env
# .env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=987654321
```

#### Step 5: Add to Sales API

```typescript
// src/app/api/sales/route.ts

import { sendDiscountAlert } from '@/lib/telegram'

// Inside POST handler, after validating discount
if (discountType === 'regular' && discountAmount > 0) {
  // Send alert for any Regular Discount
  await sendDiscountAlert(
    parseFloat(discountAmount),
    calculateSubtotal(items),
    session.user.name,
    currentLocation.name
  )
}
```

---

## Option 4: Email Alerts (100% FREE) - FALLBACK OPTION

### Details
- **Service:** Gmail SMTP or Resend.com
- **Cost:** 100% FREE
- **Limitations:**
  - Not as immediate as SMS/Telegram
  - Admin must check email
  - May go to spam folder

### Implementation (Gmail SMTP)

```typescript
// Install nodemailer
npm install nodemailer

// src/lib/email.ts
import nodemailer from 'nodemailer'

export async function sendEmailAlert(
  subject: string,
  message: string,
  toEmail: string
) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // Not regular password, use App Password
    }
  })

  await transporter.sendMail({
    from: process.env.GMAIL_USER,
    to: toEmail,
    subject: subject,
    html: message
  })
}
```

---

## Option 5: Free SMS Services (Limited)

### Twilio (Free Trial)
- **Free Credits:** $15 (≈150 SMS)
- **After Trial:** $0.0075 per SMS (₱0.42)
- **Website:** https://www.twilio.com
- **Best For:** International SMS

### Vonage (Nexmo)
- **Free Credits:** €2 (≈20 SMS)
- **After Trial:** €0.033 per SMS
- **Website:** https://www.vonage.com

❌ **Not Recommended:** Trial credits run out quickly

---

## Recommended Solution

### For Philippine Businesses

#### Tier 1: Telegram (100% FREE) ⭐⭐⭐⭐⭐
**Recommended if:**
- ✅ Admin has smartphone
- ✅ Want unlimited FREE alerts
- ✅ Want instant notifications
- ✅ Easy 10-minute setup

**Implementation Time:** 30 minutes

#### Tier 2: Email (100% FREE) ⭐⭐⭐
**Recommended if:**
- ✅ Admin always checks email
- ✅ Don't want to install apps
- ✅ Okay with slight delay

**Implementation Time:** 20 minutes

#### Tier 3: Semaphore SMS (₱0.50/SMS) ⭐⭐⭐⭐
**Recommended if:**
- ✅ Budget available for SMS
- ✅ Want SMS specifically
- ✅ Admin doesn't use Telegram
- ✅ Need guaranteed delivery

**Monthly Cost:** ≈₱500-1,000 (1,000-2,000 alerts)

---

## Implementation Priority

### Phase 1: Telegram Bot (IMMEDIATE - FREE)
1. Create Telegram bot (5 minutes)
2. Install in admin's phone (2 minutes)
3. Get Chat ID (3 minutes)
4. Implement in code (20 minutes)
5. Test alerts (5 minutes)

**Total Time:** 35 minutes
**Total Cost:** ₱0

### Phase 2: Email Backup (OPTIONAL - FREE)
1. Configure Gmail SMTP (10 minutes)
2. Add email alert function (10 minutes)
3. Test (5 minutes)

**Total Time:** 25 minutes
**Total Cost:** ₱0

### Phase 3: SMS (FUTURE - PAID)
Only if business wants SMS specifically
**Monthly Budget:** ₱500-1,000

---

## Alert Threshold Settings

### Business Configuration

Add to business settings:

```typescript
interface BusinessSettings {
  alerts: {
    enabled: boolean
    methods: ('telegram' | 'email' | 'sms')[]

    // Discount Alert Triggers
    discountThreshold: number           // e.g., 1000 (₱1,000)
    alertOnAnyRegularDiscount: boolean  // true = alert on any amount

    // Telegram Config
    telegramEnabled: boolean
    telegramChatId: string

    // Email Config
    emailEnabled: boolean
    emailAddress: string

    // SMS Config (future)
    smsEnabled: boolean
    smsPhone: string
  }
}
```

### Example Settings

```json
{
  "alerts": {
    "enabled": true,
    "methods": ["telegram", "email"],
    "discountThreshold": 1000,
    "alertOnAnyRegularDiscount": true,
    "telegramEnabled": true,
    "telegramChatId": "987654321",
    "emailEnabled": true,
    "emailAddress": "owner@business.com",
    "smsEnabled": false
  }
}
```

---

## Alert Message Examples

### Telegram Alert (Rich Formatting)
```
⚠️ DISCOUNT ALERT

💰 Amount: ₱1,500.00
📊 Percentage: 30.0%
🧾 Subtotal: ₱5,000.00

👤 Cashier: Juan Dela Cruz
📍 Location: Main Branch
🕐 Time: Jan 13, 2025, 2:45 PM
```

### Email Alert (HTML)
```html
<div style="font-family: Arial; padding: 20px; background: #fff3cd;">
  <h2 style="color: #856404;">⚠️ Discount Alert</h2>
  <p><strong>Amount:</strong> ₱1,500.00</p>
  <p><strong>Percentage:</strong> 30.0%</p>
  <p><strong>Subtotal:</strong> ₱5,000.00</p>
  <hr>
  <p><strong>Cashier:</strong> Juan Dela Cruz</p>
  <p><strong>Location:</strong> Main Branch</p>
  <p><strong>Time:</strong> Jan 13, 2025, 2:45 PM</p>
</div>
```

### SMS Alert (Short)
```
DISCOUNT ALERT
₱1,500 (30%)
Cashier: Juan
Jan 13, 2:45 PM
```

---

## Testing Checklist

### Telegram Testing
- [ ] Create bot and get token
- [ ] Admin starts chat with bot
- [ ] Get admin's Chat ID
- [ ] Add env variables to `.env`
- [ ] Test sending message via API
- [ ] Test from POS sale with Regular Discount
- [ ] Verify message received instantly
- [ ] Verify formatting looks good

### Email Testing
- [ ] Configure Gmail SMTP or Resend
- [ ] Add env variables
- [ ] Test sending email
- [ ] Check spam folder
- [ ] Test from POS sale
- [ ] Verify email received

---

## Security Considerations

### Telegram Bot Security
✅ Bot token should be in `.env` (not committed to Git)
✅ Only admin's Chat ID receives messages
✅ Bot cannot initiate commands (read-only)
✅ Messages are encrypted in transit

### Email Security
✅ Use App Password, not regular Gmail password
✅ Enable 2FA on Gmail account
✅ Store credentials in `.env`

---

## Cost Analysis

### Scenario: Busy Store (100 discounts/day)

| Solution | Monthly Messages | Monthly Cost | Setup Time |
|----------|------------------|--------------|------------|
| **Telegram** | 3,000 | ₱0 | 30 min |
| **Email** | 3,000 | ₱0 | 20 min |
| **Semaphore SMS** | 3,000 | ₱1,500 | 40 min |
| **Twilio SMS** | 3,000 | ₱1,260 | 45 min |

**Winner:** Telegram (FREE + Instant + Easy)

---

## Files to Create

### 1. Telegram Library
**File:** `src/lib/telegram.ts`
**Lines:** ~50 lines
**Functions:**
- `sendTelegramAlert(message, chatId)`
- `sendDiscountAlert(amount, subtotal, cashier, location)`

### 2. Email Library (Optional)
**File:** `src/lib/email.ts`
**Lines:** ~40 lines
**Functions:**
- `sendEmailAlert(subject, message, toEmail)`
- `sendDiscountEmailAlert(...)`

### 3. Environment Variables
**File:** `.env`
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=987654321
GMAIL_USER=yourbusiness@gmail.com
GMAIL_APP_PASSWORD=abc def ghi jkl
```

### 4. Sales API Update
**File:** `src/app/api/sales/route.ts`
**Add:** Import and call alert functions after discount validation

---

## Next Steps

1. ✅ **Choose Telegram** (100% FREE, instant, easy)
2. Create Telegram bot (5 minutes)
3. Install Telegram on admin's phone
4. Implement alert library (20 minutes)
5. Add to sales API (10 minutes)
6. Test with real discount (5 minutes)

**Total Implementation Time:** 40 minutes
**Total Cost:** ₱0

---

## Support Resources

### Telegram Bot Documentation
- Official Docs: https://core.telegram.org/bots/api
- Bot Father: https://t.me/botfather
- Tutorial: https://core.telegram.org/bots/tutorial

### Philippine SMS Services
- Semaphore: https://semaphore.co
- Chikka: https://www.chikka.com (corporate only)
- SMART: https://smart.com.ph/business/messaging

---

## Approval & Sign-Off

- [ ] Choose alert method (Telegram recommended)
- [ ] Create bot/configure service
- [ ] Implement alert library
- [ ] Add to sales API
- [ ] Test alerts
- [ ] Train admin how to use
- [ ] Document admin phone/chat ID
- [ ] Production deployment

---

**END OF DOCUMENT**

**Recommendation:** Implement Telegram alerts (100% FREE, instant, easy setup)
**Alternative:** Email alerts as backup (also FREE)
**Paid Option:** Semaphore SMS (₱0.50/message) if SMS specifically needed
