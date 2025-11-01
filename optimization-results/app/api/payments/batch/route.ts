import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST /api/payments/batch
 * Create a batch payment that pays multiple invoices in one transaction
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
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
      supplierId,
      paymentDate,
      paymentMethod,
      totalAmount,
      chequeNumber,
      chequeDate,
      bankName,
      transactionReference,
      bankTransferReference,
      isPostDated,
      notes,
      allocations, // Array of { apId, allocatedAmount }
      bankAccountNumber,
      cardType,
      cardLast4,
      cardTransactionId,
    } = body

    // Validation
    if (!supplierId || !paymentDate || !paymentMethod || !totalAmount || !allocations || allocations.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Fetch all accounts payable records to be paid
    const apIds = allocations.map((a: any) => parseInt(a.apId))
    const accountsPayables = await prisma.accountsPayable.findMany({
      where: {
        id: { in: apIds },
        businessId: parseInt(businessId),
        deletedAt: null,
      },
    })

    if (accountsPayables.length !== apIds.length) {
      return NextResponse.json(
        { error: 'One or more invoices not found' },
        { status: 404 }
      )
    }

    // Verify all are from the same supplier
    const supplierIds = [...new Set(accountsPayables.map(ap => ap.supplierId))]
    if (supplierIds.length > 1 || !supplierIds.includes(parseInt(supplierId))) {
      return NextResponse.json(
        { error: 'All invoices must be from the same supplier' },
        { status: 400 }
      )
    }

    // Validate allocations
    const totalAllocated = allocations.reduce((sum: number, a: any) => sum + parseFloat(a.allocatedAmount), 0)
    if (Math.abs(totalAllocated - parseFloat(totalAmount)) > 0.01) {
      return NextResponse.json(
        { error: 'Total allocated amount must match payment amount' },
        { status: 400 }
      )
    }

    for (const allocation of allocations) {
      const ap = accountsPayables.find(a => a.id === parseInt(allocation.apId))
      if (!ap) continue

      const allocatedAmount = parseFloat(allocation.allocatedAmount)
      const balance = parseFloat(ap.balanceAmount.toString())

      if (allocatedAmount > balance) {
        return NextResponse.json(
          { error: `Payment amount for invoice ${ap.invoiceNumber} exceeds balance of ${balance}` },
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

    // Create batch payment in transaction
    const result = await prisma.$transaction(async (tx) => {
      let postDatedChequeId = null

      // If post-dated cheque, create post-dated cheque record first
      if (isPostDated && paymentMethod === 'cheque') {
        const pdc = await tx.postDatedCheque.create({
          data: {
            businessId: parseInt(businessId),
            supplierId: parseInt(supplierId),
            chequeNumber: chequeNumber!,
            chequeDate: new Date(chequeDate!),
            amount: parseFloat(totalAmount),
            bankName: bankName || '',
            accountNumber: null,
            status: 'pending',
            reminderSent: false,
            createdBy: parseInt(userId),
          },
        })
        postDatedChequeId = pdc.id
      }

      // Create individual payment records for each allocation
      const paymentRecords = []
      const invoiceNumbers = []

      for (const allocation of allocations) {
        const allocatedAmount = parseFloat(allocation.allocatedAmount)
        if (allocatedAmount <= 0) continue

        const ap = accountsPayables.find(a => a.id === parseInt(allocation.apId))
        if (!ap) continue

        invoiceNumbers.push(ap.invoiceNumber)

        // Create payment record
        const payment = await tx.payment.create({
          data: {
            businessId: parseInt(businessId),
            supplierId: parseInt(supplierId),
            accountsPayableId: parseInt(allocation.apId),
            paymentNumber: `${paymentNumber}-${invoiceNumbers.length}`, // Sub-number for each invoice
            paymentDate: new Date(paymentDate),
            paymentMethod,
            amount: allocatedAmount,
            chequeNumber: paymentMethod === 'cheque' ? chequeNumber : null,
            chequeDate: paymentMethod === 'cheque' && chequeDate ? new Date(chequeDate) : null,
            bankName: bankName || null,
            transactionReference: transactionReference || bankTransferReference || null,
            isPostDated: isPostDated || false,
            postDatedChequeId,
            status: 'completed',
            notes: notes ? `${notes} (Batch Payment ${paymentNumber})` : `Batch Payment ${paymentNumber}`,
            createdBy: parseInt(userId),
          },
        })

        paymentRecords.push(payment)

        // Update accounts payable
        const newPaidAmount = parseFloat(ap.paidAmount.toString()) + allocatedAmount
        const newBalanceAmount = parseFloat(ap.totalAmount.toString()) - newPaidAmount

        let newPaymentStatus = 'unpaid'
        if (newBalanceAmount <= 0.01) { // Account for floating point precision
          newPaymentStatus = 'paid'
        } else if (newPaidAmount > 0) {
          newPaymentStatus = 'partial'
        }

        await tx.accountsPayable.update({
          where: { id: parseInt(allocation.apId) },
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
        // Try to find matching bank account
        let bankAccount = null
        if (bankAccountNumber) {
          bankAccount = await tx.bank.findFirst({
            where: {
              businessId: parseInt(businessId),
              bankName: bankName,
              accountNumber: bankAccountNumber,
              deletedAt: null,
              isActive: { select: { id: true, name: true } },
            },
          })
        } else {
          bankAccount = await tx.bank.findFirst({
            where: {
              businessId: parseInt(businessId),
              bankName: bankName,
              deletedAt: null,
              isActive: { select: { id: true, name: true } },
            },
          })
        }

        // Calculate new balance if bank account found
        let balanceAfter = null
        if (bankAccount) {
          const currentBalance = parseFloat(bankAccount.currentBalance.toString())
          balanceAfter = currentBalance - parseFloat(totalAmount)

          // Update bank current balance
          await tx.bank.update({
            where: { id: bankAccount.id },
            data: {
              currentBalance: balanceAfter,
            },
          })
        }

        // Create one bank transaction for the entire batch payment
        await tx.bankTransaction.create({
          data: {
            businessId: parseInt(businessId),
            bankId: bankAccount?.id || null,
            paymentId: paymentRecords[0].id, // Link to first payment
            transactionDate: new Date(paymentDate),
            transactionType: 'payment',
            amount: -parseFloat(totalAmount), // Negative for payment (money going out)
            bankName: bankName,
            accountNumber: bankAccountNumber || null,
            transactionNumber: transactionReference || bankTransferReference || paymentNumber,
            balanceAfter: balanceAfter,
            description: `Batch Payment to ${supplier.name} - ${paymentNumber} (${paymentRecords.length} invoices: ${invoiceNumbers.join(', ')})`,
            createdBy: parseInt(userId),
          },
        })
      }

      return { paymentRecords, invoiceNumbers }
    })

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'batch_payment_create' as AuditAction,
      entityType: EntityType.PAYMENT,
      entityIds: result.paymentRecords.map(p => p.id),
      description: `Created batch payment ${paymentNumber} to ${supplier.name} for ${result.paymentRecords.length} invoices`,
      metadata: {
        paymentNumber,
        supplierId: parseInt(supplierId),
        supplierName: supplier.name,
        totalAmount: parseFloat(totalAmount),
        paymentMethod,
        invoiceCount: result.paymentRecords.length,
        invoices: result.invoiceNumbers,
        isPostDated: isPostDated || false,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      success: { select: { id: true, name: true } },
      paymentNumber,
      paymentsCreated: result.paymentRecords.length,
      totalAmount: parseFloat(totalAmount),
      invoices: result.invoiceNumbers,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating batch payment:', error)
    return NextResponse.json(
      {
        error: 'Failed to create batch payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
