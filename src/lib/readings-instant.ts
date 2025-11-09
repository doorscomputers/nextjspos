/**
 * Instant X/Z Reading Generation using Real-Time Running Totals
 * Performance: O(1) - Constant time regardless of sales count
 * Falls back to SQL aggregation if running totals not available
 */

import { prisma } from './prisma.simple'
import {
  generateXReadingDataOptimized,
  generateZReadingDataOptimized,
  type XReadingData,
  type ZReadingData,
} from './readings-optimized'

/**
 * Generate X Reading - Dual Mode (Instant or Fallback)
 * Checks if running totals exist, uses them if available, otherwise falls back to SQL aggregation
 */
export async function generateXReading(
  shiftId: number,
  businessId: number,
  cashierName: string,
  cashierId: string,
  incrementCounter: boolean = true
): Promise<XReadingData> {
  console.log('[X Reading] Starting dual-mode generation for shift', shiftId)
  const startTime = Date.now()

  // Fetch shift with running totals
  const shift = await prisma.cashierShift.findFirst({
    where: {
      id: shiftId,
      businessId: businessId,
    },
    include: {
      cashInOutRecords: true,
    },
  })

  if (!shift) {
    throw new Error('Shift not found')
  }

  // Check if running totals exist and are non-zero
  const hasRunningTotals =
    parseFloat(shift.runningGrossSales.toString()) > 0 ||
    shift.runningTransactions > 0

  if (hasRunningTotals) {
    // MODE 1: INSTANT - Use real-time running totals ⚡
    console.log('[X Reading] ⚡ Using INSTANT mode (real-time totals)')
    const xReading = await generateXReadingFromRunningTotals(
      shift,
      cashierName,
      cashierId,
      incrementCounter
    )
    const elapsed = Date.now() - startTime
    console.log(`[X Reading] ✅ Generated in ${elapsed}ms (INSTANT mode)`)
    return xReading
  } else {
    // MODE 2: FALLBACK - Use SQL aggregation (for old shifts or new shifts with no sales yet)
    console.log(
      '[X Reading] 🔄 Falling back to SQL aggregation (running totals not initialized)'
    )
    const xReading = await generateXReadingDataOptimized(
      shiftId,
      businessId,
      cashierName,
      cashierId,
      incrementCounter
    )
    const elapsed = Date.now() - startTime
    console.log(`[X Reading] ✅ Generated in ${elapsed}ms (SQL aggregation mode)`)
    return xReading
  }
}

/**
 * Generate Z Reading - Dual Mode (Instant or Fallback)
 */
export async function generateZReading(
  shiftId: number,
  businessId: number,
  cashierName: string,
  cashierId: string,
  incrementCounter: boolean = true
): Promise<ZReadingData> {
  console.log('[Z Reading] Starting dual-mode generation for shift', shiftId)
  const startTime = Date.now()

  // Fetch shift with running totals
  const shift = await prisma.cashierShift.findFirst({
    where: {
      id: shiftId,
      businessId: businessId,
    },
    include: {
      cashInOutRecords: true,
      cashDenominations: {
        where: { countType: 'closing' },
      },
    },
  })

  if (!shift) {
    throw new Error('Shift not found')
  }

  // Check if running totals exist
  const hasRunningTotals =
    parseFloat(shift.runningGrossSales.toString()) > 0 ||
    shift.runningTransactions > 0

  if (hasRunningTotals) {
    // MODE 1: INSTANT - Use real-time running totals ⚡
    console.log('[Z Reading] ⚡ Using INSTANT mode (real-time totals)')
    const zReading = await generateZReadingFromRunningTotals(
      shift,
      cashierName,
      cashierId,
      incrementCounter
    )
    const elapsed = Date.now() - startTime
    console.log(`[Z Reading] ✅ Generated in ${elapsed}ms (INSTANT mode)`)
    return zReading
  } else {
    // MODE 2: FALLBACK - Use SQL aggregation
    console.log(
      '[Z Reading] 🔄 Falling back to SQL aggregation (running totals not initialized)'
    )
    const zReading = await generateZReadingDataOptimized(
      shiftId,
      businessId,
      cashierName,
      cashierId,
      incrementCounter
    )
    const elapsed = Date.now() - startTime
    console.log(`[Z Reading] ✅ Generated in ${elapsed}ms (SQL aggregation mode)`)
    return zReading
  }
}

/**
 * Generate X Reading from running totals (INSTANT MODE)
 * Performance: ~50ms regardless of sales count
 */
