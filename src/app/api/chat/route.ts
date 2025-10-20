import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// Remove edge runtime to allow NextAuth compatibility
// export const runtime = 'edge'

export async function POST(req: Request) {
  // Check authentication
  const session = await getServerSession(authOptions)

  if (!session) {
    return new Response('Unauthorized', { status: 401 })
  }

  const { messages } = await req.json()

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

  const result = streamText({
    model: openai('gpt-4o-mini'),
    messages: [systemMessage, ...messages],
    temperature: 0.7,
    maxTokens: 1000,
  })

  return result.toDataStreamResponse()
}
