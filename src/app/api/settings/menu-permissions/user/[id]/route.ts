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

    // Get user with their roles
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                menuPermissions: {
                  include: {
                    menuPermission: true
                  }
                }
              }
            }
          }
        },
        menuPermissions: {
          include: {
            menuPermission: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Collect all menu keys from roles
    const roleMenuKeys = new Set<string>()
    user.roles.forEach(userRole => {
      userRole.role.menuPermissions.forEach(rmp => {
        roleMenuKeys.add(rmp.menuPermission.key)
      })
    })

    // Collect user-specific menu keys (overrides)
    const userMenuKeys = new Set<string>()
    user.menuPermissions.forEach(ump => {
      userMenuKeys.add(ump.menuPermission.key)
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
