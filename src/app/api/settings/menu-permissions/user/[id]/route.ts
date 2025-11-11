import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

// GET /api/settings/menu-permissions/user/[id]
// Get all accessible menu keys for a user (combines role permissions + user overrides)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Get user basic info first
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        businessId: true,
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Use parallel queries instead of nested includes for better performance
    const [userRoles, userMenuPermissions] = await Promise.all([
      // Get user's role IDs
      prisma.userRole.findMany({
        where: { userId },
        select: { roleId: true }
      }),
      // Get user's direct menu permissions
      prisma.userMenuPermission.findMany({
        where: { userId },
        include: {
          menuPermission: {
            select: { key: true }
          }
        }
      })
    ])

    // Extract role IDs
    const roleIds = userRoles.map(ur => ur.roleId)

    // Get menu permissions for all roles in one query
    const roleMenuPermissions = roleIds.length > 0
      ? await prisma.roleMenuPermission.findMany({
          where: { roleId: { in: roleIds } },
          include: {
            menuPermission: {
              select: { key: true }
            }
          }
        })
      : []

    // Collect all menu keys from roles (simplified loop)
    const roleMenuKeys = new Set<string>()
    roleMenuPermissions.forEach(rmp => {
      if (rmp.menuPermission?.key) {
        roleMenuKeys.add(rmp.menuPermission.key)
      }
    })

    // Collect user-specific menu keys (overrides)
    const userMenuKeys = new Set<string>()
    userMenuPermissions.forEach(ump => {
      if (ump.menuPermission?.key) {
        userMenuKeys.add(ump.menuPermission.key)
      }
    })

    // Combine: user overrides take precedence, then fall back to role permissions
    const accessibleMenuKeys = Array.from(new Set([...roleMenuKeys, ...userMenuKeys]))

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        username: user.username,
        accessibleMenuKeys
      }
    })

  } catch (error) {
    console.error('Error fetching user menu permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch menu permissions' },
      { status: 500 }
    )
  }
}

// PUT /api/settings/menu-permissions/user/[id]
// Update user's direct menu permissions (overrides role permissions)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check permission
    if (!hasPermission(session.user, PERMISSIONS.USER_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const userId = parseInt(id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await req.json()
    const { menuPermissionIds } = body

    if (!Array.isArray(menuPermissionIds)) {
      return NextResponse.json({ error: 'menuPermissionIds must be an array' }, { status: 400 })
    }

    // Verify user exists and is in same business
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, businessId: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.businessId !== session.user.businessId) {
      return NextResponse.json({ error: 'Cannot modify users from other businesses' }, { status: 403 })
    }

    // Delete existing user menu permissions
    await prisma.userMenuPermission.deleteMany({
      where: { userId }
    })

    // Create new assignments
    if (menuPermissionIds.length > 0) {
      await prisma.userMenuPermission.createMany({
        data: menuPermissionIds.map((menuPermissionId: number) => ({
          userId,
          menuPermissionId
        })),
        skipDuplicates: true
      })
    }

    return NextResponse.json({
      success: true,
      message: 'User menu permissions updated successfully',
      count: menuPermissionIds.length
    })

  } catch (error) {
    console.error('Error updating user menu permissions:', error)
    return NextResponse.json(
      { error: 'Failed to update menu permissions' },
      { status: 500 }
    )
  }
}
