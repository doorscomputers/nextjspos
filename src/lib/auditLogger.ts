/**
 * Audit Logger
 * Logs important system events for compliance and debugging
 */

import prisma from '@/lib/prisma'

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  VIEW = 'VIEW',
  EXPORT = 'EXPORT',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  RECONCILIATION = 'RECONCILIATION',
  PAYMENT = 'PAYMENT',
  VOID = 'VOID',
  REFUND = 'REFUND',
}

export interface AuditLogData {
  userId: number
  businessId: number
  action: AuditAction
  entity: string // e.g., 'Product', 'Sale', 'Payment'
  entityId?: number
  description: string
  metadata?: Record<string, any>
  ipAddress?: string
  userAgent?: string
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    // If AuditLog model exists in Prisma schema, use it
    // Otherwise, just log to console for now

    // Check if auditLog model exists
    if ('auditLog' in prisma) {
      await (prisma as any).auditLog.create({
        data: {
          userId: data.userId,
          businessId: data.businessId,
          action: data.action,
          entity: data.entity,
          entityId: data.entityId,
          description: data.description,
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          createdAt: new Date(),
        },
      })
    } else {
      // Fallback: log to console
      console.log('[AUDIT LOG]', {
        timestamp: new Date().toISOString(),
        userId: data.userId,
        businessId: data.businessId,
        action: data.action,
        entity: data.entity,
        entityId: data.entityId,
        description: data.description,
        metadata: data.metadata,
      })
    }
  } catch (error) {
    console.error('Failed to create audit log:', error)
    // Don't throw error - audit logging should not break application flow
  }
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters: {
  businessId: number
  userId?: number
  action?: AuditAction
  entity?: string
  entityId?: number
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  try {
    if ('auditLog' in prisma) {
      const where: any = {
        businessId: filters.businessId,
      }

      if (filters.userId) where.userId = filters.userId
      if (filters.action) where.action = filters.action
      if (filters.entity) where.entity = filters.entity
      if (filters.entityId) where.entityId = filters.entityId

      if (filters.startDate || filters.endDate) {
        where.createdAt = {}
        if (filters.startDate) where.createdAt.gte = filters.startDate
        if (filters.endDate) where.createdAt.lte = filters.endDate
      }

      const logs = await (prisma as any).auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: filters.limit || 100,
        skip: filters.offset || 0,
      })

      return logs
    } else {
      console.warn('AuditLog model not found in Prisma schema')
      return []
    }
  } catch (error) {
    console.error('Failed to get audit logs:', error)
    return []
  }
}
