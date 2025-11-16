import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { testEmailConfiguration } from "@/lib/email/reconciliation-notifier"
import { hasPermission } from "@/lib/rbac"
import { PERMISSIONS } from "@/lib/rbac"

/**
 * Test Email Configuration Endpoint
 *
 * Sends a test email to verify SMTP settings are configured correctly.
 * Only accessible to Super Admin users.
 *
 * @route GET /api/test/email-config
 * @returns {object} Test result with success status
 */
export async function GET(request: NextRequest) {
  try {
    // === AUTHENTICATION CHECK ===
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 }
      )
    }

    // === PERMISSION CHECK - Super Admin Only ===
    const canAccessSettings = hasPermission(
      session.user,
      PERMISSIONS.SETTING_MANAGE
    )

    if (!canAccessSettings) {
      return NextResponse.json(
        {
          error:
            "Forbidden. Only Super Admin can test email configuration.",
        },
        { status: 403 }
      )
    }

    // === VERIFY SMTP ENVIRONMENT VARIABLES ===
    const requiredVars = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASSWORD",
    ]
    const missing = requiredVars.filter((v) => !process.env[v])

    if (missing.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing SMTP configuration: ${missing.join(", ")}`,
          message:
            "Please add the following environment variables to your .env file",
          missingVars: missing,
          help: {
            SMTP_HOST: "SMTP server hostname (e.g., smtp.gmail.com)",
            SMTP_PORT: "SMTP port (587 for TLS, 465 for SSL)",
            SMTP_USER: "Email account username/address",
            SMTP_PASSWORD: "Email account password (use app password for Gmail)",
            ALERT_EMAIL_TO: "Recipient email address (optional, defaults to rr3800@gmail.com)",
          },
        },
        { status: 500 }
      )
    }

    console.log("[EMAIL TEST] Testing SMTP configuration...")
    console.log("[EMAIL TEST] SMTP Host:", process.env.SMTP_HOST)
    console.log("[EMAIL TEST] SMTP Port:", process.env.SMTP_PORT)
    console.log("[EMAIL TEST] SMTP User:", process.env.SMTP_USER)
    console.log("[EMAIL TEST] Recipient:", process.env.ALERT_EMAIL_TO || "rr3800@gmail.com")

    // === SEND TEST EMAIL ===
    const result = await testEmailConfiguration()

    if (result) {
      console.log("[EMAIL TEST] Test email sent successfully!")
      return NextResponse.json({
        success: true,
        message: "Test email sent successfully!",
        recipient: process.env.ALERT_EMAIL_TO || "rr3800@gmail.com",
        details: {
          smtpHost: process.env.SMTP_HOST,
          smtpPort: process.env.SMTP_PORT,
          smtpUser: process.env.SMTP_USER,
          smtpSecure: process.env.SMTP_SECURE === "true" ? "SSL (465)" : "TLS (587)",
        },
      })
    } else {
      console.error("[EMAIL TEST] Test email failed")
      return NextResponse.json(
        {
          success: false,
          error: "Failed to send test email",
          message: "Please check your SMTP credentials and try again",
        },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("[EMAIL TEST] Error:", error)

    // Provide helpful error messages based on common issues
    let helpMessage = error.message

    if (error.message.includes("ECONNREFUSED")) {
      helpMessage = "Cannot connect to SMTP server. Check SMTP_HOST and SMTP_PORT settings."
    } else if (error.message.includes("Invalid login")) {
      helpMessage = "Invalid SMTP credentials. Check SMTP_USER and SMTP_PASSWORD. For Gmail, use an App Password instead of your regular password."
    } else if (error.message.includes("ETIMEDOUT")) {
      helpMessage = "Connection timeout. Check your firewall or internet connection."
    } else if (error.message.includes("ENOTFOUND")) {
      helpMessage = "SMTP host not found. Verify SMTP_HOST is correct."
    }

    return NextResponse.json(
      {
        success: false,
        error: helpMessage,
        originalError: error.message,
        troubleshooting: {
          gmail: {
            step1: "Enable 2-factor authentication on your Google account",
            step2: "Generate an App Password at https://myaccount.google.com/apppasswords",
            step3: "Use the App Password as SMTP_PASSWORD (not your regular password)",
            smtpHost: "smtp.gmail.com",
            smtpPort: "587",
            smtpSecure: "false",
          },
          outlook: {
            smtpHost: "smtp-mail.outlook.com",
            smtpPort: "587",
            smtpSecure: "false",
          },
          office365: {
            smtpHost: "smtp.office365.com",
            smtpPort: "587",
            smtpSecure: "false",
          },
        },
      },
      { status: 500 }
    )
  }
}