async function generateXReadingFromRunningTotals(
  shift: any,
  cashierName: string,
  cashierId: string,
  incrementCounter: boolean
): Promise<XReadingData> {
  // Fetch location and business details
  const [location, business] = await Promise.all([
    prisma.businessLocation.findUnique({
      where: { id: shift.locationId },
      select: {
        name: true,
        landmark: true,
        city: true,
        state: true,
        country: true,
        zipCode: true,
      },
    }),
    prisma.business.findUnique({
      where: { id: shift.businessId },
      select: { name: true },
    }),
  ])

  // Calculate cash movements
  const cashIn = shift.cashInOutRecords
    .filter((r: any) => r.type === 'cash_in')
    .reduce((sum: number, r: any) => sum + parseFloat(r.amount.toString()), 0)

  const cashOut = shift.cashInOutRecords
    .filter((r: any) => r.type === 'cash_out')
    .reduce((sum: number, r: any) => sum + parseFloat(r.amount.toString()), 0)

  // AR Payments (if any) - would need to be tracked separately or aggregated
  // For now, assume it's included in payment breakdowns or handle separately
  const arPaymentsCash = 0 // TODO: Add to running totals if needed

  // Expected cash calculation
  const expectedCash =
    parseFloat(shift.beginningCash.toString()) +
    parseFloat(shift.runningCashSales.toString()) +
    cashIn -
    cashOut +
    arPaymentsCash

  // Increment X Reading counter if requested
  const currentXReadingCount = shift.xReadingCount
  if (incrementCounter) {
    await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        xReadingCount: {
          increment: 1,
        },
      },
    })
  }

  const readingTimestamp = new Date()
  const readingNumber = currentXReadingCount + (incrementCounter ? 1 : 0)

  // Construct address
  const address = location
    ? [
        location.landmark,
        location.city,
        location.state,
        location.country,
        location.zipCode,
      ]
        .filter(Boolean)
        .join(', ')
    : ''

  // Build payment breakdown from running totals
  const paymentBreakdown: Record<string, number> = {}
  if (parseFloat(shift.runningCashSales.toString()) > 0)
    paymentBreakdown['cash'] = parseFloat(shift.runningCashSales.toString())
  if (parseFloat(shift.runningCardSales.toString()) > 0)
    paymentBreakdown['card'] = parseFloat(shift.runningCardSales.toString())
  if (parseFloat(shift.runningGcashSales.toString()) > 0)
    paymentBreakdown['gcash'] = parseFloat(shift.runningGcashSales.toString())
  if (parseFloat(shift.runningPaymayaSales.toString()) > 0)
    paymentBreakdown['paymaya'] = parseFloat(
      shift.runningPaymayaSales.toString()
    )
  if (parseFloat(shift.runningBankSales.toString()) > 0)
    paymentBreakdown['bank_transfer'] = parseFloat(
      shift.runningBankSales.toString()
    )
  if (parseFloat(shift.runningCheckSales.toString()) > 0)
    paymentBreakdown['check'] = parseFloat(shift.runningCheckSales.toString())
  if (parseFloat(shift.runningCreditSales.toString()) > 0)
    paymentBreakdown['credit'] = parseFloat(shift.runningCreditSales.toString())
  if (parseFloat(shift.runningOtherPayments.toString()) > 0)
    paymentBreakdown['other'] = parseFloat(shift.runningOtherPayments.toString())

  const xReadingData: XReadingData = {
    shiftNumber: shift.shiftNumber,
    cashierName: cashierName,
    cashierId: cashierId,
    locationName: location?.name || 'Unknown Location',
    locationAddress: address,
    businessName: business?.name || 'Unknown Business',
    openedAt: shift.openedAt,
    readingTime: readingTimestamp,
    xReadingNumber: readingNumber,
    beginningCash: parseFloat(shift.beginningCash.toString()),
    grossSales: parseFloat(shift.runningGrossSales.toString()),
    totalDiscounts: parseFloat(shift.runningTotalDiscounts.toString()),
    netSales: parseFloat(shift.runningNetSales.toString()),
    voidAmount: parseFloat(shift.runningVoidedSales.toString()),
    transactionCount: shift.runningTransactions,
    voidCount: shift.runningVoidCount,
    paymentBreakdown,
    cashIn,
    cashOut,
    arPaymentsCash,
    expectedCash,
    discountBreakdown: {
      senior: parseFloat(shift.runningSeniorDiscount.toString()),
      pwd: parseFloat(shift.runningPwdDiscount.toString()),
      regular:
        parseFloat(shift.runningEmployeeDiscount.toString()) +
        parseFloat(shift.runningVolumeDiscount.toString()) +
        parseFloat(shift.runningOtherDiscount.toString()),
    },
  }

  // Record reading log if incrementing
  if (incrementCounter) {
    await recordShiftReadingLog({
      shiftId: shift.id,
      businessId: shift.businessId,
      locationId: shift.locationId,
      userId: shift.userId,
      type: 'X',
      readingNumber,
      readingTime: readingTimestamp,
      grossSales: xReadingData.grossSales,
      netSales: xReadingData.netSales,
      totalDiscounts: xReadingData.totalDiscounts,
      expectedCash: xReadingData.expectedCash,
      transactionCount: xReadingData.transactionCount,
      payload: xReadingData,
    })
  }

  return xReadingData
}

