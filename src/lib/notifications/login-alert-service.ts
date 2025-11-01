/**
 * Login Alert Service
 * Unified service to send login notifications via Telegram, Email, and SMS
 */

import { sendSMSToAdmins, formatLoginSMS, formatLocationMismatchSMS } from './sms-semaphore'

interface LoginAlertData {
  username: string
  fullName: string
  role: string
  selectedLocation: string
  assignedLocations: string[]
  timestamp: Date
  ipAddress?: string
  isMismatch: boolean
}

/**
 * Send Telegram login alert
 * ONLY sends for location mismatches (cost saving + reduce noise)
 */
async function sendTelegramLoginAlert(data: LoginAlertData): Promise<void> {
  try {
    // ONLY send Telegram alerts for location mismatches
    if (!data.isMismatch) {
      console.log('[Telegram] Skipping - successful login (only mismatches sent)')
      return
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatIds = process.env.TELEGRAM_CHAT_IDS?.split(',').filter(Boolean) || []

    if (!botToken || chatIds.length === 0) {
      console.log('[Telegram] Not configured, skipping')
      return
    }

    if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== 'true') {
      console.log('[Telegram] Disabled, skipping')
      return
    }

    // Build mismatch alert message
    let message = `🚨 CRITICAL: LOCATION MISMATCH\n\n`
    message += `👤 User: ${data.username} (${data.fullName})\n`
    message += `🎭 Role: ${data.role}\n`
    message += `❌ Logged in at: ${data.selectedLocation}\n`
    message += `✅ Assigned to: ${data.assignedLocations.join(', ')}\n`
    message += `\n⚠️ ACTION REQUIRED: Verify immediately!\n`
    message += `⏰ Time: ${data.timestamp.toLocaleString('en-PH')}\n`
    if (data.ipAddress) {
      message += `📍 IP: ${data.ipAddress}\n`
    }

    // Send to all chat IDs
    for (const chatId of chatIds) {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId.trim(),
          text: message,
          parse_mode: 'HTML',
        }),
      })
    }

    console.log('[Telegram] ✓ Location mismatch alert sent')
  } catch (error: any) {
    console.error('[Telegram] Failed to send location mismatch alert:', error.message)
  }
}

/**
 * Send Email login alert
 */
