/**
 * Real-Time Shift Running Totals Helper Functions
 * Updates shift aggregation fields with each sale/void/refund
 * Ensures instant X/Z Reading generation (O(1) performance)
 */

import { prisma } from './prisma.simple'
import type { Prisma } from '@prisma/client'

/**
 * Calculate VAT breakdown for a sale amount
 * Philippines: 12% VAT
 */
export function calculateVATBreakdown(
  subtotal: number,
  isVatExempt: boolean = false
): {
  vatableSales: number
  vatAmount: number
  vatExempt: number
  netOfVat: number
} {
  if (isVatExempt) {
    // Senior/PWD: No VAT charged
    return {
      vatableSales: 0,
      vatAmount: 0,
      vatExempt: subtotal,
      netOfVat: subtotal,
    }
  }

  // Regular sale with 12% VAT
  // Formula: Net of VAT = Subtotal / 1.12
  const netOfVat = subtotal / 1.12
  const vatAmount = subtotal - netOfVat

  return {
    vatableSales: netOfVat,
    vatAmount: vatAmount,
    vatExempt: 0,
    netOfVat: netOfVat,
  }
}

/**
 * Update shift running totals when a sale is CREATED
 * Call this in the same transaction as sale creation
 */
export async function incrementShiftTotalsForSale(
  shiftId: number,
  saleData: {
    subtotal: number // Before VAT, before discounts
    totalAmount: number // After VAT, after discounts
    discountAmount: number
    discountType?: string | null
    payments: Array<{
      paymentMethod: string
      amount: number
    }>
  },
  tx?: any // Optional: Pass transaction from parent
): Promise<void> {
  const db = tx || prisma

  // Determine if sale is VAT-exempt (Senior/PWD get VAT exemption in Philippines)
  const isVatExempt =
    saleData.discountType === 'senior' || saleData.discountType === 'pwd'

  // Calculate VAT breakdown
  const vatBreakdown = calculateVATBreakdown(saleData.subtotal, isVatExempt)

  // Calculate payment method breakdowns
  const paymentBreakdown: Record<string, number> = {}
  saleData.payments.forEach(payment => {
    const method = payment.paymentMethod.toLowerCase()
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + payment.amount
  })

  // Build increment data
  const incrementData: any = {
    // Sales totals
    runningGrossSales: { increment: saleData.subtotal },
    runningNetSales: { increment: saleData.totalAmount },
    runningSubtotal: { increment: saleData.subtotal - saleData.discountAmount },
    runningTransactions: { increment: 1 },

    // VAT breakdown
    runningVatableSales: { increment: vatBreakdown.vatableSales },
    runningVatAmount: { increment: vatBreakdown.vatAmount },
    runningVatExempt: { increment: vatBreakdown.vatExempt },
    runningNetOfVat: { increment: vatBreakdown.netOfVat },

    // Total discounts
    runningTotalDiscounts: { increment: saleData.discountAmount },

    // Payment methods
    runningCashSales: { increment: paymentBreakdown['cash'] || 0 },
    runningCardSales: { increment: paymentBreakdown['card'] || 0 },
    runningGcashSales: { increment: paymentBreakdown['gcash'] || 0 },
    runningPaymayaSales: { increment: paymentBreakdown['paymaya'] || 0 },
    runningBankSales: { increment: paymentBreakdown['bank_transfer'] || 0 },
    runningCheckSales: { increment: paymentBreakdown['check'] || 0 },
    runningCreditSales: { increment: paymentBreakdown['credit'] || 0 },
    runningOtherPayments: {
      increment:
        paymentBreakdown['other'] ||
        paymentBreakdown['customer_deposit'] ||
        0,
    },
  }

  // Discount type breakdown
  if (saleData.discountType === 'senior') {
    incrementData.runningSeniorDiscount = { increment: saleData.discountAmount }
  } else if (saleData.discountType === 'pwd') {
    incrementData.runningPwdDiscount = { increment: saleData.discountAmount }
  } else if (saleData.discountType === 'employee') {
    incrementData.runningEmployeeDiscount = {
      increment: saleData.discountAmount,
    }
  } else if (saleData.discountType === 'volume' || saleData.discountType === 'bulk') {
    incrementData.runningVolumeDiscount = { increment: saleData.discountAmount }
  } else if (saleData.discountAmount > 0) {
    incrementData.runningOtherDiscount = { increment: saleData.discountAmount }
  }

  // Update shift running totals
  await db.cashierShift.update({
    where: { id: shiftId },
    data: incrementData,
  })

  console.log(
    `[ShiftTotals] ✅ Incremented shift ${shiftId}: +${saleData.totalAmount} (${saleData.payments.length} payments)`
  )
}

/**
 * Update shift running totals when a sale is VOIDED
 * Call this in the same transaction as sale void
 */
