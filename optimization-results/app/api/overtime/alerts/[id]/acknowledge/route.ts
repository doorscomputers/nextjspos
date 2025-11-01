import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/overtime/alerts/[id]/acknowledge
 * Acknowledge an overtime alert
 * Body:
 *  - resolution: optional resolution note
 *  - markResolved: boolean, if true marks as resolved instead of acknowledged
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

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)
    const { id } = await params

    // Permission check
    const permissions = user.permissions || []
    if (!permissions.includes(PERMISSIONS.OVERTIME_ALERTS_ACKNOWLEDGE) &&
        !permissions.includes(PERMISSIONS.OVERTIME_ALERTS_MANAGE)) {
      return NextResponse.json({
        error: 'You do not have permission to acknowledge overtime alerts'
      }, { status: 403 })
    }

    const body = await request.json()
    const markResolved = body.markResolved === true

    // Fetch the alert
    const alert = await prisma.overtimeAlert.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        deletedAt: null,
      }
    })

    if (!alert) {
      return NextResponse.json({
        error: 'Overtime alert not found'
      }, { status: 404 })
    }

    // Update alert
    const updatedAlert = await prisma.overtimeAlert.update({
      where: { id: parseInt(id) },
      data: {
        status: markResolved ? 'resolved' : 'acknowledged',
        acknowledgedBy: currentUserId,
        acknowledgedAt: new Date(),
        ...(body.resolution && { resolution: body.resolution }),
      },
      select: {
        user: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
          }
        },
        location: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
        acknowledger: {
          select: {
            id: { select: { id: true, name: true } },
            username: { select: { id: true, name: true } },
            firstName: { select: { id: true, name: true } },
            lastName: { select: { id: true, name: true } },
          }
        }
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'UPDATE',
        entityType: 'OvertimeAlert',
        entityId: parseInt(id),
        changes: {
          action: markResolved ? 'resolved' : 'acknowledged',
          resolution: body.resolution,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      message: `Overtime alert ${markResolved ? 'resolved' : 'acknowledged'} successfully`,
      alert: updatedAlert
    })
  } catch (error) {
    console.error('Error acknowledging overtime alert:', error)
    return NextResponse.json({
      error: 'Failed to acknowledge overtime alert',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
