import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  findDiscrepanciesByLocation,
  getReconciliationSummary,
} from "@/lib/reconciliation"
import { sendReconciliationAlert } from "@/lib/email/reconciliation-notifier"
import { createAuditLog } from "@/lib/auditLog"

/**
 * Automated Stock Reconciliation Cron Job
 *
 * This endpoint performs daily integrity checks and sends email alerts
 * when inventory discrepancies are detected.
 *
 * Schedule: Daily at 2:00 AM (configured in vercel.json)
 * Security: Protected by CRON_SECRET token
 * Behavior: Detect variances → Send email → NO auto-fixing
 *
 * @route GET /api/cron/reconciliation
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  try {
    // === SECURITY: Verify Cron Secret Token ===
    const authHeader = request.headers.get("authorization")
    const expectedToken = `Bearer ${process.env.CRON_SECRET}`

    if (!process.env.CRON_SECRET) {
      console.error("[CRON] CRON_SECRET not configured in environment variables")
      return NextResponse.json(
        { error: "Cron job not configured" },
        { status: 500 }
      )
    }

    if (authHeader !== expectedToken) {
      console.warn("[CRON] Unauthorized cron attempt:", {
        ip: request.headers.get("x-forwarded-for"),
        userAgent: request.headers.get("user-agent"),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[CRON] Starting automated stock reconciliation...")

    // === GET ALL ACTIVE BUSINESSES ===
    const businesses = await prisma.business.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        name: true,
        locations: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
      },
    })

    console.log(`[CRON] Found ${businesses.length} active business(es)`)

    const results: {
      businessId: number
      businessName: string
      summary: any
      alertSent: boolean
      error?: string
    }[] = []

    // === PROCESS EACH BUSINESS ===
    for (const business of businesses) {
      try {
        console.log(`[CRON] Processing business: ${business.name} (ID: ${business.id})`)

        // Get all discrepancies for all locations in this business
        const allDiscrepancies = []

        for (const location of business.locations) {
          const discrepancies = await findDiscrepanciesByLocation(
            business.id,
            location.id
          )
          allDiscrepancies.push(...discrepancies)
        }

        // Calculate summary
        const summary = getReconciliationSummary(allDiscrepancies)

        console.log(`[CRON] Business ${business.name} summary:`, {
          totalVariances: summary.totalVariances,
          requiresInvestigation: summary.requiresInvestigation,
          totalValue: summary.totalVarianceValue,
        })

        // === SEND EMAIL ALERT IF VARIANCES FOUND ===
        let alertSent = false

        if (summary.totalVariances > 0) {
          console.log(
            `[CRON] Variances detected for ${business.name}. Sending email alert...`
          )

          try {
            await sendReconciliationAlert({
              businessId: business.id,
              businessName: business.name,
              summary,
              discrepancies: allDiscrepancies,
              locations: business.locations,
            })

            alertSent = true
            console.log(`[CRON] Email alert sent successfully for ${business.name}`)

            // Create audit log
            await createAuditLog({
              businessId: business.id,
              userId: null, // System-generated
              action: "RECONCILIATION_ALERT_SENT",
              resourceType: "system",
              resourceId: null,
              details: {
                totalVariances: summary.totalVariances,
                requiresInvestigation: summary.requiresInvestigation,
                totalValue: summary.totalVarianceValue,
                locationCount: business.locations.length,
              },
              ipAddress: "CRON_JOB",
              userAgent: "Automated Reconciliation System",
            })
          } catch (emailError: any) {
            console.error(`[CRON] Failed to send email for ${business.name}:`, emailError)
            // Continue processing other businesses even if email fails
          }
        } else {
          console.log(`[CRON] No variances detected for ${business.name}. Skipping email.`)
        }

        results.push({
          businessId: business.id,
          businessName: business.name,
          summary,
          alertSent,
        })
      } catch (businessError: any) {
        console.error(`[CRON] Error processing business ${business.name}:`, businessError)
        results.push({
          businessId: business.id,
          businessName: business.name,
          summary: null,
          alertSent: false,
          error: businessError.message,
        })
      }
    }

    // === FINAL SUMMARY ===
    const totalExecutionTime = Date.now() - startTime
    const totalVariances = results.reduce(
      (sum, r) => sum + (r.summary?.totalVariances || 0),
      0
    )
    const totalAlertsNot = results.filter((r) => r.alertSent).length

    console.log(`[CRON] Reconciliation completed in ${totalExecutionTime}ms`, {
      businessesProcessed: businesses.length,
      totalVariances,
      alertsSent: totalAlertsNot,
    })

    return NextResponse.json({
      success: true,
      executionTime: `${totalExecutionTime}ms`,
      businessesProcessed: businesses.length,
      totalVariances,
      alertsSent: totalAlertsNot,
      results,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error("[CRON] Fatal error in reconciliation cron job:", error)

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