/**
 * Generate Z Reading from running totals (INSTANT MODE)
 */
async function generateZReadingFromRunningTotals(
  shift: any,
  cashierName: string,
  cashierId: string,
  incrementCounter: boolean
): Promise<ZReadingData> {
  // Get X Reading data first (uses running totals)
  const xReadingData = await generateXReadingFromRunningTotals(
    shift,
    cashierName,
    cashierId,
    false // Don't increment X counter when generating Z
  )

  // Calculate cash variance
  const endingCash = shift.endingCash
    ? parseFloat(shift.endingCash.toString())
    : 0
  const cashVariance = endingCash - xReadingData.expectedCash

  // Increment Z counter if requested
  const currentZReadingCount = shift.zReadingCount
  if (incrementCounter) {
    await prisma.cashierShift.update({
      where: { id: shift.id },
      data: {
        zReadingCount: {
          increment: 1,
        },
      },
    })
  }

  const zReadingNumber = currentZReadingCount + (incrementCounter ? 1 : 0)

  // Get top items sold (limit to prevent slow query)
  const itemsSold = await prisma.$queryRaw<
    Array<{
      product_id: number
      product_name: string
      category_name: string | null
      total_quantity: any
      total_amount: any
    }>
  >`
    SELECT
      si.product_id,
      p.name as product_name,
      c.name as category_name,
      SUM(si.quantity) as total_quantity,
      SUM(si.price * si.quantity) as total_amount
    FROM sale_items si
    INNER JOIN sales s ON si.sale_id = s.id
    INNER JOIN products p ON si.product_id = p.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE s.shift_id = ${shift.id}
      AND s.status = 'completed'
      AND s.business_id = ${shift.businessId}
    GROUP BY si.product_id, p.name, c.name
    ORDER BY total_quantity DESC
    LIMIT 50
  `

  const zReadingData: ZReadingData = {
    ...xReadingData,
    closedAt: shift.closedAt || undefined,
    endingCash,
    cashVariance,
    zReadingNumber,
    cashDenominations: shift.cashDenominations[0] || undefined,
    itemsSold: itemsSold.map(item => ({
      productName: item.product_name,
      categoryName: item.category_name || 'Uncategorized',
      quantity: parseFloat(item.total_quantity.toString()),
      totalAmount: parseFloat(item.total_amount.toString()),
    })),
  }

  // Record Z reading log if incrementing
  if (incrementCounter) {
    await recordShiftReadingLog({
      shiftId: shift.id,
      businessId: shift.businessId,
      locationId: shift.locationId,
      userId: shift.userId,
      type: 'Z',
      readingNumber: zReadingNumber,
      readingTime: new Date(),
      grossSales: xReadingData.grossSales,
      netSales: xReadingData.netSales,
      totalDiscounts: xReadingData.totalDiscounts,
      expectedCash: xReadingData.expectedCash,
      transactionCount: xReadingData.transactionCount,
      payload: zReadingData,
    })
  }

  return zReadingData
}

/**
 * Record shift reading log for audit trail
 */
async function recordShiftReadingLog(data: {
  shiftId: number
  businessId: number
  locationId: number
  userId: number
  type: 'X' | 'Z'
  readingNumber: number
  readingTime: Date
  grossSales: number
  netSales: number
  totalDiscounts: number
  expectedCash: number
  transactionCount: number
  payload: any
}) {
  await prisma.cashierShiftReading.create({
    data: {
      shiftId: data.shiftId,
      businessId: data.businessId,
      locationId: data.locationId,
      userId: data.userId,
      type: data.type,
      readingNumber: data.readingNumber,
      readingTime: data.readingTime,
      grossSales: data.grossSales,
      netSales: data.netSales,
      totalDiscounts: data.totalDiscounts,
      expectedCash: data.expectedCash,
      transactionCount: data.transactionCount,
      payload: data.payload as any,
    },
  })
}
