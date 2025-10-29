import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    console.log('🧪 Test API called')

    const body = await request.json()
    console.log('🧪 Test request body:', body)

    return NextResponse.json({
      success: true,
      message: 'Test API working',
      received: body
    })
  } catch (error) {
    console.error('🧪 Test API error:', error)
    return NextResponse.json({
      error: 'Test API failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}