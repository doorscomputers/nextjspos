import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

interface PaymentDetail {
  id: number
  referenceNumber: string | null
  amount: number
  paidAt: Date
  saleInvoice: string | null
  customerName: string | null
}

interface DenominationData {
  denomination: number
  count: number
  amount: number
}

interface PaymentTypeData {
  paymentMethod: string
  total: number
  details: PaymentDetail[]
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.businessId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const businessId = parseInt(session.user.businessId)
    if (!Number.isInteger(businessId)) {
      return NextResponse.json({ error: "Invalid business context" }, { status: 400 })
    }
    const searchParams = request.nextUrl.searchParams
    const dateParam = searchParams.get("date")
    const locationId = searchParams.get("locationId")

    // Default to today if no date provided
    const targetDate = dateParam ? new Date(dateParam) : new Date()

    // Get start and end of day in local timezone
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)

    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)

    // Build location filter
    const locationFilter = locationId ? { locationId: parseInt(locationId) } : {}

    // Fetch all payments for the date
    const payments = await prisma.salePayment.findMany({
      where: {
        paidAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
        sale: {
          businessId,
          ...locationFilter,
          status: {
            not: "cancelled",
          },
        },
      },
      include: {
        sale: {
          select: {
            invoiceNumber: true,
            customer: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        paidAt: "asc",
      },
    })

    // Group payments by payment method
    const paymentsByMethod: Record<string, PaymentDetail[]> = {}
    const paymentTotals: Record<string, number> = {}

    payments.forEach((payment) => {
      const method = payment.paymentMethod.toLowerCase()

      if (!paymentsByMethod[method]) {
        paymentsByMethod[method] = []
        paymentTotals[method] = 0
      }

      paymentsByMethod[method].push({
        id: payment.id,
        referenceNumber: payment.referenceNumber,
        amount: Number(payment.amount),
        paidAt: payment.paidAt,
        saleInvoice: payment.sale.invoiceNumber,
        customerName: payment.sale.customer?.name || null,
      })

      paymentTotals[method] += Number(payment.amount)
    })

    // Fetch cash denominations from closed shifts for the date
    const cashDenominations = await prisma.cashDenomination.findMany({
      where: {
        businessId,
        ...locationFilter,
        countType: "closing",
        cashierShift: {
          status: "closed",
          closedAt: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      },
      include: {
        cashierShift: {
          select: {
            shiftNumber: true,
            closedAt: true,
          },
        },
      },
    })

    // Aggregate denominations across all shifts
    const denominationTotals: Record<number, number> = {
      1000: 0,
      500: 0,
      200: 0,
      100: 0,
      50: 0,
      20: 0,
      10: 0,
      5: 0,
      1: 0,
      0.25: 0,
    }

    cashDenominations.forEach((denom) => {
      denominationTotals[1000] += denom.count1000
      denominationTotals[500] += denom.count500
      denominationTotals[200] += denom.count200
      denominationTotals[100] += denom.count100
      denominationTotals[50] += denom.count50
      denominationTotals[20] += denom.count20
      denominationTotals[10] += denom.count10
      denominationTotals[5] += denom.count5
      denominationTotals[1] += denom.count1
      denominationTotals[0.25] += denom.count025
    })

    // Format denominations for response
    const denominations: DenominationData[] = [
      { denomination: 1000, count: denominationTotals[1000], amount: denominationTotals[1000] * 1000 },
      { denomination: 500, count: denominationTotals[500], amount: denominationTotals[500] * 500 },
      { denomination: 200, count: denominationTotals[200], amount: denominationTotals[200] * 200 },
      { denomination: 100, count: denominationTotals[100], amount: denominationTotals[100] * 100 },
      { denomination: 50, count: denominationTotals[50], amount: denominationTotals[50] * 50 },
      { denomination: 20, count: denominationTotals[20], amount: denominationTotals[20] * 20 },
      { denomination: 10, count: denominationTotals[10], amount: denominationTotals[10] * 10 },
      { denomination: 5, count: denominationTotals[5], amount: denominationTotals[5] * 5 },
      { denomination: 1, count: denominationTotals[1], amount: denominationTotals[1] * 1 },
      { denomination: 0.25, count: denominationTotals[0.25], amount: denominationTotals[0.25] * 0.25 },
    ]

    const totalDenominationCount = denominations.reduce((sum, d) => sum + d.count, 0)
    const totalDenominationAmount = denominations.reduce((sum, d) => sum + d.amount, 0)

    // Format payment types for response
    const paymentTypes: PaymentTypeData[] = [
      { paymentMethod: "cash", total: paymentTotals["cash"] || 0, details: paymentsByMethod["cash"] || [] },
      { paymentMethod: "check", total: paymentTotals["check"] || 0, details: paymentsByMethod["check"] || [] },
      { paymentMethod: "gcash", total: paymentTotals["gcash"] || 0, details: paymentsByMethod["gcash"] || [] },
      { paymentMethod: "paymaya", total: paymentTotals["paymaya"] || 0, details: paymentsByMethod["paymaya"] || [] },
      { paymentMethod: "card", total: paymentTotals["card"] || 0, details: paymentsByMethod["card"] || [] },
      { paymentMethod: "nfc", total: paymentTotals["nfc"] || 0, details: paymentsByMethod["nfc"] || [] },
      { paymentMethod: "bank_transfer", total: paymentTotals["bank_transfer"] || 0, details: paymentsByMethod["bank_transfer"] || [] },
      { paymentMethod: "other", total: paymentTotals["other"] || 0, details: paymentsByMethod["other"] || [] },
    ]

    // Calculate grand total of all collections
    const grandTotal = paymentTypes.reduce((sum, pt) => sum + pt.total, 0)

    // Get location info if filtered
    let locationInfo = null
    if (locationId) {
      locationInfo = await prisma.businessLocation.findUnique({
        where: { id: parseInt(locationId) },
        select: { name: true, city: true },
      })
    }

    // Get business info
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        businessAddress: true,
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        date: targetDate.toISOString().split("T")[0],
        businessName: business?.name || "",
        businessAddress: business?.businessAddress || "",
        locationName: locationInfo?.name || "All Locations",
        denominations,
        totalDenominationCount,
        totalDenominationAmount,
        paymentTypes,
        grandTotal,
        generatedAt: new Date().toISOString(),
        generatedBy: session.user.name || session.user.username,
      },
    })
  } catch (error: any) {
    console.error("Error fetching daily cash collection:", error?.message || error)
    console.error("Stack:", error?.stack)
    return NextResponse.json(
      { error: "Failed to fetch daily cash collection report", details: error?.message },
      { status: 500 }
    )
  }
}
