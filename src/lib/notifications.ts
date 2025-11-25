/**
 * NOTIFICATION SYSTEM MODULE
 * ==========================
 *
 * This module provides in-app notifications to alert users about important events.
 * Unlike emails (external notifications), these appear in the user's dashboard bell icon.
 *
 * WHY NOTIFICATIONS?
 * ------------------
 * - **Real-time Alerts**: Notify users instantly about events requiring attention
 * - **Permission-Based**: Only notify users who have permission to act on the event
 * - **Location-Aware**: Notify users assigned to specific business locations
 * - **Actionable**: Each notification links to relevant page for quick action
 * - **Priority Levels**: Urgent, high, normal, low - helps users prioritize tasks
 * - **Self-Cleaning**: Auto-delete old notifications to prevent clutter
 *
 * HOW IT WORKS:
 * -------------
 * 1. Event occurs (e.g., transfer request created, low stock detected)
 * 2. System calls notification function (e.g., notifyTransferPending)
 * 3. Function finds users who should be notified (based on permissions + location)
 * 4. Creates notification records in database
 * 5. Frontend polls /api/notifications or uses websockets to display
 * 6. User clicks notification → navigates to actionUrl
 * 7. User marks as read or notification expires after X days
 *
 * NOTIFICATION TYPES:
 * -------------------
 * - **transfer_pending**: Transfer request awaiting approval
 * - **transfer_to_receive**: Approved transfer ready to be received at destination
 * - **transfer_completed**: Transfer successfully received
 * - **purchase_pending**: Purchase order needs approval
 * - **purchase_approved**: Purchase order approved
 * - **low_stock**: Product stock below alert threshold
 * - **out_of_stock**: Product completely out of stock
 * - **correction_pending**: Inventory correction awaiting approval
 * - **correction_approved**: Correction approved
 * - **return_pending**: Return request needs approval
 * - **return_approved**: Return approved
 * - **sale_void**: Sale was voided (cancelled)
 * - **shift_reminder**: Reminder to open/close shift
 * - **general**: Generic notification
 *
 * PRIORITY LEVELS:
 * ----------------
 * - **urgent**: Critical - needs immediate attention (red badge)
 * - **high**: Important - should handle soon (orange badge)
 * - **normal**: Regular priority (blue badge)
 * - **low**: Informational - no rush (gray badge)
 *
 * COMMON USE CASES:
 * -----------------
 *
 * 1. **Create Simple Notification**
 * ```typescript
 * import { createNotification } from '@/lib/notifications'
 *
 * await createNotification({
 *   businessId: 1,
 *   userId: 5,
 *   type: 'general',
 *   title: 'Welcome!',
 *   message: 'Your account has been activated',
 *   priority: 'normal'
 * })
 * ```
 *
 * 2. **Notification with Action Button**
 * ```typescript
 * await createNotification({
 *   businessId: 1,
 *   userId: 5,
 *   type: 'transfer_pending',
 *   title: 'Transfer Needs Approval',
 *   message: 'Transfer TR-001 from Main Store to Branch A',
 *   actionUrl: '/dashboard/transfers/123',  // Click to view transfer
 *   relatedType: 'transfer',
 *   relatedId: 123,
 *   priority: 'high'
 * })
 * ```
 *
 * 3. **Notify Multiple Users**
 * ```typescript
 * import { createBulkNotifications } from '@/lib/notifications'
 *
 * const managerIds = [1, 2, 3]  // All managers
 * await createBulkNotifications(managerIds, {
 *   businessId: 1,
 *   type: 'low_stock',
 *   title: 'Low Stock Alert',
 *   message: '10 products below alert level',
 *   actionUrl: '/dashboard/reports/stock-alerts',
 *   priority: 'normal'
 * })
 * ```
 *
 * 4. **Auto-Expiring Notification**
 * ```typescript
 * await createNotification({
 *   businessId: 1,
 *   userId: 5,
 *   type: 'shift_reminder',
 *   title: 'Open Your Shift',
 *   message: 'Remember to open your shift before making sales',
 *   priority: 'normal',
 *   expiresInDays: 1  // Auto-delete after 1 day
 * })
 * ```
 *
 * 5. **Notification with Metadata**
 * ```typescript
 * await createNotification({
 *   businessId: 1,
 *   userId: 5,
 *   type: 'low_stock',
 *   title: 'Low Stock: Coca Cola',
 *   message: 'Only 5 units left (alert level: 20)',
 *   metadata: {
 *     productId: 42,
 *     currentStock: 5,
 *     alertLevel: 20,
 *     locationId: 3
 *   },
 *   priority: 'normal'
 * })
 * ```
 *
 * 6. **Permission-Based Transfer Notification**
 * ```typescript
 * import { notifyTransferPending } from '@/lib/notifications'
 *
 * // After transfer request is created
 * await notifyTransferPending(
 *   businessId,
 *   transfer.id,
 *   transfer.transferNumber,
 *   'Main Store',
 *   'Branch A'
 * )
 * // Only users with 'transfer.approve' permission get notified
 * ```
 *
 * 7. **Location-Based Notification**
 * ```typescript
 * import { notifyTransferToReceive } from '@/lib/notifications'
 *
 * // Notify users at destination location
 * await notifyTransferToReceive(
 *   businessId,
 *   transfer.id,
 *   'TR-001',
 *   'Main Store',
 *   'Branch A',
 *   branchALocationId  // Only Branch A users notified
 * )
 * ```
 *
 * 8. **Cleanup Old Notifications (Scheduled Job)**
 * ```typescript
 * import { deleteExpiredNotifications } from '@/lib/notifications'
 *
 * // Run daily via cron job or scheduled task
 * const deletedCount = await deleteExpiredNotifications()
 * console.log(`Deleted ${deletedCount} expired notifications`)
 * ```
 *
 * NOTIFICATION FLOW EXAMPLE (Transfer Request):
 * ----------------------------------------------
 * ```
 * 1. User creates transfer request (Main Store → Branch A)
 * 2. System calls notifyTransferPending()
 * 3. Query finds all users with 'transfer.approve' permission
 * 4. Create notification for each approver:
 *    - Type: 'transfer_pending'
 *    - Priority: 'normal'
 *    - ActionUrl: '/dashboard/transfers/123'
 * 5. Approvers see bell icon with red badge (unread count)
 * 6. Manager clicks notification → navigates to transfer page
 * 7. Manager approves transfer
 * 8. System calls notifyTransferToReceive()
 * 9. Query finds users at Branch A with 'transfer.receive' permission
 * 10. Notification created for Branch A staff
 * 11. Staff receives inventory → marks transfer complete
 * 12. After 7 days, expired notifications auto-delete
 * ```
 *
 * DATABASE SCHEMA:
 * ----------------
 * ```prisma
 * model Notification {
 *   id          Int      @id @default(autoincrement())
 *   businessId  Int      // Which business this belongs to
 *   userId      Int      // Who should see this notification
 *   type        String   // NotificationType enum
 *   title       String   // Short headline (e.g., "Low Stock Alert")
 *   message     String   // Detailed message
 *   actionUrl   String?  // Where to navigate on click
 *   relatedType String?  // e.g., "transfer", "product", "sale"
 *   relatedId   Int?     // ID of related record
 *   priority    String   // "low", "normal", "high", "urgent"
 *   metadata    Json?    // Extra data (flexible JSON)
 *   read        Boolean  @default(false)
 *   readAt      DateTime?
 *   expiresAt   DateTime?  // Auto-delete after this date
 *   createdAt   DateTime @default(now())
 * }
 * ```
 *
 * PERMISSION-BASED TARGETING:
 * ---------------------------
 * This module queries users based on RBAC permissions to ensure notifications
 * only go to users who can actually act on them.
 *
 * Query Pattern (used in multiple functions):
 * ```typescript
 * const users = await prisma.user.findMany({
 *   where: {
 *     businessId,
 *     allowLogin: true,   // Active accounts only
 *     deletedAt: null,    // Not deleted
 *     OR: [
 *       // Direct permission assignment
 *       { permissions: { some: { permission: { name: 'transfer.approve' }}}},
 *       // Permission via role
 *       { roles: { some: { role: { permissions: { some: { permission: { name: 'transfer.approve' }}}}}}}
 *     ]
 *   }
 * })
 * ```
 *
 * TYPESCRIPT PATTERNS:
 * --------------------
 *
 * **Union Types for Enums**:
 * ```typescript
 * type NotificationType = 'transfer_pending' | 'low_stock' | ...
 * ```
 * - TypeScript ensures you can't use invalid type strings
 * - Autocomplete suggests valid options
 * - Compile-time error if you typo a type
 *
 * **Omit Utility Type**:
 * ```typescript
 * Omit<CreateNotificationParams, 'userId'>
 * ```
 * - Creates new type with all fields EXCEPT 'userId'
 * - Used in createBulkNotifications (userId provided by array)
 * - Prevents duplicate/conflicting userId parameters
 *
 * **Optional Parameters with Defaults**:
 * ```typescript
 * priority = 'normal'  // Default value if not provided
 * ```
 * - Parameter is optional in function call
 * - If omitted, uses default value
 * - Common pattern for sensible defaults
 *
 * **Promise.all for Parallel Execution**:
 * ```typescript
 * await Promise.all(notifications.map(n => createNotification(n)))
 * ```
 * - Executes all notifications in parallel (faster than sequential)
 * - Waits for ALL to complete before continuing
 * - If ANY fails, entire operation fails (all-or-nothing)
 *
 * PRISMA PATTERNS:
 * ----------------
 *
 * **Nested Where Clauses (some)**:
 * ```typescript
 * permissions: { some: { permission: { name: 'transfer.approve' }}}
 * ```
 * - Traverses relationships: User → UserPermission → Permission
 * - "some" means "at least one matching record"
 * - Prisma generates efficient JOIN query
 *
 * **OR Conditions**:
 * ```typescript
 * OR: [{ ... }, { ... }]
 * ```
 * - Matches users who satisfy ANY condition
 * - Used to check both direct permissions and role-based permissions
 * - SQL equivalent: WHERE (condition1) OR (condition2)
 *
 * **Select for Partial Data**:
 * ```typescript
 * select: { id: true }
 * ```
 * - Only fetch user IDs (don't need username, email, etc.)
 * - Reduces data transfer and memory usage
 * - Faster queries when you only need specific fields
 *
 * **Date Comparison (lt - less than)**:
 * ```typescript
 * where: { expiresAt: { lt: new Date() }}
 * ```
 * - Matches notifications that expired in the past
 * - lt = "less than" (before current date/time)
 * - Other operators: gt (greater than), gte (>=), lte (<=)
 *
 * PERFORMANCE CONSIDERATIONS:
 * ---------------------------
 * - Permission queries can be slow if many users (nested joins)
 * - Consider caching user IDs by permission for high-volume notifications
 * - Promise.all executes notifications in parallel (faster)
 * - Cleanup job should run during off-peak hours (e.g., 3 AM daily)
 * - For real-time updates, use WebSockets instead of polling
 *
 * IMPORTANT NOTES:
 * ----------------
 * - Always set expiresInDays to prevent notification buildup
 * - Use actionUrl to make notifications actionable (not just informational)
 * - Priority affects UI presentation (color, sorting, badging)
 * - relatedType/relatedId link notification to source record for tracking
 * - metadata is flexible JSON - store any extra info you need
 * - Notifications are NOT emails - they only appear in the app
 * - Run deleteExpiredNotifications() daily via cron job
 * - Consider rate limiting to prevent notification spam
 */

