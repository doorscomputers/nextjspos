/**
 * Notification System Utilities
 * Helper functions to create notifications for various events
 */

import { prisma } from '@/lib/prisma'

export type NotificationType =
  | 'transfer_pending'
  | 'transfer_to_receive'
  | 'transfer_completed'
  | 'purchase_pending'
  | 'purchase_approved'
  | 'low_stock'
  | 'out_of_stock'
  | 'correction_pending'
  | 'correction_approved'
  | 'return_pending'
  | 'return_approved'
  | 'sale_void'
  | 'shift_reminder'
  | 'general'

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

interface CreateNotificationParams {
  businessId: number
  userId: number
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  relatedType?: string
  relatedId?: number
  priority?: NotificationPriority
  metadata?: any
  expiresInDays?: number
}

/**
 * Create a notification
 */
export async function createNotification(params: CreateNotificationParams) {
  const {
    businessId,
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
  } = params

  let expiresAt = null
  if (expiresInDays) {
    expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
  }

  try {
    return await prisma.notification.create({
      data: {
        businessId,
        userId,
        type,
        title,
        message,
        actionUrl,
        relatedType,
        relatedId,
        priority,
        metadata,
        expiresAt
      }
    })
  } catch (error) {
    console.error('Error creating notification:', error)
    throw error
  }
}

/**
 * Create notification for multiple users
 */
export async function createBulkNotifications(
  userIds: number[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  const notifications = userIds.map(userId => ({
    ...params,
    userId
  }))

  try {
    return await Promise.all(notifications.map(n => createNotification(n)))
  } catch (error) {
    console.error('Error creating bulk notifications:', error)
    throw error
  }
}

/**
 * Notify users with permission about a pending transfer
 */
export async function notifyTransferPending(
  businessId: number,
  transferId: number,
  transferNumber: string,
  fromLocation: string,
  toLocation: string
) {
  // Get users with transfer approval permission at the destination location
  const users = await prisma.user.findMany({
    where: {
      businessId,
      allowLogin: true,
      deletedAt: null,
      OR: [
        // Users with direct permission
        {
          permissions: {
            some: {
              permission: {
                name: 'transfer.approve'
              }
            }
          }
        },
        // Users with roles that have permission
        {
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      name: 'transfer.approve'
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  })

  const userIds = users.map(u => u.id)

  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      businessId,
      type: 'transfer_pending',
      title: 'Transfer Awaiting Approval',
      message: `Transfer ${transferNumber} from ${fromLocation} to ${toLocation} needs approval`,
      actionUrl: `/dashboard/transfers/${transferId}`,
      relatedType: 'transfer',
      relatedId: transferId,
      priority: 'normal',
      expiresInDays: 7
    })
  }
}

/**
 * Notify destination location users about transfer ready to receive
 */
export async function notifyTransferToReceive(
  businessId: number,
  transferId: number,
  transferNumber: string,
  fromLocation: string,
  toLocation: string,
  toLocationId: number
) {
  // Get users assigned to the destination location with receive permission
  const users = await prisma.user.findMany({
    where: {
      businessId,
      allowLogin: true,
      deletedAt: null,
      userLocations: {
        some: {
          locationId: toLocationId
        }
      },
      OR: [
        {
          permissions: {
            some: {
              permission: {
                name: 'transfer.receive'
              }
            }
          }
        },
        {
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      name: 'transfer.receive'
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  })

  const userIds = users.map(u => u.id)

  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      businessId,
      type: 'transfer_to_receive',
      title: 'Transfer Ready to Receive',
      message: `Transfer ${transferNumber} from ${fromLocation} is ready to be received at ${toLocation}`,
      actionUrl: `/dashboard/transfers/${transferId}`,
      relatedType: 'transfer',
      relatedId: transferId,
      priority: 'high',
      expiresInDays: 7
    })
  }
}

/**
 * Notify about low stock
 */
export async function notifyLowStock(
  businessId: number,
  productId: number,
  productName: string,
  currentStock: number,
  alertQuantity: number,
  locationId: number
) {
  // Get users with inventory management permission
  const users = await prisma.user.findMany({
    where: {
      businessId,
      allowLogin: true,
      deletedAt: null,
      OR: [
        {
          permissions: {
            some: {
              permission: {
                name: 'product.view'
              }
            }
          }
        },
        {
          roles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      name: 'product.view'
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    select: { id: true }
  })

  const userIds = users.map(u => u.id)

  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      businessId,
      type: 'low_stock',
      title: 'Low Stock Alert',
      message: `${productName} is running low: ${currentStock} units (alert level: ${alertQuantity})`,
      actionUrl: `/dashboard/products/${productId}`,
      relatedType: 'product',
      relatedId: productId,
      priority: 'normal',
      metadata: { currentStock, alertQuantity, locationId },
      expiresInDays: 3
    })
  }
}

/**
 * Delete old notifications (cleanup utility)
 */
export async function deleteExpiredNotifications() {
  try {
    const result = await prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    })
    return result.count
  } catch (error) {
    console.error('Error deleting expired notifications:', error)
    throw error
  }
}
