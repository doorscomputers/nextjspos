import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import bcrypt from 'bcryptjs'
import { sendTelegramUserRoleChangeAlert } from '@/lib/telegram'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { detectFieldChanges, formatChangesDescription, CRITICAL_FIELDS } from '@/lib/auditFieldChanges'

// GET single user
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as any

    // Check permission
    if (!sessionUser.permissions?.includes(PERMISSIONS.USER_VIEW)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)

    // Get user
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(sessionUser.businessId),
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        userLocations: {
          include: {
            location: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Format response (exclude password)
    const formattedUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      surname: user.surname,
      firstName: user.firstName,
      lastName: user.lastName,
      allowLogin: user.allowLogin,
      roleIds: user.roles.map(ur => ur.roleId),
      roles: user.roles.map(ur => ur.role.name),
      locationId: user.userLocations.length > 0 ? user.userLocations[0].locationId : null, // Changed to single location
      locationIds: user.userLocations.map(ul => ul.locationId), // Keep for backward compatibility
      locations: user.userLocations.map(ul => ul.location.name),
      createdAt: user.createdAt,
    }

    return NextResponse.json(formattedUser)
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT (update) user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  console.log('======= USER UPDATE API CALLED =======')
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessionUser = session.user as any

    // Check permission
    if (!sessionUser.permissions?.includes(PERMISSIONS.USER_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const resolvedParams = await params
    const userId = parseInt(resolvedParams.id)
    const body = await request.json()
    const {
      username,
      password,
      email,
      surname,
      firstName,
      lastName,
      roleIds,
      locationId, // Changed to single location
      allowLogin
    } = body

    // Check if user exists and belongs to the same business
    const existingUser = await prisma.user.findFirst({
      where: {
        id: userId,
        businessId: parseInt(sessionUser.businessId),
        deletedAt: null,
      },
      include: {
        roles: {
          include: {
            role: { select: { name: true } }
          }
        }
      }
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Store previous roles for notification
    const previousRoleNames = existingUser.roles.map(ur => ur.role.name)

    // Validate location requirement based on assigned roles
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      // Get roles with their permissions
      const assignedRoles = await prisma.role.findMany({
        where: { id: { in: roleIds } },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      })

      // Check if ANY role has ACCESS_ALL_LOCATIONS permission
      const hasAccessAllLocations = assignedRoles.some(role =>
        role.permissions.some(rp => rp.permission.name === 'access_all_locations')
      )

      // Location is ONLY required if user does NOT have a role with ACCESS_ALL_LOCATIONS
      if (!hasAccessAllLocations && locationId === undefined) {
        // Check if user currently has a location
        const currentLocation = await prisma.userLocation.findFirst({
          where: { userId }
        })

        if (!currentLocation) {
          return NextResponse.json({
            error: 'Location is required for transactional roles (Cashier, Manager, Staff). Roles with ACCESS_ALL_LOCATIONS permission can work across all locations.'
          }, { status: 400 })
        }
      }
    }

    // If username is being changed, check if new username is available
    if (username && username !== existingUser.username) {
      const usernameTaken = await prisma.user.findUnique({
        where: { username },
      })
      if (usernameTaken) {
        return NextResponse.json(
          { error: 'Username already exists' },
          { status: 400 }
        )
      }
    }

    // Prepare update data
    const updateData: any = {
      ...(username && { username }),
      ...(email !== undefined && { email: email || null }),
      ...(surname && { surname }),
      ...(firstName && { firstName }),
      ...(lastName !== undefined && { lastName: lastName || null }),
      ...(allowLogin !== undefined && { allowLogin }),
    }

    // If password is provided, hash it
    if (password) {
      updateData.password = await bcrypt.hash(password, 10)
    }

    // ✅ ATOMIC TRANSACTION: Update user + roles + locations
    // All updates happen together or none at all
    const updatedUser = await prisma.$transaction(async (tx) => {
      // Update user
      const user = await tx.user.update({
        where: { id: userId },
        data: updateData,
      })

      // Update roles if provided
      if (roleIds && Array.isArray(roleIds)) {
        // Delete existing role assignments
        await tx.userRole.deleteMany({
          where: { userId },
        })

        // Create new role assignments
        await Promise.all(
          roleIds.map((roleId: number) =>
            tx.userRole.create({
              data: {
                userId,
                roleId,
              },
            })
          )
        )
      }

      // Update location if provided (single location)
      if (locationId !== undefined) {
        // Delete existing location assignments
        await tx.userLocation.deleteMany({
          where: { userId },
        })

        // Create new location assignment
        if (locationId) {
          await tx.userLocation.create({
            data: {
              userId,
              locationId: parseInt(locationId),
            },
          })
        }
      }

      return user
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    // ===== AUDIT LOGGING =====
    try {
      console.log('[USER UPDATE AUDIT] Starting audit logging for user:', userId)
      console.log('[USER UPDATE AUDIT] Session user:', sessionUser.id, sessionUser.username, sessionUser.businessId)

      // Detect field changes for basic user fields
      const fieldsToTrack = ['username', 'email', 'firstName', 'lastName', 'allowLogin']
      const oldDataForAudit: Record<string, string | boolean | null> = {
        username: existingUser.username,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        allowLogin: existingUser.allowLogin,
      }
      const newDataForAudit: Record<string, string | boolean | null> = {
        username: updatedUser.username,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        allowLogin: updatedUser.allowLogin,
      }

      console.log('[USER UPDATE AUDIT] Old data:', JSON.stringify(oldDataForAudit))
      console.log('[USER UPDATE AUDIT] New data:', JSON.stringify(newDataForAudit))

      const fieldChanges = detectFieldChanges(oldDataForAudit, newDataForAudit, fieldsToTrack)
      console.log('[USER UPDATE AUDIT] Field changes detected:', fieldChanges.length)

      // Track password change (don't log actual password, just that it changed)
      const passwordChanged = !!password
      console.log('[USER UPDATE AUDIT] Password changed:', passwordChanged)
      if (passwordChanged) {
        fieldChanges.push({
          field: 'password',
          oldValue: '********',
          newValue: '(changed)',
          fieldType: 'string'
        })
      }
      console.log('[USER UPDATE AUDIT] Total changes after password check:', fieldChanges.length)

      // Track role changes
      const previousRoleIds = existingUser.roles.map(ur => ur.roleId)
      const newRoleIds = roleIds || previousRoleIds
      const rolesChanged = roleIds && (
        previousRoleIds.length !== newRoleIds.length ||
        previousRoleIds.some((id: number) => !newRoleIds.includes(id)) ||
        newRoleIds.some((id: number) => !previousRoleIds.includes(id))
      )

      if (rolesChanged) {
        fieldChanges.push({
          field: 'roles',
          oldValue: previousRoleNames.join(', ') || 'None',
          newValue: 'Changed', // Will be updated below with actual names
          fieldType: 'string'
        })
      }

      // Only create audit log if something actually changed
      if (fieldChanges.length > 0) {
        const description = formatChangesDescription(fieldChanges)
        const userName = [existingUser.firstName, existingUser.lastName].filter(Boolean).join(' ') || existingUser.username

        // Get new role names if roles changed
        let newRoleNamesForAudit: string[] = previousRoleNames
        if (rolesChanged && roleIds) {
          const newRoles = await prisma.role.findMany({
            where: { id: { in: roleIds } },
            select: { name: true }
          })
          newRoleNamesForAudit = newRoles.map(r => r.name)

          // Update the roles change in fieldChanges
          const rolesChangeIndex = fieldChanges.findIndex(c => c.field === 'roles')
          if (rolesChangeIndex >= 0) {
            fieldChanges[rolesChangeIndex].newValue = newRoleNamesForAudit.join(', ') || 'None'
          }
        }

        console.log('[USER UPDATE AUDIT] Creating audit log with businessId:', sessionUser.businessId)
        const auditResult = await createAuditLog({
          businessId: parseInt(sessionUser.businessId),
          userId: parseInt(sessionUser.id),
          username: sessionUser.username || `User#${sessionUser.id}`,
          action: AuditAction.USER_UPDATE,
          entityType: EntityType.USER,
          entityIds: [userId],
          description: `Updated user "${userName}": ${description}`,
          metadata: {
            targetUserId: userId,
            targetUsername: existingUser.username,
            changes: fieldChanges,
            oldValues: {
              ...oldDataForAudit,
              roles: previousRoleNames.join(', ') || 'None'
            },
            newValues: {
              ...newDataForAudit,
              password: passwordChanged ? '(changed)' : '(unchanged)',
              roles: newRoleNamesForAudit.join(', ') || 'None'
            },
            changedFields: fieldChanges.map(c => c.field),
            changeCount: fieldChanges.length
          },
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request)
        })
        console.log('[USER UPDATE AUDIT] Audit log created:', auditResult?.id)
      } else {
        console.log('[USER UPDATE AUDIT] No changes detected, skipping audit log')
      }
    } catch (auditError) {
      // Don't fail the update if audit logging fails
      console.error('Audit logging failed for user update:', auditError)
    }
    // ===== END AUDIT LOGGING =====

    // Send Telegram notification for role changes
    if (roleIds && Array.isArray(roleIds)) {
      try {
        const newRoles = await prisma.role.findMany({
          where: { id: { in: roleIds } },
          select: { name: true }
        })
        const newRoleNames = newRoles.map(r => r.name)

        // Only send notification if roles actually changed
        const rolesChanged =
          previousRoleNames.length !== newRoleNames.length ||
          previousRoleNames.some(r => !newRoleNames.includes(r)) ||
          newRoleNames.some(r => !previousRoleNames.includes(r))

        if (rolesChanged) {
          const changedByName = [sessionUser.firstName, sessionUser.lastName].filter(Boolean).join(' ') || sessionUser.username || `User#${sessionUser.id}`
          const userName = [updatedUser.firstName, updatedUser.lastName].filter(Boolean).join(' ') || updatedUser.username

          await sendTelegramUserRoleChangeAlert({
            userName,
            userEmail: updatedUser.email || undefined,
            previousRole: previousRoleNames.join(', ') || 'None',
            newRole: newRoleNames.join(', ') || 'None',
            changedBy: changedByName,
            timestamp: new Date()
          })
        }
      } catch (telegramError) {
        console.error('Telegram notification failed:', telegramError)
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
      },
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
