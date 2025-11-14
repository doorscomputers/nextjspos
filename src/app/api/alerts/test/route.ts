/**
 * Test Endpoint for Alert Service
 *
 * Tests both Telegram and SMS alerts simultaneously
 * GET /api/alerts/test
 */

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTestMessage } from '@/lib/alert-service'

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('[AlertTest] Sending test message to both Telegram and SMS...')
    const results = await sendTestMessage()

    return NextResponse.json({
      success: true,
      message: 'Test alerts sent',
      results: {
        telegram: {
          enabled: results.telegram,
          status: results.telegram ? 'Message sent successfully' : 'Failed or not configured',
        },
        sms: {
          enabled: results.sms,
          status: results.sms ? 'Message sent successfully' : 'Failed or not configured',
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[AlertTest] Error sending test alerts:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test alerts',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