import { prisma } from '@/lib/prisma'

/**
 * Notification Type Enum
 *
 * TypeScript Union Type - defines all valid notification types.
 * Using string literal types ensures type safety and autocomplete.
 */
export type NotificationType =
  | 'transfer_pending'      // Transfer awaiting approval
  | 'transfer_to_receive'   // Transfer ready to receive at destination
  | 'transfer_completed'    // Transfer successfully completed
  | 'purchase_pending'      // Purchase order needs approval
  | 'purchase_approved'     // Purchase order approved
  | 'low_stock'             // Product below alert threshold
  | 'out_of_stock'          // Product completely out of stock
  | 'correction_pending'    // Inventory correction awaiting approval
  | 'correction_approved'   // Correction approved
  | 'return_pending'        // Return request needs approval
  | 'return_approved'       // Return approved
  | 'sale_void'             // Sale was voided/cancelled
  | 'shift_reminder'        // Reminder to open/close shift
  | 'general'               // Generic notification

/**
 * Notification Priority Levels
 *
 * Determines UI presentation (color, badge, sorting)
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent'

/**
 * Parameters for creating a notification
 *
 * @property businessId - Which business this notification belongs to
 * @property userId - Which user should see this notification
 * @property type - Type of notification (affects icon and category)
 * @property title - Short headline (shown in list, max ~50 chars)
 * @property message - Detailed message (shown in detail view)
 * @property actionUrl - (Optional) Page to navigate to on click
 * @property relatedType - (Optional) Type of related record (e.g., "transfer", "product")
 * @property relatedId - (Optional) ID of related record
 * @property priority - (Optional) Priority level (default: 'normal')
 * @property metadata - (Optional) Flexible JSON for extra data
 * @property expiresInDays - (Optional) Auto-delete after this many days
 */
