/**
 * Unified Alert Service
 *
 * Sends external alerts via both Telegram and SMS (Semaphore) simultaneously.
 * Each alert function wraps both services and handles errors gracefully.
 *
 * This is different from src/lib/notifications.ts which handles in-app database notifications.
 */

import * as Telegram from './telegram'
import * as SMS from './semaphore'

// ============================================
// Location Mismatch Alert
// ============================================

export async function sendLocationMismatchAlert(data: {
  username: string
  userLocation: string
  loginLocation: string
  ipAddress: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramLocationMismatchAlert(data).catch(err =>
      console.error('[AlertService] Telegram location mismatch alert failed:', err)
    ),
    SMS.sendSemaphoreLocationMismatchAlert(data).catch(err =>
      console.error('[AlertService] SMS location mismatch alert failed:', err)
    ),
  ])
}

// ============================================
// Shift Closing Alert
// ============================================

export async function sendShiftClosingAlert(data: {
  shiftNumber: string
  cashierName: string
  locationName: string
  expectedCash: number
  actualCash: number
  discrepancy: number
  totalSales: number
  closedBy: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramShiftClosingAlert(data).catch(err =>
      console.error('[AlertService] Telegram shift closing alert failed:', err)
    ),
    SMS.sendSemaphoreShiftClosingAlert(data).catch(err =>
      console.error('[AlertService] SMS shift closing alert failed:', err)
    ),
  ])
}

// ============================================
// Credit Sale Alert
// ============================================

export async function sendCreditSaleAlert(data: {
  invoiceNumber: string
  customerName: string
  totalAmount: number
  locationName: string
  cashierName: string
  timestamp: Date
}): Promise<void> {
  // Note: Telegram credit sale alert temporarily disabled due to data mismatch issue
  // Only SMS alert is active for credit sales
  await Promise.all([
    // Telegram.sendTelegramCreditSaleAlert(data) - disabled
    SMS.sendSemaphoreCreditSaleAlert(data).catch(err =>
      console.error('[AlertService] SMS credit sale alert failed:', err)
    ),
  ])
}

// ============================================
// Large Discount Alert
// ============================================

export async function sendLargeDiscountAlert(data: {
  invoiceNumber: string
  discountAmount: number
  discountPercent: number
  totalAmount: number
  locationName: string
  cashierName: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramLargeDiscountAlert(data).catch(err =>
      console.error('[AlertService] Telegram large discount alert failed:', err)
    ),
    SMS.sendSemaphoreLargeDiscountAlert(data).catch(err =>
      console.error('[AlertService] SMS large discount alert failed:', err)
    ),
  ])
}

// ============================================
// Price Change Alert
// ============================================

export async function sendPriceChangeAlert(data: {
  productName: string
  productCode: string
  oldPrice: number
  newPrice: number
  changedBy: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramPriceChangeAlert(data).catch(err =>
      console.error('[AlertService] Telegram price change alert failed:', err)
    ),
    SMS.sendSemaphorePriceChangeAlert(data).catch(err =>
      console.error('[AlertService] SMS price change alert failed:', err)
    ),
  ])
}

// ============================================
// Stock Transfer Alert
// ============================================

export async function sendStockTransferAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  productName: string
  quantity: number
  requestedBy: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramStockTransferAlert(data).catch(err =>
      console.error('[AlertService] Telegram stock transfer alert failed:', err)
    ),
    SMS.sendSemaphoreStockTransferAlert(data).catch(err =>
      console.error('[AlertService] SMS stock transfer alert failed:', err)
    ),
  ])
}

// ============================================
// Supplier Return Alert
// ============================================

export async function sendSupplierReturnAlert(data: {
  returnNumber: string
  supplierName: string
  totalAmount: number
  reason: string
  locationName: string
  processedBy: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramSupplierReturnAlert(data).catch(err =>
      console.error('[AlertService] Telegram supplier return alert failed:', err)
    ),
    SMS.sendSemaphoreSupplierReturnAlert(data).catch(err =>
      console.error('[AlertService] SMS supplier return alert failed:', err)
    ),
  ])
}

