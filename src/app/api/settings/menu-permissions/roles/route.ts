import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

// GET /api/settings/menu-permissions/roles
// Get all roles with their menu permission counts
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has permission to view roles
    if (!session.user.permissions.includes(PERMISSIONS.ROLE_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all roles for the business with menu permission counts
    const roles = await prisma.role.findMany({
      where: {
        businessId: parseInt(session.user.businessId)
      },
      include: {
        _count: {
          select: {
            menuPermissions: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    return NextResponse.json({
      success: true,
      data: roles.map(role => ({
        id: role.id,
        name: role.name,
        displayName: role.name, // Use name as displayName
        menuPermissionCount: role._count.menuPermissions
      }))
    })

  } catch (error) {
    console.error('Error fetching roles for menu permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch roles' },
      { status: 500 }
    )
  }
}