async function sendEmailLoginAlert(data: LoginAlertData): Promise<void> {
  try {
    if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') {
      console.log('[Email] Disabled, skipping')
      return
    }

    const emailAddresses = process.env.EMAIL_ADMIN_RECIPIENTS?.split(',').filter(Boolean) || []
    if (emailAddresses.length === 0) {
      console.log('[Email] No recipients configured, skipping')
      return
    }

    const nodemailer = await import('nodemailer')

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const subject = data.isMismatch
      ? `🚨 CRITICAL: Location Mismatch - ${data.username}`
      : `🔐 Login Alert - ${data.username}`

    let htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${data.isMismatch ? '#dc2626' : '#2563eb'}; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">${data.isMismatch ? '🚨 CRITICAL ALERT' : '🔐 Login Notification'}</h2>
          <p style="margin: 5px 0 0 0;">${data.isMismatch ? 'Location Mismatch Detected' : 'User Login Recorded'}</p>
        </div>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 12px 8px; font-weight: bold;">User:</td>
              <td style="padding: 12px 8px;">${data.username} (${data.fullName})</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 12px 8px; font-weight: bold;">Role:</td>
              <td style="padding: 12px 8px;">${data.role}</td>
            </tr>
    `

    if (data.isMismatch) {
      htmlContent += `
            <tr style="border-bottom: 1px solid #d1d5db; background: #fee2e2;">
              <td style="padding: 12px 8px; font-weight: bold;">⚠️ Logged in at:</td>
              <td style="padding: 12px 8px; color: #dc2626; font-weight: bold;">${data.selectedLocation}</td>
            </tr>
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 12px 8px; font-weight: bold;">✓ Assigned to:</td>
              <td style="padding: 12px 8px;">${data.assignedLocations.join(', ')}</td>
            </tr>
      `
    } else {
      htmlContent += `
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 12px 8px; font-weight: bold;">Location:</td>
              <td style="padding: 12px 8px;">${data.selectedLocation}</td>
            </tr>
      `
    }

    htmlContent += `
            <tr style="border-bottom: 1px solid #d1d5db;">
              <td style="padding: 12px 8px; font-weight: bold;">Time:</td>
              <td style="padding: 12px 8px;">${data.timestamp.toLocaleString('en-PH', {
                dateStyle: 'full',
                timeStyle: 'medium'
              })}</td>
            </tr>
    `

    if (data.ipAddress) {
      htmlContent += `
            <tr>
              <td style="padding: 12px 8px; font-weight: bold;">IP Address:</td>
              <td style="padding: 12px 8px;">${data.ipAddress}</td>
            </tr>
      `
    }

    htmlContent += `
          </table>
        </div>
    `

    if (data.isMismatch) {
      htmlContent += `
        <div style="background: #fee2e2; border: 2px solid #dc2626; border-radius: 8px; padding: 16px; margin-top: 20px;">
          <p style="margin: 0; color: #991b1b; font-weight: bold;">⚠️ ACTION REQUIRED</p>
          <p style="margin: 8px 0 0 0; color: #7f1d1d;">
            This user logged in at a location they are not assigned to. Please verify this login immediately and contact the user if necessary.
          </p>
        </div>
      `
    }

    htmlContent += `
      </div>
    `

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: emailAddresses.join(','),
      subject,
      html: htmlContent,
    })

    console.log('[Email] ✓ Login alert sent')
  } catch (error: any) {
    console.error('[Email] Failed to send login alert:', error.message)
  }
}

/**
 * Send SMS login alert (only for non-admin logins or critical mismatches)
 */
async function sendSMSLoginAlert(data: LoginAlertData, isAdmin: boolean): Promise<void> {
  try {
    // Skip SMS for admin logins unless it's a mismatch
    if (isAdmin && !data.isMismatch) {
      if (process.env.SEND_SMS_FOR_ADMIN_LOGINS === 'false') {
        console.log('[SMS] Skipping SMS for admin login (cost saving)')
        return
      }
    }

    // Check if SMS is enabled for cashier logins
    if (!isAdmin && process.env.SEND_SMS_FOR_CASHIER_LOGINS !== 'true') {
      console.log('[SMS] SMS for cashier logins is disabled')
      return
    }

    // Always send SMS for location mismatch regardless of role
    if (data.isMismatch && process.env.SEND_SMS_FOR_LOCATION_MISMATCH !== 'true') {
      console.log('[SMS] SMS for location mismatch is disabled')
      return
    }

    const time = data.timestamp.toLocaleTimeString('en-PH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })

    let message: string
    if (data.isMismatch) {
      message = formatLocationMismatchSMS(
        data.username,
        data.selectedLocation,
        data.assignedLocations[0] || 'Unknown'
      )
    } else {
      message = formatLoginSMS(data.username, data.selectedLocation, time)
    }

    const result = await sendSMSToAdmins(message)
    console.log(`[SMS] ✓ Sent to ${result.sent} admin(s), ${result.failed} failed`)
  } catch (error: any) {
    console.error('[SMS] Failed to send login alert:', error.message)
  }
}

/**
 * Main function to send login alerts via all channels
 */
export async function sendLoginAlerts(
  data: LoginAlertData,
  isAdmin: boolean = false
): Promise<void> {
  console.log('[LoginAlert] Login detected...')
  console.log('[LoginAlert] User:', data.username, '| Role:', data.role, '| Location:', data.selectedLocation, '| Mismatch:', data.isMismatch)

  // Skip ALL notifications for Super Admin logins (cost saving + privacy)
  if (isAdmin) {
    console.log('[LoginAlert] ℹ️  Super Admin login - notifications skipped')
    return
  }

  console.log('[LoginAlert] Sending notifications for non-admin user...')

  // Send all notifications in parallel (non-blocking)
  await Promise.allSettled([
    sendTelegramLoginAlert(data),
    sendEmailLoginAlert(data),
    sendSMSLoginAlert(data, isAdmin),
  ])

  console.log('[LoginAlert] ✓ All notifications processed')
}
