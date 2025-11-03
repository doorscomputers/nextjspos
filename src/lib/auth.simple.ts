import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from "./prisma.simple"
import bcrypt from "bcryptjs"
import { PERMISSIONS } from "./rbac"

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 60 * 60, // Update every 1 hour
  },
  pages: {
    signIn: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
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

        // Collect all permissions
        const rolePermissions = user.roles.flatMap(ur =>
          ur.role.permissions.map(rp => rp.permission.name)
        )
        const directPermissions = user.permissions.map(up => up.permission.name)
        let allPermissions = [...new Set([...rolePermissions, ...directPermissions])]

        const roleNames = user.roles.map(ur => ur.role.name)

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
