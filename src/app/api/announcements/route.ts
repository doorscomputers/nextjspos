import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from "@/lib/rbac"

// GET /api/announcements - List all announcements for business
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as any
    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get("active") === "true"
    const forTicker = searchParams.get("forTicker") === "true"

    // Build query conditions
    const where: any = {
      businessId: parseInt(user.businessId),
      deletedAt: null,
    }

    if (activeOnly || forTicker) {
      where.isActive = true

      // For ticker, also filter by date range
      if (forTicker) {
        const now = new Date()
        where.OR = [
          { startDate: null, endDate: null }, // No date restrictions
          { startDate: null, endDate: { gte: now } }, // No start, but not expired
          { startDate: { lte: now }, endDate: null }, // Started, no end
          { startDate: { lte: now }, endDate: { gte: now } }, // Within range
        ]

        // SIMPLIFIED: Just show announcements with no targeting restrictions
        // If announcement has targetRoles or targetLocations set, it needs more complex matching
        // For now, we'll show ALL active announcements within date range (no role/location filtering)
        // TODO: Implement proper role/location targeting if needed
      }
    }

    const announcements = await prisma.announcement.findMany({
      where,
      orderBy: [
        { displayOrder: 'asc' },
        { createdAt: 'desc' },
      ],
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
          },
        },
      },
    })

    return NextResponse.json({
      announcements,
      count: announcements.length,
    })
  } catch (error: any) {
    console.error("[ANNOUNCEMENTS_GET]", error)
    return NextResponse.json(
      { error: "Failed to fetch announcements", details: error.message },
      { status: 500 }
    )
  }
}

// POST /api/announcements - Create new announcement
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.ANNOUNCEMENT_CREATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      message,
      type,
      priority,
      startDate,
      endDate,
      targetRoles,
      targetLocations,
      isActive,
      displayOrder,
      icon,
    } = body

    // Validation
    if (!title || !message) {
      return NextResponse.json(
        { error: "Title and message are required" },
        { status: 400 }
      )
    }

    // Create announcement
    const announcement = await prisma.announcement.create({
      data: {
        businessId: parseInt(user.businessId),
        title,
        message,
        type: type || "system",
        priority: priority || "info",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        targetRoles: targetRoles ? targetRoles.join(",") : null,
        targetLocations: targetLocations ? targetLocations.join(",") : null,
        isActive: isActive !== undefined ? isActive : true,
        displayOrder: displayOrder || 0,
        icon: icon || null,
        createdById: parseInt(user.id),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            surname: true,
          },
        },
      },
    })

    return NextResponse.json({
      announcement,
      message: "Announcement created successfully",
    }, { status: 201 })
  } catch (error: any) {
    console.error("[ANNOUNCEMENTS_POST]", error)
    return NextResponse.json(
      { error: "Failed to create announcement", details: error.message },
      { status: 500 }
    )
  }
}
