import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { createAuditLog, AuditAction, EntityType } from "./auditLog"
import { PERMISSIONS } from "./rbac"

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
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Missing credentials")
        }

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
          select: {
            business: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            roles: {
              select: {
                role: {
                  select: {
                    permissions: {
                      select: {
                        permission: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                      },
                    },
                    locations: {
                      select: {
                        location: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
                      },
                    },
                  },
                },
              },
            },
            permissions: {
              select: {
                permission: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
              },
            },
            userLocations: {
              select: {
                location: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
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
                enforceScheduleLogin: { select: { id: true, name: true } },
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
                  isActive: { select: { id: true, name: true } },
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

        // Get user role names
        const roleNames = user.roles.map(ur => ur.role.name)

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