interface CreateNotificationParams {
  businessId: number
  userId: number
  type: NotificationType
  title: string
  message: string
  actionUrl?: string           // Optional: URL to navigate to on click
  relatedType?: string         // Optional: e.g., "transfer", "product", "sale"
  relatedId?: number           // Optional: ID of related record
  priority?: NotificationPriority  // Optional: defaults to 'normal'
  metadata?: any               // Optional: flexible JSON data
  expiresInDays?: number       // Optional: auto-delete after X days
}

/**
 * Create a notification for a single user
 *
 * This is the core function for creating notifications. All other notification
 * functions ultimately call this one.
 *
 * @param params - Notification parameters (businessId, userId, type, title, etc.)
 * @returns The created notification record
 *
 * Example:
 * ```typescript
 * const notification = await createNotification({
 *   businessId: 1,
 *   userId: 5,
 *   type: 'low_stock',
 *   title: 'Low Stock Alert',
 *   message: 'Coca Cola has only 5 units left',
 *   actionUrl: '/dashboard/products/42',
 *   priority: 'high',
 *   expiresInDays: 3
 * })
 * ```
 */
export async function createNotification(params: CreateNotificationParams) {
  // Destructure parameters (extract individual fields from params object)
  // TypeScript Pattern: Object destructuring with default value (priority = 'normal')
  const {
    businessId,
    userId,
    type,
    title,
    message,
    actionUrl,
    relatedType,
    relatedId,
    priority = 'normal',  // Default to 'normal' if not provided
    metadata,
    expiresInDays
  } = params

  // Calculate expiration date if expiresInDays is provided
  let expiresAt = null
  if (expiresInDays) {
    expiresAt = new Date()  // Current date/time
    // Add days to current date
    // JavaScript Date: setDate() modifies the day of month
    expiresAt.setDate(expiresAt.getDate() + expiresInDays)
    // Example: Today is Jan 15 + 7 days = Jan 22
  }

  try {
    // Create notification record in database
    // Prisma Pattern: create() inserts a new record and returns it
    return await prisma.notification.create({
      data: {
        businessId,
        userId,
        type,
        title,
        message,
        actionUrl,      // Nullable - can be undefined
        relatedType,    // Nullable - can be undefined
        relatedId,      // Nullable - can be undefined
        priority,       // Defaults to 'normal' if not provided
        metadata,       // Nullable JSON - can store any object
        expiresAt       // Nullable DateTime - can be null (no expiration)
      }
    })
  } catch (error) {
    // Log error for debugging (appears in server logs)
    console.error('Error creating notification:', error)
    // Re-throw error so caller can handle it
    // This allows caller to wrap in try-catch and react appropriately
    throw error
  }
}

