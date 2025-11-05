import { openai } from '@ai-sdk/openai'
import { createOpenAI } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'

// Remove edge runtime to allow NextAuth compatibility
// export const runtime = 'edge'

export async function POST(req: Request) {
  // Check authentication
  const session = await getServerSession(authOptions)

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Check which AI provider is configured
  const openaiKey = process.env.OPENAI_API_KEY
  const xaiKey = process.env.XAI_API_KEY

  if (!openaiKey && !xaiKey) {
    console.error('❌ No AI API key configured (OPENAI_API_KEY or XAI_API_KEY)')
    return new Response(
      JSON.stringify({
        error: 'AI Assistant is not configured. Please add OPENAI_API_KEY or XAI_API_KEY to your environment variables.'
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  const body = await req.json()
  console.log('📥 Received request body:', JSON.stringify(body, null, 2))

  const { messages } = body

  if (!messages || !Array.isArray(messages)) {
    console.error('❌ Invalid messages format:', messages)
    return new Response(
      JSON.stringify({ error: 'Invalid request: messages must be an array' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  console.log('📝 Messages count:', messages.length)

  // Add system context about POS system
  const businessName = (session.user as any)?.businessName || 'your business'
  const systemMessage = {
    role: 'system',
    content: `You are an AI assistant for ${businessName}'s Point of Sale system.
    You help users with:
    - Understanding POS features and functionality
    - Analyzing sales data and generating insights
    - Answering questions about inventory management
    - Providing business analytics and recommendations
    - Troubleshooting system issues

    Current user: ${session.user?.name}
    Business: ${businessName}
    Role: ${(session.user as any)?.roles?.[0] || 'User'}

    Be helpful, concise, and provide actionable insights.`
  }

  try {
    let result

    // Use xAI if configured, otherwise fallback to OpenAI
    if (xaiKey && xaiKey !== 'your-xai-api-key-here') {
      console.log('🤖 Using xAI (x.ai) for AI Assistant')

      // Create xAI client (OpenAI-compatible)
      const xai = createOpenAI({
        apiKey: xaiKey,
        baseURL: 'https://api.x.ai/v1',
      })

      console.log('🚀 Calling streamText with xAI...')
      result = await streamText({
        model: xai('grok-beta'), // or 'grok-2-latest'
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        maxTokens: 1000,
      })
      console.log('✅ streamText completed')
    } else if (openaiKey && openaiKey !== 'your-openai-api-key-here') {
      console.log('🤖 Using OpenAI for AI Assistant')

      console.log('🚀 Calling streamText with OpenAI...')
      result = await streamText({
        model: openai('gpt-4o-mini'),
        messages: [systemMessage, ...messages],
        temperature: 0.7,
        maxTokens: 1000,
      })
      console.log('✅ streamText completed')
    } else {
      throw new Error('Valid API key not configured')
    }

    console.log('📤 Sending response...')
    return result.toTextStreamResponse()
  } catch (error: any) {
    console.error('❌ AI API Error:', error)
    console.error('❌ Error details:', {
      message: error.message,
      stack: error.stack,
      cause: error.cause,
    })

    // Provide helpful error message
    let errorMessage = 'Failed to connect to AI service.'

    if (error.message?.includes('401') || error.message?.includes('authentication')) {
      errorMessage = 'Invalid AI API key. Please check your OPENAI_API_KEY or XAI_API_KEY.'
    } else if (error.message?.includes('quota') || error.message?.includes('billing')) {
      errorMessage = 'AI API quota exceeded or billing issue. Please check your account.'
    } else if (error.message?.includes('rate_limit')) {
      errorMessage = 'AI API rate limit exceeded. Please try again in a moment.'
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
