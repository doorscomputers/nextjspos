/**
 * API Route: User Menu Permissions (Overrides)
 * GET /api/settings/menu-permissions/user/[userId] - Get user's menu permission overrides
 * PUT /api/settings/menu-permissions/user/[userId] - Update user's menu permission overrides
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import {
  getUserMenuPermissions,
  updateUserMenuPermissions,
  getUserAccessibleMenuKeys,
} from '@/lib/menu-permissions'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    if (!hasPermission(session.user, PERMISSIONS.USER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId: userIdParam } = await params
    const userId = parseInt(userIdParam)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Check if user exists and belongs to same business
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(session.user.businessId as string),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get query parameter to determine what to return
    const searchParams = request.nextUrl.searchParams
    const type = searchParams.get('type') || 'overrides' // 'overrides' or 'all'

    let menuKeys

    if (type === 'all') {
      // Return all menus user can access (role + overrides)
      menuKeys = await getUserAccessibleMenuKeys(userId)
    } else {
      // Return only user-specific overrides
      menuKeys = await getUserMenuPermissions(userId)
    }

    return NextResponse.json({
      success: true,
      data: {
        userId,
        username: user.username,
        firstName: user.firstName,
        surname: user.surname,
        roles: user.roles.map((ur) => ur.role.name),
        menuKeys,
      },
    })
  } catch (error) {
    console.error('Error fetching user menu permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // Authentication check
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Authorization check
    if (!hasPermission(session.user, PERMISSIONS.USER_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { userId: userIdParam } = await params
    const userId = parseInt(userIdParam)

    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Check if user exists and belongs to same business
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(session.user.businessId as string),
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get request body
    const body = await request.json()
    const { menuKeys } = body

    if (!Array.isArray(menuKeys)) {
      return NextResponse.json(
        { error: 'menuKeys must be an array' },
        { status: 400 }
      )
    }

    // Update user menu permissions
    await updateUserMenuPermissions(userId, menuKeys)

    return NextResponse.json({
      success: true,
      message: 'User menu permissions updated successfully',
      data: {
        userId,
        username: user.username,
        menuKeys,
      },
    })
  } catch (error) {
    console.error('Error updating user menu permissions:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
