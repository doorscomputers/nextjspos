import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { isSuperAdmin } from '@/lib/rbac'

/**
 * GET /api/reports/audit-trail
 * Enhanced audit trail reporting with advanced filtering and search capabilities
 *
 * Query Parameters:
 * - startDate: Start date for filtering (ISO string)
 * - endDate: End date for filtering (ISO string)
 * - userId: Filter by specific user ID
 * - username: Filter by username (partial match)
 * - action: Filter by action type (bulk_delete, bulk_activate, etc.)
 * - entityType: Filter by entity type (product, user, sale, etc.)
 * - businessId: Filter by business ID (super admin only)
 * - ipAddress: Filter by IP address
 * - requiresPassword: Filter by password-protected actions (true/false)
 * - search: Full-text search across description and metadata
 * - page: Page number (default: 1)
 * - limit: Results per page (default: 50, max: 200)
 * - sortBy: Sort field (createdAt, username, action, entityType)
 * - sortOrder: Sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userRole = user.roles || []

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.AUDIT_LOG_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires AUDIT_LOG_VIEW permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)

    // Parse query parameters with validation
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const userId = searchParams.get('userId')
    const username = searchParams.get('username')
    const action = searchParams.get('action')
    const entityType = searchParams.get('entityType')
    const filterBusinessId = searchParams.get('businessId')
    const ipAddress = searchParams.get('ipAddress')
    const requiresPassword = searchParams.get('requiresPassword')
    const search = searchParams.get('search')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'

    // Validate sortBy field
    const allowedSortFields = ['createdAt', 'username', 'action', 'entityType', 'ipAddress']
    if (!allowedSortFields.includes(sortBy)) {
      return NextResponse.json(
        { error: `Invalid sortBy field. Allowed: ${allowedSortFields.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate sortOrder
    if (!['asc', 'desc'].includes(sortOrder)) {
      return NextResponse.json(
        { error: 'Invalid sortOrder. Must be "asc" or "desc"' },
        { status: 400 }
      )
    }

    // Build where clause
    const where: any = {}

    // Super admin can see all businesses, admin sees their own business
    if (!isSuperAdmin(user) || (filterBusinessId && filterBusinessId !== businessId)) {
      if (!isSuperAdmin(user)) {
        where.businessId = parseInt(businessId)
      } else if (filterBusinessId) {
        where.businessId = parseInt(filterBusinessId)
      }
    }

    // IMPORTANT: Exclude superadmin user from audit trail
    // Superadmin actions should not be visible in reports for privacy/security
    where.username = {
      not: 'superadmin',
      mode: 'insensitive'
    }

    // Date range filtering
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        const start = new Date(startDate)
        if (isNaN(start.getTime())) {
          return NextResponse.json({ error: 'Invalid startDate format' }, { status: 400 })
        }
        where.createdAt.gte = start
      }
      if (endDate) {
        const end = new Date(endDate)
        if (isNaN(end.getTime())) {
          return NextResponse.json({ error: 'Invalid endDate format' }, { status: 400 })
        }
        end.setHours(23, 59, 59, 999) // Include full day
        where.createdAt.lte = end
      }
    }

    // User filtering
    if (userId) {
      where.userId = parseInt(userId)
    }

    if (username) {
      where.username = {
        contains: username,
        mode: 'insensitive'
      }
    }

    // Action filtering
    if (action) {
      const validActions = [
        // User actions
        'user_login', 'user_logout', 'user_update', 'user_create',
        // Product actions
        'product_create', 'product_update', 'product_delete', 'price_change',
        // Sales actions
        'sale_create', 'sale_update', 'sale_void', 'sale_refund', 'sale_return', 'sale_exchange', 'sale_delete',
        // Transfer actions
        'stock_transfer_create', 'stock_transfer_update', 'stock_transfer_send', 'stock_transfer_receive', 'stock_transfer_delete',
        // Inventory actions
        'inventory_correction_create', 'inventory_correction_update', 'inventory_correction_delete', 'inventory_correction_approve',
        'opening_stock_set',
        // Purchase actions
        'purchase_order_create', 'purchase_order_update', 'purchase_order_delete',
        'purchase_receipt_create', 'purchase_receipt_approve',
        // Bulk actions
        'bulk_delete', 'bulk_activate', 'bulk_deactivate',
        'bulk_add_to_location', 'bulk_remove_from_location',
        // POS actions
        'shift_open', 'shift_close', 'shift_x_reading', 'shift_z_reading',
        'discount_applied', 'discount_approved', 'price_override',
        'cash_in', 'cash_out',
        // Quotation actions
        'quotation_create', 'quotation_update', 'quotation_convert', 'quotation_delete',
        // Other
        'warranty_claim_create', 'warranty_claim_resolve',
        'employee_schedule_create', 'employee_schedule_update', 'employee_schedule_delete'
      ]
      if (!validActions.includes(action)) {
        return NextResponse.json(
          { error: `Invalid action. Allowed: ${validActions.join(', ')}` },
          { status: 400 }
        )
      }
      where.action = action
    }

    // Entity type filtering
    if (entityType) {
      const validEntityTypes = [
        'product', 'user', 'sale', 'purchase', 'transfer',
        'expense', 'supplier', 'customer', 'category', 'brand'
      ]
      if (!validEntityTypes.includes(entityType)) {
        return NextResponse.json(
          { error: `Invalid entityType. Allowed: ${validEntityTypes.join(', ')}` },
          { status: 400 }
        )
      }
      where.entityType = entityType
    }

    // IP address filtering
    if (ipAddress) {
      where.ipAddress = {
        contains: ipAddress,
        mode: 'insensitive'
      }
    }

    // Password protection filtering
    if (requiresPassword !== null && requiresPassword !== undefined) {
      where.requiresPassword = requiresPassword === 'true'
    }

    // Full-text search (safe across providers: search common text fields)
    if (search) {
      where.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { username: { contains: search, mode: 'insensitive' } },
        { action: { contains: search, mode: 'insensitive' } },
        { entityType: { contains: search, mode: 'insensitive' } },
        { ipAddress: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Calculate pagination
    const skip = (page - 1) * limit

    // Execute queries in parallel
    const [auditLogs, totalCount] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          // Include user details if needed
          // We can optionally join with User table for more details
        },
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit,
      }),
      prisma.auditLog.count({ where })
    ])

    // Format response
    const formattedLogs = auditLogs.map(log => ({
      id: log.id,
      businessId: log.businessId,
      userId: log.userId,
      username: log.username,
      action: log.action,
      entityType: log.entityType,
      entityIds: (() => { try { return JSON.parse(log.entityIds || '[]') } catch { return [] } })(),
      description: log.description,
      metadata: log.metadata,
      requiresPassword: log.requiresPassword,
      passwordVerified: log.passwordVerified,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    }))

    // Build response
    const response = {
      data: formattedLogs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
      filters: {
        startDate,
        endDate,
        userId,
        username,
        action,
        entityType,
        businessId: filterBusinessId || (isSuperAdmin(user) ? null : businessId),
        ipAddress,
        requiresPassword,
        search,
        sortBy,
        sortOrder,
      },
      permissions: {
        isSuperAdmin: isSuperAdmin(user),
        canViewAllBusinesses: isSuperAdmin(user),
      }
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Error fetching audit trail:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch audit trail data',
        details: error.message,
        ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/reports/audit-trail/export
 * Export audit trail data to various formats
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.AUDIT_LOG_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires AUDIT_LOG_VIEW permission' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { format, filters = {} } = body

    // Validate export format
    const allowedFormats = ['csv', 'json', 'pdf']
    if (!allowedFormats.includes(format)) {
      return NextResponse.json(
        { error: `Invalid format. Allowed: ${allowedFormats.join(', ')}` },
        { status: 400 }
      )
    }

    // Build query with filters (reuse logic from GET)
    const where: any = {}

    // Apply filters similar to GET endpoint
    if (!isSuperAdmin(user)) {
      where.businessId = parseInt(user.businessId)
    } else if (filters.businessId) {
      where.businessId = parseInt(filters.businessId)
    }

    // IMPORTANT: Exclude superadmin user from export
    where.username = {
      not: 'superadmin',
      mode: 'insensitive'
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {}
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
      if (filters.endDate) {
        const end = new Date(filters.endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    if (filters.userId) where.userId = parseInt(filters.userId)
    if (filters.username) {
      where.username = { contains: filters.username, mode: 'insensitive' }
    }
    if (filters.action) where.action = filters.action
    if (filters.entityType) where.entityType = filters.entityType
    if (filters.ipAddress) {
      where.ipAddress = { contains: filters.ipAddress, mode: 'insensitive' }
    }
    if (filters.requiresPassword !== undefined) {
      where.requiresPassword = filters.requiresPassword
    }
    if (filters.search) {
      where.OR = [
        { description: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
        { action: { contains: filters.search, mode: 'insensitive' } },
        { entityType: { contains: filters.search, mode: 'insensitive' } },
        { ipAddress: { contains: filters.search, mode: 'insensitive' } },
      ]
    }

    // Limit export to 10,000 records to prevent memory issues
    const auditLogs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
      include: {
        // Include related data if needed
      }
    })

    // Format based on export type
    switch (format) {
      case 'csv':
        // Generate CSV content
        const csvHeaders = [
          'ID', 'Business ID', 'User ID', 'Username', 'Action', 'Entity Type',
          'Description', 'Requires Password', 'Password Verified', 'IP Address',
          'Created At'
        ]

        const csvRows = auditLogs.map(log => [
          log.id,
          log.businessId,
          log.userId,
          log.username,
          log.action,
          log.entityType,
          `"${log.description.replace(/"/g, '""')}"`, // Escape quotes in CSV
          log.requiresPassword ? 'Yes' : 'No',
          log.passwordVerified ? 'Yes' : 'No',
          log.ipAddress || 'N/A',
          log.createdAt.toISOString()
        ])

        const csvContent = [
          csvHeaders.join(','),
          ...csvRows.map(row => row.join(','))
        ].join('\n')

        // Return CSV file
        return new NextResponse(csvContent, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="audit-trail-${new Date().toISOString().split('T')[0]}.csv"`
          }
        })

      case 'json':
        return NextResponse.json({
          data: auditLogs,
          exportedAt: new Date().toISOString(),
          count: auditLogs.length
        })

      case 'pdf':
        // PDF export logic would go here
        return NextResponse.json({
          message: 'PDF export not yet implemented',
          count: auditLogs.length
        })

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Error exporting audit trail:', error)
    return NextResponse.json(
      {
        error: 'Failed to export audit trail data',
        details: error.message
      },
      { status: 500 }
    )
  }
}