/**
 * Create notification for multiple users
 *
 * Sends the same notification to multiple users at once.
 * More efficient than calling createNotification() in a loop.
 *
 * TypeScript Pattern: Omit Utility Type
 * --------------------------------------
 * `Omit<CreateNotificationParams, 'userId'>` creates a new type with
 * all fields from CreateNotificationParams EXCEPT 'userId'.
 *
 * Why? Because userId is provided separately (in the userIds array).
 * This prevents conflicting userId values and ensures type safety.
 *
 * @param userIds - Array of user IDs to notify
 * @param params - Notification parameters (without userId - provided by array)
 * @returns Array of created notification records
 *
 * Example:
 * ```typescript
 * const managerIds = [1, 2, 3]
 * await createBulkNotifications(managerIds, {
 *   businessId: 1,
 *   type: 'transfer_pending',
 *   title: 'Transfer Awaiting Approval',
 *   message: 'Transfer TR-001 needs your approval',
 *   actionUrl: '/dashboard/transfers/123',
 *   priority: 'high'
 * })
 * // Creates 3 notifications (one for each manager)
 * ```
 */
export async function createBulkNotifications(
  userIds: number[],
  params: Omit<CreateNotificationParams, 'userId'>
) {
  // Build array of notification objects (one per user)
  // TypeScript Pattern: .map() transforms user IDs to notification params
  // Spread operator (...params) copies all fields from params object
  const notifications = userIds.map(userId => ({
    ...params,    // Copy all fields: businessId, type, title, message, etc.
    userId        // Add the specific userId for this notification
  }))
  // Example: [
  //   { ...params, userId: 1 },
  //   { ...params, userId: 2 },
  //   { ...params, userId: 3 }
  // ]

  try {
    // Create all notifications in parallel using Promise.all
    // JavaScript Pattern: Promise.all waits for ALL promises to complete
    // - Executes createNotification() for each user simultaneously (faster)
    // - If ANY fails, entire operation fails (all-or-nothing)
    // - Returns array of results once all complete
    return await Promise.all(notifications.map(n => createNotification(n)))
  } catch (error) {
    console.error('Error creating bulk notifications:', error)
    throw error
  }
}

