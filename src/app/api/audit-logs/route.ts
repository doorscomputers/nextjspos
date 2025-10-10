import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/audit-logs
 * Query audit logs with various filters
 * Supports: entityType, entityId, userId, action, dateFrom, dateTo
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')
    const userId = searchParams.get('userId')
    const action = searchParams.get('action')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const limit = searchParams.get('limit')

    const where: any = {
      businessId: parseInt(businessId)
    }

    if (entityType) {
      where.entityType = entityType
    }

    if (entityId) {
      // entityIds is stored as JSON string, use contains to search
      // Note: This searches for the ID as a substring in the JSON array
      where.entityIds = {
        contains: entityId
      }
    }

    if (userId) {
      where.userId = parseInt(userId)
    }

    if (action) {
      where.action = action
    }

    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo)
      }
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: 'desc'
      },
      take: limit ? parseInt(limit) : 100
    })

    return NextResponse.json(logs)
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs', details: error.message },
      { status: 500 }
    )
  }
}
