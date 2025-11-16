import nodemailer from "nodemailer"

/**
 * Stock Reconciliation Email Notification Service
 *
 * Sends email alerts when inventory discrepancies are detected during
 * automated reconciliation runs.
 *
 * Configuration (in .env):
 * - SMTP_HOST: SMTP server hostname (e.g., smtp.gmail.com)
 * - SMTP_PORT: SMTP port (587 for TLS, 465 for SSL)
 * - SMTP_SECURE: "true" for SSL, "false" for TLS
 * - SMTP_USER: Email account username
 * - SMTP_PASSWORD: Email account password (use app password for Gmail)
 * - ALERT_EMAIL_TO: Recipient email address (default: rr3800@gmail.com)
 */

interface ReconciliationAlertData {
  businessId: number
  businessName: string
  summary: {
    totalVariances: number
    requiresInvestigation: number
    autoFixable: number
    totalVarianceValue: number
    healthPercentage: number
  }
  discrepancies: Array<{
    product: { name: string }
    variation: { name: string }
    location: { name: string }
    ledgerStock: number
    physicalStock: number
    variance: number
    varianceValue: number
    discrepancyPercentage: number
  }>
  locations: Array<{ id: number; name: string }>
}

/**
 * Creates SMTP transporter for sending emails
 */
function createTransporter() {
  // Validate required environment variables
  const requiredVars = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD"]
  const missing = requiredVars.filter((v) => !process.env[v])

  if (missing.length > 0) {
    throw new Error(
      `Missing required SMTP environment variables: ${missing.join(", ")}`
    )
  }

  const smtpSecure = process.env.SMTP_SECURE === "true"

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: smtpSecure, // true for 465 (SSL), false for 587 (TLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    // Connection timeout
    connectionTimeout: 10000,
    // Socket timeout
    socketTimeout: 10000,
  })
}

/**
 * Generates HTML email body for reconciliation alert
 */
