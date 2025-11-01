import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { createAuditLog, AuditAction, EntityType } from "./auditLog"
import { PERMISSIONS } from "./rbac"
import { sendLoginAlerts } from "./notifications/login-alert-service"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours - sessions expire after 8 hours regardless of activity
    updateAge: 60 * 60, // Update session every 1 hour
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET || "default-secret-for-development-only",
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        locationId: { label: "Location", type: "text" },  // Added for login monitoring
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials")
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          include: {
            business: true,
            roles: {
              include: {
                role: {
                  include: {
                    permissions: {
                      include: {
                        permission: true,
                      },
                    },
                    locations: {
                      include: {
                        location: true,
                      },
                    },
                  },
                },
              },
            },
            permissions: {
              include: {
                permission: true,
              },
            },
            userLocations: {
              include: {
                location: true,
              },
            },
          },
        })

        if (!user || !user.allowLogin) {
          throw new Error("Invalid credentials")
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          throw new Error("Invalid credentials")
        }

        // Parse selected location from login form (used in shift validation & notifications)
        const selectedLocationId = credentials.locationId ? parseInt(credentials.locationId) : null

        // Get user role names for various checks
        const roleNames = user.roles.map(ur => ur.role.name)

        // Check if user is admin (exempt from RFID location scanning)
        const isAdminRole = roleNames.some(role =>
          role === 'Super Admin' ||
          role === 'System Administrator' ||
          role === 'All Branch Admin'
        )

        // ============================================================================
        // RFID LOCATION VALIDATION: Enforce for non-admin roles only
        // ============================================================================
        if (!isAdminRole && !selectedLocationId) {
          console.log(`[LOGIN] ❌ BLOCKED - Location RFID scan required for ${user.username}`)
          throw new Error(
            "Location verification required.\n\n" +
            "Please scan the RFID card at your location to continue.\n\n" +
            "The RFID card should be physically located at your workstation."
          )
        }

        if (isAdminRole) {
          console.log(`[LOGIN] ✓ Admin role detected - skipping location validation for ${user.username}`)
        } else if (selectedLocationId) {
          console.log(`[LOGIN] ✓ RFID scanned - Location ID: ${selectedLocationId}`)
        }

        // ============================================================================
        // SHIFT VALIDATION: Prevent login conflicts for cashiers
        // ============================================================================
        // Check if user has cashier-related roles (users who work with shifts)
        const isCashierRole = roleNames.some(role =>
          role.toLowerCase().includes('cashier') ||
          role === 'Manager' ||
          role === 'Supervisor'
        )

        // Only enforce shift checks for cashier/manager roles (not for admins)
        const isExemptFromShiftCheck = roleNames.some(role =>
          role === 'Super Admin' ||
          role === 'System Administrator' ||
          role === 'Admin' ||
          role === 'All Branch Admin'
        )

        if (isCashierRole && !isExemptFromShiftCheck) {
          console.log(`[LOGIN] Checking shift status for user: ${user.username} (ID: ${user.id})`)

          // ===== CHECK 1: Does this user have ANY open shift? =====
          const userOpenShift = await prisma.cashierShift.findFirst({
            where: {
              userId: user.id,
              status: 'open',
              businessId: user.businessId,
            }
          })

          // IMPORTANT: Allow login if user has their own open shift
          // (they need to log in to close it!)
          // The dashboard will auto-redirect them to POS to close the shift
          if (userOpenShift) {
            const shiftLocation = await prisma.businessLocation.findUnique({
              where: { id: userOpenShift.locationId },
              select: { name: true }
            })

            const locationName = shiftLocation?.name || 'Unknown Location'
            const hoursSinceOpen = Math.floor((new Date().getTime() - new Date(userOpenShift.openedAt).getTime()) / (1000 * 60 * 60))

            console.log(`[LOGIN] ✓ ALLOWED - User ${user.username} has their own open shift at ${locationName} (will be redirected to close it)`)

            // Don't block - let them log in to close their shift
            // The system will auto-redirect them to POS/close shift page
          }

          // ===== CHECK 2: Does the SELECTED location have a shift by SOMEONE ELSE? =====
          // Determine which location(s) to check for open shifts
          let locationsToCheck: number[] = []

          if (selectedLocationId) {
            // User selected a specific location - check ONLY that location
            locationsToCheck = [selectedLocationId]
            console.log(`[LOGIN] Checking shift for selected location: ${selectedLocationId}`)
          } else {
            // No location selected - check ALL assigned locations (fallback)
            locationsToCheck = user.userLocations.map(ul => ul.locationId)
            console.log(`[LOGIN] No location selected, checking all assigned locations`)
          }

          if (locationsToCheck.length > 0) {
            // Check if the selected/assigned location(s) have an open shift by another user
            const locationOpenShifts = await prisma.cashierShift.findMany({
              where: {
                locationId: { in: locationsToCheck },
                status: 'open',
                businessId: user.businessId,
                userId: { not: user.id }, // Exclude current user (already checked above)
              }
            })

            if (locationOpenShifts.length > 0) {
              const conflictShift = locationOpenShifts[0]

              // Fetch location and user separately (no relations in schema)
              const [conflictLocation, conflictUser] = await Promise.all([
                prisma.businessLocation.findUnique({
                  where: { id: conflictShift.locationId },
                  select: { name: true }
                }),
                prisma.user.findUnique({
                  where: { id: conflictShift.userId },
                  select: {
                    username: true,
                    firstName: true,
                    lastName: true,
                  }
                })
              ])

              const locationName = conflictLocation?.name || 'Unknown Location'
              const otherUserName = conflictUser
                ? `${conflictUser.firstName} ${conflictUser.lastName || ''}`.trim() || conflictUser.username
                : 'Another user'

              const hoursSinceOpen = Math.floor((new Date().getTime() - new Date(conflictShift.openedAt).getTime()) / (1000 * 60 * 60))

              console.log(`[LOGIN] BLOCKED - Location ${locationName} has open shift by ${otherUserName}`)
              throw new Error(
                `Location ${locationName} already has an active shift.\n\n` +
                `Active Shift: ${conflictShift.shiftNumber}\n` +
                `Cashier: ${otherUserName}\n` +
                `Opened: ${hoursSinceOpen} hours ago\n\n` +
                `Please wait for ${otherUserName} to close their shift before you can start a new shift at this location.\n\n` +
                `Only ONE active shift is allowed per location at a time.`
              )
            }
          }

          console.log(`[LOGIN] ✓ Shift validation passed for user: ${user.username}`)
        }

        // Check schedule-based login restrictions
        if (user.businessId) {
          // Get schedule login configuration for business
          let config = await prisma.scheduleLoginConfiguration.findUnique({
            where: { businessId: user.businessId }
          })

          // Create default configuration if not exists
          if (!config) {
            config = await prisma.scheduleLoginConfiguration.create({
              data: {
                businessId: user.businessId,
                enforceScheduleLogin: true,
                earlyClockInGraceMinutes: 30,
                lateClockOutGraceMinutes: 60,
                exemptRoles: "Super Admin,System Administrator,Super Admin (Legacy),Admin (Legacy)",
              }
            })
          }

          // Check if feature is enabled
          if (config.enforceScheduleLogin) {
            const roleNames = user.roles.map(ur => ur.role.name)

            // Check if user has exempt role
            const exemptRolesList = config.exemptRoles?.split(',').map(r => r.trim()) || []
            const isExemptRole = roleNames.some(role => exemptRolesList.includes(role))

            // Non-exempt users must login within their scheduled hours
            if (!isExemptRole) {
              const now = new Date()
              // Get day of week as number (0=Sunday, 1=Monday, ..., 6=Saturday)
              const dayOfWeek = now.getDay()

              // Get today's schedule for the user
              const todaySchedule = await prisma.employeeSchedule.findFirst({
                where: {
                  userId: user.id,
                  businessId: user.businessId,
                  dayOfWeek: dayOfWeek,
                  isActive: true,
                  deletedAt: null,
                }
              })

              // Block login if no schedule exists for today
              if (!todaySchedule) {
                const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                throw new Error(`Login denied: You are not scheduled to work on ${dayNames[dayOfWeek]}. Please contact your manager if you need access.`)
              }

              if (todaySchedule && todaySchedule.endTime) {
                // Parse schedule end time
                const [endHours, endMinutes, endSeconds] = todaySchedule.endTime.split(':').map(Number)
                const scheduleEndTime = new Date(now)
                scheduleEndTime.setHours(endHours, endMinutes, endSeconds || 0, 0)

                // Add grace period for clock-out purposes
                const endTimeWithGrace = new Date(scheduleEndTime.getTime() + config.lateClockOutGraceMinutes * 60000)

                // Check if current time is past schedule end + grace period
                if (now > endTimeWithGrace) {
                  const errorMessage = config.tooLateMessage ||
                    `Login denied: You cannot login after your scheduled working hours (${todaySchedule.endTime}). Please contact your manager if you need access.`
                  throw new Error(errorMessage)
                }

                // Check if current time is before schedule start
                const [startHours, startMinutes, startSeconds] = todaySchedule.startTime.split(':').map(Number)
                const scheduleStartTime = new Date(now)
                scheduleStartTime.setHours(startHours, startMinutes, startSeconds || 0, 0)

                // Allow early clock-in based on configuration
                const startTimeWithEarly = new Date(scheduleStartTime.getTime() - config.earlyClockInGraceMinutes * 60000)

                if (now < startTimeWithEarly) {
                  const errorMessage = config.tooEarlyMessage ||
                    `Login denied: You cannot login before your scheduled working hours (${todaySchedule.startTime}). Please wait until ${startTimeWithEarly.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`
                  throw new Error(errorMessage)
                }
              }
            }
          }
        }

        // Log successful login
        try {
          await createAuditLog({
            businessId: user.businessId || 0,
            userId: user.id,
            username: user.username,
            action: AuditAction.USER_LOGIN,
            entityType: EntityType.USER,
            entityIds: [user.id],
            description: `User ${user.username} logged in successfully`,
            metadata: {
              loginTime: new Date().toISOString(),
              firstName: user.firstName,
              lastName: user.lastName,
            },
            ipAddress: 'unknown', // Will be updated when we have request context
            userAgent: 'unknown', // Will be updated when we have request context
          })
        } catch (auditError) {
          console.error('Failed to create login audit log:', auditError)
          // Don't block login if audit logging fails
        }

        // Collect all permissions from roles and direct permissions
        const rolePermissions = user.roles.flatMap(ur =>
          ur.role.permissions.map(rp => rp.permission.name)
        )
        const directPermissions = user.permissions.map(up => up.permission.name)
        let allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

        // roleNames already declared at line 82, reuse it here
        // const roleNames = user.roles.map(ur => ur.role.name) // REMOVED: duplicate declaration

        // If user has "Super Admin" role, grant ALL permissions automatically
        // Support all Super Admin role name variations for backward compatibility
        if (roleNames.includes('Super Admin') ||
            roleNames.includes('System Administrator') ||
            roleNames.includes('Super Admin (Legacy)')) {
          allPermissions = Object.values(PERMISSIONS)
        }

        // Collect location IDs with priority logic:
        // 1. If user has direct UserLocation assignments, use those (override)
        // 2. Otherwise, collect from all roles' RoleLocation assignments (union)
        const directLocationIds = user.userLocations.map(ul => ul.locationId)
        const roleLocationIds = user.roles.flatMap(ur =>
          ur.role.locations.map(rl => rl.locationId)
        )

        // Priority: Direct user locations override role locations
        const locationIds = directLocationIds.length > 0
          ? directLocationIds
          : [...new Set(roleLocationIds)]

        // ============================================================================
        // LOGIN MONITORING: Send notifications via Telegram, Email, and SMS
        // ============================================================================
        try {
          // Check if user is Super Admin (skip monitoring for admins)
          const isSuperAdmin = roleNames.includes('Super Admin') ||
                               roleNames.includes('System Administrator') ||
                               roleNames.includes('All Branch Admin')

          // Get selected location details (selectedLocationId already declared at top)
          let selectedLocationName = 'Unknown'
          let isMismatch = false

          if (selectedLocationId) {
            // Fetch selected location name
            const selectedLocation = await prisma.businessLocation.findUnique({
              where: { id: selectedLocationId },
              select: { name: true }
            })
            selectedLocationName = selectedLocation?.name || 'Unknown'

            // Check for location mismatch (only for non-admins)
            if (!isSuperAdmin) {
              isMismatch = !locationIds.includes(selectedLocationId)
            }
          }

          // Get assigned location names for alert message
          const assignedLocationNames: string[] = []
          if (locationIds.length > 0) {
            const assignedLocations = await prisma.businessLocation.findMany({
              where: { id: { in: locationIds } },
              select: { name: true }
            })
            assignedLocationNames.push(...assignedLocations.map(l => l.name))
          }

          // If location mismatch detected, send CRITICAL alert and BLOCK login
          if (isMismatch && !isSuperAdmin) {
            console.log(`[LOGIN] ❌ BLOCKED - Location mismatch for ${user.username}`)
            console.log(`[LOGIN] Attempted location: ${selectedLocationName} (ID: ${selectedLocationId})`)
            console.log(`[LOGIN] Assigned locations: ${assignedLocationNames.join(', ')}`)

            // Send CRITICAL alerts immediately (fire-and-forget)
            sendLoginAlerts({
              username: user.username,
              fullName: `${user.firstName} ${user.lastName || ''}`.trim(),
              role: roleNames.join(', '),
              selectedLocation: selectedLocationName,
              assignedLocations: assignedLocationNames,
              timestamp: new Date(),
              ipAddress: 'unknown',
              isMismatch: true,
            }, false).catch((error) => {
              console.error('[LoginAlert] Failed to send mismatch alert:', error)
            })

            // BLOCK THE LOGIN
            throw new Error(
              `Access Denied: Location Mismatch\n\n` +
              `You are not authorized to login at "${selectedLocationName}".\n\n` +
              `Your assigned locations are: ${assignedLocationNames.join(', ')}\n\n` +
              `This login attempt has been logged and administrators have been notified.\n\n` +
              `Please contact your manager if you believe this is an error.`
            )
          }

          // Send login alerts for successful logins (async, non-blocking)
          if (!isMismatch) {
            sendLoginAlerts({
              username: user.username,
              fullName: `${user.firstName} ${user.lastName || ''}`.trim(),
              role: roleNames.join(', '),
              selectedLocation: selectedLocationName,
              assignedLocations: assignedLocationNames,
              timestamp: new Date(),
              ipAddress: 'unknown', // TODO: Get from request context
              isMismatch: false,
            }, isSuperAdmin).catch((error) => {
              // Log error but don't block login
              console.error('[LoginAlert] Failed to send notifications:', error)
            })

            console.log(`[LoginAlert] Notifications queued for ${user.username} (SUCCESS)`)
          }
        } catch (notificationError: any) {
          // Re-throw errors that are NOT just notification failures (e.g., location mismatch)
          if (notificationError?.message?.includes('Access Denied') ||
              notificationError?.message?.includes('Location Mismatch')) {
            throw notificationError // Re-throw security errors
          }

          // Only suppress notification failures (don't block login for notification errors)
          console.error('[LoginAlert] Notification error (non-blocking):', notificationError)
        }

        return {
          id: user.id.toString(),
          username: user.username,
          email: user.email,
          name: `${user.surname} ${user.firstName} ${user.lastName || ""}`.trim(),
          firstName: user.firstName,
          lastName: user.lastName,
          surname: user.surname,
          businessId: user.businessId?.toString(),
          businessName: user.business?.name,
          permissions: allPermissions,
          roles: roleNames,
          locationIds: locationIds,
        } as any
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.username = (user as any).username
        token.firstName = (user as any).firstName
        token.lastName = (user as any).lastName
        token.surname = (user as any).surname
        token.businessId = (user as any).businessId
        token.businessName = (user as any).businessName
        token.permissions = (user as any).permissions
        token.roles = (user as any).roles
        token.locationIds = (user as any).locationIds
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        ;(session.user as any).id = token.userId
        ;(session.user as any).username = token.username
        ;(session.user as any).firstName = token.firstName
        ;(session.user as any).lastName = token.lastName
        ;(session.user as any).surname = token.surname
        ;(session.user as any).businessId = token.businessId
        ;(session.user as any).businessName = token.businessName
        ;(session.user as any).permissions = token.permissions || []
        ;(session.user as any).roles = token.roles || []
        ;(session.user as any).locationIds = token.locationIds || []
      }
      return session
    },
  },
}
