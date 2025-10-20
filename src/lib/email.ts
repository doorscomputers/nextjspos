import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Email configuration from environment variables
const emailConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
}

const fromAddress = process.env.SMTP_FROM || 'IgoroTechPOS <noreply@igorotechpos.com>'

// Alert thresholds
const alertConfig = {
  enabled: process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true',
  adminRecipients: (process.env.EMAIL_ADMIN_RECIPIENTS || '').split(',').filter(Boolean),
  discountThreshold: parseFloat(process.env.EMAIL_ALERT_DISCOUNT_THRESHOLD || '1000'),
  voidEnabled: process.env.EMAIL_ALERT_VOID_ENABLED === 'true',
  refundEnabled: process.env.EMAIL_ALERT_REFUND_ENABLED === 'true',
  creditEnabled: process.env.EMAIL_ALERT_CREDIT_ENABLED === 'true',
  cashOutThreshold: parseFloat(process.env.EMAIL_ALERT_CASH_OUT_THRESHOLD || '5000'),
  lowStockEnabled: process.env.EMAIL_ALERT_LOW_STOCK_ENABLED === 'true',
  transferDiscrepancyEnabled: process.env.EMAIL_ALERT_TRANSFER_DISCREPANCY_ENABLED === 'true',
}

// Create reusable transporter
let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
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
