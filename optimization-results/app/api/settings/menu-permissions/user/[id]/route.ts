import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
        id: { select: { id: true, name: true } },
        username: { select: { id: true, name: true } },
        businessId: { select: { id: true, name: true } },
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
        select: { roleId: { select: { id: true, name: true } } }
      }),
      // Get user's direct menu permissions
      prisma.userMenuPermission.findMany({
        where: { userId },
        select: {
          menuPermission: {
            select: { key: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } } }
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
          select: {
            menuPermission: {
              select: { key: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } } }
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
      success: { select: { id: true, name: true } },
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
