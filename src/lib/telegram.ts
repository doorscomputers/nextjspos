/**
 * Telegram Notification Service for IgoroTechPOS
 *
 * Sends instant alerts to Telegram for critical business events:
 * - Large discounts
 * - Void transactions
 * - Refund transactions
 * - Credit sales
 * - Large cash outs
 * - Low stock alerts
 *
 * 100% FREE - Unlimited messages
 *
 * Setup:
 * 1. Create bot via @BotFather on Telegram
 * 2. Admin starts chat with bot (/start)
 * 3. Get Chat ID from: https://api.telegram.org/bot<TOKEN>/getUpdates
 * 4. Add TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS to .env
 */

// Configuration
const telegramConfig = {
  enabled: process.env.TELEGRAM_NOTIFICATIONS_ENABLED === 'true',
  botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  chatIds: (process.env.TELEGRAM_CHAT_IDS || '').split(',').filter(Boolean),
  discountThreshold: parseFloat(process.env.TELEGRAM_ALERT_DISCOUNT_THRESHOLD || '1000'),
  voidEnabled: process.env.TELEGRAM_ALERT_VOID_ENABLED === 'true',
  refundEnabled: process.env.TELEGRAM_ALERT_REFUND_ENABLED === 'true',
  creditEnabled: process.env.TELEGRAM_ALERT_CREDIT_ENABLED === 'true',
  cashOutThreshold: parseFloat(process.env.TELEGRAM_ALERT_CASH_OUT_THRESHOLD || '5000'),
  lowStockEnabled: process.env.TELEGRAM_ALERT_LOW_STOCK_ENABLED === 'true',
}

interface DiscountAlertData {
  discountAmount: number
  subtotal: number
  cashierName: string
  locationName: string
  invoiceNumber?: string
}

/**
 * Check if Telegram is configured
 */
export function isTelegramConfigured(): boolean {
  return !!(
    telegramConfig.enabled &&
    telegramConfig.botToken &&
    telegramConfig.chatIds.length > 0
  )
}

/**
 * Send a message via Telegram Bot API to all configured chat IDs
 *
 * @param message - Message text (supports HTML formatting)
 * @returns Promise<boolean> - Success status
 */
