import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/notifications/pending-approvals
 * Get counts of all pending approvals for the current manager
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)
    const currentUserId = parseInt(user.id)

    // Initialize counts
    const pendingCounts = {
      leaveRequests: 0,
      locationChanges: 0,
      transfers: 0,
      supplierReturns: 0,
      purchaseOrders: 0,
      total: 0,
    }

    const details: any = {}

    // 1. Leave Requests (if user can approve)
    if (user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_APPROVE) ||
        user.permissions?.includes(PERMISSIONS.LEAVE_REQUEST_MANAGE)) {
      const count = await prisma.leaveRequest.count({
        where: {
          businessId,
          status: 'pending',
          deletedAt: null,
          userId: { not: currentUserId }, // Cannot approve own request
        }
      })
      pendingCounts.leaveRequests = count
      pendingCounts.total += count

      // Get recent pending requests
      details.leaveRequests = await prisma.leaveRequest.findMany({
        where: {
          businessId,
          status: 'pending',
          deletedAt: null,
          userId: { not: currentUserId },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          }
        },
        orderBy: {
          requestedAt: 'desc'
        },
        take: 5
      })
    }

    // 2. Location Change Requests (if user can approve)
    if (user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_APPROVE) ||
        user.permissions?.includes(PERMISSIONS.LOCATION_CHANGE_REQUEST_MANAGE)) {
      const count = await prisma.locationChangeRequest.count({
        where: {
          businessId,
          status: 'pending',
          deletedAt: null,
        }
      })
      pendingCounts.locationChanges = count
      pendingCounts.total += count

      // Get recent pending requests
      details.locationChanges = await prisma.locationChangeRequest.findMany({
        where: {
          businessId,
          status: 'pending',
          deletedAt: null,
        },
        include: {
          requestedByUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          },
          fromLocation: {
            select: {
              id: true,
              name: true,
            }
          },
          toLocation: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          requestedAt: 'desc'
        },
        take: 5
      })
    }

    // 3. Transfers (if user can approve)
    if (user.permissions?.includes(PERMISSIONS.TRANSFER_APPROVE) ||
        user.permissions?.includes(PERMISSIONS.TRANSFER_MANAGE)) {
      const count = await prisma.transfer.count({
        where: {
          businessId,
          status: 'pending_approval',
          deletedAt: null,
        }
      })
      pendingCounts.transfers = count
      pendingCounts.total += count

      // Get recent pending transfers
      details.transfers = await prisma.transfer.findMany({
        where: {
          businessId,
          status: 'pending_approval',
          deletedAt: null,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          },
          fromLocation: {
            select: {
              id: true,
              name: true,
            }
          },
          toLocation: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
    }

    // 4. Supplier Returns (if user can approve)
    if (user.permissions?.includes(PERMISSIONS.SUPPLIER_RETURN_APPROVE) ||
        user.permissions?.includes(PERMISSIONS.SUPPLIER_RETURN_MANAGE)) {
      const count = await prisma.supplierReturn.count({
        where: {
          businessId,
          status: 'pending',
          deletedAt: null,
        }
      })
      pendingCounts.supplierReturns = count
      pendingCounts.total += count

      // Get recent pending returns
      details.supplierReturns = await prisma.supplierReturn.findMany({
        where: {
          businessId,
          status: 'pending',
          deletedAt: null,
        },
        include: {
          createdByUser: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 5
      })
    }

    // 5. Purchase Orders (if user can approve) - Optional if you have purchase order approvals
    // This is commented out since the current system might not have PO approvals
    /*
    if (user.permissions?.includes(PERMISSIONS.PURCHASE_APPROVE)) {
      const count = await prisma.purchase.count({
        where: {
          businessId,
          status: 'pending_approval',
          deletedAt: null,
        }
      })
      pendingCounts.purchaseOrders = count
      pendingCounts.total += count
    }
    */

    return NextResponse.json({
      counts: pendingCounts,
      details,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return NextResponse.json({ error: 'Failed to fetch pending approvals' }, { status: 500 })
  }
}
