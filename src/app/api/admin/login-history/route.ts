import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from "@/lib/rbac"
import { AuditAction } from "@/lib/auditLog"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as any

    // Check if user has permission to view login history
    if (!user.permissions?.includes(PERMISSIONS.AUDIT_LOG_VIEW)) {
      return NextResponse.json(
        { error: "Forbidden: You don't have permission to view login history" },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId")
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const days = searchParams.get("days") || "30" // Default to 30 days

    // Build where clause
    const where: any = {
      businessId: parseInt(String(user.businessId)),
      action: AuditAction.USER_LOGIN, // Use enum value: 'user_login'
    }

    // Date filtering
    const dateThreshold = new Date()
    dateThreshold.setDate(dateThreshold.getDate() - parseInt(days))

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      }
    } else {
      where.createdAt = {
        gte: dateThreshold,
      }
    }

    // User filtering
    if (userId && userId !== "all") {
      where.userId = parseInt(userId)
    }

    // Fetch login audit logs (excluding Super Admin logins)
    const loginLogs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 500, // Limit to 500 records for performance
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            roles: {
              include: {
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    // Process logs to extract location info and detect mismatches
    const processedLogs = await Promise.all(
      loginLogs.map(async (log) => {
        const roles = log.user?.roles.map((ur) => ur.role.name).join(", ") || "N/A"

        const metadata = log.metadata as any
        const selectedLocation = metadata?.selectedLocation || "Unknown"
        const assignedLocations = metadata?.assignedLocations || []

        // Determine if there's a location mismatch
        // This is a simplified check - you may need to enhance based on your exact logic
        let isMismatch = false
        let selectedLocationId: number | null = null

        // Try to find the selected location ID
        if (locationId && locationId !== "all") {
          const locationFilter = parseInt(locationId)
          // You might need to fetch location by name if only name is stored
          const location = await prisma.businessLocation.findFirst({
            where: {
              businessId: parseInt(String(user.businessId)),
              name: selectedLocation,
            },
          })
          selectedLocationId = location?.id || null

          // Apply location filter
          if (selectedLocationId !== locationFilter) {
            return null // Filter out this log
          }
        }

        // Check for mismatch (if assigned locations exist and selected is not in the list)
        if (assignedLocations.length > 0 && !assignedLocations.includes(selectedLocation)) {
          isMismatch = true
        }

        return {
          id: log.id,
          userId: log.userId,
          username: log.username,
          fullName: `${log.user?.firstName || ""} ${log.user?.lastName || ""}`.trim() || log.username,
          roles,
          selectedLocation,
          assignedLocations,
          isMismatch,
          timestamp: log.createdAt,
          ipAddress: log.ipAddress || "Unknown",
          description: log.description,
        }
      })
    )

    // Filter out null entries (location filters, etc.)
    const filteredLogs = processedLogs.filter((log) => log !== null)

    // Get all users for filter dropdown
    const uniqueUsers = await prisma.user.findMany({
      where: {
        businessId: parseInt(String(user.businessId)),
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
      },
      orderBy: {
        username: "asc",
      },
    })

    // Get locations for filter dropdown
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: parseInt(String(user.businessId)),
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json({
      logs: filteredLogs,
      users: uniqueUsers,
      locations,
      total: filteredLogs.length,
    })
  } catch (error: any) {
    console.error("[LoginHistory] Error fetching login history:", error)
    return NextResponse.json(
      { error: "Failed to fetch login history", details: error.message },
      { status: 500 }
    )
  }
}
