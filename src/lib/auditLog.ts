/**
 * AUDIT LOGGING SYSTEM
 * ====================
 *
 * This module provides comprehensive audit trail functionality for the POS system.
 * Every significant business operation (sales, inventory changes, user actions) is logged here.
 *
 * WHY AUDIT LOGS ARE CRITICAL FOR POS SYSTEMS:
 * ---------------------------------------------
 * 1. **Compliance**: Many industries require detailed records of all transactions
 * 2. **Security**: Track who did what and when (detect fraud, unauthorized access)
 * 3. **Accountability**: If something goes wrong, you can trace it back to the person/action
 * 4. **Dispute Resolution**: Prove what happened in case of customer/supplier disputes
 * 5. **Forensics**: Investigate theft, errors, or suspicious activity
 * 6. **Regulatory Requirements**: Tax audits, BIR reporting (Philippines), SOX compliance
 *
 * WHAT GETS LOGGED:
 * -----------------
 * - Who performed the action (userId, username)
 * - What action was performed (sale, delete, price override, etc.)
 * - When it happened (timestamp)
 * - What was affected (product ID, sale ID, etc.)
 * - Additional context (metadata, IP address, user agent)
 * - Whether password verification was required/completed
 *
 * AUDIT LOG BEST PRACTICES:
 * --------------------------
 * 1. Log BEFORE critical operations (in case operation fails, you know it was attempted)
 * 2. Log AFTER critical operations (to confirm success)
 * 3. Include enough detail in metadata to reconstruct what happened
 * 4. Use transactions when audit log is critical to operation atomicity
 * 5. Never delete audit logs (soft delete if needed, or archive to separate table)
 * 6. Regularly review suspicious patterns (mass deletions, price overrides, voids)
 *
 * EXAMPLE USAGE:
 * --------------
 * ```typescript
 * // Logging a sale creation
 * await createAuditLog({
 *   businessId: 1,
 *   userId: user.id,
 *   username: user.username,
 *   action: AuditAction.SALE_CREATE,
 *   entityType: EntityType.SALE,
 *   entityIds: [saleId],
 *   description: `Created sale #${saleInvoiceNumber} for customer ${customerName}`,
 *   metadata: {
 *     invoiceNumber: saleInvoiceNumber,
 *     total: grandTotal,
 *     itemCount: items.length,
 *     paymentMethod: 'cash'
 *   },
 *   ipAddress: getIpAddress(request),
 *   userAgent: getUserAgent(request)
 * })
 *
 * // Logging with transaction (audit log will rollback if sale fails)
 * await prisma.$transaction(async (tx) => {
 *   const sale = await tx.sale.create({ data: {...} })
 *   await createAuditLog({
 *     ...auditData,
 *     tx  // Include transaction client
 *   })
 * })
 * ```
 */

import { prisma } from './prisma'
import { Prisma } from '@prisma/client'

// Type alias for database transaction client
type TransactionClient = Prisma.TransactionClient

/**
 * AUDIT ACTION TYPES
 * ==================
 *
 * This enum defines all the types of actions that can be logged in the audit trail.
 * Each action represents a specific business operation that needs to be tracked.
 *
 * NAMING CONVENTION:
 * ------------------
 * - Format: {ENTITY}_{OPERATION}
 * - Example: PRODUCT_CREATE, SALE_DELETE, SHIFT_CLOSE
 * - Use descriptive names that make the action clear without looking at code
 *
 * CATEGORIES:
 * -----------
 * 1. Bulk Operations: Mass updates affecting multiple records
 * 2. Product Management: Product CRUD and inventory setup
 * 3. Inventory: Stock corrections and adjustments
 * 4. Purchasing: Purchase orders and receipts
 * 5. Sales: All sales-related operations
 * 6. Transfers: Stock movement between locations
 * 7. POS Operations: Cashier shifts, readings, voids, refunds
 * 8. Quotations: Quote management
 * 9. Warranties: Warranty claim handling
 * 10. Cash Management: Cash in/out operations
 * 11. Workforce: Employee scheduling
 */
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
  USER_UPDATE = 'user_update',
  USER_CREATE = 'user_create',
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

  // Price changes
  PRICE_CHANGE = 'price_change',

  // Workforce management
  EMPLOYEE_SCHEDULE_CREATE = 'employee_schedule_create',
  EMPLOYEE_SCHEDULE_UPDATE = 'employee_schedule_update',
  EMPLOYEE_SCHEDULE_DELETE = 'employee_schedule_delete',
}

