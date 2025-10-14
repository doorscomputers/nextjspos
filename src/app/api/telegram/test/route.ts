import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  sendTelegramTestMessage,
  getTelegramBotInfo,
  isTelegramConfigured,
} from '@/lib/telegram'

/**
 * POST /api/telegram/test - Test Telegram bot configuration
 * Sends a test message and verifies bot settings
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if Telegram is configured
    if (!isTelegramConfigured()) {
      return NextResponse.json(
        {
          error: 'Telegram not configured',
          message: 'Please configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_IDS in .env',
          configured: false,
        },
        { status: 400 }
      )
    }

    // Get bot information
    let botInfo
    try {
      botInfo = await getTelegramBotInfo()
    } catch (error: any) {
      return NextResponse.json(
        {
          error: 'Invalid bot token',
          message: error.message,
          configured: true,
        },
        { status: 400 }
      )
    }

    // Send test message
    const success = await sendTelegramTestMessage()

    if (!success) {
      return NextResponse.json(
        {
          error: 'Failed to send test message',
          message: 'Check if chat IDs are correct and bot has been started',
          botInfo,
          configured: true,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Test message sent successfully!',
      botInfo: {
        id: botInfo.id,
        name: botInfo.first_name,
        username: botInfo.username,
        can_join_groups: botInfo.can_join_groups,
        can_read_all_group_messages: botInfo.can_read_all_group_messages,
      },
      configured: true,
    })
  } catch (error: any) {
    console.error('Telegram test error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/telegram/test - Check Telegram configuration status
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configured = isTelegramConfigured()

    if (!configured) {
      return NextResponse.json({
        configured: false,
        message: 'Telegram not configured',
      })
    }

    // Try to get bot info
    try {
      const botInfo = await getTelegramBotInfo()
      return NextResponse.json({
        configured: true,
        botInfo: {
          id: botInfo.id,
          name: botInfo.first_name,
          username: botInfo.username,
        },
      })
    } catch (error: any) {
      return NextResponse.json({
        configured: true,
        error: 'Invalid bot token',
        message: error.message,
      })
    }
  } catch (error: any) {
    console.error('Telegram status check error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error.message,
      },
      { status: 500 }
    )
  }
}
