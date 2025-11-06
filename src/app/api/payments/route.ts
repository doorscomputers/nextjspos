import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { isAccountingEnabled, recordSupplierPayment } from '@/lib/accountingIntegration'

// GET - List all payments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PAYMENT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    // Get query parameters for filtering
    const { searchParams } = new URL(request.url)
    const supplierId = searchParams.get('supplierId')
    const accountsPayableId = searchParams.get('accountsPayableId')
    const paymentMethod = searchParams.get('paymentMethod')
    const status = searchParams.get('status')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
    }

    if (supplierId) {
      where.supplierId = parseInt(supplierId)
    }

    if (accountsPayableId) {
      where.accountsPayableId = parseInt(accountsPayableId)
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod
    }

    if (status) {
      where.status = status
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              mobile: true,
              email: true,
            },
          },
          accountsPayable: {
            select: {
              id: true,
              invoiceNumber: true,
              invoiceDate: true,
              totalAmount: true,
              balanceAmount: true,
            },
          },
          postDatedCheque: {
            select: {
              id: true,
              chequeNumber: true,
              chequeDate: true,
              status: true,
            },
          },
          bankTransactions: true,
        },
        orderBy: {
          paymentDate: 'desc',
        },
        skip: offset,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ])

    return NextResponse.json({
      payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching payments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    )
  }
}

