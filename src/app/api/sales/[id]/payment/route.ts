import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth.simple'
import prisma from "@/lib/prisma"
import { PERMISSIONS } from "@/lib/rbac"
import { isAccountingEnabled, recordCustomerPayment } from "@/lib/accountingIntegration"

/**
 * POST /api/sales/[id]/payment
 * Record a customer payment for a specific sale/invoice
 */
export async function POST(
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

    // 2. Permission check - user must have permission to record customer payments
    if (!user.permissions?.includes(PERMISSIONS.REPORT_CUSTOMER_PAYMENTS)) {
      return NextResponse.json(
        { success: false, error: "Insufficient permissions to record customer payments" },
        { status: 403 }
      )
    }

    // 3. Parse request body
    const body = await request.json()
    const { amount, paymentMethod, referenceNumber, paymentDate, shiftId } = body

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
        businessId: user.businessId,
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

    // 8. Create payment record
    const paidAt = paymentDate ? new Date(paymentDate) : new Date()

    const payment = await prisma.salePayment.create({
      data: {
        saleId: sale.id,
        paymentMethod,
        amount,
        referenceNumber: referenceNumber || null,
        paidAt,
        // Link to shift if payment collected at POS (AR Payment Collection)
        shiftId: shiftId ? parseInt(shiftId) : null,
        collectedBy: shiftId ? user.id : null, // Only set collectedBy if collected during a shift
      },
    })

    // 9. Calculate new balance after payment
    const newBalance = currentBalance - amount
    const isFullyPaid = newBalance <= 0.01

    // ACCOUNTING INTEGRATION: Create journal entries if accounting is enabled
    if (await isAccountingEnabled(user.businessId)) {
      try {
        await recordCustomerPayment({
          businessId: user.businessId,
          userId: user.id,
          paymentId: payment.id,
          paymentDate: paidAt,
          amount,
          referenceNumber: referenceNumber || undefined,
          customerId: sale.customerId || undefined
        })
      } catch (accountingError) {
        // Log accounting errors but don't fail the payment
        console.error('Accounting integration error:', accountingError)
      }
    }

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
    console.error("Error recording customer payment:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to record payment",
        details: error.message,
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
        businessId: user.businessId,
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