export async function decrementShiftTotalsForVoid(
  shiftId: number,
  saleData: {
    subtotal: number
    totalAmount: number
    discountAmount: number
    discountType?: string | null
    payments: Array<{
      paymentMethod: string
      amount: number
    }>
  },
  tx?: any
): Promise<void> {
  const db = tx || prisma

  // Determine if sale was VAT-exempt
  const isVatExempt =
    saleData.discountType === 'senior' || saleData.discountType === 'pwd'

  // Calculate VAT breakdown
  const vatBreakdown = calculateVATBreakdown(saleData.subtotal, isVatExempt)

  // Calculate payment method breakdowns
  const paymentBreakdown: Record<string, number> = {}
  saleData.payments.forEach(payment => {
    const method = payment.paymentMethod.toLowerCase()
    paymentBreakdown[method] = (paymentBreakdown[method] || 0) + payment.amount
  })

  // Build decrement data (reverse of increment)
  const decrementData: any = {
    // Reverse sales totals
    runningGrossSales: { decrement: saleData.subtotal },
    runningNetSales: { decrement: saleData.totalAmount },
    runningSubtotal: { decrement: saleData.subtotal - saleData.discountAmount },
    runningTransactions: { decrement: 1 },

    // Reverse VAT breakdown
    runningVatableSales: { decrement: vatBreakdown.vatableSales },
    runningVatAmount: { decrement: vatBreakdown.vatAmount },
    runningVatExempt: { decrement: vatBreakdown.vatExempt },
    runningNetOfVat: { decrement: vatBreakdown.netOfVat },

    // Reverse discounts
    runningTotalDiscounts: { decrement: saleData.discountAmount },

    // Reverse payment methods
    runningCashSales: { decrement: paymentBreakdown['cash'] || 0 },
    runningCardSales: { decrement: paymentBreakdown['card'] || 0 },
    runningGcashSales: { decrement: paymentBreakdown['gcash'] || 0 },
    runningPaymayaSales: { decrement: paymentBreakdown['paymaya'] || 0 },
    runningBankSales: { decrement: paymentBreakdown['bank_transfer'] || 0 },
    runningCheckSales: { decrement: paymentBreakdown['check'] || 0 },
    runningCreditSales: { decrement: paymentBreakdown['credit'] || 0 },
    runningOtherPayments: {
      decrement:
        paymentBreakdown['other'] ||
        paymentBreakdown['customer_deposit'] ||
        0,
    },

    // Track void
    runningVoidCount: { increment: 1 },
    runningVoidedSales: { increment: saleData.totalAmount },
  }

  // Reverse discount type breakdown
  if (saleData.discountType === 'senior') {
    decrementData.runningSeniorDiscount = { decrement: saleData.discountAmount }
  } else if (saleData.discountType === 'pwd') {
    decrementData.runningPwdDiscount = { decrement: saleData.discountAmount }
  } else if (saleData.discountType === 'employee') {
    decrementData.runningEmployeeDiscount = {
      decrement: saleData.discountAmount,
    }
  } else if (saleData.discountType === 'volume' || saleData.discountType === 'bulk') {
    decrementData.runningVolumeDiscount = {
      decrement: saleData.discountAmount,
    }
  } else if (saleData.discountAmount > 0) {
    decrementData.runningOtherDiscount = { decrement: saleData.discountAmount }
  }

  // Update shift running totals
  await db.cashierShift.update({
    where: { id: shiftId },
    data: decrementData,
  })

  console.log(
    `[ShiftTotals] ⚠️ Decremented shift ${shiftId} for void: -${saleData.totalAmount}`
  )
}

/**
 * Update shift running totals when a REFUND is processed
 * Similar to void but tracks separately
 */
export async function incrementShiftTotalsForRefund(
  shiftId: number,
  refundAmount: number,
  tx?: any
): Promise<void> {
  const db = tx || prisma

  await db.cashierShift.update({
    where: { id: shiftId },
    data: {
      runningRefundCount: { increment: 1 },
      runningRefundAmount: { increment: refundAmount },
      // Note: Net sales already adjusted by void, this is just tracking
    },
  })

  console.log(`[ShiftTotals] 💸 Refund recorded for shift ${shiftId}: ${refundAmount}`)
}

/**
 * Calculate running totals from existing sales (for migration/backfill)
 * Use this to populate running totals for shifts created before this feature
 */