// POST - Create new payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PAYMENT_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      accountsPayableId,
      supplierId,
      paymentDate,
      paymentMethod,
      amount,
      chequeNumber,
      chequeDate,
      bankName,
      transactionReference,
      isPostDated,
      notes,
    } = body

    // Validation
    if (!supplierId || !paymentDate || !paymentMethod || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields: supplierId, paymentDate, paymentMethod, amount' },
        { status: 400 }
      )
    }

    // Verify supplier belongs to business
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(supplierId),
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found or does not belong to your business' },
        { status: 404 }
      )
    }

    // If accountsPayableId provided, verify it exists and belongs to business
    let accountsPayable = null
    if (accountsPayableId) {
      accountsPayable = await prisma.accountsPayable.findFirst({
        where: {
          id: parseInt(accountsPayableId),
          businessId: parseInt(businessId),
          deletedAt: null,
        },
      })

      if (!accountsPayable) {
        return NextResponse.json(
          { error: 'Accounts payable entry not found' },
          { status: 404 }
        )
      }

      // Check if payment amount exceeds balance
      const paymentAmount = parseFloat(amount)
      const balance = parseFloat(accountsPayable.balanceAmount.toString())

      if (paymentAmount > balance) {
        return NextResponse.json(
          { error: `Payment amount (${paymentAmount}) exceeds outstanding balance (${balance})` },
          { status: 400 }
        )
      }
    }

    // Validation for cheque payments
    if (paymentMethod === 'cheque') {
      if (!chequeNumber || !chequeDate) {
        return NextResponse.json(
          { error: 'Cheque number and cheque date are required for cheque payments' },
          { status: 400 }
        )
      }

      // Check if post-dated
      const chequeDateObj = new Date(chequeDate)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (chequeDateObj > today && !isPostDated) {
        return NextResponse.json(
          { error: 'Cheque date is in the future. Please mark as post-dated.' },
          { status: 400 }
        )
      }
    }

    // Generate payment number
    const currentYear = new Date().getFullYear()
    const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')
    const lastPayment = await prisma.payment.findFirst({
      where: {
        businessId: parseInt(businessId),
        paymentNumber: {
          startsWith: `PAY-${currentYear}${currentMonth}`,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    let paymentNumber
    if (lastPayment) {
      const lastNumber = parseInt(lastPayment.paymentNumber.split('-').pop() || '0')
      paymentNumber = `PAY-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
    } else {
      paymentNumber = `PAY-${currentYear}${currentMonth}-0001`
    }

    // Create payment in transaction
    const payment = await prisma.$transaction(async (tx) => {
      let postDatedChequeId = null

      // If post-dated cheque, create post-dated cheque record first
      if (isPostDated && paymentMethod === 'cheque') {
        const pdc = await tx.postDatedCheque.create({
          data: {
            businessId: parseInt(businessId),
            supplierId: parseInt(supplierId),
            chequeNumber: chequeNumber!,
            chequeDate: new Date(chequeDate!),
            amount: parseFloat(amount),
            bankName: bankName || '',
            accountNumber: null,
            status: 'pending',
            reminderSent: false,
            createdBy: parseInt(userId),
          },
        }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })
        postDatedChequeId = pdc.id
      }

      // Create payment
      const newPayment = await tx.payment.create({
        data: {
          businessId: parseInt(businessId),
          supplierId: parseInt(supplierId),
          accountsPayableId: accountsPayableId ? parseInt(accountsPayableId) : null,
          paymentNumber,
          paymentDate: new Date(paymentDate),
          paymentMethod,
          amount: parseFloat(amount),
          chequeNumber: paymentMethod === 'cheque' ? chequeNumber : null,
          chequeDate: paymentMethod === 'cheque' && chequeDate ? new Date(chequeDate) : null,
          bankName: bankName || null,
          transactionReference: transactionReference || null,
          isPostDated: isPostDated || false,
          postDatedChequeId,
          status: 'completed',
          notes,
          createdBy: parseInt(userId),
        },
      })

      // If accountsPayableId provided, update the AP entry
      if (accountsPayableId && accountsPayable) {
        const newPaidAmount =
          parseFloat(accountsPayable.paidAmount.toString()) + parseFloat(amount)
        const newBalanceAmount =
          parseFloat(accountsPayable.totalAmount.toString()) - newPaidAmount

        let newPaymentStatus = 'unpaid'
        if (newBalanceAmount <= 0) {
          newPaymentStatus = 'paid'
        } else if (newPaidAmount > 0) {
          newPaymentStatus = 'partial'
        }

        await tx.accountsPayable.update({
          where: { id: parseInt(accountsPayableId) },
          data: {
            paidAmount: newPaidAmount,
            balanceAmount: newBalanceAmount,
            paymentStatus: newPaymentStatus,
          },
        })
      }

      // Create bank transaction record for all payment methods except cash
      // Payments to suppliers are negative amounts (money going out)
      if (paymentMethod !== 'cash' && bankName) {
        // Try to find matching bank account by name and account number
        let bankAccount = null
        if (body.bankAccountNumber) {
          bankAccount = await tx.bank.findFirst({
            where: {
              businessId: parseInt(businessId),
              bankName: bankName,
              accountNumber: body.bankAccountNumber,
              deletedAt: null,
              isActive: true,
            },
          })
        } else {
          // If no account number, try to find by bank name only (first active match)
          bankAccount = await tx.bank.findFirst({
            where: {
              businessId: parseInt(businessId),
              bankName: bankName,
              deletedAt: null,
              isActive: true,
            },
          })
        }

        // Calculate new balance if bank account found
        let balanceAfter = null
        if (bankAccount) {
          const currentBalance = parseFloat(bankAccount.currentBalance.toString())
          balanceAfter = currentBalance - parseFloat(amount) // Subtract for payment

          // Update bank current balance
          await tx.bank.update({
            where: { id: bankAccount.id },
            data: {
              currentBalance: balanceAfter,
            },
          })
        }

        await tx.bankTransaction.create({
          data: {
            businessId: parseInt(businessId),
            bankId: bankAccount?.id || null, // Link to bank if found
            paymentId: newPayment.id,
            transactionDate: new Date(paymentDate),
            transactionType: 'payment',
            amount: -parseFloat(amount), // Negative for payment (money going out)
            bankName: bankName,
            accountNumber: body.bankAccountNumber || null,
            transactionNumber: transactionReference || body.bankTransferReference || paymentNumber,
            balanceAfter: balanceAfter, // Set balance if bank account found
            description: `Payment to ${supplier.name} - ${paymentNumber} (${paymentMethod})`,
            createdBy: parseInt(userId),
          },
        })
      }

      return newPayment
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'payment_create' as AuditAction,
      entityType: EntityType.PAYMENT,
      entityIds: [payment.id],
      description: `Created payment ${paymentNumber} to ${supplier.name}`,
      metadata: {
        paymentId: payment.id,
        paymentNumber,
        supplierId: parseInt(supplierId),
        supplierName: supplier.name,
        amount: parseFloat(amount),
        paymentMethod,
        accountsPayableId,
        isPostDated: isPostDated || false,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    // ACCOUNTING INTEGRATION: Create journal entries if accounting is enabled
    if (await isAccountingEnabled(parseInt(businessId))) {
      try {
        await recordSupplierPayment({
          businessId: parseInt(businessId),
          userId: parseInt(userId),
          paymentId: payment.id,
          paymentDate: new Date(paymentDate),
          amount: parseFloat(amount),
          referenceNumber: paymentNumber,
          supplierId: parseInt(supplierId)
        })
        console.log(`[Accounting] Supplier payment journal entry created for payment ${paymentNumber}`)
      } catch (accountingError) {
        // Log accounting errors but don't fail the payment
        console.error('[Accounting] Failed to create journal entry for supplier payment:', accountingError)
        // Payment still succeeds even if accounting integration fails
      }
    }

    // Fetch complete payment with relations
    const completePayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        supplier: true,
        accountsPayable: true,
        postDatedCheque: true,
        bankTransactions: true,
      },
    })

    return NextResponse.json(completePayment, { status: 201 })
  } catch (error) {
    console.error('Error creating payment:', error)
    return NextResponse.json(
      {
        error: 'Failed to create payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
