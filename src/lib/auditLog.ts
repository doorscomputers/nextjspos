import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

type TransactionClient = Prisma.TransactionClient

export enum AuditAction {
  BULK_DELETE = 'bulk_delete',
  BULK_ACTIVATE = 'bulk_activate',
  BULK_DEACTIVATE = 'bulk_deactivate',
  BULK_ADD_TO_LOCATION = 'bulk_add_to_location',
  BULK_REMOVE_FROM_LOCATION = 'bulk_remove_from_location',
  PRODUCT_CREATE = 'product_create',
  PRODUCT_UPDATE = 'product_update',
  PRODUCT_DELETE = 'product_delete',
  OPENING_STOCK_SET = 'opening_stock_set',
  INVENTORY_CORRECTION_CREATE = 'inventory_correction_create',
  INVENTORY_CORRECTION_UPDATE = 'inventory_correction_update',
  INVENTORY_CORRECTION_DELETE = 'inventory_correction_delete',
  INVENTORY_CORRECTION_APPROVE = 'inventory_correction_approve',
  PURCHASE_ORDER_CREATE = 'purchase_order_create',
  PURCHASE_ORDER_UPDATE = 'purchase_order_update',
  PURCHASE_ORDER_DELETE = 'purchase_order_delete',
  PURCHASE_RECEIPT_CREATE = 'purchase_receipt_create',
  PURCHASE_RECEIPT_APPROVE = 'purchase_receipt_approve',
  SALE_CREATE = 'sale_create',
  SALE_UPDATE = 'sale_update',
  SALE_DELETE = 'sale_delete',
  STOCK_TRANSFER_CREATE = 'stock_transfer_create',
  STOCK_TRANSFER_UPDATE = 'stock_transfer_update',
  STOCK_TRANSFER_SEND = 'stock_transfer_send',
  STOCK_TRANSFER_RECEIVE = 'stock_transfer_receive',
  STOCK_TRANSFER_DELETE = 'stock_transfer_delete',

  // POS-specific actions
  USER_LOGIN = 'user_login',
  USER_LOGOUT = 'user_logout',
  SHIFT_OPEN = 'shift_open',
  SHIFT_CLOSE = 'shift_close',
  SHIFT_X_READING = 'shift_x_reading',
  SHIFT_Z_READING = 'shift_z_reading',
  SALE_VOID = 'sale_void',
  SALE_REFUND = 'sale_refund',
  SALE_RETURN = 'sale_return',
  SALE_EXCHANGE = 'sale_exchange',
  DISCOUNT_APPLIED = 'discount_applied',
  DISCOUNT_APPROVED = 'discount_approved',
  PRICE_OVERRIDE = 'price_override',
  QUOTATION_CREATE = 'quotation_create',
  QUOTATION_UPDATE = 'quotation_update',
  QUOTATION_CONVERT = 'quotation_convert',
  QUOTATION_DELETE = 'quotation_delete',
  WARRANTY_CLAIM_CREATE = 'warranty_claim_create',
  WARRANTY_CLAIM_RESOLVE = 'warranty_claim_resolve',
  CASH_IN = 'cash_in',
  CASH_OUT = 'cash_out',

  // Workforce management
  EMPLOYEE_SCHEDULE_CREATE = 'employee_schedule_create',
  EMPLOYEE_SCHEDULE_UPDATE = 'employee_schedule_update',
  EMPLOYEE_SCHEDULE_DELETE = 'employee_schedule_delete',
}

export enum EntityType {
  PRODUCT = 'product',
  USER = 'user',
  SALE = 'sale',
  PURCHASE = 'purchase',
  LOCATION = 'location',
  STOCK_TRANSFER = 'stock_transfer',
  CASHIER_SHIFT = 'cashier_shift',
  QUOTATION = 'quotation',
  WARRANTY_CLAIM = 'warranty_claim',
  DISCOUNT = 'discount',
  EMPLOYEE_SCHEDULE = 'employee_schedule',
  CASH_IN_OUT = 'cash_in_out',
}

interface AuditLogParams {
  businessId: number
  userId: number
  username: string
  action: AuditAction
  entityType: EntityType
  entityIds: number[]
  description: string
  metadata?: any
  requiresPassword?: boolean
  passwordVerified?: boolean
  ipAddress?: string
  userAgent?: string
  tx?: TransactionClient  // CRITICAL: Transaction client for atomicity
}

/**
 * Create an audit log entry
 * CRITICAL: Now supports transaction client to ensure atomic operations
 * When called with tx parameter, audit log becomes part of the transaction
 * If transaction rolls back, audit log is also rolled back (proper all-or-nothing behavior)
 */
export async function createAuditLog(params: AuditLogParams) {
  const client = params.tx ?? prisma  // Use transaction client if provided

  // CRITICAL: When inside a transaction (tx provided), errors should propagate to rollback
  // When outside transaction, we catch errors to prevent breaking the main operation
  const shouldPropagateErrors = !!params.tx

  try {
    const auditLog = await client.auditLog.create({
      data: {
        businessId: params.businessId,
        userId: params.userId,
        username: params.username,
        action: params.action,
        entityType: params.entityType,
        entityIds: JSON.stringify(params.entityIds),
        description: params.description,
        metadata: params.metadata || {},
        requiresPassword: params.requiresPassword || false,
        passwordVerified: params.passwordVerified || false,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    })

    return auditLog
  } catch (error) {
    console.error('Error creating audit log:', error)

    // CRITICAL: If inside transaction, throw error to trigger rollback
    if (shouldPropagateErrors) {
      throw error
    }

    // Outside transaction, don't break the operation
    return null
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs({
  businessId,
  userId,
  action,
  entityType,
  startDate,
  endDate,
  limit = 100,
  offset = 0,
}: {
  businessId: number
  userId?: number
  action?: AuditAction
  entityType?: EntityType
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: any = {
    businessId,
  }

  if (userId) where.userId = userId
  if (action) where.action = action
  if (entityType) where.entityType = entityType
  if (startDate || endDate) {
    where.createdAt = {}
    if (startDate) where.createdAt.gte = startDate
    if (endDate) where.createdAt.lte = endDate
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.auditLog.count({ where }),
  ])

  return {
    logs: logs.map(log => ({
      ...log,
      entityIds: JSON.parse(log.entityIds),
    })),
    total,
    limit,
    offset,
  }
}

/**
 * Extract IP address from request headers
 */
export function getIpAddress(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    return realIp
  }

  return undefined
}

/**
 * Extract user agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}
