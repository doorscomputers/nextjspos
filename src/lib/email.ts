/**
 * EMAIL ALERTS MODULE
 * ===================
 *
 * This module sends external email notifications for critical events in the POS system.
 * Unlike in-app notifications (notifications.ts), these are EMAILS sent to admin inboxes.
 *
 * WHY EMAIL ALERTS?
 * -----------------
 * - **Critical Events**: Notify managers even when not logged into the system
 * - **Audit Trail**: Permanent email records of sensitive transactions
 * - **Fraud Prevention**: Instant alerts for large discounts, voids, cash outs
 * - **Inventory Management**: Low stock alerts to prevent stock outs
 * - **Discrepancy Detection**: Transfer mismatches that may indicate theft/errors
 * - **Remote Monitoring**: Managers can monitor business from anywhere
 *
 * WHAT TRIGGERS EMAIL ALERTS?
 * ----------------------------
 * 1. **Large Discount** - Discount exceeds configured threshold (default: ₱1,000)
 * 2. **Void Transaction** - Any sale is voided/cancelled
 * 3. **Refund Transaction** - Customer receives money back
 * 4. **Credit Sale** - Sale made on credit (accounts receivable)
 * 5. **Large Cash Out** - Cash withdrawal exceeds threshold (default: ₱5,000)
 * 6. **Low Stock** - Product inventory below reorder point
 * 7. **Transfer Discrepancy** - Received quantity doesn't match sent quantity
 * 8. **Supplier Return** - Products being returned to supplier
 *
 * HOW IT WORKS:
 * -------------
 * 1. Event occurs in the system (e.g., sale with large discount)
 * 2. System checks if email alerts are enabled (areNotificationsEnabled())
 * 3. Checks if event exceeds threshold (e.g., discount > ₱1,000)
 * 4. Builds HTML email using template (getEmailTemplate())
 * 5. Sends email via SMTP using Nodemailer (sendEmail())
 * 6. Returns true if sent, false if skipped/failed
 *
 * CONFIGURATION (Environment Variables):
 * ---------------------------------------
 * **SMTP Settings** (required for email to work):
 * - SMTP_HOST: Mail server (e.g., "smtp.gmail.com")
 * - SMTP_PORT: Port number (587 for TLS, 465 for SSL)
 * - SMTP_SECURE: "true" for port 465, "false" for 587
 * - SMTP_USER: Email account username
 * - SMTP_PASS: Email account password/app password
 * - SMTP_FROM: From address (e.g., "POS <noreply@company.com>")
 *
 * **Alert Settings** (optional - control which alerts are sent):
 * - EMAIL_NOTIFICATIONS_ENABLED: "true" to enable all alerts
 * - EMAIL_ADMIN_RECIPIENTS: Comma-separated admin emails
 * - EMAIL_ALERT_DISCOUNT_THRESHOLD: Min discount amount (default: 1000)
 * - EMAIL_ALERT_VOID_ENABLED: "true" to alert on voids
 * - EMAIL_ALERT_REFUND_ENABLED: "true" to alert on refunds
 * - EMAIL_ALERT_CREDIT_ENABLED: "true" to alert on credit sales
 * - EMAIL_ALERT_CASH_OUT_THRESHOLD: Min cash out amount (default: 5000)
 * - EMAIL_ALERT_LOW_STOCK_ENABLED: "true" to alert on low stock
 * - EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED: "true" for transfer alerts
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Check if Email is Configured**
 * ```typescript
 * import { isEmailConfigured } from '@/lib/email'
 *
 * if (isEmailConfigured()) {
 *   console.log('Email system ready')
 * } else {
 *   console.warn('Email not configured - check .env file')
 * }
 * ```
 *
 * 2. **Send Test Email**
 * ```typescript
 * import { sendTestEmail } from '@/lib/email'
 *
 * // Verify SMTP configuration
 * const success = await sendTestEmail('admin@company.com')
 * if (success) {
 *   console.log('Test email sent successfully')
 * }
 * ```
 *
 * 3. **Alert on Large Discount** (called from sales API)
 * ```typescript
 * import { sendLargeDiscountAlert } from '@/lib/email'
 *
 * // After processing sale with discount
 * if (discountAmount > 1000) {
 *   await sendLargeDiscountAlert({
 *     saleNumber: 'INV-001',
 *     discountAmount: 1500,
 *     discountType: 'Senior Citizen 20%',
 *     totalAmount: 6000,
 *     cashierName: 'Juan Dela Cruz',
 *     locationName: 'Main Store',
 *     timestamp: new Date(),
 *     reason: 'Valid senior citizen ID presented'
 *   })
 * }
 * ```
 *
 * 4. **Alert on Low Stock** (called from stock operations)
 * ```typescript
 * import { sendLowStockAlert } from '@/lib/email'
 *
 * await sendLowStockAlert({
 *   products: [
 *     {
 *       name: 'Coca Cola 1.5L',
 *       sku: 'COKE-1.5',
 *       currentStock: 5,
 *       reorderPoint: 20,
 *       locationName: 'Main Store',
 *       urgency: 'critical'  // Red alert
 *     },
 *     {
 *       name: 'Sprite 1.5L',
 *       sku: 'SPR-1.5',
 *       currentStock: 12,
 *       reorderPoint: 20,
 *       locationName: 'Main Store',
 *       urgency: 'high'  // Orange alert
 *     }
 *   ]
 * })
 * ```
 *
 * 5. **Alert on Transfer Discrepancy** (called after transfer verification)
 * ```typescript
 * import { sendTransferDiscrepancyAlert } from '@/lib/email'
 *
 * // When received quantity doesn't match sent quantity
 * await sendTransferDiscrepancyAlert({
 *   transferNumber: 'TR-001',
 *   fromLocationName: 'Main Warehouse',
 *   toLocationName: 'Branch A',
 *   verifierName: 'Maria Santos',
 *   timestamp: new Date(),
 *   discrepantItems: [
 *     {
 *       productName: 'Laptop Dell XPS',
 *       variationName: '15-inch, 16GB RAM',
 *       sku: 'LAPTOP-DELL-001',
 *       quantitySent: 10,
 *       quantityReceived: 9,  // Missing 1 unit!
 *       difference: -1,
 *       discrepancyType: 'shortage'
 *     }
 *   ]
 * })
 * ```
 *
 * 6. **Custom Email** (generic send function)
 * ```typescript
 * import { sendEmail } from '@/lib/email'
 *
 * await sendEmail({
 *   to: ['admin@company.com', 'manager@company.com'],
 *   subject: 'Custom Alert',
 *   html: '<h1>Custom HTML content</h1><p>Alert details...</p>',
 *   text: 'Plain text fallback',
 *   attachments: [
 *     {
 *       filename: 'report.pdf',
 *       path: '/path/to/report.pdf'
 *     }
 *   ]
 * })
 * ```
 *
 * EMAIL TEMPLATE DESIGN:
 * ----------------------
 * All emails use consistent HTML template with:
 * - Responsive design (mobile-friendly)
 * - Brand colors (blue header)
 * - Alert boxes (red/orange/blue for different severities)
 * - Detail tables (key-value pairs for transaction data)
 * - Action buttons (links to relevant pages)
 * - Footer with disclaimer and copyright
 *
 * PHILIPPINE FORMATTING:
 * ----------------------
 * All monetary amounts and dates use Philippine format:
 * - Currency: ₱1,234.56 (peso sign, thousands separator, 2 decimals)
 * - Dates: "January 15, 2025 at 3:45 PM" (en-PH locale)
 * - Numbers: 1,234.5678 (for quantities with precision)
 *
 * SMTP PROVIDERS:
 * ---------------
 * **Gmail** (recommended for testing):
 * - Host: smtp.gmail.com
 * - Port: 587 (TLS) or 465 (SSL)
 * - Requires "App Password" (not regular password)
 * - Enable 2FA first, then generate app password
 *
 * **SendGrid** (recommended for production):
 * - Host: smtp.sendgrid.net
 * - Port: 587
 * - User: apikey
 * - Pass: Your SendGrid API key
 * - More reliable delivery than Gmail
 *
 * **Mailgun, Amazon SES, etc.**:
 * - Follow provider's SMTP settings
 * - Update .env file accordingly
 *
 * TYPESCRIPT PATTERNS:
 * --------------------
 *
 * **Singleton Pattern (Transporter)**:
 * ```typescript
 * let transporter: Transporter | null = null
 * function getTransporter() {
 *   if (!transporter) {
 *     transporter = nodemailer.createTransport(...)
 *   }
 *   return transporter
 * }
 * ```
 * - Creates transporter ONCE and reuses it
 * - Avoids creating new SMTP connections for every email
 * - More efficient than creating transporter per email
 *
 * **Type Safety with Interfaces**:
 * ```typescript
 * interface SendEmailOptions {
 *   to: string | string[]  // Single email or array
 *   subject: string
 *   html: string
 *   text?: string  // Optional plain text
 *   attachments?: Array<...>  // Optional files
 * }
 * ```
 * - Ensures all required fields are provided
 * - Autocomplete in IDE
 * - Compile-time error if missing fields
 *
 * **Template Literals for HTML**:
 * ```typescript
 * const html = `<div>${variable}</div>`
 * ```
 * - Embed variables directly in HTML
 * - Easier than string concatenation
 * - Supports multi-line strings
 *
 * **Array Methods (filter, map, reduce)**:
 * ```typescript
 * const critical = products.filter(p => p.urgency === 'critical')
 * const rows = items.map(item => `<tr>...</tr>`).join('')
 * const total = items.reduce((sum, item) => sum + item.amount, 0)
 * ```
 * - Functional programming patterns
 * - More readable than loops
 * - Chainable operations
 *
 * NODEMAILER PATTERNS:
 * --------------------
 *
 * **Creating Transporter**:
 * ```typescript
 * nodemailer.createTransport({
 *   host: 'smtp.gmail.com',
 *   port: 587,
 *   secure: false,  // TLS (upgrade later)
 *   auth: { user: '...', pass: '...' }
 * })
 * ```
 * - Configures SMTP connection
 * - `secure: true` for port 465 (SSL)
 * - `secure: false` for port 587 (TLS/STARTTLS)
 *
 * **Sending Email**:
 * ```typescript
 * await transporter.sendMail({
 *   from: 'POS <noreply@company.com>',
 *   to: 'admin@company.com',
 *   subject: 'Alert',
 *   html: '<h1>HTML content</h1>',
 *   text: 'Plain text fallback'
 * })
 * ```
 * - Returns message info (including messageId)
 * - Throws error if send fails
 * - Always provide both HTML and text for compatibility
 *
 * **Multiple Recipients**:
 * ```typescript
 * to: ['admin@company.com', 'manager@company.com'].join(', ')
 * // Or: to: 'admin@company.com, manager@company.com'
 * ```
 * - Comma-separated string
 * - All recipients see each other (TO field)
 * - Use BCC for privacy
 *
 * PERFORMANCE CONSIDERATIONS:
 * ---------------------------
 * - Email sending is SLOW (1-3 seconds per email)
 * - Don't block API response waiting for email send
 * - Consider background job queue (BullMQ, etc.) for production
 * - Rate limit: Most providers limit emails per hour
 * - Gmail: 500 emails/day for free accounts
 * - Batch low stock alerts instead of per-product
 *
 * SECURITY NOTES:
 * ---------------
 * - NEVER commit SMTP credentials to git (.env only)
 * - Use app passwords for Gmail (not account password)
 * - Enable 2FA on email account for security
 * - Validate email addresses before sending
 * - Sanitize user input in email content (prevent injection)
 * - Use TLS/SSL for encrypted SMTP connection
 * - Monitor failed send attempts (could indicate attack)
 *
 * IMPORTANT NOTES:
 * ----------------
 * - Emails are EXTERNAL notifications (leave audit trail)
 * - Always check isEmailConfigured() before relying on alerts
 * - Test with sendTestEmail() after configuration changes
 * - Use areNotificationsEnabled() to check both config AND feature flags
 * - Alert functions return false if skipped (threshold not met, disabled)
 * - Recipient list comes from EMAIL_ADMIN_RECIPIENTS env var
 * - Each alert type can be individually enabled/disabled
 * - Thresholds prevent alert fatigue from minor events
 * - HTML emails may be blocked by some email clients (provide text fallback)
 * - Email delivery not guaranteed (use in-app notifications for critical UX)
 */

