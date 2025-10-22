import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { PERMISSIONS } from "@/lib/rbac"

// PUT /api/announcements/[id] - Update announcement
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.ANNOUNCEMENT_UPDATE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const announcementId = parseInt(params.id)
    const body = await request.json()

    // Verify announcement belongs to user's business
    const existing = await prisma.announcement.findFirst({
      where: {
        id: announcementId,
        businessId: parseInt(user.businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      )
    }

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

    // Update announcement
    const announcement = await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        ...(title !== undefined && { title }),
        ...(message !== undefined && { message }),
        ...(type !== undefined && { type }),
        ...(priority !== undefined && { priority }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(targetRoles !== undefined && { targetRoles: targetRoles ? targetRoles.join(",") : null }),
        ...(targetLocations !== undefined && { targetLocations: targetLocations ? targetLocations.join(",") : null }),
        ...(isActive !== undefined && { isActive }),
        ...(displayOrder !== undefined && { displayOrder }),
        ...(icon !== undefined && { icon }),
        updatedAt: new Date(),
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
      message: "Announcement updated successfully",
    })
  } catch (error: any) {
    console.error("[ANNOUNCEMENT_PUT]", error)
    return NextResponse.json(
      { error: "Failed to update announcement", details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/announcements/[id] - Soft delete announcement
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = session.user as any

    // Check permissions
    if (!user.permissions?.includes(PERMISSIONS.ANNOUNCEMENT_DELETE)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const announcementId = parseInt(params.id)

    // Verify announcement belongs to user's business
    const existing = await prisma.announcement.findFirst({
      where: {
        id: announcementId,
        businessId: parseInt(user.businessId),
        deletedAt: null,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.announcement.update({
      where: { id: announcementId },
      data: {
        deletedAt: new Date(),
      },
    })

    return NextResponse.json({
      message: "Announcement deleted successfully",
    })
  } catch (error: any) {
    console.error("[ANNOUNCEMENT_DELETE]", error)
    return NextResponse.json(
      { error: "Failed to delete announcement", details: error.message },
      { status: 500 }
    )
  }
}
