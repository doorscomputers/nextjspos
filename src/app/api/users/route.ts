import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

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
        createdAt: 'desc',
      },
    })

    // Format response (exclude passwords)
    const formattedUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      surname: u.surname,
      firstName: u.firstName,
      lastName: u.lastName,
      allowLogin: u.allowLogin,
      roles: u.roles.map(ur => ur.role.name),
      locations: u.userLocations.map(ul => ul.location.name),
      createdAt: u.createdAt,
    }))

    return NextResponse.json(formattedUsers)
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

    const user = session.user as any
    if (!user.permissions?.includes(PERMISSIONS.USER_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { username, password, email, surname, firstName, lastName, roleIds, locationId, allowLogin } = body

    if (!username || !surname || !firstName) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 })
    }

    if (!locationId) {
      return NextResponse.json({ error: 'Location is required. Please select a location for the user.' }, { status: 400 })
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

    const user = session.user as any
    if (!user.permissions?.includes(PERMISSIONS.USER_DELETE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'User ID required' }, { status: 400 })
    }

    // Soft delete
    await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        deletedAt: new Date(),
        allowLogin: false,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
