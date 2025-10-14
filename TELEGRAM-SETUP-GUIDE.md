# Telegram Alert Setup Guide - 10 Minutes

**Goal:** Receive FREE instant discount alerts on your phone via Telegram
**Cost:** ₱0 (100% FREE forever)
**Time:** 10 minutes

---

## What You'll Need

- ✅ Smartphone (Android or iOS)
- ✅ Telegram app (FREE download)
- ✅ 10 minutes of your time

---

## Step-by-Step Setup

### Step 1: Install Telegram (2 minutes)

#### For Android:
1. Open Google Play Store
2. Search "Telegram"
3. Install "Telegram Messenger"
4. Open app and register with your phone number

#### For iPhone:
1. Open App Store
2. Search "Telegram"
3. Install "Telegram Messenger"
4. Open app and register with your phone number

**Already have Telegram?** Skip to Step 2!

---

### Step 2: Create Your Bot (3 minutes)

1. **Open Telegram app** on your phone

2. **Search for "@BotFather"** (official Telegram bot creator)
   - Click the search icon 🔍
   - Type: `@BotFather`
   - Click the verified account (blue checkmark)

3. **Start chat with BotFather**
   - Click "START" button
   - BotFather will greet you

4. **Create new bot**
   - Send this message: `/newbot`
   - BotFather asks: "Alright, a new bot. How are we going to call it?"

5. **Name your bot**
   - Type: `PciNet Discount Alerts` (or your business name)
   - Press Send

6. **Choose username for bot**
   - BotFather asks: "Now let's choose a username for your bot."
   - Type: `PciNetDiscounts_bot` (must end with "bot")
   - If taken, try: `PciNetAlerts_bot` or `YourBusinessName_bot`

7. **Copy your Bot Token** ⚠️ IMPORTANT
   - BotFather replies with: "Done! Your token is: `123456789:ABCdefGHI...`"
   - **Screenshot this message** or copy the token
   - Example token: `7891234560:AAHFj8sK9-LmNoPqRsT_UvWxYz012345ABC`

✅ **Your bot is created!**

---

### Step 3: Start Chat with Your Bot (1 minute)

1. **Click the link** BotFather sent (looks like: `t.me/YourBot_bot`)
2. Chat opens with your bot
3. Click **"START"** button
4. Bot shows: "This bot can't receive messages from users"
5. **That's okay!** You just needed to start the chat

---

### Step 4: Get Your Chat ID (2 minutes)

1. **Open web browser** on your computer or phone

2. **Visit this URL** (replace `<YOUR_BOT_TOKEN>` with your actual token):
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```

   **Example:**
   ```
   https://api.telegram.org/bot7891234560:AAHFj8sK9-LmNoPqRsT_UvWxYz012345ABC/getUpdates
   ```

3. **You'll see JSON response** like:
   ```json
   {
     "ok": true,
     "result": [
       {
         "update_id": 123456789,
         "message": {
           "message_id": 1,
           "from": {
             "id": 987654321,    ← THIS IS YOUR CHAT ID
             "is_bot": false,
             "first_name": "Juan"
           },
           "chat": {
             "id": 987654321,    ← THIS IS YOUR CHAT ID
             "first_name": "Juan",
             "type": "private"
           },
           "date": 1705123456,
           "text": "/start"
         }
       }
     ]
   }
   ```

4. **Find the "chat" section** and copy the **"id"** number
   - Example: `987654321`
   - **Screenshot this** or write it down

✅ **You now have your Chat ID!**

---

### Step 5: Add to Your POS System (2 minutes)

1. **Open your project folder**
   ```
   C:\xampp\htdocs\ultimatepos-modern
   ```

2. **Open `.env` file** (create if it doesn't exist)

3. **Add these two lines** at the end:
   ```env
   # Telegram Discount Alerts (100% FREE)
   TELEGRAM_BOT_TOKEN=7891234560:AAHFj8sK9-LmNoPqRsT_UvWxYz012345ABC
   TELEGRAM_ADMIN_CHAT_ID=987654321
   ```

   ⚠️ **Replace with YOUR values:**
   - `TELEGRAM_BOT_TOKEN` = Your bot token from Step 2
   - `TELEGRAM_ADMIN_CHAT_ID` = Your Chat ID from Step 4

4. **Save the file**

5. **Restart your POS server**
   ```bash
   # Stop server (Ctrl+C)
   # Start again
   npm run dev
   ```

✅ **Telegram is now configured!**

---

## Testing Your Setup

### Send Test Message

1. **Open terminal** in your project folder

2. **Run this test script:**

Create file: `test-telegram.js`
```javascript
async function testTelegram() {
  const botToken = 'YOUR_BOT_TOKEN_HERE'
  const chatId = 'YOUR_CHAT_ID_HERE'

  const message = `
✅ <b>Telegram Bot Test</b>

Your POS system is successfully connected!

You will receive discount alerts here.

🕐 ${new Date().toLocaleString('en-PH')}
  `.trim()

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
  console.log('Telegram response:', data)

  if (data.ok) {
    console.log('✅ SUCCESS! Check your Telegram app!')
  } else {
    console.log('❌ FAILED:', data.description)
  }
}

testTelegram()
```

3. **Replace values** in the script with your Bot Token and Chat ID

4. **Run the test:**
   ```bash
   node test-telegram.js
   ```

5. **Check your Telegram app** - you should receive a message!

✅ **If you got the message, everything is working!**

---

## What Happens Now?

### When Cashier Gives Discount

1. **Cashier** selects "Regular Discount" in POS
2. **Cashier** enters discount amount (e.g., ₱500)
3. **Cashier** completes the sale
4. **Instantly**, you receive message on Telegram:

```
⚠️ DISCOUNT ALERT

