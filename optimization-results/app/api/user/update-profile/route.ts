import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { firstName, lastName, surname, username, email } = body

    // Validation
    if (!firstName || !surname || !username) {
      return NextResponse.json(
        { error: 'First Name, Surname, and Username are required' },
        { status: 400 }
      )
    }

    // Check if username is already taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        username,
        id: { not: parseInt(session.user.id) } // Exclude current user
      }
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username is already taken by another user' },
        { status: 400 }
      )
    }

    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: {
        firstName,
        lastName: lastName || null,
        surname,
        username,
        email: email || null,
        updatedAt: new Date(),
      },
      select: {
        id: { select: { id: true, name: true } },
        firstName: { select: { id: true, name: true } },
        lastName: { select: { id: true, name: true } },
        surname: { select: { id: true, name: true } },
        username: { select: { id: true, name: true } },
        email: { select: { id: true, name: true } },
      }
    })

    // Log the profile update in audit trail (optional)
    await prisma.auditLog.create({
      data: {
        userId: parseInt(session.user.id),
        action: 'PROFILE_UPDATE',
        entityType: 'user',
        entityId: session.user.id,
        details: {
          message: 'User updated their profile',
          fields: { firstName, lastName, surname, username, email }
        },
      },
    }).catch(() => {
      // If audit log fails, don't block the profile update
      console.log('Failed to create audit log for profile update')
    })

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      message: 'Profile updated successfully',
      user: updatedUser
    })

  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}
