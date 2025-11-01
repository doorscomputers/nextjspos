/**
 * Semaphore SMS Notification Service
 * Documentation: https://semaphore.co/docs
 * Cost: ₱0.70 per SMS (Philippines)
 */

interface SemaphoreResponse {
  success: boolean
  message?: string
  messageId?: string
  balance?: number
}

/**
 * Send SMS via Semaphore API
 * @param phoneNumber - Phone number in +63 format (e.g., +639171234567)
 * @param message - SMS message (max 160 characters for single SMS)
 * @returns Promise<SemaphoreResponse>
 */
export async function sendSMS(
  phoneNumber: string,
  message: string
): Promise<SemaphoreResponse> {
  try {
    // Check if SMS is enabled
    if (process.env.SMS_ENABLED !== 'true') {
      console.log('[SMS] SMS disabled via environment variable')
      return { success: false, message: 'SMS disabled' }
    }

    // Validate API key
    const apiKey = process.env.SEMAPHORE_API_KEY
    if (!apiKey) {
      console.error('[SMS] SEMAPHORE_API_KEY not configured')
      return { success: false, message: 'API key not configured' }
    }

    // Validate phone number format
    if (!phoneNumber.startsWith('+63')) {
      console.error('[SMS] Invalid phone number format:', phoneNumber)
      return { success: false, message: 'Invalid phone number format' }
    }

    // Get sender name (max 11 characters)
    const senderName = process.env.SEMAPHORE_SENDER_NAME || 'POSSystem'

    // Truncate message if too long (160 chars for single SMS)
    let finalMessage = message
    if (message.length > 160) {
      finalMessage = message.substring(0, 157) + '...'
      console.warn(`[SMS] Message truncated from ${message.length} to 160 characters`)
    }

    console.log(`[SMS] Sending SMS to ${phoneNumber}`)
    console.log(`[SMS] Message: ${finalMessage}`)

    // Send SMS via Semaphore API
    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        apikey: apiKey,
        number: phoneNumber,
        message: finalMessage,
        sendername: senderName,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[SMS] Semaphore API error:', data)
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`,
      }
    }

    console.log('[SMS] ✓ SMS sent successfully')
    console.log('[SMS] Response:', data)

    return {
      success: true,
      messageId: data[0]?.message_id,
      balance: data[0]?.account?.account_balance,
    }
  } catch (error: any) {
    console.error('[SMS] Failed to send SMS:', error.message)
    return {
      success: false,
      message: error.message,
    }
  }
}

/**
 * Send SMS to multiple admin numbers
 * @param message - SMS message to send
 * @returns Promise with results for each number
 */
export async function sendSMSToAdmins(message: string): Promise<{
  sent: number
  failed: number
  results: Array<{ phoneNumber: string; success: boolean; error?: string }>
}> {
  const phoneNumbers = process.env.ADMIN_SMS_NUMBERS?.split(',').map((n) => n.trim()) || []

  if (phoneNumbers.length === 0) {
    console.warn('[SMS] No admin phone numbers configured')
    return { sent: 0, failed: 0, results: [] }
  }

  console.log(`[SMS] Sending SMS to ${phoneNumbers.length} admin(s)`)

  const results = await Promise.allSettled(
    phoneNumbers.map(async (phoneNumber) => {
      const result = await sendSMS(phoneNumber, message)
      return {
        phoneNumber,
        success: result.success,
        error: result.message,
      }
    })
  )

  let sent = 0
  let failed = 0
  const finalResults: Array<{ phoneNumber: string; success: boolean; error?: string }> = []

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      if (result.value.success) {
        sent++
      } else {
        failed++
      }
      finalResults.push(result.value)
    } else {
      failed++
      finalResults.push({
        phoneNumber: 'unknown',
        success: false,
        error: result.reason?.message || 'Unknown error',
      })
    }
  })

  console.log(`[SMS] Summary: ${sent} sent, ${failed} failed`)

  return { sent, failed, results: finalResults }
}

/**
 * Format login alert message for SMS (160 char limit)
 * @param username - User's username
 * @param location - Location name
 * @param time - Login time
 * @returns Formatted SMS message
 */
export function formatLoginSMS(username: string, location: string, time: string): string {
  // Keep it under 160 characters
  return `POS LOGIN: ${username} at ${location}, ${time}`
}

/**
 * Format location mismatch alert for SMS
 * @param username - User's username
 * @param selectedLocation - Location they selected
 * @param assignedLocation - Location they're assigned to
 * @returns Formatted SMS message
 */
export function formatLocationMismatchSMS(
  username: string,
  selectedLocation: string,
  assignedLocation: string
): string {
  return `⚠️ ALERT: ${username} logged at ${selectedLocation.toUpperCase()} but assigned to ${assignedLocation.toUpperCase()}. Verify now!`
}
