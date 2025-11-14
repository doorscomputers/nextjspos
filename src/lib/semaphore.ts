/**
 * Semaphore SMS Notification Service for IgoroTechPOS
 *
 * Sends instant SMS alerts via Semaphore.co for critical business events:
 * - Location mismatch
 * - Shift closing
 * - Credit/Charge invoice transactions
 * - Large discounts (> ₱100)
 * - Price changes
 * - Transfer alerts
 * - Return to suppliers
 *
 * API: https://semaphore.co/
 * Pricing: Pay-as-you-go, ~₱1.00 per SMS
 */

// Configuration
const semaphoreConfig = {
  enabled: process.env.SEMAPHORE_SMS_ENABLED === 'true',
  apiKey: process.env.SEMAPHORE_API_KEY || '',
  apiUrl: 'https://api.semaphore.co/api/v4/messages',
  senderName: process.env.SEMAPHORE_SENDER_NAME || 'IgoroTechPOS',
  // Comma-separated phone numbers (e.g., "09171234567,09181234567")
  recipients: (process.env.SEMAPHORE_RECIPIENTS || '').split(',').filter(Boolean),
  discountThreshold: parseFloat(process.env.SMS_ALERT_DISCOUNT_THRESHOLD || '100'),
  creditSaleEnabled: process.env.SMS_ALERT_CREDIT_SALE_ENABLED === 'true',
  priceChangeEnabled: process.env.SMS_ALERT_PRICE_CHANGE_ENABLED === 'true',
  transferEnabled: process.env.SMS_ALERT_TRANSFER_ENABLED === 'true',
  supplierReturnEnabled: process.env.SMS_ALERT_SUPPLIER_RETURN_ENABLED === 'true',
  shiftCloseEnabled: process.env.SMS_ALERT_SHIFT_CLOSE_ENABLED === 'true',
  locationMismatchEnabled: process.env.SMS_ALERT_LOCATION_MISMATCH_ENABLED === 'true',
}

/**
 * Check if Semaphore SMS is configured
 */
export function isSemaphoreConfigured(): boolean {
  return !!(
    semaphoreConfig.enabled &&
    semaphoreConfig.apiKey &&
    semaphoreConfig.recipients.length > 0
  )
}

/**
 * Send SMS via Semaphore API to all configured recipients
 *
 * @param message - Message text (max 1600 chars for long SMS)
 * @returns Promise<boolean> - Success status
 */
async function sendSemaphoreSMS(message: string): Promise<boolean> {
  if (!isSemaphoreConfigured()) {
    console.log('[Semaphore] Not configured, skipping SMS')
    return false
  }

  // Truncate message if too long (Semaphore supports up to 1600 chars for long SMS)
  const smsMessage = message.length > 1600 ? message.substring(0, 1597) + '...' : message

  try {
    const promises = semaphoreConfig.recipients.map((recipient) =>
      fetch(semaphoreConfig.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          apikey: semaphoreConfig.apiKey,
          number: recipient.trim(),
          message: smsMessage,
          sendername: semaphoreConfig.senderName,
        }).toString(),
      })
    )

    const responses = await Promise.all(promises)
    const results = await Promise.all(responses.map((r) => r.json()))

    // Semaphore returns: { message_id, user_id, user, account_id, account, recipient, message, sender_name, network, status, type, source, created_at, updated_at }
    const allSuccessful = results.every((r) => r.status === 'Pending' || r.status === 'Queued' || r.message_id)

    if (allSuccessful) {
      console.log(`[Semaphore] SMS sent to ${semaphoreConfig.recipients.length} recipient(s)`)
    } else {
      console.error('[Semaphore] Some SMS failed:', results)
    }

    return allSuccessful
  } catch (error: any) {
    console.error('[Semaphore] Network error:', error.message || error)
    return false
  }
}

/**
 * Format currency for display
 */