import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Email configuration from environment variables
// process.env is a Node.js global containing all environment variables from .env file
/**
 * SMTP Configuration
 *
 * Loaded from environment variables (.env file).
 * If variables not set, uses defaults (Gmail SMTP for development).
 */
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',  // SMTP server
  port: parseInt(process.env.SMTP_PORT || '587'),    // 587=TLS, 465=SSL
  secure: process.env.SMTP_SECURE === 'true',        // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER || '',  // Email account username
    pass: process.env.SMTP_PASS || '',  // Email account password/app password
  },
}

/**
 * From Address
 *
 * Email address that appears in "From" field.
 * Format: "Name <email@domain.com>"
 */
const fromAddress = process.env.SMTP_FROM || 'IgoroTechPOS <noreply@igorotechpos.com>'

/**
 * Alert Configuration
 *
 * Controls which alerts are enabled and their thresholds.
 * Loaded from environment variables with sensible defaults.
 */
const alertConfig = {
  enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',  // Master switch
  // Admin recipients (comma-separated in .env, converted to array)
  adminRecipients: (process.env.EMAIL_ADMIN_RECIPIENTS || '').split(',').filter(Boolean),
  // Minimum discount amount to trigger alert (default: ₱1,000)
  discountThreshold: parseFloat(process.env.EMAIL_ALERT_DISCOUNT_THRESHOLD || '1000'),
  // Individual alert type toggles
  voidEnabled: process.env.EMAIL_ALERT_VOID_ENABLED === 'true',
  refundEnabled: process.env.EMAIL_ALERT_REFUND_ENABLED === 'true',
  creditEnabled: process.env.EMAIL_ALERT_CREDIT_ENABLED === 'true',
  // Minimum cash out amount to trigger alert (default: ₱5,000)
  cashOutThreshold: parseFloat(process.env.EMAIL_ALERT_CASH_OUT_THRESHOLD || '5000'),
  lowStockEnabled: process.env.EMAIL_ALERT_LOW_STOCK_ENABLED === 'true',
  transferDiscrepancyEnabled: process.env.EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED === 'true',
}

