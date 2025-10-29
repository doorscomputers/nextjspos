import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'

type SessionUser = {
  businessId: string
  id?: string
  permissions?: string[]
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as SessionUser

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.USER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get users for the business
    const users = await prisma.user.findMany({
      where: {
        businessId: parseInt(user.businessId),
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userLocations: {
          include: {
            location: true,
          },
        },
      },
      orderBy: {
        username: 'asc',
      },
    })

    // Format response (exclude passwords)
    const formattedUsers = users.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      surname: u.surname,
      firstName: u.firstName,
      lastName: u.lastName,
      allowLogin: u.allowLogin,
      roles: u.roles.map((ur) => ur.role.name),
      locations: u.userLocations.map((ul) => ul.location.name),
      locationAssignments: u.userLocations.map((ul) => ({
        id: ul.location.id,
        name: ul.location.name,
      })),
      createdAt: u.createdAt,
    }))

    return NextResponse.json({ success: true, data: formattedUsers })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as SessionUser
    if (!user.permissions?.includes(PERMISSIONS.USER_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { username, password, email, surname, firstName, lastName, roleIds, locationId, allowLogin } = body

    if (!username || !surname || !firstName) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    // Validate location requirement based on assigned roles
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      // Get role names for the assigned role IDs
      const assignedRoles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { name: true },
      })

      const roleNames = assignedRoles.map((r) => r.name)
      const adminRoles = ['Super Admin', 'Branch Admin', 'All Branch Admin']
      const hasAdminRole = roleNames.some((name) => adminRoles.includes(name))

      // Location is ONLY required if user does NOT have an admin role
      if (!hasAdminRole && !locationId) {
        return NextResponse.json(
          {
            error:
              'Location is required for transactional roles (Cashier, Manager, Staff). Admin roles can work across all locations.',
          },
          { status: 400 }
        )
      }
    } else if (!locationId) {
      // If no roles assigned, require location
      return NextResponse.json({ error: 'Location is required when no admin role is assigned.' }, { status: 400 })
    }

    // Check if username already exists
    const existing = await prisma.user.findUnique({ where: { username } })
    if (existing) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 })
    }

    // Use provided password or default to "123456"
    const userPassword = password || '123456'

    // Hash password
    const hashedPassword = await bcrypt.hash(userPassword, 10)

    // Create user
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email: email || null,
        surname,
        firstName,
        lastName: lastName || null,
        businessId: parseInt(user.businessId),
        allowLogin: allowLogin !== false,
      },
    })

    // Assign roles
    if (roleIds && Array.isArray(roleIds)) {
      await Promise.all(
        roleIds.map((roleId: number) =>
          prisma.userRole.create({
            data: {
              userId: newUser.id,
              roleId,
            },
          })
        )
      )
    }

    // Assign single location
    if (locationId) {
      await prisma.userLocation.create({
        data: {
          userId: newUser.id,
          locationId: parseInt(locationId),
        },
      })
    }

    return NextResponse.json({ success: true, user: { id: newUser.id, username: newUser.username } }, { status: 201 })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as SessionUser
    if (!user.permissions?.includes(PERMISSIONS.USER_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Verify the user exists and belongs to the same business
    const targetUser = await prisma.user.findFirst({
      where: {
        id: parseInt(userId),
        businessId: parseInt(user.businessId),
        deletedAt: null,
      },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found or already deleted' }, { status: 404 })
    }

    // Prevent self-deletion
    if (targetUser.id === parseInt(user.id ?? '0')) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    // Soft delete
    await prisma.user.update({
      where: { id: parseInt(userId) },
      data: {
        deletedAt: new Date(),
        allowLogin: false,
      },
    })

    return NextResponse.json({ success: true, message: 'User deleted successfully' })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
