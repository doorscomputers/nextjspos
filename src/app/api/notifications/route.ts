import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get('unreadOnly') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    const page = parseInt(searchParams.get('page') || '1')
    const skip = (page - 1) * limit

    // Build where clause
    const where: any = {
      userId: parseInt(session.user.id.toString()),
      businessId: parseInt(session.user.businessId)
    }

    if (unreadOnly) {
      where.isRead = false
    }

    // Delete expired notifications first
    await prisma.$executeRawUnsafe(`
      DELETE FROM notifications
      WHERE expires_at IS NOT NULL AND expires_at < NOW()
    `)

    // Get notifications
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [
          { isRead: 'asc' }, // Unread first
          { createdAt: 'desc' } // Newest first
        ],
        take: limit,
        skip
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: {
          userId: parseInt(session.user.id.toString()),
          businessId: parseInt(session.user.businessId),
          isRead: false
        }
      })
    ])

    return NextResponse.json({
      notifications,
      total,
      unreadCount,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    })

  } catch (error: any) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/notifications
 * Create a new notification (for system use)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      userId,
      type,
      title,
      message,
      actionUrl,
      relatedType,
      relatedId,
      priority = 'normal',
      metadata,
      expiresInDays
    } = body

    // Calculate expiry date if specified
    let expiresAt = null
    if (expiresInDays) {
      expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    }

    const notification = await prisma.notification.create({
      data: {
        businessId: parseInt(session.user.businessId),
        userId: parseInt(userId.toString()),
        type,
        title,
        message,
        actionUrl,
        relatedType,
        relatedId: relatedId ? parseInt(relatedId.toString()) : null,
        priority,
        metadata,
        expiresAt
      }
    })

    return NextResponse.json(notification, { status: 201 })

  } catch (error: any) {
    console.error('Error creating notification:', error)
    return NextResponse.json(
      { error: 'Failed to create notification', details: error.message },
      { status: 500 }
    )
  }
}
