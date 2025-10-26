# Telegram Price Change Alerts

## Overview

The system now automatically sends Telegram notifications whenever product prices are changed. This feature provides real-time alerts to business owners and managers about pricing changes across all locations.

## Features

### What Gets Notified

The system sends Telegram alerts for:

1. **Individual Price Changes** - When a single product price is edited
2. **Bulk Price Updates** - When multiple prices are updated at once
3. **Price Imports** - When prices are imported via CSV/Excel files

### Information Included in Alerts

Each price change notification includes:

- **Location Name** - Which branch/location the price applies to
- **Product Name** - The name of the product
- **SKU** - Product SKU for easy identification
- **Old Selling Price** - The previous price (in ₱)
- **New Selling Price** - The updated price (in ₱)
- **Price Change** - The difference amount and percentage
- **Changed By** - Username of the person who made the change
- **Change Type** - How the price was changed (Individual Edit, Bulk Update, or Price Import)
- **Timestamp** - When the change was made

### Smart Notification Logic

- **Individual Changes**: When 1-3 prices are updated, sends individual alerts for each product
- **Bulk Updates**: When 4+ prices are updated, sends a summary alert with:
  - Total number of products changed
  - First 5 changes as preview
  - Indication of additional changes beyond the preview

## Environment Variables

Add these to your `.env` file to enable Telegram notifications:

```env
# Telegram Notifications
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_IDS=123456789,987654321  # Comma-separated list of chat IDs
```

## Setup Instructions

### Step 1: Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` command
3. Follow the prompts to:
   - Choose a name for your bot (e.g., "IgoroTech POS Alerts")
   - Choose a username (must end in 'bot', e.g., "igorotech_pos_bot")
4. BotFather will give you a **Bot Token** - save this for the `.env` file

### Step 2: Get Your Chat ID

1. Start a chat with your new bot by clicking the link BotFather provides
2. Send `/start` to your bot
3. Visit this URL in your browser (replace `YOUR_BOT_TOKEN`):
   ```
   https://api.telegram.org/botYOUR_BOT_TOKEN/getUpdates
   ```
4. Look for `"chat":{"id":123456789` in the JSON response
5. The number after `"id":` is your **Chat ID**

### Step 3: Configure Environment Variables

Add to your `.env` file:

```env
TELEGRAM_NOTIFICATIONS_ENABLED=true
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_IDS=123456789
```

**For multiple recipients:**
```env
TELEGRAM_CHAT_IDS=123456789,987654321,456789123
```

### Step 4: Test the Integration

After configuration, test by:

1. Editing a product price in the system
2. Check your Telegram for the notification
3. The message should include all price change details with proper formatting

## Message Examples

### Individual Price Change

```
📈 PRICE CHANGE ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━
Location: Main Warehouse
Product: A-Data 32GB Flash Drive
SKU: ADATA-FD-32GB

Old Price: ₱450.00
New Price: ₱500.00
Change: +₱50.00 (11.11%)

Changed By: Juan Dela Cruz
Change Type: Individual Price Edit
Time: Jan 26, 2025, 7:30 PM

⚠️ Significant price change detected
```

### Bulk Update Summary

```
📊 BULK PRICE UPDATE ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Products Changed: 25
Changed By: Maria Santos
Change Type: Bulk Price Update
Time: Jan 26, 2025, 7:45 PM

Sample Changes:
1. 📈 Mouse Optical USB (MS-OPT-001): ₱150.00 → ₱175.00
2. 📈 Keyboard Mechanical (KB-MECH-001): ₱850.00 → ₱900.00
3. 📉 Monitor 24" LED (MON-24-001): ₱7,500.00 → ₱7,200.00
4. 📈 USB Cable Type-C (USB-C-001): ₱120.00 → ₱150.00
5. 📈 HDMI Cable 2m (HDMI-2M-001): ₱180.00 → ₱200.00

... and 20 more products

⚠️ Bulk price update completed
```

## Implementation Details

### Modified Files

1. **`src/lib/telegram.ts`**
   - Added `sendTelegramPriceChangeAlert()` - Individual price change notifications
   - Added `sendTelegramBulkPriceChangeAlert()` - Bulk update summaries

2. **`src/app/api/products/bulk-price-update/route.ts`**
   - Tracks old prices before update
   - Sends individual or bulk notifications based on quantity
   - Uses smart threshold (3 products) to decide notification type

3. **`src/app/api/products/import-prices/route.ts`**
   - Captures price changes during CSV/Excel import
   - Sends bulk summary after import completes
   - Includes sample of first 5 changes

4. **`src/app/api/products/variations/[id]/inventory/route.ts`**
   - Individual product price edit endpoint
   - Sends immediate notification on price change
   - Includes full product and location details

### Error Handling

- Telegram failures do not block price updates
- Errors are logged to console for debugging
- Updates complete successfully even if Telegram is down or misconfigured

### Security Features

- Notifications only sent if properly configured
- Requires valid bot token and chat IDs
- No sensitive data exposed in error messages
- RBAC permissions still enforced for price changes

## Troubleshooting

### Not Receiving Notifications

1. **Check Configuration**
   - Verify `TELEGRAM_NOTIFICATIONS_ENABLED=true`
   - Confirm bot token is valid
   - Ensure chat IDs are correct

2. **Test Bot Connection**
   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getMe
   ```
   Should return bot information

3. **Check Logs**
   - Look for `[Telegram]` messages in console
   - Check for error messages after price changes

### Multiple Notifications

- If receiving duplicates, check for multiple chat IDs in `TELEGRAM_CHAT_IDS`
- Ensure bot token is not being used by multiple environments

### Wrong Information

- Verify product SKUs are correctly set in database
- Check user names/usernames are populated
- Ensure location names are configured

## Benefits

1. **Real-time Monitoring** - Instant awareness of all price changes
2. **Audit Trail** - Know who changed what, when, and where
3. **Fraud Prevention** - Detect unauthorized price modifications
4. **Price Integrity** - Quickly spot errors or unusual changes
5. **Multi-location Management** - Track prices across all branches
6. **Free Service** - Unlimited messages via Telegram Bot API
7. **Multiple Recipients** - Alert multiple managers simultaneously

## Future Enhancements

Possible future improvements:
- Price change approval workflow via Telegram
- Daily/weekly price change summaries
- Price threshold alerts (changes over X%)
- Integration with other notification channels (Email, SMS)
- Interactive Telegram commands to query prices
- Price history reports via bot commands

## Support

For issues or questions about Telegram price alerts:
1. Check environment variables are correctly set
2. Verify bot token and chat IDs
3. Review console logs for error messages
4. Test with manual price changes
5. Contact system administrator if issues persist

---

**Last Updated:** January 26, 2025
**Feature Version:** 1.0
**Status:** Production Ready
