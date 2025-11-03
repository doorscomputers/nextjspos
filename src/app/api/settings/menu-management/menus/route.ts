import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/settings/menu-management/menus
// Get all menu items
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const menus = await prisma.menuPermission.findMany({
      orderBy: [
        { parentId: 'asc' },
        { order: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: menus
    })

  } catch (error) {
    console.error('Error fetching menus:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menus' },
      { status: 500 }
    )
  }
}

// POST /api/settings/menu-management/menus
// Create a new menu item
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await req.json()
    const { key, name, href, parentId, order } = body

    // Validate required fields
    if (!key || !name || !href) {
      return NextResponse.json(
        { error: 'Key, name, and href are required' },
        { status: 400 }
      )
    }

    // Check if key already exists
    const existing = await prisma.menuPermission.findUnique({
      where: { key }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A menu with this key already exists' },
        { status: 400 }
      )
    }

    // Create menu item
    const menu = await prisma.menuPermission.create({
      data: {
        key,
        name,
        href,
        parentId: parentId || null,
        order: order || 0
      }
    })

    return NextResponse.json({
      success: true,
      data: menu
    })

  } catch (error) {
    console.error('Error creating menu:', error)
    return NextResponse.json(
      { error: 'Failed to create menu' },
      { status: 500 }
    )
  }
}
