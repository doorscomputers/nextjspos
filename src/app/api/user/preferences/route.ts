import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/user/preferences - Get current user's theme preferences
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userId = parseInt(user.id)

    const userPreferences = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        theme: true,
        themeMode: true,
        sidebarStyle: true,
      },
    })

    if (!userPreferences) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      theme: userPreferences.theme || 'light',
      mode: userPreferences.themeMode || 'light',
      sidebarStyle: userPreferences.sidebarStyle || 'default',
    })
  } catch (error) {
    console.error('Error fetching user preferences:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}

// POST /api/user/preferences - Save user's theme preferences
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userId = parseInt(user.id)

    const body = await request.json()
    const { theme, mode, sidebarStyle } = body

    // Validate inputs
    const validThemes = [
      'light',
      'dark',
      'ocean',
      'forest',
      'purple',
      'sunset',
      'midnight',
      'rose-gold',
      'corporate',
      'high-contrast',
      'minimal',
      'vibrant',
    ]
    const validModes = ['light', 'dark']
    const validSidebarStyles = ['default', 'compact', 'icons-only', 'wide']

    if (theme && !validThemes.includes(theme)) {
      return NextResponse.json({ error: 'Invalid theme' }, { status: 400 })
    }

    if (mode && !validModes.includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    if (sidebarStyle && !validSidebarStyles.includes(sidebarStyle)) {
      return NextResponse.json({ error: 'Invalid sidebar style' }, { status: 400 })
    }

    // Update user preferences
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        theme: theme || undefined,
        themeMode: mode || undefined,
        sidebarStyle: sidebarStyle || undefined,
      },
      select: {
        theme: true,
        themeMode: true,
        sidebarStyle: true,
      },
    })

    return NextResponse.json({
      success: true,
      preferences: {
        theme: updatedUser.theme || 'light',
        mode: updatedUser.themeMode || 'light',
        sidebarStyle: updatedUser.sidebarStyle || 'default',
      },
    })
  } catch (error) {
    console.error('Error saving user preferences:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}