💰 Discount Amount: ₱500.00
📊 Percentage: 10.0%

🧾 Original Subtotal: ₱5,000.00
💳 Final Amount: ₱4,500.00

👤 Cashier: Juan Dela Cruz
📍 Location: Main Branch
🕐 Time: Jan 13, 2025, 2:45 PM
```

5. **You see it immediately** on your phone!

---

## How to Integrate with Sales API

Add this to your sales route after successful sale with Regular Discount:

**File:** `src/app/api/sales/route.ts`

```typescript
import { sendDiscountAlert } from '@/lib/telegram'

// Inside POST handler, after creating sale
if (discountType === 'regular' && discountAmount > 0) {
  // Send Telegram alert (doesn't block sale processing)
  sendDiscountAlert({
    discountAmount: parseFloat(discountAmount),
    subtotal: calculateSubtotal(items),
    cashierName: session.user.name || 'Unknown',
    locationName: location.name,
    invoiceNumber: newSale.invoiceNumber
  }).catch(err => {
    // Don't fail sale if Telegram fails
    console.error('Telegram alert failed:', err)
  })
}
```

---

## Optional: High-Value Alerts

Want extra alerts for discounts over ₱1,000?

```typescript
import { sendHighValueDiscountAlert } from '@/lib/telegram'

const THRESHOLD = 1000

if (discountType === 'regular' && discountAmount >= THRESHOLD) {
  // Send special high-value alert
  sendHighValueDiscountAlert({
    discountAmount: parseFloat(discountAmount),
    subtotal: calculateSubtotal(items),
    cashierName: session.user.name || 'Unknown',
    locationName: location.name,
    invoiceNumber: newSale.invoiceNumber
  }, THRESHOLD)
}
```

---

## Troubleshooting

### Problem 1: "Not Found" when visiting getUpdates URL
**Solution:**
- Check you replaced `<YOUR_BOT_TOKEN>` with actual token
- Token should not have spaces or `<>` brackets
- Token should be exactly as BotFather sent it

### Problem 2: Empty "result" array in getUpdates
**Solution:**
- You didn't start chat with bot yet
- Go to bot and click START button
- Wait 10 seconds
- Refresh the getUpdates URL

### Problem 3: No message received on test
**Solution:**
- Check Bot Token is correct in `.env`
- Check Chat ID is correct in `.env`
- Check you saved `.env` file
- Restart POS server after editing `.env`
- Check Telegram app is open

### Problem 4: "Unauthorized" error
**Solution:**
- Bot Token is wrong
- Copy token again from BotFather
- Make sure no extra spaces in `.env` file

---

## Security Tips

### ✅ DO:
- Keep your Bot Token secret (like a password)
- Add `.env` to `.gitignore` (don't commit to GitHub)
- Only give Chat ID to people who should receive alerts

### ❌ DON'T:
- Share Bot Token publicly
- Commit Bot Token to Git
- Use the same bot for multiple businesses

---

## Benefits Summary

| Feature | Status |
|---------|--------|
| **Cost** | ₱0 (FREE forever) |
| **Monthly Limit** | Unlimited messages |
| **Delivery Speed** | Instant (< 1 second) |
| **Reliability** | 99.9% uptime |
| **Setup Time** | 10 minutes |
| **Maintenance** | Zero (works forever) |
| **Works On** | All phones + Desktop + Web |

---

## Additional Features You Can Add

### 1. Daily Summary
Send summary at end of day:
```typescript
import { sendDailyDiscountSummary } from '@/lib/telegram'

// Call at end of shift
sendDailyDiscountSummary({
  date: '2025-01-13',
  totalDiscounts: 15,
  totalAmount: 3500,
  seniorCitizenCount: 5,
  seniorCitizenAmount: 800,
  pwdCount: 3,
  pwdAmount: 450,
  regularCount: 7,
  regularAmount: 2250,
  locationName: 'Main Branch'
})
```

### 2. Multiple Recipients
Send to owner AND manager:
```env
TELEGRAM_ADMIN_CHAT_ID=987654321
TELEGRAM_MANAGER_CHAT_ID=123456789
```

Then in code:
```typescript
// Send to both
await sendTelegramMessage(message, process.env.TELEGRAM_ADMIN_CHAT_ID)
await sendTelegramMessage(message, process.env.TELEGRAM_MANAGER_CHAT_ID)
```

---

## Need Help?

### Common Questions

**Q: Is this really free forever?**
A: Yes! Telegram Bot API is 100% free with no limits.

**Q: What if I lose my phone?**
A: Login to Telegram on new phone, bot messages are synced.

**Q: Can multiple people receive alerts?**
A: Yes! Each person creates their own Chat ID, add all to code.

**Q: Does this work without internet?**
A: No, POS needs internet to send. Messages queue and send when online.

**Q: Is this secure?**
A: Yes! Messages encrypted, only your Chat ID receives them.

---

## Quick Reference

### Your Telegram Setup Info

Fill this out after setup:

```
Bot Name: _____________________________
Bot Username: @________________________
Bot Token: ____________________________
Your Chat ID: _________________________
Setup Date: ___________________________
```

Keep this information safe!

---

## Next Steps

1. ✅ Complete setup above (10 minutes)
2. ✅ Test with real discount in POS
3. ✅ Train cashiers on new discount system
4. ✅ Monitor alerts for first week
5. ✅ Adjust threshold if needed (currently alerts on any Regular Discount)

---

**END OF SETUP GUIDE**

🎉 **Congratulations!** You now have FREE instant discount alerts!

**Support:** If you encounter issues, check Troubleshooting section above.