export async function calculateRunningTotalsFromSales(
  shiftId: number
): Promise<Prisma.CashierShiftUpdateInput> {
  console.log(`[Migration] Calculating running totals for shift ${shiftId}...`)

  // Get all sales for this shift
  const sales = await prisma.sale.findMany({
    where: { shiftId },
    include: { payments: true },
  })

  // Initialize totals
  const totals: any = {
    runningGrossSales: 0,
    runningNetSales: 0,
    runningSubtotal: 0,
    runningTransactions: 0,
    runningVoidCount: 0,
    runningRefundCount: 0,
    runningVatableSales: 0,
    runningVatAmount: 0,
    runningVatExempt: 0,
    runningNetOfVat: 0,
    runningSeniorDiscount: 0,
    runningPwdDiscount: 0,
    runningEmployeeDiscount: 0,
    runningVolumeDiscount: 0,
    runningOtherDiscount: 0,
    runningTotalDiscounts: 0,
    runningCashSales: 0,
    runningCardSales: 0,
    runningGcashSales: 0,
    runningPaymayaSales: 0,
    runningBankSales: 0,
    runningCheckSales: 0,
    runningCreditSales: 0,
    runningOtherPayments: 0,
    runningVoidedSales: 0,
    runningRefundAmount: 0,
    runningReturnAmount: 0,
  }

  // Process each sale
  for (const sale of sales) {
    const subtotal = parseFloat(sale.subtotal.toString())
    const totalAmount = parseFloat(sale.totalAmount.toString())
    const discountAmount = parseFloat(sale.discountAmount.toString())

    if (sale.status === 'completed') {
      // Completed sale
      totals.runningGrossSales += subtotal
      totals.runningNetSales += totalAmount
      totals.runningSubtotal += subtotal - discountAmount
      totals.runningTransactions += 1

      // VAT breakdown
      const isVatExempt =
        sale.discountType === 'senior' || sale.discountType === 'pwd'
      const vatBreakdown = calculateVATBreakdown(subtotal, isVatExempt)
      totals.runningVatableSales += vatBreakdown.vatableSales
      totals.runningVatAmount += vatBreakdown.vatAmount
      totals.runningVatExempt += vatBreakdown.vatExempt
      totals.runningNetOfVat += vatBreakdown.netOfVat

      // Discounts
      totals.runningTotalDiscounts += discountAmount
      if (sale.discountType === 'senior') {
        totals.runningSeniorDiscount += discountAmount
      } else if (sale.discountType === 'pwd') {
        totals.runningPwdDiscount += discountAmount
      } else if (sale.discountType === 'employee') {
        totals.runningEmployeeDiscount += discountAmount
      } else if (sale.discountType === 'volume' || sale.discountType === 'bulk') {
        totals.runningVolumeDiscount += discountAmount
      } else if (discountAmount > 0) {
        totals.runningOtherDiscount += discountAmount
      }

      // Payment methods
      sale.payments.forEach(payment => {
        const amount = parseFloat(payment.amount.toString())
        const method = payment.paymentMethod.toLowerCase()

        if (method === 'cash') totals.runningCashSales += amount
        else if (method === 'card') totals.runningCardSales += amount
        else if (method === 'gcash') totals.runningGcashSales += amount
        else if (method === 'paymaya') totals.runningPaymayaSales += amount
        else if (method === 'bank_transfer') totals.runningBankSales += amount
        else if (method === 'check') totals.runningCheckSales += amount
        else if (method === 'credit') totals.runningCreditSales += amount
        else totals.runningOtherPayments += amount
      })
    } else if (sale.status === 'voided') {
      // Voided sale
      totals.runningVoidCount += 1
      totals.runningVoidedSales += totalAmount
    } else if (sale.status === 'refunded') {
      // Refunded sale
      totals.runningRefundCount += 1
      totals.runningRefundAmount += totalAmount
    }
  }

  console.log(
    `[Migration] ✅ Calculated totals for shift ${shiftId}: ${sales.length} sales, ₱${totals.runningNetSales.toFixed(2)}`
  )

  return totals
}

/**
 * Verify running totals match actual sales (for testing/audit)
 */
export async function verifyShiftTotals(shiftId: number): Promise<{
  valid: boolean
  errors: string[]
  differences: Record<string, { expected: number; actual: number }>
}> {
  const shift = await prisma.cashierShift.findUnique({
    where: { id: shiftId },
  })

  if (!shift) {
    return { valid: false, errors: ['Shift not found'], differences: {} }
  }

  // Calculate expected totals from sales
  const expectedTotals = await calculateRunningTotalsFromSales(shiftId)

  const errors: string[] = []
  const differences: Record<string, { expected: number; actual: number }> = {}

  // Compare each field
  const fieldsToCheck = [
    'runningGrossSales',
    'runningNetSales',
    'runningTransactions',
    'runningTotalDiscounts',
    'runningCashSales',
  ]

  fieldsToCheck.forEach(field => {
    const expected = (expectedTotals as any)[field] || 0
    const actual = parseFloat(((shift as any)[field] || 0).toString())

    if (Math.abs(expected - actual) > 0.01) {
      // Allow 1 cent difference for rounding
      errors.push(
        `${field} mismatch: expected ${expected.toFixed(2)}, got ${actual.toFixed(2)}`
      )
      differences[field] = { expected, actual }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    differences,
  }
}
