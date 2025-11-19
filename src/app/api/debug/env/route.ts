/**
 * Debug Endpoint - Check Environment Variables
 * This will help us see what Next.js is actually reading
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isSemaphoreConfigured, getSemaphoreConfig } from '@/lib/semaphore'

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Semaphore-related environment variables
    const semaphoreEnv = {
      SEMAPHORE_SMS_ENABLED: process.env.SEMAPHORE_SMS_ENABLED,
      SEMAPHORE_API_KEY: process.env.SEMAPHORE_API_KEY ?
        `${process.env.SEMAPHORE_API_KEY.substring(0, 8)}...` : 'NOT SET',
      SEMAPHORE_SENDER_NAME: process.env.SEMAPHORE_SENDER_NAME,
      SEMAPHORE_RECIPIENTS: process.env.SEMAPHORE_RECIPIENTS,
      SMS_ALERT_PURCHASE_APPROVAL_ENABLED: process.env.SMS_ALERT_PURCHASE_APPROVAL_ENABLED,
      SMS_ALERT_SHIFT_CLOSE_ENABLED: process.env.SMS_ALERT_SHIFT_CLOSE_ENABLED,
      SMS_ALERT_CREDIT_SALE_ENABLED: process.env.SMS_ALERT_CREDIT_SALE_ENABLED,
      SMS_ALERT_DISCOUNT_THRESHOLD: process.env.SMS_ALERT_DISCOUNT_THRESHOLD,
    }

    // Check boolean comparisons
    const checks = {
      enabled_value: process.env.SEMAPHORE_SMS_ENABLED,
      enabled_type: typeof process.env.SEMAPHORE_SMS_ENABLED,
      enabled_equals_string_true: process.env.SEMAPHORE_SMS_ENABLED === 'true',
      enabled_truthy: !!process.env.SEMAPHORE_SMS_ENABLED,
      api_key_exists: !!process.env.SEMAPHORE_API_KEY,
      api_key_length: process.env.SEMAPHORE_API_KEY?.length || 0,
      recipients_exists: !!process.env.SEMAPHORE_RECIPIENTS,
      recipients_split: (process.env.SEMAPHORE_RECIPIENTS || '').split(',').filter(Boolean),
      recipients_count: (process.env.SEMAPHORE_RECIPIENTS || '').split(',').filter(Boolean).length,
    }

    // Check actual Semaphore config object state
    const semaphoreConfigState = getSemaphoreConfig()
    const isConfigured = isSemaphoreConfigured()

    return NextResponse.json({
      success: true,
      environment: semaphoreEnv,
      checks,
      semaphoreConfig: semaphoreConfigState,
      isSemaphoreConfigured: isConfigured,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[DebugEnv] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check environment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