function generateEmailHTML(data: ReconciliationAlertData): string {
  const { businessName, summary, discrepancies } = data

  // Sort discrepancies by value (highest first)
  const sortedDiscrepancies = [...discrepancies].sort(
    (a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue)
  )

  // Show top 10 variances only in email
  const topVariances = sortedDiscrepancies.slice(0, 10)
  const hasMore = sortedDiscrepancies.length > 10

  // Color coding for severity
  const getStatusColor = (percentage: number) => {
    if (percentage < 2) return "#22c55e" // green - minor
    if (percentage < 5) return "#eab308" // yellow - moderate
    return "#ef4444" // red - critical
  }

  const getHealthColor = (health: number) => {
    if (health >= 95) return "#22c55e" // green
    if (health >= 85) return "#eab308" // yellow
    return "#ef4444" // red
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Stock Reconciliation Alert</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">

  <!-- Header -->
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px;">⚠️ Stock Reconciliation Alert</h1>
    <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">${businessName}</p>
  </div>

  <!-- Summary Section -->
  <div style="background: white; padding: 30px; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0;">
    <h2 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Summary</h2>

    <div style="display: flex; flex-wrap: wrap; gap: 15px; margin-bottom: 20px;">

      <!-- Total Variances Card -->
      <div style="flex: 1; min-width: 150px; background: #fef2f2; border-left: 4px solid #ef4444; padding: 15px; border-radius: 5px;">
        <div style="font-size: 12px; color: #991b1b; font-weight: bold; text-transform: uppercase;">Total Variances</div>
        <div style="font-size: 32px; color: #dc2626; font-weight: bold; margin: 5px 0;">${summary.totalVariances}</div>
      </div>

      <!-- Requires Investigation Card -->
      <div style="flex: 1; min-width: 150px; background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 5px;">
        <div style="font-size: 12px; color: #92400e; font-weight: bold; text-transform: uppercase;">Needs Investigation</div>
        <div style="font-size: 32px; color: #d97706; font-weight: bold; margin: 5px 0;">${summary.requiresInvestigation}</div>
      </div>

      <!-- Health Percentage Card -->
      <div style="flex: 1; min-width: 150px; background: #f0fdf4; border-left: 4px solid ${getHealthColor(summary.healthPercentage)}; padding: 15px; border-radius: 5px;">
        <div style="font-size: 12px; color: #14532d; font-weight: bold; text-transform: uppercase;">System Health</div>
        <div style="font-size: 32px; color: ${getHealthColor(summary.healthPercentage)}; font-weight: bold; margin: 5px 0;">${summary.healthPercentage.toFixed(1)}%</div>
      </div>

    </div>

    <div style="background: #f8fafc; padding: 15px; border-radius: 5px; border-left: 4px solid #64748b;">
      <strong style="color: #334155;">Total Variance Value:</strong>
      <span style="font-size: 20px; color: #ef4444; font-weight: bold;">₱${Math.abs(summary.totalVarianceValue).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    </div>
  </div>

  <!-- Top Variances Section -->
  <div style="background: white; padding: 30px; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0;">
    <h2 style="color: #667eea; margin-top: 0; border-bottom: 2px solid #667eea; padding-bottom: 10px;">
      Top ${hasMore ? "10" : ""} Variances Detected
    </h2>

    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
          <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #475569;">#</th>
          <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #475569;">Product / Variation</th>
          <th style="padding: 12px 8px; text-align: left; font-weight: 600; color: #475569;">Location</th>
          <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #475569;">Expected</th>
          <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #475569;">Actual</th>
          <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #475569;">Variance</th>
          <th style="padding: 12px 8px; text-align: right; font-weight: 600; color: #475569;">Value</th>
        </tr>
      </thead>
      <tbody>
        ${topVariances
          .map(
            (item, index) => `
          <tr style="border-bottom: 1px solid #e2e8f0; ${index % 2 === 0 ? "background: #fafafa;" : ""}">
            <td style="padding: 12px 8px; color: #64748b; font-weight: 500;">${index + 1}</td>
            <td style="padding: 12px 8px;">
              <div style="font-weight: 600; color: #1e293b;">${item.product.name}</div>
              ${item.variation.name !== "default" ? `<div style="font-size: 12px; color: #64748b;">${item.variation.name}</div>` : ""}
            </td>
            <td style="padding: 12px 8px; color: #475569;">${item.location.name}</td>
            <td style="padding: 12px 8px; text-align: right; color: #475569;">${item.ledgerStock}</td>
            <td style="padding: 12px 8px; text-align: right; color: #475569;">${item.physicalStock}</td>
            <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: ${item.variance > 0 ? "#22c55e" : "#ef4444"};">
              ${item.variance > 0 ? "+" : ""}${item.variance}
              <span style="font-size: 11px; color: ${getStatusColor(item.discrepancyPercentage)};">
                (${item.discrepancyPercentage.toFixed(1)}%)
              </span>
            </td>
            <td style="padding: 12px 8px; text-align: right; font-weight: 600; color: ${item.varianceValue < 0 ? "#ef4444" : "#22c55e"};">
              ₱${Math.abs(item.varianceValue).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </td>
          </tr>
        `
          )
          .join("")}
      </tbody>
    </table>

    ${hasMore ? `<p style="margin-top: 15px; padding: 10px; background: #fef3c7; border-left: 4px solid #f59e0b; color: #92400e; border-radius: 3px;"><strong>Note:</strong> Showing top 10 variances. ${sortedDiscrepancies.length - 10} more variances detected. View full report in the system.</p>` : ""}
  </div>

  <!-- Action Required Section -->
  <div style="background: white; padding: 30px; border-left: 1px solid #e0e0e0; border-right: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0;">
    <h2 style="color: #dc2626; margin-top: 0; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">⚠️ Action Required</h2>

    <div style="background: #fef2f2; border: 2px solid #fca5a5; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <p style="margin: 0 0 10px 0; font-size: 16px; font-weight: 600; color: #991b1b;">
        Manual review and approval required before fixing variances.
      </p>
      <p style="margin: 0; color: #7f1d1d;">
        Please review the discrepancies and manually approve corrections through the system.
        No automatic fixes have been applied.
      </p>
    </div>

    <div style="text-align: center; margin: 25px 0;">
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports/reconciliation"
         style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 8px; font-weight: bold; font-size: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        🔍 View Full Reconciliation Report
      </a>
    </div>

    <div style="background: #f0f9ff; border-left: 4px solid #0284c7; padding: 15px; border-radius: 3px; margin-top: 20px;">
      <strong style="color: #075985;">📝 Next Steps:</strong>
      <ol style="margin: 10px 0 0 0; padding-left: 20px; color: #0c4a6e;">
        <li style="margin-bottom: 8px;">Review each variance in the reconciliation report</li>
        <li style="margin-bottom: 8px;">Investigate discrepancies using the "Investigate" button</li>
        <li style="margin-bottom: 8px;">Manually approve fixes for verified variances</li>
        <li style="margin-bottom: 8px;">Document root causes in audit log</li>
      </ol>
    </div>
  </div>

  <!-- Footer -->
  <div style="background: #1e293b; color: #cbd5e1; padding: 20px 30px; border-radius: 0 0 10px 10px; font-size: 13px;">
    <p style="margin: 0 0 10px 0;">
      <strong style="color: white;">Generated:</strong> ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine Time)
    </p>
    <p style="margin: 0; font-size: 12px; color: #94a3b8;">
      This is an automated alert from the Igoro Tech Inventory Management System.
      This email was sent to you because you are designated as the Super Admin for stock reconciliation alerts.
    </p>
  </div>

</body>
</html>
  `.trim()
}

/**
 * Generates plain text email body (fallback for clients that don't support HTML)
 */
function generateEmailText(data: ReconciliationAlertData): string {
  const { businessName, summary, discrepancies } = data

  const sortedDiscrepancies = [...discrepancies].sort(
    (a, b) => Math.abs(b.varianceValue) - Math.abs(a.varianceValue)
  )
  const topVariances = sortedDiscrepancies.slice(0, 10)

  return `
STOCK RECONCILIATION ALERT
${businessName}

========================================
SUMMARY
========================================

Total Variances: ${summary.totalVariances}
Requires Investigation: ${summary.requiresInvestigation}
System Health: ${summary.healthPercentage.toFixed(1)}%
Total Variance Value: ₱${Math.abs(summary.totalVarianceValue).toLocaleString("en-PH", { minimumFractionDigits: 2 })}

========================================
TOP VARIANCES DETECTED
========================================

${topVariances
  .map(
    (item, index) =>
      `${index + 1}. ${item.product.name} ${item.variation.name !== "default" ? `(${item.variation.name})` : ""}
   Location: ${item.location.name}
   Expected: ${item.ledgerStock} | Actual: ${item.physicalStock}
   Variance: ${item.variance > 0 ? "+" : ""}${item.variance} (${item.discrepancyPercentage.toFixed(1)}%)
   Value Impact: ₱${Math.abs(item.varianceValue).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
  )
  .join("\n\n")}

${sortedDiscrepancies.length > 10 ? `\n(${sortedDiscrepancies.length - 10} more variances detected. View full report in the system.)` : ""}

========================================
ACTION REQUIRED
========================================

Manual review and approval required before fixing variances.
No automatic fixes have been applied.

View full report:
${process.env.NEXT_PUBLIC_APP_URL}/dashboard/reports/reconciliation

NEXT STEPS:
1. Review each variance in the reconciliation report
2. Investigate discrepancies using the "Investigate" button
3. Manually approve fixes for verified variances
4. Document root causes in audit log

----------------------------------------
Generated: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine Time)

This is an automated alert from the Igoro Tech Inventory Management System.
  `.trim()
}

/**
 * Sends reconciliation alert email to configured recipient
 *
 * @param data Reconciliation report data
 * @throws Error if email sending fails
 */
export async function sendReconciliationAlert(
  data: ReconciliationAlertData
): Promise<void> {
  try {
    // Create transporter
    const transporter = createTransporter()

    // Get recipient email from env or use default
    const recipient = process.env.ALERT_EMAIL_TO || "rr3800@gmail.com"

    // Prepare email content
    const subject = `⚠️ Stock Reconciliation Alert - ${data.summary.totalVariances} Variance${data.summary.totalVariances !== 1 ? "s" : ""} Detected (${data.businessName})`
    const html = generateEmailHTML(data)
    const text = generateEmailText(data)

    console.log(`[EMAIL] Sending reconciliation alert to: ${recipient}`)

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.NEXT_PUBLIC_APP_NAME || "Igoro Tech Inventory System"}" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject,
      text,
      html,
      priority: "high", // Mark as high priority
    })

    console.log(`[EMAIL] Alert sent successfully. Message ID: ${info.messageId}`)
  } catch (error: any) {
    console.error("[EMAIL] Failed to send reconciliation alert:", error)
    throw new Error(`Email notification failed: ${error.message}`)
  }
}