/**
 * Notify users with permission about a pending transfer
 *
 * This is a PERMISSION-BASED notification - only users who can act on the
 * transfer (approve it) get notified. This prevents spam and ensures only
 * relevant users see the notification.
 *
 * Permission-Based Notification Pattern:
 * ---------------------------------------
 * 1. Query database for users with specific permission ('transfer.approve')
 * 2. Check both direct permissions AND role-based permissions (OR condition)
 * 3. Filter by businessId (multi-tenant isolation)
 * 4. Filter by allowLogin=true and deletedAt=null (active users only)
 * 5. Create notifications for all matching users
 *
 * When to Call This:
 * ------------------
 * - Immediately after transfer request is created
 * - Status changes from 'draft' to 'pending'
 * - Called from transfer creation API route
 *
 * @param businessId - Business ID (for multi-tenant filtering)
 * @param transferId - Transfer record ID (for actionUrl)
 * @param transferNumber - Transfer number to show in message (e.g., "TR-001")
 * @param fromLocation - Source location name (e.g., "Main Store")
 * @param toLocation - Destination location name (e.g., "Branch A")
 *
 * Example Usage:
 * ```typescript
 * // After creating transfer request
 * await notifyTransferPending(
 *   business.id,
 *   transfer.id,
 *   transfer.transferNumber,
 *   sourceLocation.name,
 *   destinationLocation.name
 * )
 * ```
 */
