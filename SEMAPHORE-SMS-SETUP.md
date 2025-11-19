# Semaphore SMS Setup Guide

This guide explains how to configure SMS notifications for Purchase Order approvals using Semaphore.co.

## Features

The system now sends automatic SMS notifications when:
- ✅ **Purchase Receipt (GRN) is Approved** - Notifies configured recipients about approved purchases

The SMS includes:
- Purchase Order Number (PO)
- Goods Receipt Number (GRN)
- Supplier Name
- Total Amount
- Item Count
- Quantity Received
- Location Name
- Approved By
- Timestamp

## Prerequisites

1. **Semaphore Account**
   - Sign up at https://semaphore.co
   - Load credits (approximately ₱1.00 per SMS)
   - Get your API key from the dashboard

2. **Environment Variables**
   - Access to your Vercel project settings (or `.env.local` for local development)

## Setup Steps

### Step 1: Get Your Semaphore API Key

1. Go to https://semaphore.co
2. Sign in to your account
3. Navigate to **API Settings** in the dashboard
4. Copy your **API Key**

### Step 2: Configure Environment Variables

Add the following environment variables to your Vercel project or `.env.local` file:

```env
# Semaphore SMS Configuration
SEMAPHORE_SMS_ENABLED=true
SEMAPHORE_API_KEY=your_api_key_here
SEMAPHORE_SENDER_NAME=UltimatePOS
SEMAPHORE_RECIPIENTS=09171234567,09181234567
SMS_ALERT_PURCHASE_APPROVAL_ENABLED=true
```

#### Environment Variable Descriptions

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SEMAPHORE_SMS_ENABLED` | Yes | `false` | Master switch to enable/disable all SMS notifications |
| `SEMAPHORE_API_KEY` | Yes | - | Your Semaphore API key from dashboard |
| `SEMAPHORE_SENDER_NAME` | No | `IgoroTechPOS` | Sender name shown in SMS (max 11 chars, must be pre-registered) |
| `SEMAPHORE_RECIPIENTS` | Yes | - | Comma-separated list of mobile numbers to receive alerts |
| `SMS_ALERT_PURCHASE_APPROVAL_ENABLED` | No | `false` | Enable/disable purchase approval SMS notifications |

#### Phone Number Format

You can use any of these formats for `SEMAPHORE_RECIPIENTS`:
- `09171234567` (Philippine format)
- `+639171234567` (International format)
- `9171234567` (Without leading zero)

The system automatically normalizes all formats to international format (+639XXXXXXXXX).

### Step 3: Verify Configuration in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable mentioned above
4. Redeploy your application for changes to take effect

### Step 4: Test the Integration

You can test the SMS integration by:

1. **Create a Test Purchase Order**
   ```
   Dashboard → Purchases → Create Purchase Order
   ```

2. **Create a Goods Receipt**
   ```
   Dashboard → Purchases → [Select PO] → Receive
   ```

3. **Approve the Receipt**
   ```
   Dashboard → Purchases → Receipts → [Select GRN] → Approve
   ```

4. **Check for SMS**
   - You should receive an SMS notification on the configured phone numbers
   - Check server logs for confirmation: `[Purchase Approval] SMS notification sent successfully`

## SMS Message Format

When a Purchase Receipt is approved, recipients will receive an SMS like this:

```
✅ PURCHASE APPROVED
PO: PO-202501-0001
GRN: GRN-202501-0001
Supplier: ABC Supplies Inc.
Amount: ₱15,000.00
Items: 5 (100 units)
Location: Main Warehouse
By: John Doe
Jan 17, 02:45 PM
📦 Inventory updated
```

## Cost Considerations

- **Per SMS Cost**: Approximately ₱1.00 per SMS (check current rates at https://semaphore.co/pricing)
- **Bulk Discounts**: Available for high-volume users
- **Multiple Recipients**: Each recipient is charged separately
- **Long Messages**: Messages over 160 characters may be split into multiple SMS

## Troubleshooting

### SMS Not Sending

1. **Check Environment Variables**
   ```bash
   # Verify in Vercel Dashboard or .env.local
   SEMAPHORE_SMS_ENABLED=true
   SMS_ALERT_PURCHASE_APPROVAL_ENABLED=true
   SEMAPHORE_API_KEY=<your_key>
   SEMAPHORE_RECIPIENTS=<phone_numbers>
   ```

2. **Check Server Logs**
   - Look for: `[Purchase Approval] SMS notification sent successfully`
   - Or errors: `[Purchase Approval] Failed to send SMS notification:`

3. **Verify Semaphore Account Balance**
   - Ensure you have sufficient credits in your Semaphore account
   - Check at https://semaphore.co/dashboard

4. **Test API Key**
   ```bash
   curl --data "apikey=YOUR_API_KEY&number=09171234567&message=Test" https://semaphore.co/api/v4/messages
   ```

### SMS Received but Missing Information

- Check that purchase order has all required fields filled
- Verify supplier information is complete
- Ensure location is properly configured

### Multiple SMS Received

- This is normal if you have multiple phone numbers in `SEMAPHORE_RECIPIENTS`
- Each number receives one SMS

## Additional SMS Alerts

The system also supports SMS alerts for:

- 🚨 Location mismatch attempts
- 💼 Shift closing/cash counting
- 💳 Credit sales
- 🚨 Large discounts (configurable threshold)
- 📈 Price changes
- 📦 Stock transfers
- ↩️ Supplier returns
- 📊 Inventory corrections
- ⚠️ Void transactions

Enable these by setting the corresponding environment variables:
```env
SMS_ALERT_SHIFT_CLOSE_ENABLED=true
SMS_ALERT_CREDIT_SALE_ENABLED=true
SMS_ALERT_DISCOUNT_THRESHOLD=100
SMS_ALERT_PRICE_CHANGE_ENABLED=true
SMS_ALERT_TRANSFER_ENABLED=true
SMS_ALERT_SUPPLIER_RETURN_ENABLED=true
SMS_ALERT_LOCATION_MISMATCH_ENABLED=true
```

## Security Best Practices

1. **Keep API Key Secure**
   - Never commit API keys to version control
   - Use environment variables only
   - Rotate keys periodically

2. **Limit Recipients**
   - Only add authorized personnel to `SEMAPHORE_RECIPIENTS`
   - Review recipient list regularly

3. **Monitor Usage**
   - Check Semaphore dashboard for unusual activity
   - Set up low-balance alerts

## Support

- **Semaphore Support**: https://semaphore.co/support
- **API Documentation**: https://semaphore.co/docs
- **Pricing**: https://semaphore.co/pricing

## Related Files

- `src/lib/semaphore.ts` - SMS notification functions
- `src/app/api/purchases/receipts/[id]/approve/route.ts` - Purchase approval with SMS integration

---

**Last Updated**: January 2025
**Version**: 1.0.0
