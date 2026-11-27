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

<b>🔥 CRITICAL ALERTS (Security & Finance):</b>
• 🚨 Large discounts (>${formatCurrency(telegramConfig.discountThreshold)})
• ⚠️ Void transactions
• 🔄 Refund transactions
• 💳 Credit sales
• 💰 Large cash outs (>${formatCurrency(telegramConfig.cashOutThreshold)})
• 🔐 User role/permission changes
• 💼 Shift closings (with discrepancy tracking)

<b>📊 INVENTORY & OPERATIONS:</b>
• 📦 Low stock alerts
• 📊 Inventory corrections
• 📤 Stock transfers between locations
• 📈 Price changes (individual and bulk)
• 🛠️ Product edits

<b>💵 FINANCIAL TRANSACTIONS:</b>
• 💰 Supplier payments (>${formatCurrency(50000)})
• 📋 Expense approvals (>${formatCurrency(5000)})
• 📦 Purchase orders (>${formatCurrency(100000)})
• 💸 Bank transactions (>${formatCurrency(50000)})

<b>⚙️ SYSTEM CHANGES:</b>
• ⚙️ Business settings modifications
• 📝 Customer edits

<i>🎉 Total: 19 types of real-time business alerts!</i>
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
 * Send inventory correction alert
 */
