import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * GET /api/locations/verify-code?code=XXXXX
 * PUBLIC endpoint - Verifies RFID location code before login
 * No authentication required since this is used during login
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const code = searchParams.get("code")

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "Location code is required" },
        { status: 400 }
      )
    }

    // Validate code format (10-15 alphanumeric characters)
    if (!/^[A-Z0-9]{10,15}$/i.test(code)) {
      console.log(`[RFID] Invalid code format: ${code}`)
      return NextResponse.json(
        { valid: false, error: "Invalid code format" },
        { status: 400 }
      )
    }

    // Find location with matching RFID code
    const location = await prisma.businessLocation.findFirst({
      where: {
        locationCode: code.toUpperCase(), // Store codes in uppercase for consistency
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        businessId: true,
      },
    })

    if (location) {
      console.log(`[RFID] ✓ Valid code scanned: ${code} → ${location.name}`)
      return NextResponse.json({
        valid: true,
        locationId: location.id,
        locationName: location.name,
        businessId: location.businessId,
      })
    } else {
      console.log(`[RFID] ✗ Invalid code: ${code} (not found or inactive)`)
      return NextResponse.json(
        {
          valid: false,
          error: "Invalid location code. Please check the RFID card and try again.",
        },
        { status: 404 }
      )
    }
  } catch (error: any) {
    console.error("[RFID] Error verifying location code:", error)
    return NextResponse.json(
      {
        valid: false,
        error: "Failed to verify location code",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
