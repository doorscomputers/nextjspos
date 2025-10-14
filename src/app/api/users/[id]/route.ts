import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'

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
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
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
