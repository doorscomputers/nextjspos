import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma.simple'

export async function GET() {
  try {
    console.log('Testing database connection...')
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.split('@')[1]) // Log without password

    // Simple query to test connection
    const userCount = await prisma.user.count()

    return NextResponse.json({
      success: true,
      message: 'Database connection successful',
      userCount,
    })
  } catch (error: any) {
    console.error('Database test failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack,
    }, { status: 500 })
  }
}