// ============================================
// Transfer Rejection Alert
// ============================================

export async function sendTransferRejectionAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  rejectedBy: string
  rejectionReason: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramTransferRejectionAlert(data).catch(err =>
      console.error('[AlertService] Telegram transfer rejection alert failed:', err)
    ),
    SMS.sendSemaphoreTransferRejectionAlert(data).catch(err =>
      console.error('[AlertService] SMS transfer rejection alert failed:', err)
    ),
  ])
}

// ============================================
// Transfer Approval Alert
// ============================================

export async function sendTransferApprovalAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  approvedBy: string
  notes?: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramTransferApprovalAlert(data).catch(err =>
      console.error('[AlertService] Telegram transfer approval alert failed:', err)
    ),
    SMS.sendSemaphoreTransferApprovalAlert(data).catch(err =>
      console.error('[AlertService] SMS transfer approval alert failed:', err)
    ),
  ])
}

// ============================================
// Transfer Acceptance Alert
// ============================================

export async function sendTransferAcceptanceAlert(data: {
  transferNumber: string
  fromLocation: string
  toLocation: string
  itemCount: number
  totalQuantity: number
  acceptedBy: string
  notes?: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramTransferAcceptanceAlert(data).catch(err =>
      console.error('[AlertService] Telegram transfer acceptance alert failed:', err)
    ),
    SMS.sendSemaphoreTransferAcceptanceAlert(data).catch(err =>
      console.error('[AlertService] SMS transfer acceptance alert failed:', err)
    ),
  ])
}

// ============================================
// Inventory Correction Alert
// ============================================

export async function sendInventoryCorrectionAlert(data: {
  productName: string
  productCode: string
  locationName: string
  oldQuantity: number
  newQuantity: number
  difference: number
  reason: string
  correctedBy: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramInventoryCorrectionAlert(data).catch(err =>
      console.error('[AlertService] Telegram inventory correction alert failed:', err)
    ),
    SMS.sendSemaphoreInventoryCorrectionAlert(data).catch(err =>
      console.error('[AlertService] SMS inventory correction alert failed:', err)
    ),
  ])
}

// ============================================
// Void Transaction Alert
// ============================================

export async function sendVoidTransactionAlert(data: {
  invoiceNumber: string
  totalAmount: number
  reason: string
  locationName: string
  voidedBy: string
  timestamp: Date
}): Promise<void> {
  await Promise.all([
    Telegram.sendTelegramVoidTransactionAlert(data).catch(err =>
      console.error('[AlertService] Telegram void transaction alert failed:', err)
    ),
    SMS.sendSemaphoreVoidTransactionAlert(data).catch(err =>
      console.error('[AlertService] SMS void transaction alert failed:', err)
    ),
  ])
}

// ============================================
// Test Message
// ============================================

export async function sendTestMessage(): Promise<{ telegram: boolean; sms: boolean }> {
  console.log('[AlertService] sendTestMessage() called')
  console.log('[AlertService] Calling Telegram.sendTelegramTestMessage()...')
  console.log('[AlertService] Calling SMS.sendSemaphoreTestMessage()...')

  const results = await Promise.allSettled([
    Telegram.sendTelegramTestMessage(),
    SMS.sendSemaphoreTestMessage(),
  ])

  console.log('[AlertService] Telegram result:', results[0])
  console.log('[AlertService] SMS result:', results[1])

  const telegramSuccess = results[0].status === 'fulfilled' && results[0].value
  const smsSuccess = results[1].status === 'fulfilled' && results[1].value

  console.log('[AlertService] Final results - Telegram:', telegramSuccess, 'SMS:', smsSuccess)

  return {
    telegram: telegramSuccess,
    sms: smsSuccess,
  }
}