export async function notifyTransferPending(
  businessId: number,
  transferId: number,
  transferNumber: string,
  fromLocation: string,
  toLocation: string
) {
  // STEP 1: Find all users who can approve transfers
  // Complex Prisma query with nested relationships and OR conditions
  const users = await prisma.user.findMany({
    where: {
      businessId,           // Multi-tenant: only users from this business
      allowLogin: true,     // Active accounts only (not suspended)
      deletedAt: null,      // Not soft-deleted
      OR: [                 // Match if user has permission EITHER directly OR via role
        // OPTION 1: Users with DIRECT permission assignment
        // User → UserPermission → Permission (permission.name = 'transfer.approve')
        {
          permissions: {    // User has direct permissions
            some: {         // At least ONE matching permission
              permission: {
                name: 'transfer.approve'  // The specific permission we're checking
              }
            }
          }
        },
        // OPTION 2: Users with permission via ROLE
        // User → UserRole → Role → RolePermission → Permission
        {
          roles: {          // User has roles
            some: {         // At least ONE role...
              role: {
                permissions: {  // ...that has permissions
                  some: {       // At least ONE permission...
                    permission: {
                      name: 'transfer.approve'  // ...matching this name
                    }
                  }
                }
              }
            }
          }
        }
      ]
    },
    select: { id: true }  // Only fetch user IDs (don't need full user objects)
  })

  // Extract just the IDs from the query result
  // Array of user objects → Array of user IDs
  const userIds = users.map(u => u.id)

  // STEP 2: Create notifications for all matching users (if any found)
  if (userIds.length > 0) {
    await createBulkNotifications(userIds, {
      businessId,
      type: 'transfer_pending',
      title: 'Transfer Awaiting Approval',
      // Template string: Insert variables into message
      message: `Transfer ${transferNumber} from ${fromLocation} to ${toLocation} needs approval`,
      actionUrl: `/dashboard/transfers/${transferId}`,  // Click to view transfer
      relatedType: 'transfer',  // Links notification to transfer record
      relatedId: transferId,
      priority: 'normal',       // Not urgent (can approve later today)
      expiresInDays: 7          // Auto-delete after 1 week if not handled
    })
  }
  // If no users have permission, no notifications are sent (silent)
}

/**
 * Notify destination location users about transfer ready to receive
 *
 * This is a LOCATION + PERMISSION-BASED notification.
 * Only notifies users who are:
 * 1. Assigned to the destination location (toLocationId)
 * 2. Have 'transfer.receive' permission
 *
 * When to Call: After transfer is approved, before receiving
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
  // Additional filter: userLocations.some({ locationId: toLocationId })
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
 *
 * Alerts inventory managers when product stock falls below alert threshold.
 *
 * When to Call:
 * - After stock transaction that brings quantity below alertQuantity
 * - Called from stockOperations.ts after deducting stock
 * - Typically triggers during sales or inventory adjustments
 *
 * Targets users with 'product.view' permission (inventory managers/admins)
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
  // Permission: 'product.view' (inventory managers can see/manage products)
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
 *
 * Removes notifications that have passed their expiration date.
 * This prevents notification table from growing indefinitely.
 *
 * When to Run:
 * ------------
 * - Daily via cron job (e.g., 3 AM when system is idle)
 * - From scheduled task runner (e.g., node-cron, BullMQ)
 * - Manually from admin panel "Cleanup" button
 *
 * Example Cron Setup:
 * ```typescript
 * // In scheduled-jobs.ts
 * import cron from 'node-cron'
 * import { deleteExpiredNotifications } from '@/lib/notifications'
 *
 * // Run daily at 3:00 AM
 * cron.schedule('0 3 * * *', async () => {
 *   const count = await deleteExpiredNotifications()
 *   console.log(`Cleaned up ${count} expired notifications`)
 * })
 * ```
 *
 * @returns Number of deleted notifications
 */
export async function deleteExpiredNotifications() {
  try {
    // Delete all notifications where expiresAt is in the past
    // Prisma Pattern: deleteMany with date comparison
    // lt = "less than" (before current date/time)
    const result = await prisma.notification.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()  // Current date/time
        }
      }
    })
    // Return count of deleted records
    // result.count contains number of rows deleted
    return result.count
  } catch (error) {
    console.error('Error deleting expired notifications:', error)
    throw error
  }
}