/**
 * ENTITY TYPES
 * ============
 *
 * This enum defines the types of business entities that can be tracked in audit logs.
 * Each EntityType corresponds to a major database table or business concept.
 *
 * WHY WE NEED ENTITY TYPES:
 * -------------------------
 * - Allows filtering audit logs by entity (e.g., "show me all Product changes")
 * - Provides context for the action (knowing it's a SALE vs PRODUCT makes logs clearer)
 * - Enables entity-specific audit trail pages (e.g., "Product #123 History")
 *
 * USAGE:
 * ------
 * When logging an action, specify which type of entity is being affected.
 * Example: Creating a sale logs EntityType.SALE with the sale ID in entityIds
 */
export enum EntityType {
  PRODUCT = 'product',                    // Product catalog and inventory items
  USER = 'user',                          // User account and authentication actions
  SALE = 'sale',                          // Sales transactions (invoices, receipts)
  PURCHASE = 'purchase',                  // Purchase orders and supplier transactions
  LOCATION = 'location',                  // Business locations (stores, warehouses)
  STOCK_TRANSFER = 'stock_transfer',      // Inter-location inventory transfers
  CASHIER_SHIFT = 'cashier_shift',        // POS cashier shift management
  QUOTATION = 'quotation',                // Sales quotations (estimates)
  WARRANTY_CLAIM = 'warranty_claim',      // Product warranty and return claims
  DISCOUNT = 'discount',                  // Discount applications and overrides
  EMPLOYEE_SCHEDULE = 'employee_schedule', // Work schedules and shifts
  CASH_IN_OUT = 'cash_in_out',            // Cash drawer deposits and withdrawals
}

/**
 * AUDIT LOG PARAMETERS
 * ====================
 *
 * This interface defines all the data needed to create an audit log entry.
 *
 * REQUIRED FIELDS:
 * ----------------
 * @param businessId - Which business this audit log belongs to (multi-tenant isolation)
 * @param userId - ID of the user who performed the action
 * @param username - Username for quick reference (denormalized for performance)
 * @param action - What type of action was performed (see AuditAction enum)
 * @param entityType - What type of entity was affected (see EntityType enum)
 * @param entityIds - Array of affected entity IDs (e.g., [productId1, productId2])
 * @param description - Human-readable description of what happened
 *
 * OPTIONAL FIELDS:
 * ----------------
 * @param metadata - Additional structured data (JSON object with any relevant details)
 *   Example: { invoiceNumber: "INV-001", total: 150.00, items: 5 }
 *
 * @param requiresPassword - Was supervisor password required for this action?
 *   (e.g., price overrides, voids, deletions often require manager approval)
 *
 * @param passwordVerified - Was the password actually verified?
 *   This provides proof that proper authorization was obtained
 *
 * @param ipAddress - IP address of the user (helps track location, detect unauthorized access)
 *   Extract using: getIpAddress(request)
 *
 * @param userAgent - Browser/device information
 *   Extract using: getUserAgent(request)
 *   Helps identify which device was used (useful for security investigations)
 *
 * @param tx - Database transaction client (optional)
 *   Include this when the audit log must be part of a larger atomic operation
 *   If the main operation fails and rolls back, the audit log will also roll back
 */
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
 * RETRIEVE AUDIT LOGS WITH FILTERING
 * ===================================
 *
 * Query the audit log database with various filters to find specific actions.
 * Supports pagination for large result sets.
 *
 * COMMON USE CASES:
 * -----------------
 * 1. User Activity Report: Filter by userId to see everything a specific user did
 * 2. Entity History: Filter by entityType + entityId to see all changes to a specific product/sale
 * 3. Security Audit: Filter by action (e.g., all PRICE_OVERRIDE or SALE_VOID actions)
 * 4. Date Range Report: Filter by startDate/endDate for compliance reporting
 * 5. Investigation: Combine multiple filters to narrow down suspicious activity
 *
 * @param businessId - Required: Which business's logs to retrieve (multi-tenant isolation)
 * @param userId - Optional: Filter to specific user
 * @param action - Optional: Filter to specific action type
 * @param entityType - Optional: Filter to specific entity type
 * @param startDate - Optional: Only logs on or after this date
 * @param endDate - Optional: Only logs on or before this date
 * @param limit - How many results to return (default: 100, for pagination)
 * @param offset - How many results to skip (default: 0, for pagination)
 *
 * @returns Object with:
 *   - logs: Array of audit log records (entityIds are parsed from JSON)
 *   - total: Total count matching the filter (for calculating pages)
 *   - limit: Echo of limit parameter
 *   - offset: Echo of offset parameter
 *
 * PAGINATION EXAMPLE:
 * -------------------
 * ```typescript
 * // Page 1 (first 50 logs)
 * const page1 = await getAuditLogs({ businessId: 1, limit: 50, offset: 0 })
 *
 * // Page 2 (next 50 logs)
 * const page2 = await getAuditLogs({ businessId: 1, limit: 50, offset: 50 })
 *
 * // Calculate total pages
 * const totalPages = Math.ceil(page1.total / 50)
 * ```
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
 * EXTRACT IP ADDRESS FROM REQUEST
 * ================================
 *
 * Gets the client's IP address from HTTP request headers.
 * Handles various proxy configurations correctly.
 *
 * WHY LOG IP ADDRESSES:
 * ---------------------
 * - Security: Detect unauthorized access from unusual locations
 * - Fraud Detection: Multiple failed logins from different IPs = potential attack
 * - Compliance: Some regulations require tracking where transactions originated
 * - Troubleshooting: Identify network issues or user location problems
 *
 * PROXY HANDLING:
 * ---------------
 * When your app is behind a proxy (load balancer, CDN, reverse proxy):
 * - Direct connection: You'd get the proxy's IP, not the user's actual IP
 * - Proxies add special headers with the real client IP
 *
 * Header Priority (checked in order):
 * 1. **x-forwarded-for**: Standard proxy header (may contain multiple IPs if multiple proxies)
 *    Format: "client-ip, proxy1-ip, proxy2-ip"
 *    We take the FIRST IP (leftmost = original client)
 *
 * 2. **x-real-ip**: Alternative header used by some proxies (single IP)
 *
 * 3. **undefined**: If no proxy headers found (direct connection or headers stripped)
 *
 * @param request - Next.js Request object
 * @returns IP address string, or undefined if not available
 *
 * SECURITY NOTE:
 * --------------
 * IP addresses can be spoofed if you don't trust your proxy configuration.
 * Only use this for logging/analytics, not for security-critical decisions.
 *
 * Example Usage:
 * ```typescript
 * const ip = getIpAddress(request)
 * console.log(`Request from IP: ${ip}`)
 * ```
 */
