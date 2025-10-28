import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'
import { sendTelegramUserRoleChangeAlert } from '@/lib/telegram'

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as any

    // Check permission
    if (!sessionUser.permissions?.includes(PERMISSIONS.USER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)

    // Get user
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(sessionUser.businessId),
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
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Format response (exclude password)
    const formattedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      surname: user.surname,
      firstName: user.firstName,
      lastName: user.lastName,
      allowLogin: user.allowLogin,
      roleIds: user.roles.map(ur => ur.roleId),
      roles: user.roles.map(ur => ur.role.name),
      locationId: user.userLocations.length > 0 ? user.userLocations[0].locationId : null, // Changed to single location
      locationIds: user.userLocations.map(ul => ul.locationId), // Keep for backward compatibility
      locations: user.userLocations.map(ul => ul.location.name),
      createdAt: user.createdAt,
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT (update) user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as any

    // Check permission
    if (!sessionUser.permissions?.includes(PERMISSIONS.USER_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    const body = await request.json()
    const {
      username,
      password,
      email,
      surname,
      firstName,
      lastName,
      roleIds,
      locationId, // Changed to single location
      allowLogin
    } = body

    // Check if user exists and belongs to the same business
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(sessionUser.businessId),
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: { select: { name: true } }
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Store previous roles for notification
    const previousRoleNames = existingUser.roles.map(ur => ur.role.name)

    // Validate location requirement based on assigned roles
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      // Get role names for the assigned role IDs
      const assignedRoles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        select: { name: true }
      })

      const roleNames = assignedRoles.map(r => r.name)
      const adminRoles = ['Super Admin', 'Branch Admin', 'All Branch Admin']
      const hasAdminRole = roleNames.some(name => adminRoles.includes(name))

      // Location is ONLY required if user does NOT have an admin role
      if (!hasAdminRole && locationId === undefined) {
        // Check if user currently has a location
        const currentLocation = await prisma.userLocation.findFirst({
          where: { userId }
        })

        if (!currentLocation) {
          return NextResponse.json({
            error: 'Location is required for transactional roles (Cashier, Manager, Staff). Admin roles can work across all locations.'
          }, { status: 400 })
        }
      }
    }

    // If username is being changed, check if new username is available
    if (username && username !== existingUser.username) {
      const usernameTaken = await prisma.user.findUnique({
        where: { username },
      })
      if (usernameTaken) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      ...(username && { username }),
      ...(email !== undefined && { email: email || null }),
      ...(surname && { surname }),
      ...(firstName && { firstName }),
      ...(lastName !== undefined && { lastName: lastName || null }),
      ...(allowLogin !== undefined && { allowLogin }),
    }

    // If password is provided, hash it
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    // Update roles if provided
    if (roleIds && Array.isArray(roleIds)) {
      // Delete existing role assignments
      await prisma.userRole.deleteMany({
        where: { userId },
      })

      // Create new role assignments
      await Promise.all(
        roleIds.map((roleId: number) =>
          prisma.userRole.create({
            data: {
              userId,
              roleId,
            },
          })
        )
      )
    }

    // Update location if provided (single location)
    if (locationId !== undefined) {
      // Delete existing location assignments
      await prisma.userLocation.deleteMany({
        where: { userId },
      })

      // Create new location assignment
      if (locationId) {
        await prisma.userLocation.create({
          data: {
            userId,
            locationId: parseInt(locationId),
          },
        })
      }
    }

    // Send Telegram notification for role changes
    if (roleIds && Array.isArray(roleIds)) {
      try {
        const newRoles = await prisma.role.findMany({
          where: { id: { in: roleIds } },
          select: { name: true }
        })
        const newRoleNames = newRoles.map(r => r.name)

        // Only send notification if roles actually changed
        const rolesChanged =
          previousRoleNames.length !== newRoleNames.length ||
          previousRoleNames.some(r => !newRoleNames.includes(r)) ||
          newRoleNames.some(r => !previousRoleNames.includes(r))

        if (rolesChanged) {
          const changedByName = [sessionUser.firstName, sessionUser.lastName].filter(Boolean).join(' ') || sessionUser.username || `User#${sessionUser.id}`
          const userName = [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' ') || updatedUser.username

          await sendTelegramUserRoleChangeAlert({
            userName,
            userEmail: updatedUser.email || undefined,
            previousRole: previousRoleNames.join(', ') || 'None',
            newRole: newRoleNames.join(', ') || 'None',
            changedBy: changedByName,
            timestamp: new Date()
          })
        }
      } catch (telegramError) {
        console.error('Telegram notification failed:', telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
      },
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
