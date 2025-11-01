import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * POST /api/location-changes/[id]/submit-xreading
 * Submit X-Reading data for a location change request
 * Body:
 *   - xReadingData: X-Reading object from /api/readings/x-reading
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

    const body = await request.json()

    if (!body.xReadingData) {
      return NextResponse.json({
        error: 'X-Reading data is required'
      }, { status: 400 })
    }

    // Fetch the location change request
    const locationRequest = await prisma.locationChangeRequest.findFirst({
      where: {
        id: parseInt(id),
        businessId,
        requestedBy: currentUserId, // Only the requester can submit X-Reading
        status: 'pending',
        deletedAt: null,
      }
    })

    if (!locationRequest) {
      return NextResponse.json({
        error: 'Location change request not found or you do not have permission to update it'
      }, { status: 404 })
    }

    if (!locationRequest.xReadingRequired) {
      return NextResponse.json({
        error: 'X-Reading is not required for this location change request'
      }, { status: 400 })
    }

    if (locationRequest.xReadingData) {
      return NextResponse.json({
        error: 'X-Reading has already been submitted for this request'
      }, { status: 409 })
    }

    // Update the request with X-Reading data
    const updatedRequest = await prisma.locationChangeRequest.update({
      where: {
        id: parseInt(id),
      },
      data: {
        xReadingData: body.xReadingData,
        xReadingGeneratedAt: new Date(),
      },
      select: {
        fromLocation: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
          }
        },
        toLocation: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
          }
        },
      }
    })

    // Create audit log
    await prisma.auditLog.create({
      data: {
        businessId,
        userId: currentUserId,
        action: 'UPDATE',
        entityType: 'LocationChangeRequest',
        entityId: parseInt(id),
        changes: {
          action: 'submit_xreading',
          xReadingNumber: body.xReadingData.xReadingNumber,
          shiftNumber: body.xReadingData.shiftNumber,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      }
    })

    return NextResponse.json({
      message: 'X-Reading submitted successfully. Your request is now ready for manager approval.',
      request: updatedRequest
    })
  } catch (error) {
    console.error('Error submitting X-Reading:', error)
    return NextResponse.json({
      error: 'Failed to submit X-Reading',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