function formatCurrency(amount: number): string {
  return `P${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * Format date and time for display
 */
function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

/**
 * Send location mismatch alert
 */
export async function sendSemaphoreLocationMismatchAlert(data: {
  userName: string
  attemptedLocation: string
  assignedLocations: string[]
  ipAddress?: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.locationMismatchEnabled) {
    return false
  }

  const locationList = data.assignedLocations.slice(0, 2).join(', ')
  const moreLocations = data.assignedLocations.length > 2 ? ` +${data.assignedLocations.length - 2}` : ''

  const message = `🚨 LOCATION MISMATCH
User: ${data.userName}
Attempted: ${data.attemptedLocation}
Allowed: ${locationList}${moreLocations}
${data.ipAddress ? `IP: ${data.ipAddress}\n` : ''}Time: ${formatDateTime(data.timestamp)}
⚠️ Unauthorized location access attempt!`

  return sendSemaphoreSMS(message)
}

/**
 * Send shift closing alert
 */
export async function sendSemaphoreShiftClosingAlert(data: {
  shiftNumber: string
  cashierName: string
  locationName: string
  expectedCash: number
  actualCash: number
  discrepancy: number
  totalSales: number
  closedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.shiftCloseEnabled) {
    return false
  }

  const hasDiscrepancy = Math.abs(data.discrepancy) > 0
  const isLargeDiscrepancy = Math.abs(data.discrepancy) > 1000

  const message = `💼 SHIFT CLOSED
Shift: ${data.shiftNumber}
Cashier: ${data.cashierName}
Location: ${data.locationName}
Expected: ${formatCurrency(data.expectedCash)}
Actual: ${formatCurrency(data.actualCash)}
${hasDiscrepancy ? `Variance: ${data.discrepancy > 0 ? '+' : ''}${formatCurrency(data.discrepancy)}\n` : ''}Sales: ${formatCurrency(data.totalSales)}
By: ${data.closedBy}
${formatDateTime(data.timestamp)}
${isLargeDiscrepancy ? '🚨 LARGE DISCREPANCY!' : hasDiscrepancy ? '⚠️ Cash variance detected' : '✅ Balanced'}`

  return sendSemaphoreSMS(message)
}

/**
 * Send credit sale alert
 */
export async function sendSemaphoreCreditSaleAlert(data: {
  saleNumber: string
  creditAmount: number
  customerName: string
  cashierName: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.creditSaleEnabled) {
    return false
  }

  const message = `💳 CREDIT SALE
Invoice: ${data.saleNumber}
Amount: ${formatCurrency(data.creditAmount)}
Customer: ${data.customerName}
Cashier: ${data.cashierName}
Location: ${data.locationName}
${formatDateTime(data.timestamp)}
📋 Sale on credit terms`

  return sendSemaphoreSMS(message)
}

/**
 * Send large discount alert
 */
export async function sendSemaphoreLargeDiscountAlert(data: {
  saleNumber: string
  discountAmount: number
  discountType: string
  totalAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || data.discountAmount < semaphoreConfig.discountThreshold) {
    return false
  }

  const discountPercent = ((data.discountAmount / (data.totalAmount + data.discountAmount)) * 100).toFixed(1)

  const message = `🚨 LARGE DISCOUNT
Sale: ${data.saleNumber}
Discount: ${formatCurrency(data.discountAmount)} (${discountPercent}%)
Type: ${data.discountType}
Total: ${formatCurrency(data.totalAmount)}
Cashier: ${data.cashierName}
Location: ${data.locationName}
${formatDateTime(data.timestamp)}
⚠️ Exceeds P${semaphoreConfig.discountThreshold} threshold`

  return sendSemaphoreSMS(message)
}

/**
 * Send price change alert
 */
export async function sendSemaphorePriceChangeAlert(data: {
  productName: string
  productSku: string
  locationName: string
  oldPrice: number
  newPrice: number
  changedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.priceChangeEnabled) {
    return false
  }

  const priceChange = data.newPrice - data.oldPrice
  const percentChange = data.oldPrice > 0
    ? ((priceChange / data.oldPrice) * 100).toFixed(1)
    : 'N/A'

  const emoji = priceChange > 0 ? '📈' : priceChange < 0 ? '📉' : '➡️'

  // Truncate product name if too long
  const productName = data.productName.length > 30
    ? data.productName.substring(0, 27) + '...'
    : data.productName

  const message = `${emoji} PRICE CHANGE
Product: ${productName}
SKU: ${data.productSku}
Location: ${data.locationName}
Old: ${formatCurrency(data.oldPrice)}
New: ${formatCurrency(data.newPrice)}
Change: ${priceChange >= 0 ? '+' : ''}${formatCurrency(Math.abs(priceChange))} (${percentChange}%)
By: ${data.changedBy}
${formatDateTime(data.timestamp)}`

  return sendSemaphoreSMS(message)
}

/**
 * Send stock transfer alert
 */
export async function sendSemaphoreStockTransferAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  status: string
  createdBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.transferEnabled) {
    return false
  }

  const statusEmoji = data.status === 'completed' ? '✅' : data.status === 'sent' ? '📤' : '📋'

  const message = `${statusEmoji} STOCK TRANSFER
TRN: ${data.transferNumber}
From: ${data.fromLocation}
To: ${data.toLocation}
Status: ${data.status.toUpperCase()}
Items: ${data.itemCount} products
Qty: ${data.totalQuantity} units
By: ${data.createdBy}
${formatDateTime(data.timestamp)}
${data.totalQuantity > 50 ? '⚠️ Large transfer' : ''}`

  return sendSemaphoreSMS(message)
}

/**
 * Send supplier return alert
 */
export async function sendSemaphoreSupplierReturnAlert(data: {
  returnNumber: string
  supplierName: string
  totalAmount: number
  itemCount: number
  reason: string
  createdBy: string
  locationName: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.supplierReturnEnabled) {
    return false
  }

  // Truncate supplier name and reason if too long
  const supplierName = data.supplierName.length > 25
    ? data.supplierName.substring(0, 22) + '...'
    : data.supplierName

  const reason = data.reason.length > 30
    ? data.reason.substring(0, 27) + '...'
    : data.reason

  const message = `↩️ SUPPLIER RETURN
Return: ${data.returnNumber}
Supplier: ${supplierName}
Amount: ${formatCurrency(data.totalAmount)}
Items: ${data.itemCount}
Reason: ${reason}
By: ${data.createdBy}
Location: ${data.locationName}
${formatDateTime(data.timestamp)}
⚠️ Pending approval`

  return sendSemaphoreSMS(message)
}

/**
 * Send transfer rejection alert
 */
export async function sendSemaphoreTransferRejectionAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  rejectedBy: string
  rejectionReason: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.transferEnabled) {
    return false
  }

  const reason = data.rejectionReason.length > 40
    ? data.rejectionReason.substring(0, 37) + '...'
    : data.rejectionReason

  const message = `❌ TRANSFER REJECTED
TRN: ${data.transferNumber}
From: ${data.fromLocation}
To: ${data.toLocation}
By: ${data.rejectedBy}
Reason: ${reason}
${formatDateTime(data.timestamp)}
⚠️ Returned to draft`

  return sendSemaphoreSMS(message)
}

/**
 * Send transfer approval alert
 */
export async function sendSemaphoreTransferApprovalAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  approvedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.transferEnabled) {
    return false
  }

  const message = `✅ TRANSFER APPROVED
TRN: ${data.transferNumber}
From: ${data.fromLocation}
To: ${data.toLocation}
Items: ${data.itemCount}
By: ${data.approvedBy}
${formatDateTime(data.timestamp)}
✅ Ready to send`

  return sendSemaphoreSMS(message)
}

/**
 * Send transfer acceptance/completion alert
 */
export async function sendSemaphoreTransferAcceptanceAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  acceptedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled || !semaphoreConfig.transferEnabled) {
    return false
  }

  const message = `📦 TRANSFER COMPLETED
TRN: ${data.transferNumber}
From: ${data.fromLocation}
To: ${data.toLocation}
Items: ${data.itemCount}
By: ${data.acceptedBy}
${formatDateTime(data.timestamp)}
✅ Stock added to destination`

  return sendSemaphoreSMS(message)
}

/**
 * Send inventory correction alert
 */
export async function sendSemaphoreInventoryCorrectionAlert(data: {
  productName: string
  sku: string
  previousInventory: number
  currentInventory: number
  difference: number
  reason: string
  locationName: string
  correctedBy: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled) {
    return false
  }

  const emoji = data.difference > 0 ? '📈' : data.difference < 0 ? '📉' : '➡️'
  const changeType = data.difference > 0 ? 'ADDED' : 'REDUCED'

  const productName = data.productName.length > 25
    ? data.productName.substring(0, 22) + '...'
    : data.productName

  const reason = data.reason.length > 30
    ? data.reason.substring(0, 27) + '...'
    : data.reason

  const message = `${emoji} INVENTORY CORRECTION
Product: ${productName}
SKU: ${data.sku}
Location: ${data.locationName}
Previous: ${data.previousInventory}
Current: ${data.currentInventory}
Change: ${data.difference > 0 ? '+' : ''}${data.difference} (${changeType})
Reason: ${reason}
By: ${data.correctedBy}
${formatDateTime(data.timestamp)}
${Math.abs(data.difference) > 100 ? '⚠️ Large adjustment' : ''}`

  return sendSemaphoreSMS(message)
}

/**
 * Send void transaction alert
 */
export async function sendSemaphoreVoidTransactionAlert(data: {
  saleNumber: string
  totalAmount: number
  cashierName: string
  locationName: string
  reason: string
  timestamp: Date
}): Promise<boolean> {
  if (!semaphoreConfig.enabled) {
    return false
  }

  const reason = data.reason.length > 35
    ? data.reason.substring(0, 32) + '...'
    : data.reason

  const message = `⚠️ VOID TRANSACTION
Sale: ${data.saleNumber}
Amount: ${formatCurrency(data.totalAmount)}
Cashier: ${data.cashierName}
Location: ${data.locationName}
Reason: ${reason}
${formatDateTime(data.timestamp)}
🔒 Manager authorized`

  return sendSemaphoreSMS(message)
}

/**
 * Send test SMS
 */
export async function sendSemaphoreTestMessage(): Promise<boolean> {
  const message = `✅ IgoroTechPOS SMS Test
Status: Connected ✓
Time: ${formatDateTime(new Date())}

SMS alerts configured for:
- Location mismatch
- Shift closing
- Credit sales
- Large discounts (>P${semaphoreConfig.discountThreshold})
- Price changes
- Stock transfers
- Supplier returns

Recipients: ${semaphoreConfig.recipients.length}
Ready to send alerts!`

  return sendSemaphoreSMS(message)
}

/**
 * Get account balance from Semaphore (for monitoring)
 */
export async function getSemaphoreBalance(): Promise<{ balance: number; currency: string } | null> {
  if (!isSemaphoreConfigured()) {
    return null
  }

  try {
    const response = await fetch(
      `https://api.semaphore.co/api/v4/account?apikey=${semaphoreConfig.apiKey}`
    )
    const data = await response.json()

    if (data && data.credit_balance !== undefined) {
      return {
        balance: parseFloat(data.credit_balance),
        currency: 'PHP',
      }
    }

    return null
  } catch (error: any) {
    console.error('[Semaphore] Failed to get balance:', error.message)
    return null
  }
}
