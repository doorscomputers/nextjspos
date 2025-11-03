import { NextResponse } from "next/server"
import { prisma } from '@/lib/prisma.simple'

/**
 * GET /api/locations/public
 * PUBLIC endpoint - Returns all active business locations for the login page location selector
 * No authentication required since this is used on the login page
 */
export async function GET() {
  try {
    // Fetch all active business locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        businessId: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    console.log("[API] Public locations fetched:", locations.length)

    return NextResponse.json({
      success: true,
      locations,
    })
  } catch (error: any) {
    console.error("[API] Error fetching public locations:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch locations",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
