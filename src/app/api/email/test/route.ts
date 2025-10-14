import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendTestEmail, isEmailConfigured } from '@/lib/email'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if email is configured
    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error: 'Email not configured',
          message: 'Please configure SMTP settings in your .env file',
        },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { email } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email address is required' },
        { status: 400 }
      )
    }

    // Send test email
    const success = await sendTestEmail(email)

    if (success) {
      return NextResponse.json({
        success: true,
        message: `Test email sent successfully to ${email}`,
      })
    } else {
      return NextResponse.json(
        {
          error: 'Failed to send test email',
          message: 'Check server logs for details',
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Test email error:', error)
    return NextResponse.json(
      {
        error: 'Failed to send test email',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
