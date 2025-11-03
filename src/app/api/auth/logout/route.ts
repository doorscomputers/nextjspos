import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/auth/logout
 * Log user logout activity before signing out
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (session?.user) {
      const user = session.user as any

      // Log logout activity
      try {
        await createAuditLog({
          businessId: parseInt(user.businessId) || 0,
          userId: parseInt(user.id),
          username: user.username,
          action: AuditAction.USER_LOGOUT,
          entityType: EntityType.USER,
          entityIds: [parseInt(user.id)],
          description: `User ${user.username} logged out`,
          metadata: {
            logoutTime: new Date().toISOString(),
            sessionDuration: 'unknown', // Could calculate if we store login time in session
          },
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request),
        })
      } catch (auditError) {
        console.error('Failed to create logout audit log:', auditError)
        // Don't block logout if audit logging fails
      }
    }

    return NextResponse.json({
      message: 'Logout logged successfully',
      success: true
    })
  } catch (error) {
    console.error('Error logging logout:', error)
    return NextResponse.json(
      {
        error: 'Failed to log logout',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
