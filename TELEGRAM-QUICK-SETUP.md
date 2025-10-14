# Telegram Bot Setup - Quick Guide

## Step-by-Step Instructions

### 1. Create Your Bot

1. Open Telegram (phone or desktop)
2. Search for **@BotFather**
3. Send `/newbot`
4. Enter bot name: `IgoroTechPOS Alerts`
5. Enter bot username: `igorotechpos_bot` (or any unique name ending in `bot`)
6. **COPY THE BOT TOKEN** - You'll need this!
   - Example: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz-1234567`

### 2. Start Your Bot

**IMPORTANT: Do this BEFORE trying to get your Chat ID!**

1. Click the link provided by @BotFather (or search for your bot)
2. Click **"START"** button
3. Send a message to your bot: `Hello`
4. You should see your message in the chat

### 3. Get Your Chat ID

1. **After** sending a message to your bot, visit this URL in your browser:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
   Replace `<YOUR_BOT_TOKEN>` with your actual token (no angle brackets)

2. **Example URL**:
   ```
   https://api.telegram.org/bot1234567890:ABCdefGHIjklMNOpqrsTUVwxyz/getUpdates
   ```

3. **Find your Chat ID** in the response:
   ```json
   {
     "ok": true,
     "result": [{
       "update_id": 123456789,
       "message": {
         "message_id": 1,
         "from": {
           "id": 987654321,  // ← This is your Chat ID
           "is_bot": false,
           "first_name": "Your Name"
         },
         "chat": {
           "id": 987654321,  // ← Or this one (same value)
           "first_name": "Your Name",
           "type": "private"
         },
         "date": 1234567890,
         "text": "Hello"
       }
     }]
   }
   ```

4. **Copy the Chat ID** - it's the number in `"chat": {"id": 987654321}`

### 4. Update Your .env File

Open `.env` and update these lines:

```env
# Enable Telegram notifications
TELEGRAM_NOTIFICATIONS_ENABLED="true"

# Paste your bot token here (from BotFather)
TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"

# Paste your chat ID here (from getUpdates)
TELEGRAM_CHAT_IDS="987654321"
```

**For multiple admins**, separate Chat IDs with commas (no spaces):
```env
TELEGRAM_CHAT_IDS="987654321,123456789,555666777"
```

### 5. Restart the Server

Stop the dev server (Ctrl+C in terminal) and restart:
```bash
npm run dev
```

### 6. Test It!

1. Open: `http://localhost:3000/dashboard/test-telegram`
2. Click: **"Send Test Message to Telegram"**
3. Check your Telegram app for the test message!

---

## Common Issues

### Issue: "Not Found" error (404)
**Solution**: You forgot to send a message to your bot first! Go back to Step 2.

### Issue: Empty result `{"ok":true,"result":[]}`
**Solution**:
- Make sure you clicked "START" in your bot chat
- Send at least one message to the bot
- Wait a few seconds and try again

### Issue: Bot token doesn't work
**Solution**:
- Double-check you copied the entire token from @BotFather
- Make sure there are no extra spaces
- The token should look like: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### Issue: Test message not received
**Solution**:
- Make sure `TELEGRAM_NOTIFICATIONS_ENABLED="true"`
- Check that bot token and chat ID are correct
- Restart the development server after updating .env
- Make sure you started the bot (sent /start)

---

## Your Information Template

Fill this out as you go:

```
Bot Name: IgoroTechPOS Alerts
Bot Username: @igorotechpos_bot
Bot Token: ______________________________
Your Chat ID: ______________________________
```

---

## What You'll Receive

Once configured, you'll get instant Telegram alerts for:

🚨 **Large Discounts** - When discount exceeds ₱1,000
💳 **Credit Sales** - All credit transactions
⚠️ **Void Transactions** - Voided sales (requires manager auth)
🔄 **Refund Transactions** - Processed refunds (requires manager auth)

---

**Need Help?**
- Visit: `/dashboard/test-telegram` in your app
- Check the console for error messages
- Review: `TELEGRAM-NOTIFICATIONS-COMPLETE.md` for full documentation
