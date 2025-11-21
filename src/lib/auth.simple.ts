import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma.simple"
import bcrypt from "bcryptjs"
import { PERMISSIONS } from "./rbac"
import { createAuditLog, AuditAction, EntityType } from "./auditLog"

export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === 'development',
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // Update every 1 hour
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NEXTAUTH_URL?.startsWith('https://'),
  cookies: {
    sessionToken: {
      name: process.env.NEXTAUTH_URL?.startsWith('https://')
        ? '__Secure-next-auth.session-token'
        : 'next-auth.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NEXTAUTH_URL?.startsWith('https://'),
      },
    },
  },
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

        // Get user role names for various checks
        const roleNames = user.roles.map(ur => ur.role.name)

        // Collect all permissions to check for access_all_locations
        const rolePermissionsCheck = user.roles.flatMap(ur =>
          (ur.role.permissions || []).map(rp => rp.permission.name)
        )
        const directPermissionsCheck = user.permissions.map(p => p.permission.name)
        const allPermissionsCheck = [...new Set([...rolePermissionsCheck, ...directPermissionsCheck])]

        // Parse selected location from login form (used for RFID validation)
        const selectedLocationId = (credentials as any).locationId
          ? parseInt((credentials as any).locationId)
          : null

        // Check if user is exempt from location scanning:
        // 1. Admin roles (Super Admin, System Administrator, All Branch Admin)
        // 2. Users with access_all_locations permission (e.g., Cross-Location Approver)
        const isAdminRole = roleNames.some(role =>
          role === 'Super Admin' ||
          role === 'System Administrator' ||
          role === 'Admin' ||
          role === 'All Branch Admin' ||
          role === 'Cross Location Approver' ||
          role === 'Cross-Location Approver'
        )
        const hasAccessAllLocations = allPermissionsCheck.includes('access_all_locations')
        const isLocationExempt = isAdminRole || hasAccessAllLocations

        // ============================================================================
        // RFID LOCATION VALIDATION: Enforce for non-exempt users only
        // ============================================================================
        if (!isLocationExempt && !selectedLocationId) {
          console.log(`[LOGIN] ❌ BLOCKED - Location RFID scan required for ${user.username}`)
          throw new Error(
            "Location verification required.\n\n" +
            "Please scan the RFID card at your location to continue.\n\n" +
            "The RFID card should be physically located at your workstation."
          )
        }

        if (isLocationExempt) {
          if (isAdminRole) {
            console.log(`[LOGIN] ✓ Admin role detected - skipping location validation for ${user.username}`)
          } else if (hasAccessAllLocations) {
            console.log(`[LOGIN] ✓ access_all_locations permission - skipping location validation for ${user.username}`)
          }
        } else if (selectedLocationId) {
          console.log(`[LOGIN] ✓ RFID scanned - Location ID: ${selectedLocationId}`)
        }

        // ============================================================================
        // LOCATION MISMATCH VALIDATION: Verify user is assigned to scanned location
        // ============================================================================
        if (selectedLocationId && !isLocationExempt) {
          // Collect user's assigned location IDs
          const directLocationIds = user.userLocations.map(ul => ul.locationId)
          const roleLocationIds = user.roles.flatMap(ur =>
            (ur.role.locations || []).map(rl => rl.locationId)
          )
          const assignedLocationIds = directLocationIds.length > 0
            ? directLocationIds
            : [...new Set(roleLocationIds)]

          // Check if scanned location matches assigned locations
          const isMismatch = !assignedLocationIds.includes(selectedLocationId)

          if (isMismatch) {
            // Get location names for error message
            const selectedLocation = await prisma.businessLocation.findUnique({
              where: { id: selectedLocationId },
              select: { name: true }
            })
            const selectedLocationName = selectedLocation?.name || 'Unknown'

            const assignedLocations = await prisma.businessLocation.findMany({
              where: { id: { in: assignedLocationIds } },
              select: { name: true }
            })
            const assignedLocationNames = assignedLocations.map(l => l.name)

            console.log(`[LOGIN] ❌ BLOCKED - Location mismatch for ${user.username}`)
            console.log(`[LOGIN] Attempted location: ${selectedLocationName} (ID: ${selectedLocationId})`)
            console.log(`[LOGIN] Assigned locations: ${assignedLocationNames.join(', ')}`)

            // Log the failed login attempt with location mismatch
            try {
              await createAuditLog({
                businessId: user.businessId!,
                userId: user.id,
                username: user.username,
                action: AuditAction.USER_LOGIN,
                entityType: EntityType.USER,
                entityIds: [user.id],
                description: `BLOCKED: Location mismatch - Attempted login at ${selectedLocationName}`,
                metadata: {
                  selectedLocation: selectedLocationName,
                  selectedLocationId: selectedLocationId,
                  assignedLocations: assignedLocationNames,
                  assignedLocationIds: assignedLocationIds,
                  roles: roleNames,
                  loginBlocked: true,
                  blockReason: 'Location Mismatch',
                  loginTimestamp: new Date().toISOString(),
                },
                ipAddress: (credentials as any).ipAddress || 'Unknown',
                userAgent: (credentials as any).userAgent || 'Unknown',
              })
            } catch (auditError) {
              console.error('[LOGIN] Failed to create audit log for blocked login:', auditError)
            }

            // BLOCK THE LOGIN
            throw new Error(
              `Access Denied: Location Mismatch\n\n` +
              `You are not authorized to login at "${selectedLocationName}".\n\n` +
              `Your assigned locations are: ${assignedLocationNames.join(', ')}\n\n` +
              `This login attempt has been logged.\n\n` +
              `Please contact your manager if you believe this is an error.`
            )
          }

          if (!isMismatch) {
            console.log(`[LOGIN] ✓ Location verified - User has access to location ID: ${selectedLocationId}`)
          }
        }

        // Collect all permissions
        const rolePermissions = user.roles.flatMap(ur =>
          ur.role.permissions.map(rp => rp.permission.name)
        )
        const directPermissions = user.permissions.map(up => up.permission.name)
        let allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

        // Grant all permissions to Super Admin
        if (roleNames.includes('Super Admin') ||
            roleNames.includes('System Administrator')) {
          allPermissions = Object.values(PERMISSIONS)
        }

        // Collect location IDs
        const directLocationIds = user.userLocations.map(ul => ul.locationId)
        const roleLocationIds = user.roles.flatMap(ur =>
          (ur.role.locations || []).map(rl => rl.locationId)
        )

        const locationIds = directLocationIds.length > 0
          ? directLocationIds
          : [...new Set(roleLocationIds)]

        // Create audit log for successful login
        try {
          // Get location names for audit metadata
          let selectedLocationName = 'Not Selected'
          let assignedLocationNames: string[] = []

          if (selectedLocationId) {
            const selectedLoc = await prisma.businessLocation.findUnique({
              where: { id: selectedLocationId },
              select: { name: true }
            })
            selectedLocationName = selectedLoc?.name || 'Unknown'
          }

          if (locationIds.length > 0) {
            const assignedLocs = await prisma.businessLocation.findMany({
              where: { id: { in: locationIds } },
              select: { name: true }
            })
            assignedLocationNames = assignedLocs.map(l => l.name)
          }

          await createAuditLog({
            businessId: user.businessId!,
            userId: user.id,
            username: user.username,
            action: AuditAction.USER_LOGIN,
            entityType: EntityType.USER,
            entityIds: [user.id],
            description: `User logged in successfully${selectedLocationId ? ` at ${selectedLocationName}` : ''}`,
            metadata: {
              selectedLocation: selectedLocationName,
              selectedLocationId: selectedLocationId || null,
              assignedLocations: assignedLocationNames,
              assignedLocationIds: locationIds,
              roles: roleNames,
              loginTimestamp: new Date().toISOString(),
            },
            ipAddress: (credentials as any).ipAddress || 'Unknown',
            userAgent: (credentials as any).userAgent || 'Unknown',
          })
        } catch (auditError) {
          console.error('[LOGIN] Failed to create audit log:', auditError)
          // Don't block login if audit log fails
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
      try {
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
      } catch (error) {
        console.error('[JWT Callback Error]:', error)
        return token
      }
    },
    async session({ session, token }) {
      try {
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
      } catch (error) {
        console.error('[Session Callback Error]:', error)
        return session
      }
    },
  },
}