export function getIpAddress(request: Request): string | undefined {
  // Check x-forwarded-for header (most common proxy header)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  if (forwarded) {
    // x-forwarded-for may contain multiple IPs: "client, proxy1, proxy2"
    // The leftmost IP is the original client
    return forwarded.split(',')[0].trim()
  }

  if (realIp) {
    // x-real-ip contains a single IP
    return realIp
  }

  // No proxy headers found
  return undefined
}

/**
 * EXTRACT USER AGENT FROM REQUEST
 * ================================
 *
 * Gets the User-Agent string from HTTP request headers.
 * This identifies the client's browser, device, and operating system.
 *
 * WHY LOG USER AGENTS:
 * --------------------
 * - Security: Detect unusual/suspicious clients (bots, scrapers, automated attacks)
 * - Troubleshooting: "This bug only happens in Safari on iPhone" → User-Agent helps identify
 * - Analytics: Understand which devices/browsers your users use
 * - Compliance: Some industries require tracking what device was used for transactions
 *
 * EXAMPLE USER-AGENT STRINGS:
 * ----------------------------
 * Desktop Chrome:
 *   "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
 *
 * Mobile Safari (iPhone):
 *   "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
 *
 * Automated Tool (Postman):
 *   "PostmanRuntime/7.28.0"
 *
 * WHAT YOU CAN LEARN:
 * -------------------
 * - Browser: Chrome, Firefox, Safari, Edge
 * - OS: Windows, macOS, Linux, iOS, Android
 * - Device: Desktop, Mobile, Tablet
 * - Bot Detection: Many bots have obvious User-Agents
 *
 * @param request - Next.js Request object
 * @returns User-Agent string, or undefined if not provided
 *
 * Example Usage:
 * ```typescript
 * const userAgent = getUserAgent(request)
 * if (userAgent?.includes('Mobile')) {
 *   console.log('Request from mobile device')
 * }
 * ```
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined
}