async function sendTelegramMessage(message: string): Promise<boolean> {
  if (!isTelegramConfigured()) {
    console.log('[Telegram] Not configured, skipping notification')
    return false
  }

  try {
    const promises = telegramConfig.chatIds.map((chatId) =>
      fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      })
    )

    const responses = await Promise.all(promises)
    const results = await Promise.all(responses.map((r) => r.json()))

    const allSuccessful = results.every((r) => r.ok)

    if (allSuccessful) {
      console.log(`[Telegram] Message sent to ${telegramConfig.chatIds.length} recipient(s)`)
    } else {
      console.error('[Telegram] Some messages failed:', results)
    }

    return allSuccessful
  } catch (error: any) {
    console.error('[Telegram] Network error:', error.message || error)
    return false
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format date and time for display
 */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Send large discount alert
 */
export async function sendTelegramLargeDiscountAlert(data: {
  saleNumber: string
  discountAmount: number
  discountType: string
  totalAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason?: string
}): Promise<boolean> {
  if (!telegramConfig.enabled || data.discountAmount < telegramConfig.discountThreshold) {
    return false
  }

  const discountPercent = ((data.discountAmount / (data.totalAmount + data.discountAmount)) * 100).toFixed(1)

  const message = `
🚨 <b>LARGE DISCOUNT ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Sale:</b> ${data.saleNumber}
<b>Discount:</b> ${formatCurrency(data.discountAmount)} (${discountPercent}%)
<b>Type:</b> ${data.discountType}
<b>Total:</b> ${formatCurrency(data.totalAmount)}
<b>Cashier:</b> ${data.cashierName}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}
${data.reason ? `<b>Reason:</b> ${data.reason}` : ''}

⚠️ <i>This discount exceeds the threshold of ${formatCurrency(telegramConfig.discountThreshold)}</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send void transaction alert
 */
export async function sendTelegramVoidTransactionAlert(data: {
  saleNumber: string
  totalAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason: string
  itemCount: number
}): Promise<boolean> {
  if (!telegramConfig.enabled || !telegramConfig.voidEnabled) {
    return false
  }

  const message = `
⚠️ <b>VOID TRANSACTION ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Sale:</b> ${data.saleNumber}
<b>Amount:</b> ${formatCurrency(data.totalAmount)}
<b>Items:</b> ${data.itemCount}
<b>Cashier:</b> ${data.cashierName}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}
<b>Reason:</b> ${data.reason}

🔒 <i>This transaction was voided and requires manager authorization</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send refund transaction alert
 */
export async function sendTelegramRefundTransactionAlert(data: {
  saleNumber: string
  refundAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason: string
  itemCount: number
  originalSaleDate: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled || !telegramConfig.refundEnabled) {
    return false
  }

  const message = `
🔄 <b>REFUND TRANSACTION ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Original Sale:</b> ${data.saleNumber}
<b>Refund Amount:</b> ${formatCurrency(data.refundAmount)}
<b>Items:</b> ${data.itemCount}
<b>Cashier:</b> ${data.cashierName}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}
<b>Original Sale Date:</b> ${formatDateTime(data.originalSaleDate)}
<b>Reason:</b> ${data.reason}

🔒 <i>This refund was processed with manager authorization</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send credit sale alert
 */
export async function sendTelegramCreditSaleAlert(data: {
  saleNumber: string
  creditAmount: number
  customerName: string
  cashierName: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled || !telegramConfig.creditEnabled) {
    return false
  }

  const message = `
💳 <b>CREDIT SALE ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Sale:</b> ${data.saleNumber}
<b>Credit Amount:</b> ${formatCurrency(data.creditAmount)}
<b>Customer:</b> ${data.customerName}
<b>Cashier:</b> ${data.cashierName}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}

📋 <i>This sale was completed on credit terms</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send large cash out alert
 */
export async function sendTelegramLargeCashOutAlert(data: {
  amount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason: string
}): Promise<boolean> {
  if (!telegramConfig.enabled || data.amount < telegramConfig.cashOutThreshold) {
    return false
  }

  const message = `
💰 <b>LARGE CASH OUT ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Amount:</b> ${formatCurrency(data.amount)}
<b>Cashier:</b> ${data.cashierName}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}
<b>Reason:</b> ${data.reason}

⚠️ <i>This cash withdrawal exceeds the threshold of ${formatCurrency(telegramConfig.cashOutThreshold)}</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send low stock alert
 */
export async function sendTelegramLowStockAlert(data: {
  productName: string
  sku: string
  currentStock: number
  reorderLevel: number
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled || !telegramConfig.lowStockEnabled) {
    return false
  }

  const stockPercent = data.reorderLevel > 0
    ? ((data.currentStock / data.reorderLevel) * 100).toFixed(0)
    : '0'

  const message = `
📦 <b>LOW STOCK ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Product:</b> ${data.productName}
<b>SKU:</b> ${data.sku}
<b>Current Stock:</b> ${data.currentStock} units
<b>Reorder Level:</b> ${data.reorderLevel} units
<b>Stock Level:</b> ${stockPercent}% of reorder point
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}

⚠️ <i>This product has reached its reorder point</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send test message
 */
export async function sendTelegramTestMessage(): Promise<boolean> {
  const message = `
✅ <b>IgoroTechPOS - Telegram Test</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Status:</b> Connection Successful ✓
<b>Time:</b> ${formatDateTime(new Date())}

Your Telegram bot is configured correctly and ready to send notifications!

<i>You will now receive instant alerts for:</i>
• 🚨 Large discounts (>${formatCurrency(telegramConfig.discountThreshold)})
• ⚠️ Void transactions
• 🔄 Refund transactions
• 💳 Credit sales
• 💰 Large cash outs (>${formatCurrency(telegramConfig.cashOutThreshold)})
• 📦 Low stock alerts
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send price change alert
 */
export async function sendTelegramPriceChangeAlert(data: {
  locationName: string
  productName: string
  productSku: string
  oldPrice: number
  newPrice: number
  changedBy: string
  changeType?: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const priceChange = data.newPrice - data.oldPrice
  const percentChange = data.oldPrice > 0
    ? ((priceChange / data.oldPrice) * 100).toFixed(2)
    : 'N/A'

  const emoji = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️'
  const changeTypeLabel = data.changeType || 'Individual Update'

  const message = `
${emoji} <b>PRICE CHANGE ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Location:</b> ${data.locationName}
<b>Product:</b> ${data.productName}
<b>SKU:</b> ${data.productSku}

<b>Old Price:</b> ${formatCurrency(data.oldPrice)}
<b>New Price:</b> ${formatCurrency(data.newPrice)}
<b>Change:</b> ${priceChange >= 0 ? '+' : ''}${formatCurrency(Math.abs(priceChange))} (${percentChange}%)

<b>Changed By:</b> ${data.changedBy}
<b>Change Type:</b> ${changeTypeLabel}
<b>Time:</b> ${formatDateTime(data.timestamp)}

${Math.abs(priceChange) > 1000 ? '⚠️ <i>Significant price change detected</i>' : ''}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send bulk price change summary alert
 */
export async function sendTelegramBulkPriceChangeAlert(data: {
  changedBy: string
  totalProducts: number
  locationName?: string
  changeType: string
  timestamp: Date
  sampleChanges: Array<{
    productName: string
    productSku: string
    oldPrice: number
    newPrice: number
  }>
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const preview = data.sampleChanges.slice(0, 5).map((change, index) => {
    const priceChange = change.newPrice - change.oldPrice
    const emoji = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️'
    return `${index + 1}. ${emoji} ${change.productName} (${change.productSku}): ${formatCurrency(change.oldPrice)} → ${formatCurrency(change.newPrice)}`
  }).join('\n')

  const message = `
📊 <b>BULK PRICE UPDATE ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Total Products Changed:</b> ${data.totalProducts}
<b>Changed By:</b> ${data.changedBy}
${data.locationName ? `<b>Location:</b> ${data.locationName}` : ''}
<b>Change Type:</b> ${data.changeType}
<b>Time:</b> ${formatDateTime(data.timestamp)}

<b>Sample Changes:</b>
${preview}${data.totalProducts > 5 ? `\n\n... and ${data.totalProducts - 5} more products` : ''}

⚠️ <i>Bulk price update completed</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send customer edit alert
 */
export async function sendTelegramCustomerEditAlert(data: {
  previousName: string
  currentName: string
  changedBy: string
  timestamp: Date
  customerDetails?: {
    mobile?: string
    email?: string
    address?: string
  }
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const message = `
📝 <b>CUSTOMER EDIT ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Previous Name:</b> ${data.previousName}
<b>Current Name:</b> ${data.currentName}
${data.customerDetails?.mobile ? `<b>Mobile:</b> ${data.customerDetails.mobile}` : ''}
${data.customerDetails?.email ? `<b>Email:</b> ${data.customerDetails.email}` : ''}
${data.customerDetails?.address ? `<b>Address:</b> ${data.customerDetails.address}` : ''}

<b>Changed By:</b> ${data.changedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

ℹ️ <i>Customer information was updated</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send product edit alert
 */
export async function sendTelegramProductEditAlert(data: {
  productName: string
  sku: string
  changedBy: string
  timestamp: Date
  changes: {
    field: string
    oldValue: string
    newValue: string
  }[]
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const changesText = data.changes.map(change =>
    `• <b>${change.field}:</b> ${change.oldValue} → ${change.newValue}`
  ).join('\n')

  const message = `
🛠️ <b>PRODUCT EDIT ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Product:</b> ${data.productName}
<b>SKU:</b> ${data.sku}

<b>Changes Made:</b>
${changesText}

<b>Changed By:</b> ${data.changedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

ℹ️ <i>Product information was updated</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Get bot information (for testing)
 */
export async function getTelegramBotInfo(): Promise<any> {
  if (!isTelegramConfigured()) {
    throw new Error('Telegram bot not configured')
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${telegramConfig.botToken}/getMe`
    )
    const data = await response.json()

    if (!data.ok) {
      throw new Error(data.description || 'Failed to get bot info')
    }

    return data.result
  } catch (error: any) {
    throw new Error(`Failed to get bot info: ${error.message}`)
  }
}
