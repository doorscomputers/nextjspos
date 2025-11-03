import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/users/[id]/reset-password
 * Reset a user's password (Admin function)
 *
 * Body:
 * - newPassword: string (optional) - If provided, sets this password. Otherwise generates random one.
 * - forceChangeOnLogin: boolean (optional, default: true) - User must change password on next login
 *
 * Returns: { success: true, temporaryPassword: string (if generated) }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const currentUser = session.user as any

    // Check permission - only users with USER_UPDATE can reset passwords
    if (!currentUser.permissions?.includes(PERMISSIONS.USER_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const userId = parseInt((await params).id)
    if (isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Get user to reset
    const userToReset = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(currentUser.businessId),
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
    })

    if (!userToReset) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { newPassword, forceChangeOnLogin = true } = body

    // Generate or use provided password
    let temporaryPassword: string | undefined
    let passwordToSet: string

    if (newPassword && typeof newPassword === 'string' && newPassword.length >= 6) {
      // Use provided password
      passwordToSet = newPassword
    } else {
      // Generate random 12-character password
      temporaryPassword = generateRandomPassword()
      passwordToSet = temporaryPassword
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(passwordToSet, 10)

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        // You could add a field like `mustChangePassword: forceChangeOnLogin` if your schema supports it
      },
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(currentUser.businessId),
      userId: parseInt(currentUser.id),
      username: currentUser.username,
      action: AuditAction.USER_UPDATE,
      entityType: EntityType.USER,
      entityIds: [userId],
      description: `Password reset for user: ${userToReset.username} by ${currentUser.username}`,
      metadata: {
        resetBy: currentUser.username,
        targetUser: userToReset.username,
        forceChangeOnLogin,
        timestamp: new Date().toISOString(),
      },
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    })

    // Return response
    if (temporaryPassword) {
      return NextResponse.json({
        success: true,
        message: 'Password reset successfully',
        temporaryPassword,
        username: userToReset.username,
      })
    } else {
      return NextResponse.json({
        success: true,
        message: 'Password updated successfully',
      })
    }
  } catch (error) {
    console.error('Error resetting password:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Generate a random password
 * Format: 3 uppercase + 3 lowercase + 3 digits + 3 special chars
 */
function generateRandomPassword(): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const lowercase = 'abcdefghijklmnopqrstuvwxyz'
  const digits = '0123456789'
  const special = '!@#$%^&*'

  const getRandomChar = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)]

  let password = ''

  // Add 3 of each type
  for (let i = 0; i < 3; i++) {
    password += getRandomChar(uppercase)
    password += getRandomChar(lowercase)
    password += getRandomChar(digits)
    password += getRandomChar(special)
  }

  // Shuffle the password
  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
}