export async function sendTelegramInventoryCorrectionAlert(data: {
  productName: string
  variationName?: string
  sku: string
  previousInventory: number
  currentInventory: number
  difference: number
  reason: string
  remarks?: string
  locationName: string
  correctedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const emoji = data.difference > 0 ? '📈' : data.difference < 0 ? '📉' : '➡️'
  const changeType = data.difference > 0 ? 'ADDED' : data.difference < 0 ? 'REDUCED' : 'NO CHANGE'
  const fullProductName = data.variationName
    ? `${data.productName} - ${data.variationName}`
    : data.productName

  const message = `
${emoji} <b>INVENTORY CORRECTION ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Product:</b> ${fullProductName}
<b>SKU:</b> ${data.sku}
<b>Location:</b> ${data.locationName}

<b>Previous Inventory:</b> ${data.previousInventory} units
<b>Current Inventory:</b> ${data.currentInventory} units
<b>Change:</b> ${data.difference > 0 ? '+' : ''}${data.difference} units (${changeType})

<b>Reason:</b> ${data.reason}
${data.remarks ? `<b>Remarks:</b> ${data.remarks}` : ''}

<b>Corrected By:</b> ${data.correctedBy}
<b>Date:</b> ${formatDateTime(data.timestamp)}

${Math.abs(data.difference) > 100 ? '⚠️ <i>Significant inventory adjustment detected</i>' : 'ℹ️ <i>Inventory correction applied</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send ONE summary alert when a mobile Physical Count Session is approved
 */
export async function sendTelegramPhysicalCountApprovedAlert(data: {
  sessionId: number
  locationName: string
  counters: string
  itemsCounted: number
  itemsPosted: number
  unitsAdded: number
  unitsRemoved: number
  valueImpact: number
  approvedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const message = `
📋 <b>PHYSICAL COUNT APPROVED</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Count Session:</b> #${data.sessionId}
<b>Location:</b> ${data.locationName}
<b>Counted By:</b> ${data.counters}

<b>Items Counted:</b> ${data.itemsCounted}
<b>Items Adjusted:</b> ${data.itemsPosted}
<b>Units Added:</b> +${data.unitsAdded}
<b>Units Removed:</b> -${data.unitsRemoved}
<b>Value Impact:</b> ${formatCurrency(data.valueImpact)}

<b>Approved By:</b> ${data.approvedBy}
<b>Date:</b> ${formatDateTime(data.timestamp)}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send stock transfer alert
 */
export async function sendTelegramStockTransferAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  status: string
  createdBy: string
  timestamp: Date
  items?: Array<{
    productName: string
    variationName?: string
    quantity: number
  }>
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const statusEmoji = data.status === 'completed' ? '✅' : data.status === 'sent' ? '📤' : '📋'
  const itemPreview = data.items && data.items.length > 0
    ? data.items.slice(0, 3).map(item =>
        `  • ${item.productName}${item.variationName ? ` (${item.variationName})` : ''}: ${item.quantity} units`
      ).join('\n')
    : ''

  const message = `
${statusEmoji} <b>STOCK TRANSFER ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Transfer #:</b> ${data.transferNumber}
<b>From:</b> ${data.fromLocation}
<b>To:</b> ${data.toLocation}
<b>Status:</b> ${data.status.toUpperCase()}

<b>Items:</b> ${data.itemCount} products
<b>Total Quantity:</b> ${data.totalQuantity} units

${itemPreview ? `<b>Sample Items:</b>\n${itemPreview}${data.itemCount > 3 ? `\n  ... and ${data.itemCount - 3} more items` : ''}` : ''}

<b>Created By:</b> ${data.createdBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

${data.totalQuantity > 50 ? '⚠️ <i>Large transfer detected - verify authorization</i>' : 'ℹ️ <i>Stock transfer recorded</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send user role/permission change alert
 */
export async function sendTelegramUserRoleChangeAlert(data: {
  userName: string
  userEmail?: string
  previousRole?: string
  newRole?: string
  permissionChanges?: Array<{
    permission: string
    action: 'added' | 'removed'
  }>
  changedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const roleChange = data.previousRole && data.newRole
    ? `<b>Role Change:</b> ${data.previousRole} → ${data.newRole}\n`
    : ''

  const permissionList = data.permissionChanges && data.permissionChanges.length > 0
    ? `<b>Permissions Modified:</b>\n${data.permissionChanges.slice(0, 5).map(p =>
        `  ${p.action === 'added' ? '✅' : '❌'} ${p.permission}`
      ).join('\n')}${data.permissionChanges.length > 5 ? `\n  ... and ${data.permissionChanges.length - 5} more` : ''}\n`
    : ''

  const message = `
🔐 <b>USER ACCESS CHANGE ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>User:</b> ${data.userName}
${data.userEmail ? `<b>Email:</b> ${data.userEmail}\n` : ''}
${roleChange}${permissionList}
<b>Changed By:</b> ${data.changedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

⚠️ <b>SECURITY ALERT</b> - User access level modified
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send supplier payment alert
 */
export async function sendTelegramSupplierPaymentAlert(data: {
  paymentNumber: string
  supplierName: string
  amount: number
  paymentMethod: string
  referenceNumber?: string
  paidBy: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const isLarge = data.amount >= 50000

  const message = `
💰 <b>SUPPLIER PAYMENT ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Payment #:</b> ${data.paymentNumber}
<b>Supplier:</b> ${data.supplierName}
<b>Amount:</b> ${formatCurrency(data.amount)}
<b>Method:</b> ${data.paymentMethod}
${data.referenceNumber ? `<b>Reference:</b> ${data.referenceNumber}\n` : ''}
<b>Paid By:</b> ${data.paidBy}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}

${isLarge ? '⚠️ <i>Large payment detected - verify authorization</i>' : 'ℹ️ <i>Payment processed successfully</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send shift closing alert
 */
export async function sendTelegramShiftClosingAlert(data: {
  shiftNumber: string
  cashierName: string
  locationName: string
  openingCash: number
  expectedCash: number
  actualCash: number
  discrepancy: number
  totalSales: number
  totalTransactions: number
  closedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const hasDiscrepancy = Math.abs(data.discrepancy) > 0
  const isLargeDiscrepancy = Math.abs(data.discrepancy) > 1000 || Math.abs(data.discrepancy) > data.expectedCash * 0.05

  const message = `
💼 <b>SHIFT CLOSING ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Shift #:</b> ${data.shiftNumber}
<b>Cashier:</b> ${data.cashierName}
<b>Location:</b> ${data.locationName}

<b>Opening Cash:</b> ${formatCurrency(data.openingCash)}
<b>Expected Cash:</b> ${formatCurrency(data.expectedCash)}
<b>Actual Cash:</b> ${formatCurrency(data.actualCash)}
${hasDiscrepancy ? `<b>Discrepancy:</b> ${data.discrepancy > 0 ? '+' : ''}${formatCurrency(data.discrepancy)}\n` : ''}
<b>Total Sales:</b> ${formatCurrency(data.totalSales)}
<b>Transactions:</b> ${data.totalTransactions}

<b>Closed By:</b> ${data.closedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

${isLargeDiscrepancy ? '🚨 <b>LARGE DISCREPANCY DETECTED</b> - Immediate review required!' : hasDiscrepancy ? '⚠️ <i>Cash discrepancy detected</i>' : '✅ <i>Shift closed successfully - no discrepancy</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send business settings change alert
 */
export async function sendTelegramBusinessSettingsChangeAlert(data: {
  businessName: string
  changes: Array<{
    setting: string
    oldValue: string
    newValue: string
  }>
  changedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const changesList = data.changes.slice(0, 5).map(change =>
    `  • <b>${change.setting}:</b>\n    ${change.oldValue} → ${change.newValue}`
  ).join('\n')

  const message = `
⚙️ <b>BUSINESS SETTINGS CHANGE ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Business:</b> ${data.businessName}

<b>Settings Modified:</b>
${changesList}${data.changes.length > 5 ? `\n  ... and ${data.changes.length - 5} more changes` : ''}

<b>Changed By:</b> ${data.changedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

⚠️ <b>CONFIGURATION CHANGE</b> - May affect system behavior
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send expense approval alert
 */
export async function sendTelegramExpenseApprovalAlert(data: {
  expenseNumber: string
  amount: number
  category: string
  description: string
  expenseDate: Date
  submittedBy: string
  approvedBy: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const isLarge = data.amount >= 5000

  const message = `
📋 <b>EXPENSE APPROVAL ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Expense #:</b> ${data.expenseNumber}
<b>Amount:</b> ${formatCurrency(data.amount)}
<b>Category:</b> ${data.category}
<b>Description:</b> ${data.description}
<b>Expense Date:</b> ${formatDateTime(data.expenseDate)}

<b>Submitted By:</b> ${data.submittedBy}
<b>Approved By:</b> ${data.approvedBy}
<b>Location:</b> ${data.locationName}
<b>Approval Time:</b> ${formatDateTime(data.timestamp)}

${isLarge ? '⚠️ <i>Large expense approved - verify justification</i>' : 'ℹ️ <i>Expense approved successfully</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send purchase order alert
 */
export async function sendTelegramPurchaseOrderAlert(data: {
  poNumber: string
  supplierName: string
  totalAmount: number
  itemCount: number
  status: string
  deliveryDate?: Date
  createdBy: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const isLarge = data.totalAmount >= 100000

  const message = `
📦 <b>PURCHASE ORDER ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>PO #:</b> ${data.poNumber}
<b>Supplier:</b> ${data.supplierName}
<b>Amount:</b> ${formatCurrency(data.totalAmount)}
<b>Items:</b> ${data.itemCount} products
<b>Status:</b> ${data.status.toUpperCase()}
${data.deliveryDate ? `<b>Delivery Date:</b> ${formatDateTime(data.deliveryDate)}\n` : ''}
<b>Created By:</b> ${data.createdBy}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}

${isLarge ? '⚠️ <i>Large purchase order - significant inventory investment</i>' : 'ℹ️ <i>Purchase order created</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send bank transaction alert
 */
export async function sendTelegramBankTransactionAlert(data: {
  transactionNumber: string
  bankName: string
  transactionType: 'deposit' | 'withdrawal' | 'transfer'
  amount: number
  referenceNumber?: string
  description: string
  recordedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const isLarge = data.amount >= 50000
  const emoji = data.transactionType === 'deposit' ? '💵' : data.transactionType === 'withdrawal' ? '💸' : '🔄'

  const message = `
${emoji} <b>BANK TRANSACTION ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Transaction #:</b> ${data.transactionNumber}
<b>Bank:</b> ${data.bankName}
<b>Type:</b> ${data.transactionType.toUpperCase()}
<b>Amount:</b> ${formatCurrency(data.amount)}
${data.referenceNumber ? `<b>Reference:</b> ${data.referenceNumber}\n` : ''}
<b>Description:</b> ${data.description}

<b>Recorded By:</b> ${data.recordedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

${isLarge ? '⚠️ <i>Large bank transaction - verify against bank statement</i>' : 'ℹ️ <i>Bank transaction recorded</i>'}
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send supplier return alert
 */
export async function sendTelegramSupplierReturnAlert(data: {
  returnNumber: string
  supplierName: string
  totalAmount: number
  itemCount: number
  reason: string
  status: string
  createdBy: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const message = `
↩️ <b>SUPPLIER RETURN ALERT</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Return #:</b> ${data.returnNumber}
<b>Supplier:</b> ${data.supplierName}
<b>Amount:</b> ${formatCurrency(data.totalAmount)}
<b>Items:</b> ${data.itemCount} products
<b>Reason:</b> ${data.reason}
<b>Status:</b> ${data.status.toUpperCase()}

<b>Created By:</b> ${data.createdBy}
<b>Location:</b> ${data.locationName}
<b>Time:</b> ${formatDateTime(data.timestamp)}

⚠️ <i>Supplier return created - pending approval</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send transfer rejection alert
 */
export async function sendTelegramTransferRejectionAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  rejectedBy: string
  rejectionReason: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const message = `
❌ <b>TRANSFER REJECTED</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>TRN #:</b> ${data.transferNumber}
<b>From:</b> ${data.fromLocation}
<b>To:</b> ${data.toLocation}
<b>Status:</b> REJECTED - Returned to Draft

<b>Items:</b> ${data.itemCount} products
<b>Total Quantity:</b> ${data.totalQuantity} units

<b>Rejected By:</b> ${data.rejectedBy}
<b>Rejection Reason:</b> ${data.rejectionReason}
<b>Time:</b> ${formatDateTime(data.timestamp)}

⚠️ <i>Transfer returned to creator for corrections</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send transfer approval alert (origin checker approved)
 */
export async function sendTelegramTransferApprovalAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  approvedBy: string
  notes?: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const message = `
✅ <b>TRANSFER APPROVED</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>TRN #:</b> ${data.transferNumber}
<b>From:</b> ${data.fromLocation}
<b>To:</b> ${data.toLocation}
<b>Status:</b> CHECKED - Ready to Send

<b>Items:</b> ${data.itemCount} products
<b>Total Quantity:</b> ${data.totalQuantity} units

<b>Approved By:</b> ${data.approvedBy}
${data.notes ? `<b>Notes:</b> ${data.notes}` : ''}
<b>Time:</b> ${formatDateTime(data.timestamp)}

✅ <i>Transfer verified and approved - ready for shipment</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send transfer acceptance/completion alert (receiving location accepted)
 */
export async function sendTelegramTransferAcceptanceAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  acceptedBy: string
  notes?: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const message = `
📦 <b>TRANSFER COMPLETED</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>TRN #:</b> ${data.transferNumber}
<b>From:</b> ${data.fromLocation}
<b>To:</b> ${data.toLocation}
<b>Status:</b> COMPLETED ✓

<b>Items:</b> ${data.itemCount} products
<b>Total Quantity:</b> ${data.totalQuantity} units

<b>Accepted By:</b> ${data.acceptedBy}
${data.notes ? `<b>Notes:</b> ${data.notes}` : ''}
<b>Time:</b> ${formatDateTime(data.timestamp)}

✅ <i>Transfer completed - stock added to destination</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send location-specific price change alert
 */
export async function sendTelegramLocationPriceChangeAlert(data: {
  productName: string
  productSku: string
  locationName: string
  priceType: 'purchase' | 'selling' | 'both'
  oldPurchasePrice?: number
  newPurchasePrice?: number
  oldSellingPrice?: number
  newSellingPrice?: number
  changedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  let priceChanges = ''

  if (data.priceType === 'purchase' || data.priceType === 'both') {
    if (data.oldPurchasePrice !== undefined && data.newPurchasePrice !== undefined) {
      const change = data.newPurchasePrice - data.oldPurchasePrice
      const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️'
      priceChanges += `${emoji} <b>Purchase Price:</b> ${formatCurrency(data.oldPurchasePrice)} → ${formatCurrency(data.newPurchasePrice)}\n`
    }
  }

  if (data.priceType === 'selling' || data.priceType === 'both') {
    if (data.oldSellingPrice !== undefined && data.newSellingPrice !== undefined) {
      const change = data.newSellingPrice - data.oldSellingPrice
      const emoji = change > 0 ? '📈' : change < 0 ? '📉' : '➡️'
      priceChanges += `${emoji} <b>Selling Price:</b> ${formatCurrency(data.oldSellingPrice)} → ${formatCurrency(data.newSellingPrice)}\n`
    }
  }

  const message = `
💵 <b>LOCATION PRICE CHANGE</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Product:</b> ${data.productName}
<b>SKU:</b> ${data.productSku}
<b>Location:</b> ${data.locationName}

${priceChanges}
<b>Changed By:</b> ${data.changedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

ℹ️ <i>Location-specific pricing updated</i>
  `.trim()

  return sendTelegramMessage(message)
}

/**
 * Send bulk location price changes alert
 */
export async function sendTelegramBulkLocationPriceChangeAlert(data: {
  changedBy: string
  totalChanges: number
  locations: string[]
  productName?: string
  timestamp: Date
}): Promise<boolean> {
  if (!telegramConfig.enabled) {
    return false
  }

  const locationList = data.locations.slice(0, 5).join(', ')
  const moreLocations = data.locations.length > 5 ? ` +${data.locations.length - 5} more` : ''

  const message = `
📊 <b>BULK LOCATION PRICE UPDATE</b>
━━━━━━━━━━━━━━━━━━━━━━━━━━
${data.productName ? `<b>Product:</b> ${data.productName}\n` : ''}
<b>Total Changes:</b> ${data.totalChanges}
<b>Locations:</b> ${locationList}${moreLocations}

<b>Changed By:</b> ${data.changedBy}
<b>Time:</b> ${formatDateTime(data.timestamp)}

⚠️ <i>Multiple location prices updated</i>
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
