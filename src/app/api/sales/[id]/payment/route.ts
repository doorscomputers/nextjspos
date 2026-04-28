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
    const { amount, paymentMethod, referenceNumber, paymentDate, shiftId, deductions, cheques } = body
    console.log('[AR Payment API] Request body:', { amount, paymentMethod, referenceNumber, paymentDate, shiftId, deductions, chequesCount: Array.isArray(cheques) ? cheques.length : 0 })

    // 4. Validation — ensure amount is a proper number (prevent string concatenation bugs)
    const parsedAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount)
    if (!parsedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { success: false, error: "Payment amount must be a valid number greater than zero" },
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

    // 4b. Validate deductions (optional array)
    const validDeductionTypes = ["ewt", "vat_withholding", "other_gov_deduction"]
    let totalDeductions = 0
    const parsedDeductions: { type: string; amount: number; notes?: string; referenceNumber?: string }[] = []
    if (deductions && Array.isArray(deductions) && deductions.length > 0) {
      for (const ded of deductions) {
        const dedAmount = typeof ded.amount === 'string' ? parseFloat(ded.amount) : Number(ded.amount)
        if (!dedAmount || isNaN(dedAmount) || dedAmount <= 0) {
          return NextResponse.json(
            { success: false, error: "Each deduction must have a valid amount greater than zero" },
            { status: 400 }
          )
        }
        if (!ded.type || !validDeductionTypes.includes(ded.type)) {
          return NextResponse.json(
            { success: false, error: `Invalid deduction type. Must be one of: ${validDeductionTypes.join(", ")}` },
            { status: 400 }
          )
        }
        totalDeductions += dedAmount
        parsedDeductions.push({ type: ded.type, amount: dedAmount, notes: ded.notes, referenceNumber: ded.referenceNumber })
      }
    }

    // 4c. Validate cheques (optional array — only allowed when paymentMethod === 'cheque')
    // When provided, one SalePayment row is created per cheque so each can be tracked independently
    // (clearing/bouncing/bank deposit). Sum of cheque amounts MUST equal `amount`.
    type ParsedCheque = { number: string; bank: string | null; date: Date; amount: number }
    const parsedCheques: ParsedCheque[] = []
    if (cheques !== undefined && cheques !== null) {
      if (!Array.isArray(cheques)) {
        return NextResponse.json(
          { success: false, error: "`cheques` must be an array when provided" },
          { status: 400 }
        )
      }
      if (cheques.length > 0) {
        if (paymentMethod !== 'cheque') {
          return NextResponse.json(
            { success: false, error: "`cheques` array is only valid when paymentMethod is 'cheque'" },
            { status: 400 }
          )
        }
        let sumOfCheques = 0
        for (const cq of cheques) {
          const cqAmount = typeof cq?.amount === 'string' ? parseFloat(cq.amount) : Number(cq?.amount)
          if (!cqAmount || isNaN(cqAmount) || cqAmount <= 0) {
            return NextResponse.json(
              { success: false, error: "Each cheque must have a valid amount greater than zero" },
              { status: 400 }
            )
          }
          const cqNumber = typeof cq?.number === 'string' ? cq.number.trim() : ''
          if (!cqNumber) {
            return NextResponse.json(
              { success: false, error: "Each cheque must have a non-empty cheque number" },
              { status: 400 }
            )
          }
          const cqDate = cq?.date ? new Date(cq.date) : null
          parsedCheques.push({
            number: cqNumber,
            bank: typeof cq?.bank === 'string' && cq.bank.trim() ? cq.bank.trim() : null,
            date: cqDate && !isNaN(cqDate.getTime()) ? cqDate : new Date(),
            amount: cqAmount,
          })
          sumOfCheques += cqAmount
        }
        // 1 centavo tolerance for rounding
        if (Math.abs(sumOfCheques - parsedAmount) > 0.01) {
          return NextResponse.json(
            {
              success: false,
              error: `Sum of cheque amounts (₱${sumOfCheques.toFixed(2)}) must equal payment total (₱${parsedAmount.toFixed(2)})`,
            },
            { status: 400 }
          )
        }
      }
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

    // 6. Calculate current balance using sale.paidAmount field (source of truth)
    const totalAmount = parseFloat(sale.totalAmount.toString())
    const totalPaid = parseFloat(sale.paidAmount.toString())
    const currentBalance = totalAmount - totalPaid

    console.log('[AR Payment API] Balance calculation:', {
      totalAmount,
      paidAmount: totalPaid,
      currentBalance,
      paymentsCount: sale.payments.length
    })

    // 7. Validate payment amount + deductions doesn't exceed balance
    const totalApplied = parsedAmount + totalDeductions
    if (totalApplied > currentBalance + 0.01) {
      // Allow 1 cent tolerance for rounding
      const errorParts = [`Payment (₱${parsedAmount.toFixed(2)})`]
      if (totalDeductions > 0) errorParts.push(`Deductions (₱${totalDeductions.toFixed(2)})`)
      return NextResponse.json(
        {
          success: false,
          error: `${errorParts.join(' + ')} = ₱${totalApplied.toFixed(2)} exceeds outstanding balance (₱${currentBalance.toFixed(2)})`,
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
      console.log('[AR Payment API] Inside transaction - Step 1: Creating payment record(s)...')
      // Step 1: Create payment record(s) — one per cheque when cheques[] provided, else single row
      const createdPayments: Awaited<ReturnType<typeof tx.salePayment.create>>[] = []
      if (parsedCheques.length > 0) {
        // Multi-cheque mode: one SalePayment per cheque so each is independently trackable
        for (const cq of parsedCheques) {
          const row = await tx.salePayment.create({
            data: {
              saleId: sale.id,
              paymentMethod: 'cheque',
              amount: cq.amount,
              referenceNumber: cq.bank ? `${cq.number} (${cq.bank})` : cq.number,
              paidAt: cq.date,
              shiftId: shiftId ? parseInt(shiftId) : null,
              collectedBy: shiftId ? parseInt(String(user.id)) : null,
            },
          })
          createdPayments.push(row)
          console.log('[AR Payment API] ✅ Cheque payment created, ID:', row.id, 'Number:', cq.number, 'Amount:', cq.amount)
        }
      } else {
        // Legacy single-payment path (cash, card, gcash, paymaya, bank_transfer, or single-cheque without cheques[])
        const row = await tx.salePayment.create({
          data: {
            saleId: sale.id,
            paymentMethod,
            amount: parsedAmount,
            referenceNumber: referenceNumber || null,
            paidAt,
            shiftId: shiftId ? parseInt(shiftId) : null,
            collectedBy: shiftId ? parseInt(String(user.id)) : null,
          },
        })
        createdPayments.push(row)
        console.log('[AR Payment API] ✅ Payment record created, ID:', row.id)
      }
      const newPayment = createdPayments[0]

      // Step 1b: Create deduction records (if any)
      if (parsedDeductions.length > 0) {
        for (const ded of parsedDeductions) {
          const dedRecord = await tx.salePayment.create({
            data: {
              saleId: sale.id,
              paymentMethod: 'government_deduction',
              amount: ded.amount,
              deductionType: ded.type,
              deductionNotes: ded.notes || null,
              referenceNumber: ded.referenceNumber || referenceNumber || null,
              paidAt,
              shiftId: shiftId ? parseInt(shiftId) : null,
              collectedBy: shiftId ? parseInt(String(user.id)) : null,
            },
          })
          console.log('[AR Payment API] ✅ Deduction record created, ID:', dedRecord.id, 'Type:', ded.type, 'Amount:', ded.amount)
        }
      }

      // Step 1.5: Update sale's paidAmount field (CRITICAL!)
      // Increment by actual payment + total deductions so AR balance closes out
      const totalIncrement = parsedAmount + totalDeductions
      console.log('[AR Payment API] Step 1.5: Updating sale paidAmount...')
      const newTotalPaid = parseFloat(sale.paidAmount.toString()) + totalIncrement
      const totalAmount = parseFloat(sale.totalAmount.toString())
      const isFullyPaid = newTotalPaid >= totalAmount - 0.01 // Allow 1 cent tolerance

      await tx.sale.update({
        where: { id: sale.id },
        data: {
          paidAmount: { increment: totalIncrement },
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
          parsedAmount,
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
          // Generate journal entry number (JE-YYYY-NNNN, unique per business)
          // Pattern matches src/lib/expense-utils.ts:137-164
          const year = new Date().getFullYear()
          const jePrefix = `JE-${year}-`
          const lastEntry = await tx.journalEntry.findFirst({
            where: { businessId: businessIdInt, entryNumber: { startsWith: jePrefix } },
            orderBy: { entryNumber: 'desc' },
            select: { entryNumber: true },
          })
          let nextSeq = 1
          if (lastEntry) {
            const m = lastEntry.entryNumber.match(/(\d+)$/)
            if (m) nextSeq = parseInt(m[1], 10) + 1
          }
          const entryNumber = `${jePrefix}${nextSeq.toString().padStart(4, '0')}`

          // Create journal entry for payment received
          const userIdInt = parseInt(String(user.id))
          const totalArCredit = parsedAmount + totalDeductions
          const journalEntry = await tx.journalEntry.create({
            data: {
              businessId: businessIdInt,
              entryNumber,
              entryDate: paidAt,
              entryType: 'automated',
              referenceType: 'Sale',
              referenceId: sale.id.toString(),
              referenceNumber: referenceNumber || null,
              description: `Payment Received${totalDeductions > 0 ? ' (with gov deductions)' : ''}${referenceNumber ? ` - ${referenceNumber}` : ''}`,
              totalDebit: totalArCredit,
              totalCredit: totalArCredit,
              balanced: true,
              status: 'posted',
              createdBy: userIdInt,
              postedBy: userIdInt,
              postedAt: new Date(),
            },
          })

          // Debit: Cash (increase asset) — actual cash received
          await tx.journalEntryLine.create({
            data: {
              journalEntryId: journalEntry.id,
              accountId: cashAccount.id,
              debit: parsedAmount,
              credit: 0,
              description: `Payment received from customer`,
              lineNumber: 1,
            },
          })

          // Debit: Government Deductions (if any)
          let deductionLineWritten = false
          if (totalDeductions > 0) {
            // Try to find or use a tax deductions account (code 1150)
            // If not found, fall back to cash account (conservative — user can reclassify later)
            let deductionAccount = await tx.chartOfAccounts.findFirst({
              where: { businessId: businessIdInt, accountCode: '1150', isActive: true },
            })
            if (!deductionAccount) {
              // Try expense account for tax deductions
              deductionAccount = await tx.chartOfAccounts.findFirst({
                where: { businessId: businessIdInt, accountCode: '6100', isActive: true },
              })
            }
            const deductionAccountId = deductionAccount?.id || cashAccount.id

            await tx.journalEntryLine.create({
              data: {
                journalEntryId: journalEntry.id,
                accountId: deductionAccountId,
                debit: totalDeductions,
                credit: 0,
                description: `Government deductions (EWT/VAT withholding)`,
                lineNumber: 2,
              },
            })
            deductionLineWritten = true

            // Update deduction account balance if different from cash
            if (deductionAccount && deductionAccount.id !== cashAccount.id) {
              await tx.chartOfAccounts.update({
                where: { id: deductionAccount.id },
                data: { currentBalance: { increment: totalDeductions } },
              })
            }
          }

          // Credit: Accounts Receivable (decrease asset) — full amount (payment + deductions)
          await tx.journalEntryLine.create({
            data: {
              journalEntryId: journalEntry.id,
              accountId: arAccount.id,
              debit: 0,
              credit: totalArCredit,
              description: `Payment received from customer${totalDeductions > 0 ? ' (includes gov deductions)' : ''}`,
              lineNumber: deductionLineWritten ? 3 : 2,
            },
          })

          // Update account balances
          await tx.chartOfAccounts.update({
            where: { id: cashAccount.id },
            data: { currentBalance: { increment: parsedAmount } },
          })
          await tx.chartOfAccounts.update({
            where: { id: arAccount.id },
            data: { currentBalance: { decrement: totalArCredit } },
          })
        }
      }

      return { newPayment, createdPayments }
    }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

    // 10. Calculate new balance after payment + deductions
    const newBalance = currentBalance - totalApplied
    const isFullyPaid = newBalance <= 0.01

    // 10. Return success response with updated invoice status
    return NextResponse.json({
      success: true,
      payment: {
        id: payment.newPayment.id,
        amount: parseFloat(payment.newPayment.amount.toString()),
        paymentMethod: payment.newPayment.paymentMethod,
        referenceNumber: payment.newPayment.referenceNumber,
        paidAt: payment.newPayment.paidAt,
      },
      payments: payment.createdPayments.map((p) => ({
        id: p.id,
        amount: parseFloat(p.amount.toString()),
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        paidAt: p.paidAt,
      })),
      deductions: parsedDeductions.map((d) => ({
        type: d.type,
        amount: d.amount,
        notes: d.notes || null,
      })),
      invoice: {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        totalAmount,
        previousBalance: currentBalance,
        paymentAmount: parsedAmount,
        deductionAmount: totalDeductions,
        totalApplied,
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

    // 3. Calculate balance using sale.paidAmount field (source of truth)
    const totalAmount = parseFloat(sale.totalAmount.toString())
    const totalPaid = parseFloat(sale.paidAmount.toString())
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
          deductionType: p.deductionType || null,
          deductionNotes: p.deductionNotes || null,
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
