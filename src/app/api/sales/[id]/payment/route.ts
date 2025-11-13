import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth.simple'
import prisma from '@/lib/prisma.simple'
import { PERMISSIONS } from "@/lib/rbac"
import { isAccountingEnabled, recordCustomerPayment } from "@/lib/accountingIntegration"
import { incrementShiftTotalsForARPayment } from "@/lib/shift-running-totals"

/**
 * POST /api/sales/[id]/payment
 * Record a customer payment for a specific sale/invoice
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('[AR Payment API] ========== START ==========')

    // 1. Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      console.log('[AR Payment API] ERROR: No session')
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = session.user
    const saleId = parseInt(params.id)
    console.log('[AR Payment API] User:', user.username, 'BusinessId:', user.businessId, 'SaleId:', saleId)

    if (isNaN(saleId)) {
      console.log('[AR Payment API] ERROR: Invalid sale ID')
      return NextResponse.json(
        { success: false, error: "Invalid sale ID" },
        { status: 400 }
      )
    }

    // 2. Permission check - user must have permission to collect AR payments
    console.log('[AR Payment API] Checking permissions:', user.permissions)
    if (!user.permissions?.includes(PERMISSIONS.PAYMENT_COLLECT_AR)) {
      console.log('[AR Payment API] ERROR: Missing PAYMENT_COLLECT_AR permission')
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to collect customer payments. Contact your administrator." },
        { status: 403 }
      )
    }
    console.log('[AR Payment API] ✅ Permission check passed')

    // 3. Parse request body
    const body = await request.json()
    const { amount, paymentMethod, referenceNumber, paymentDate, shiftId } = body
    console.log('[AR Payment API] Request body:', { amount, paymentMethod, referenceNumber, paymentDate, shiftId })

    // 4. Validation
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Payment amount must be greater than zero" },
        { status: 400 }
      )
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { success: false, error: "Payment method is required" },
        { status: 400 }
      )
    }

    // Valid payment methods (excluding 'credit' which is only for initial charge invoice marker)
    const validPaymentMethods = ["cash", "card", "bank_transfer", "cheque", "gcash", "paymaya"]
    if (!validPaymentMethods.includes(paymentMethod)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid payment method. Must be one of: ${validPaymentMethods.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // 5. Verify sale exists and belongs to user's business (multi-tenant check)
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId: parseInt(String(user.businessId)),
      },
      include: {
        payments: true,
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found or access denied" },
        { status: 404 }
      )
    }

    // 6. Calculate current balance
    const totalAmount = parseFloat(sale.totalAmount.toString())
    const totalPaid = sale.payments
      .filter((p) => p.paymentMethod !== "credit") // Exclude credit marker
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

    const currentBalance = totalAmount - totalPaid

    // 7. Validate payment amount doesn't exceed balance
    if (amount > currentBalance + 0.01) {
      // Allow 1 cent tolerance for rounding
      return NextResponse.json(
        {
          success: false,
          error: `Payment amount (₱${amount.toFixed(2)}) exceeds outstanding balance (₱${currentBalance.toFixed(2)})`,
          balance: currentBalance,
        },
        { status: 400 }
      )
    }

    // 8 & 9: Create payment record + accounting journal entry in ONE transaction
    // ✅ ATOMIC: If accounting fails, payment is NOT created (all-or-nothing)
    const paidAt = paymentDate ? new Date(paymentDate) : new Date()
    const businessIdInt = parseInt(String(user.businessId))
    const accountingEnabled = await isAccountingEnabled(businessIdInt)
    console.log('[AR Payment API] Accounting enabled:', accountingEnabled)
    console.log('[AR Payment API] Starting transaction...')

    const payment = await prisma.$transaction(async (tx) => {
      console.log('[AR Payment API] Inside transaction - Step 1: Creating payment record...')
      // Step 1: Create payment record
      const newPayment = await tx.salePayment.create({
        data: {
          saleId: sale.id,
          paymentMethod,
          amount,
          referenceNumber: referenceNumber || null,
          paidAt,
          // Link to shift if payment collected at POS (AR Payment Collection)
          shiftId: shiftId ? parseInt(shiftId) : null,
          collectedBy: shiftId ? parseInt(String(user.id)) : null,
        },
      })
      console.log('[AR Payment API] ✅ Payment record created, ID:', newPayment.id)

      // Step 1.5: Update sale's paidAmount field (CRITICAL!)
      console.log('[AR Payment API] Step 1.5: Updating sale paidAmount...')
      const newTotalPaid = parseFloat(sale.paidAmount.toString()) + amount
      const totalAmount = parseFloat(sale.totalAmount.toString())
      const isFullyPaid = newTotalPaid >= totalAmount - 0.01 // Allow 1 cent tolerance

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          paidAmount: { increment: amount },
          status: isFullyPaid ? 'completed' : 'pending', // Mark as completed when fully paid
        },
      })
      console.log('[AR Payment API] ✅ Sale paidAmount updated. New total paid:', newTotalPaid, 'Fully paid:', isFullyPaid)

      // Step 2: Update shift running totals if payment collected at POS
      if (shiftId) {
        console.log('[AR Payment API] Step 2: Updating shift running totals for shift:', shiftId)
        await incrementShiftTotalsForARPayment(
          parseInt(shiftId),
          paymentMethod,
          amount,
          tx
        )
        console.log('[AR Payment API] ✅ Shift totals updated')
      } else {
        console.log('[AR Payment API] Step 2: Skipped (no shiftId)')
      }

      // Step 3: Create accounting journal entry if enabled
      if (accountingEnabled) {
        // Get accounts (Cash and Accounts Receivable)
        const cashAccount = await tx.chartOfAccounts.findFirst({
          where: { businessId: businessIdInt, accountCode: '1000', isActive: true },
        })
        const arAccount = await tx.chartOfAccounts.findFirst({
          where: { businessId: businessIdInt, accountCode: '1100', isActive: true },
        })

        if (cashAccount && arAccount) {
          // Create journal entry for payment received
          const userIdInt = parseInt(String(user.id))
          const journalEntry = await tx.journalEntry.create({
            data: {
              businessId: businessIdInt,
              entryDate: paidAt,
              description: `Payment Received${referenceNumber ? ` - ${referenceNumber}` : ''}`,
              referenceNumber: referenceNumber || null,
              sourceType: 'payment_received',
              sourceId: newPayment.id,
              status: 'posted',
              balanced: true,
              createdBy: userIdInt,
              postedBy: userIdInt,
              postedAt: new Date(),
            },
          })

          // Debit: Cash (increase asset)
          await tx.journalEntryLine.create({
            data: {
              journalEntryId: journalEntry.id,
              accountId: cashAccount.id,
              debit: amount,
              credit: 0,
              description: `Payment received from customer`,
            },
          })

          // Credit: Accounts Receivable (decrease asset)
          await tx.journalEntryLine.create({
            data: {
              journalEntryId: journalEntry.id,
              accountId: arAccount.id,
              debit: 0,
              credit: amount,
              description: `Payment received from customer`,
            },
          })

          // Update account balances
          await tx.chartOfAccounts.update({
            where: { id: cashAccount.id },
            data: { currentBalance: { increment: amount } },
          })
          await tx.chartOfAccounts.update({
            where: { id: arAccount.id },
            data: { currentBalance: { decrement: amount } },
          })
        }
      }

      return newPayment
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    // 10. Calculate new balance after payment
    const newBalance = currentBalance - amount
    const isFullyPaid = newBalance <= 0.01

    // 10. Return success response with updated invoice status
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: parseFloat(payment.amount.toString()),
        paymentMethod: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        paidAt: payment.paidAt,
      },
      invoice: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        totalAmount,
        previousBalance: currentBalance,
        paymentAmount: amount,
        newBalance,
        isFullyPaid,
        customer: sale.customer,
        location: sale.location,
      },
    })
  } catch (error: any) {
    console.error("[AR Payment API] ========== ERROR ==========")
    console.error("[AR Payment API] Error type:", error.constructor.name)
    console.error("[AR Payment API] Error message:", error.message)
    console.error("[AR Payment API] Error stack:", error.stack)
    console.error("[AR Payment API] Full error:", JSON.stringify(error, null, 2))
    return NextResponse.json(
      {
        success: false,
        error: "Failed to record payment",
        details: error.message,
        errorType: error.constructor.name,
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/sales/[id]/payment
 * Get payment history for a specific sale
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Authentication check
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      )
    }

    const user = session.user
    const saleId = parseInt(params.id)

    if (isNaN(saleId)) {
      return NextResponse.json(
        { success: false, error: "Invalid sale ID" },
        { status: 400 }
      )
    }

    // 2. Get sale with payment history (multi-tenant check)
    const sale = await prisma.sale.findFirst({
      where: {
        id: saleId,
        businessId: parseInt(String(user.businessId)),
      },
      include: {
        payments: {
          orderBy: {
            paidAt: "desc",
          },
        },
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Sale not found or access denied" },
        { status: 404 }
      )
    }

    // 3. Calculate balance
    const totalAmount = parseFloat(sale.totalAmount.toString())
    const totalPaid = sale.payments
      .filter((p) => p.paymentMethod !== "credit")
      .reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)
    const balance = totalAmount - totalPaid

    // 4. Return payment history
    return NextResponse.json({
      success: true,
      invoice: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        totalAmount,
        totalPaid,
        balance,
        isFullyPaid: balance <= 0.01,
        customer: sale.customer,
      },
      payments: sale.payments
        .filter((p) => p.paymentMethod !== "credit") // Don't show credit marker in history
        .map((p) => ({
          id: p.id,
          amount: parseFloat(p.amount.toString()),
          paymentMethod: p.paymentMethod,
          referenceNumber: p.referenceNumber,
          paidAt: p.paidAt,
        })),
    })
  } catch (error: any) {
    console.error("Error fetching payment history:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch payment history",
        details: error.message,
      },
      { status: 500 }
    )
  }
}