/**
 * Transporter Singleton
 *
 * Nodemailer transporter is created ONCE and reused for all emails.
 * This avoids creating new SMTP connections for every email (more efficient).
 */
let transporter: Transporter | null = null

/**
 * Get Transporter (Singleton Pattern)
 *
 * Returns the cached transporter if it exists, otherwise creates it.
 * Lazy initialization: transporter is only created when first email is sent.
 *
 * @returns Nodemailer transporter instance
 */
function getTransporter(): Transporter {
  if (!transporter) {
    // Create transporter on first call
    transporter = nodemailer.createTransport(emailConfig)
  }
  return transporter
}

// Check if email is configured
export function isEmailConfigured(): boolean {
  return !!(
    process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS
  )
}

// Check if notifications are enabled
export function areNotificationsEnabled(): boolean {
  return alertConfig.enabled && isEmailConfigured()
}

// Generic email sending function
interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  attachments?: Array<{
    filename: string
    content?: string | Buffer
    path?: string
  }>
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn('Email not configured. Skipping email send.')
    return false
  }

  try {
    const transport = getTransporter()
    const recipients = Array.isArray(options.to) ? options.to.join(', ') : options.to

    const info = await transport.sendMail({
      from: fromAddress,
      to: recipients,
      subject: options.subject,
      text: options.text || '',
      html: options.html,
      attachments: options.attachments,
    })

    console.log('Email sent:', info.messageId)
    return true
  } catch (error) {
    console.error('Email send error:', error)
    return false
  }
}