/**
 * Verifies SMTP configuration by sending a test email
 *
 * @returns Promise<boolean> True if test email sent successfully
 */
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    const transporter = createTransporter()

    // Verify connection
    await transporter.verify()

    console.log("[EMAIL] SMTP configuration verified successfully")

    // Send test email
    const recipient = process.env.ALERT_EMAIL_TO || "rr3800@gmail.com"

    await transporter.sendMail({
      from: `"${process.env.NEXT_PUBLIC_APP_NAME || "Igoro Tech Inventory System"}" <${process.env.SMTP_USER}>`,
      to: recipient,
      subject: "✅ Stock Reconciliation Email Configuration Test",
      text: "This is a test email to verify your SMTP configuration for stock reconciliation alerts. If you received this, your email settings are configured correctly!",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #22c55e;">✅ Email Configuration Test Successful</h2>
          <p>This is a test email to verify your SMTP configuration for stock reconciliation alerts.</p>
          <p><strong>If you received this email, your settings are configured correctly!</strong></p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #e0e0e0;">
          <p style="font-size: 12px; color: #666;">
            Sent from: ${process.env.NEXT_PUBLIC_APP_NAME || "Igoro Tech Inventory System"}<br>
            Time: ${new Date().toLocaleString("en-PH", { timeZone: "Asia/Manila" })} (Philippine Time)
          </p>
        </div>
      `,
    })

    console.log("[EMAIL] Test email sent successfully to:", recipient)
    return true
  } catch (error: any) {
    console.error("[EMAIL] SMTP configuration test failed:", error)
    return false
  }
}
