import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

// GET - Fetch fresh permissions from database (bypasses cached JWT)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const userId = parseInt(user.id)

    // Fetch fresh user data with roles and permissions from database
    const freshUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!freshUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Collect all permissions (from roles and direct permissions)
    const permissionsSet = new Set<string>()

    // Add role permissions
    for (const userRole of freshUser.roles) {
      for (const rolePermission of userRole.role.permissions) {
        permissionsSet.add(rolePermission.permission.name)
      }
    }

    // Add direct user permissions
    for (const userPermission of freshUser.permissions) {
      permissionsSet.add(userPermission.permission.name)
    }

    const permissions = Array.from(permissionsSet)

    return NextResponse.json({
      success: true,
      permissions,
      roles: freshUser.roles.map(ur => ur.role.name),
      username: freshUser.username,
      businessId: freshUser.businessId
    })

  } catch (error) {
    console.error('Error fetching fresh permissions:', error)
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 })
  }
}