// Email Templates
function getEmailTemplate(title: string, content: string, footerText?: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f4f4f4;
        }
        .container {
          background-color: #ffffff;
          border-radius: 8px;
          padding: 30px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .header {
          border-bottom: 3px solid #2563eb;
          padding-bottom: 20px;
          margin-bottom: 20px;
        }
        .header h1 {
          margin: 0;
          color: #2563eb;
          font-size: 24px;
        }
        .content {
          margin-bottom: 20px;
        }
        .alert-box {
          background-color: #fef2f2;
          border-left: 4px solid #ef4444;
          padding: 15px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .alert-box.warning {
          background-color: #fffbeb;
          border-left-color: #f59e0b;
        }
        .alert-box.info {
          background-color: #eff6ff;
          border-left-color: #3b82f6;
        }
        .detail-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .detail-table td {
          padding: 10px;
          border-bottom: 1px solid #e5e7eb;
        }
        .detail-table td:first-child {
          font-weight: 600;
          color: #6b7280;
          width: 40%;
        }
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          font-size: 12px;
          color: #6b7280;
          text-align: center;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: #2563eb;
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          margin: 10px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${title}</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          ${footerText || 'This is an automated notification from IgoroTechPOS. Please do not reply to this email.'}
          <br>
          <small>© ${new Date().getFullYear()} IgoroTechPOS. All rights reserved.</small>
        </div>
      </div>
    </body>
    </html>
  `
}

// Alert: Large Discount
export async function sendLargeDiscountAlert(data: {
  saleNumber: string
  discountAmount: number
  discountType: string
  totalAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason?: string
}): Promise<boolean> {
  if (!alertConfig.enabled || data.discountAmount < alertConfig.discountThreshold) {
    return false
  }

  const content = `
    <div class="alert-box warning">
      <strong>⚠️ Large Discount Alert</strong>
      <p>A discount exceeding the threshold has been applied to a sale.</p>
    </div>
    <table class="detail-table">
      <tr><td>Sale Number:</td><td><strong>${data.saleNumber}</strong></td></tr>
      <tr><td>Discount Amount:</td><td><strong style="color: #ef4444;">₱${data.discountAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Discount Type:</td><td>${data.discountType}</td></tr>
      <tr><td>Sale Total:</td><td>₱${data.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
      <tr><td>Cashier:</td><td>${data.cashierName}</td></tr>
      <tr><td>Location:</td><td>${data.locationName}</td></tr>
      <tr><td>Timestamp:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      ${data.reason ? `<tr><td>Reason:</td><td>${data.reason}</td></tr>` : ''}
    </table>
    <p><em>Threshold: ₱${alertConfig.discountThreshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</em></p>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `🚨 Large Discount Alert - ${data.saleNumber} (₱${data.discountAmount.toLocaleString('en-PH')})`,
    html: getEmailTemplate('Large Discount Alert', content),
  })
}

// Alert: Void Transaction
export async function sendVoidTransactionAlert(data: {
  saleNumber: string
  totalAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason: string
  itemCount: number
}): Promise<boolean> {
  if (!alertConfig.enabled || !alertConfig.voidEnabled) {
    return false
  }

  const content = `
    <div class="alert-box">
      <strong>🚫 Transaction Void Alert</strong>
      <p>A sale transaction has been voided.</p>
    </div>
    <table class="detail-table">
      <tr><td>Sale Number:</td><td><strong>${data.saleNumber}</strong></td></tr>
      <tr><td>Voided Amount:</td><td><strong style="color: #ef4444;">₱${data.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Item Count:</td><td>${data.itemCount}</td></tr>
      <tr><td>Cashier:</td><td>${data.cashierName}</td></tr>
      <tr><td>Location:</td><td>${data.locationName}</td></tr>
      <tr><td>Timestamp:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      <tr><td>Reason:</td><td><strong>${data.reason}</strong></td></tr>
    </table>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `🚫 Void Transaction Alert - ${data.saleNumber} (₱${data.totalAmount.toLocaleString('en-PH')})`,
    html: getEmailTemplate('Void Transaction Alert', content),
  })
}

// Alert: Refund Transaction
export async function sendRefundTransactionAlert(data: {
  saleNumber: string
  refundAmount: number
  cashierName: string
  locationName: string
  timestamp: Date
  reason: string
  itemCount: number
  originalSaleDate: Date
}): Promise<boolean> {
  if (!alertConfig.enabled || !alertConfig.refundEnabled) {
    return false
  }

  const content = `
    <div class="alert-box warning">
      <strong>↩️ Refund Transaction Alert</strong>
      <p>A refund has been processed.</p>
    </div>
    <table class="detail-table">
      <tr><td>Original Sale:</td><td><strong>${data.saleNumber}</strong></td></tr>
      <tr><td>Refund Amount:</td><td><strong style="color: #ef4444;">₱${data.refundAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Item Count:</td><td>${data.itemCount}</td></tr>
      <tr><td>Processed By:</td><td>${data.cashierName}</td></tr>
      <tr><td>Location:</td><td>${data.locationName}</td></tr>
      <tr><td>Original Sale Date:</td><td>${data.originalSaleDate.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      <tr><td>Refund Timestamp:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      <tr><td>Reason:</td><td><strong>${data.reason}</strong></td></tr>
    </table>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `↩️ Refund Alert - ${data.saleNumber} (₱${data.refundAmount.toLocaleString('en-PH')})`,
    html: getEmailTemplate('Refund Transaction Alert', content),
  })
}

// Alert: Credit Sale
export async function sendCreditSaleAlert(data: {
  saleNumber: string
  creditAmount: number
  customerName: string
  cashierName: string
  locationName: string
  timestamp: Date
  dueDate?: Date
  paymentTerms?: string
}): Promise<boolean> {
  if (!alertConfig.enabled || !alertConfig.creditEnabled) {
    return false
  }

  const content = `
    <div class="alert-box info">
      <strong>💳 Credit Sale Alert</strong>
      <p>A sale has been processed on credit.</p>
    </div>
    <table class="detail-table">
      <tr><td>Sale Number:</td><td><strong>${data.saleNumber}</strong></td></tr>
      <tr><td>Credit Amount:</td><td><strong style="color: #3b82f6;">₱${data.creditAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Customer:</td><td>${data.customerName}</td></tr>
      <tr><td>Cashier:</td><td>${data.cashierName}</td></tr>
      <tr><td>Location:</td><td>${data.locationName}</td></tr>
      <tr><td>Sale Date:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      ${data.dueDate ? `<tr><td>Due Date:</td><td><strong>${data.dueDate.toLocaleString('en-PH', { dateStyle: 'long' })}</strong></td></tr>` : ''}
      ${data.paymentTerms ? `<tr><td>Payment Terms:</td><td>${data.paymentTerms}</td></tr>` : ''}
    </table>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `💳 Credit Sale Alert - ${data.saleNumber} (₱${data.creditAmount.toLocaleString('en-PH')})`,
    html: getEmailTemplate('Credit Sale Alert', content),
  })
}

// Alert: Large Cash Out
export async function sendLargeCashOutAlert(data: {
  cashOutNumber: string
  amount: number
  reason: string
  cashierName: string
  locationName: string
  timestamp: Date
  approvedBy?: string
}): Promise<boolean> {
  if (!alertConfig.enabled || data.amount < alertConfig.cashOutThreshold) {
    return false
  }

  const content = `
    <div class="alert-box warning">
      <strong>💰 Large Cash Out Alert</strong>
      <p>A large cash out transaction has been recorded.</p>
    </div>
    <table class="detail-table">
      <tr><td>Transaction Number:</td><td><strong>${data.cashOutNumber}</strong></td></tr>
      <tr><td>Amount:</td><td><strong style="color: #ef4444;">₱${data.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Reason:</td><td><strong>${data.reason}</strong></td></tr>
      <tr><td>Cashier:</td><td>${data.cashierName}</td></tr>
      <tr><td>Location:</td><td>${data.locationName}</td></tr>
      <tr><td>Timestamp:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
      ${data.approvedBy ? `<tr><td>Approved By:</td><td>${data.approvedBy}</td></tr>` : ''}
    </table>
    <p><em>Threshold: ₱${alertConfig.cashOutThreshold.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</em></p>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `💰 Large Cash Out Alert - ${data.cashOutNumber} (₱${data.amount.toLocaleString('en-PH')})`,
    html: getEmailTemplate('Large Cash Out Alert', content),
  })
}

// Alert: Low Stock / Critical Stock
export async function sendLowStockAlert(data: {
  products: Array<{
    name: string
    sku: string
    currentStock: number
    reorderPoint: number
    locationName: string
    urgency: 'critical' | 'high' | 'medium'
  }>
}): Promise<boolean> {
  if (!alertConfig.enabled || !alertConfig.lowStockEnabled || data.products.length === 0) {
    return false
  }

  const criticalCount = data.products.filter(p => p.urgency === 'critical').length
  const highCount = data.products.filter(p => p.urgency === 'high').length

  const productRows = data.products.map(product => `
    <tr style="background-color: ${product.urgency === 'critical' ? '#fef2f2' : product.urgency === 'high' ? '#fffbeb' : '#fefefe'};">
      <td style="padding: 10px; border: 1px solid #e5e7eb;">
        <strong>${product.name}</strong><br>
        <small style="color: #6b7280;">${product.sku}</small>
      </td>
      <td style="padding: 10px; border: 1px solid #e5e7eb;">${product.locationName}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
        <strong style="color: ${product.urgency === 'critical' ? '#ef4444' : product.urgency === 'high' ? '#f59e0b' : '#6b7280'};">${product.currentStock}</strong>
      </td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">${product.reorderPoint}</td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
        <span style="background-color: ${product.urgency === 'critical' ? '#ef4444' : product.urgency === 'high' ? '#f59e0b' : '#3b82f6'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase;">
          ${product.urgency}
        </span>
      </td>
    </tr>
  `).join('')

  const content = `
    <div class="alert-box ${criticalCount > 0 ? '' : 'warning'}">
      <strong>📦 Low Stock Alert</strong>
      <p>${criticalCount > 0 ? `${criticalCount} product(s) at CRITICAL level! ` : ''}${data.products.length} product(s) need reordering.</p>
    </div>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Product</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Location</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Current</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Reorder Point</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Urgency</th>
        </tr>
      </thead>
      <tbody>
        ${productRows}
      </tbody>
    </table>
    <p style="margin-top: 20px;">
      <strong>Summary:</strong><br>
      🔴 Critical: ${criticalCount} | 🟠 High: ${highCount} | 🟡 Medium: ${data.products.length - criticalCount - highCount}
    </p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/purchases/suggestions" class="button">
      View Reorder Suggestions
    </a>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `📦 Low Stock Alert - ${data.products.length} Product(s) Need Reordering`,
    html: getEmailTemplate('Low Stock Alert', content),
  })
}

// Alert: Transfer Discrepancy
export async function sendTransferDiscrepancyAlert(data: {
  transferNumber: string
  fromLocationName: string
  toLocationName: string
  verifierName: string
  timestamp: Date
  businessEmail?: string
  discrepantItems: Array<{
    productName: string
    variationName: string
    sku: string
    quantitySent: number
    quantityReceived: number
    difference: number
    discrepancyType: 'shortage' | 'overage'
  }>
}): Promise<boolean> {
  if (!alertConfig.enabled || !alertConfig.transferDiscrepancyEnabled || data.discrepantItems.length === 0) {
    return false
  }

  const totalShortage = data.discrepantItems
    .filter(item => item.discrepancyType === 'shortage')
    .reduce((sum, item) => sum + Math.abs(item.difference), 0)

  const totalOverage = data.discrepantItems
    .filter(item => item.discrepancyType === 'overage')
    .reduce((sum, item) => sum + item.difference, 0)

  const itemRows = data.discrepantItems.map(item => `
    <tr style="background-color: ${item.discrepancyType === 'shortage' ? '#fef2f2' : '#fffbeb'};">
      <td style="padding: 10px; border: 1px solid #e5e7eb;">
        <strong>${item.productName}</strong><br>
        <small style="color: #6b7280;">${item.variationName}</small><br>
        <small style="color: #9ca3af;">SKU: ${item.sku}</small>
      </td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
        ${item.quantitySent.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
      </td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
        <strong style="color: ${item.discrepancyType === 'shortage' ? '#ef4444' : '#f59e0b'};">
          ${item.quantityReceived.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </strong>
      </td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
        <strong style="color: ${item.discrepancyType === 'shortage' ? '#ef4444' : '#f59e0b'};">
          ${item.difference > 0 ? '+' : ''}${item.difference.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </strong>
      </td>
      <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
        <span style="background-color: ${item.discrepancyType === 'shortage' ? '#ef4444' : '#f59e0b'}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; text-transform: uppercase;">
          ${item.discrepancyType}
        </span>
      </td>
    </tr>
  `).join('')

  const content = `
    <div class="alert-box">
      <strong>🚨 Inventory Transfer Discrepancy Detected</strong>
      <p><strong>URGENT:</strong> A discrepancy was detected during transfer verification. Immediate investigation required.</p>
    </div>

    <table class="detail-table">
      <tr><td>Transfer Number:</td><td><strong>${data.transferNumber}</strong></td></tr>
      <tr><td>From Location:</td><td>${data.fromLocationName}</td></tr>
      <tr><td>To Location:</td><td>${data.toLocationName}</td></tr>
      <tr><td>Verified By:</td><td>${data.verifierName}</td></tr>
      <tr><td>Timestamp:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'long' })}</td></tr>
    </table>

    <h3 style="color: #ef4444; margin-top: 30px; margin-bottom: 15px;">Discrepant Items (${data.discrepantItems.length})</h3>

    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Product</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Sent</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Received</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Difference</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Type</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>

    <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: 600; color: #991b1b;">Summary:</p>
      <p style="margin: 10px 0 0 0; color: #7f1d1d;">
        🔴 <strong>Shortages:</strong> ${totalShortage.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} units missing<br>
        🟠 <strong>Overages:</strong> ${totalOverage.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} extra units received
      </p>
    </div>

    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: 600; color: #92400e;">⚠️ Recommended Actions:</p>
      <ul style="margin: 10px 0 0 0; color: #78350f; padding-left: 20px;">
        <li>Investigate immediately - check for theft, damage, or shipping errors</li>
        <li>Review CCTV footage at both locations if available</li>
        <li>Interview personnel involved in packing and verification</li>
        <li>Check for damaged or misplaced items</li>
        <li>Document findings for audit trail</li>
        <li>Review and improve packing/verification procedures if needed</li>
      </ul>
    </div>

    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/transfers/${data.transferNumber.replace('TR-', '')}" class="button" style="background-color: #ef4444;">
      View Transfer Details
    </a>
  `

  // Prepare recipient list
  const recipients = [...alertConfig.adminRecipients]

  // Add business email if provided
  if (data.businessEmail && data.businessEmail.trim()) {
    recipients.push(data.businessEmail)
  }

  return sendEmail({
    to: recipients,
    subject: `🚨 URGENT: Transfer Discrepancy - ${data.transferNumber} (${data.discrepantItems.length} item${data.discrepantItems.length > 1 ? 's' : ''})`,
    html: getEmailTemplate('Inventory Transfer Discrepancy Alert', content),
  })
}

// Alert: Supplier Return
export async function sendSupplierReturnAlert(data: {
  returnNumber: string
  supplierName: string
  totalAmount: number
  itemCount: number
  reason: string
  status: string
  createdBy: string
  locationName: string
  timestamp: Date
  items?: Array<{
    productName: string
    quantity: number
    unitCost: number
  }>
}): Promise<boolean> {
  if (!alertConfig.enabled) {
    return false
  }

  const itemRows = data.items && data.items.length > 0
    ? data.items.map(item => `
      <tr>
        <td style="padding: 10px; border: 1px solid #e5e7eb;">
          <strong>${item.productName}</strong>
        </td>
        <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">
          ${item.unitCost.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
        </td>
        <td style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">
          <strong>₱${(item.quantity * item.unitCost).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>
        </td>
      </tr>
    `).join('')
    : ''

  const content = `
    <div class="alert-box warning">
      <strong>↩️ Supplier Return Alert</strong>
      <p>A supplier return has been created and is pending approval.</p>
    </div>
    <table class="detail-table">
      <tr><td>Return Number:</td><td><strong>${data.returnNumber}</strong></td></tr>
      <tr><td>Supplier:</td><td>${data.supplierName}</td></tr>
      <tr><td>Total Amount:</td><td><strong style="color: #ef4444;">₱${data.totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td></tr>
      <tr><td>Item Count:</td><td>${data.itemCount}</td></tr>
      <tr><td>Reason:</td><td><strong>${data.reason}</strong></td></tr>
      <tr><td>Status:</td><td><strong>${data.status.toUpperCase()}</strong></td></tr>
      <tr><td>Created By:</td><td>${data.createdBy}</td></tr>
      <tr><td>Location:</td><td>${data.locationName}</td></tr>
      <tr><td>Timestamp:</td><td>${data.timestamp.toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</td></tr>
    </table>
    ${itemRows ? `
    <h3 style="color: #6b7280; margin-top: 30px; margin-bottom: 15px;">Return Items</h3>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <thead>
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: left;">Product</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: center;">Quantity</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Unit Cost</th>
          <th style="padding: 10px; border: 1px solid #e5e7eb; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
      </tbody>
    </table>
    ` : ''}
    <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0; font-weight: 600; color: #92400e;">⚠️ Action Required:</p>
      <p style="margin: 10px 0 0 0; color: #78350f;">
        This supplier return requires approval before inventory and accounting adjustments are made.
      </p>
    </div>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/supplier-returns" class="button">
      View Supplier Returns
    </a>
  `

  return sendEmail({
    to: alertConfig.adminRecipients,
    subject: `↩️ Supplier Return Created - ${data.returnNumber} (₱${data.totalAmount.toLocaleString('en-PH')})`,
    html: getEmailTemplate('Supplier Return Alert', content),
  })
}

// Test email function
export async function sendTestEmail(recipientEmail: string): Promise<boolean> {
  const content = `
    <div class="alert-box info">
      <strong>✅ Test Email Successful</strong>
      <p>Your email configuration is working correctly!</p>
    </div>
    <table class="detail-table">
      <tr><td>SMTP Host:</td><td>${emailConfig.host}</td></tr>
      <tr><td>SMTP Port:</td><td>${emailConfig.port}</td></tr>
      <tr><td>SMTP User:</td><td>${emailConfig.auth.user}</td></tr>
      <tr><td>Test Date:</td><td>${new Date().toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'long' })}</td></tr>
    </table>
    <p>If you received this email, your notification system is ready to use!</p>
  `

  return sendEmail({
    to: recipientEmail,
    subject: '✅ IgoroTechPOS - Email Test Successful',
    html: getEmailTemplate('Email Configuration Test', content),
  })
}

// Export configuration for external use
export { alertConfig }
