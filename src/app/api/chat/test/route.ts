import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'

/**
 * Test endpoint to diagnose AI Assistant issues
 * Visit: /api/chat/test to see diagnostic info
 */
export async function GET() {
  try {
    // Check session
    const session = await getServerSession(authOptions)

    // Check API keys
    const openaiKey = process.env.OPENAI_API_KEY
    const xaiKey = process.env.XAI_API_KEY

    const diagnostics = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,

      // Session info
      session: {
        exists: !!session,
        user: session?.user ? {
          id: (session.user as any).id,
          username: session.user.name,
          businessId: (session.user as any).businessId,
        } : null,
      },

      // API Keys status (DO NOT expose actual keys!)
      apiKeys: {
        openai: {
          exists: !!openaiKey,
          isPlaceholder: openaiKey === 'your-openai-api-key-here',
          startsWithCorrectPrefix: openaiKey?.startsWith('sk-') || false,
          length: openaiKey?.length || 0,
          first10Chars: openaiKey?.substring(0, 10) || 'N/A',
        },
        xai: {
          exists: !!xaiKey,
          isPlaceholder: xaiKey === 'your-xai-api-key-here',
          startsWithCorrectPrefix: xaiKey?.startsWith('xai-') || false,
          length: xaiKey?.length || 0,
          first10Chars: xaiKey?.substring(0, 10) || 'N/A',
        },
      },

      // Which API would be used
      selectedProvider: (() => {
        if (xaiKey && xaiKey !== 'your-xai-api-key-here') return 'xAI (Grok)'
        if (openaiKey && openaiKey !== 'your-openai-api-key-here') return 'OpenAI (GPT)'
        return 'NONE - No valid API key configured!'
      })(),

      // Configuration status
      status: {
        canUseAI: (xaiKey && xaiKey !== 'your-xai-api-key-here') ||
                  (openaiKey && openaiKey !== 'your-openai-api-key-here'),
        isAuthenticated: !!session,
        readyToUse: !!session && (
          (xaiKey && xaiKey !== 'your-xai-api-key-here') ||
          (openaiKey && openaiKey !== 'your-openai-api-key-here')
        ),
      },
    }

    return NextResponse.json({
      success: true,
      message: 'AI Assistant Diagnostics',
      diagnostics,
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
