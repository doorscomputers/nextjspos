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
import { getNextReadingReceiptNumber } from './atomicNumbers'

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
  // Fetch location and business details (including BIR compliance fields)
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
        zCounter: true, // Per-location Z counter
        resetCounter: true, // Per-location reset counter
        accumulatedSales: true, // Per-location accumulated sales
      },
    }),
    prisma.business.findUnique({
      where: { id: shift.businessId },
      select: {
        name: true,
        taxNumber1: true, // VAT REG TIN
        birMinNumber: true, // MIN
        birSerialNumber: true, // S/N
        birPermitNumber: true, // Permit to Use
        operatedBy: true, // Operated by
        businessAddress: true, // Full address
      },
    }),
  ])

  // Calculate cash movements
  const cashIn = shift.cashInOutRecords
    .filter((r: any) => r.type === 'cash_in')
    .reduce((sum: number, r: any) => sum + parseFloat(r.amount.toString()), 0)

  const cashOut = shift.cashInOutRecords
    .filter((r: any) => r.type === 'cash_out')
    .reduce((sum: number, r: any) => sum + parseFloat(r.amount.toString()), 0)

  // AR Payments collected in cash during this shift
  const arPaymentsCash = parseFloat(shift.runningArPaymentsCash.toString())

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

  // Generate location-based receipt number for X Reading
  // Format: Inv{LocationName}{MM_DD_YYYY}_####
  const receiptNumber = incrementCounter
    ? await getNextReadingReceiptNumber(
        shift.businessId,
        shift.locationId,
        location?.name || 'Unknown',
        undefined
      )
    : undefined

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

  // Get first and last invoice numbers for this shift (BIR requirement)
  // INCLUDE ALL INVOICES: cash sales, charge invoices (pending), and partial payments
  // Use secondary sort by ID to handle multiple sales with same timestamp
  const [firstSale, lastSale] = await Promise.all([
    prisma.sale.findFirst({
      where: {
        shiftId: shift.id,
        status: { in: ['completed', 'partial', 'pending'] }, // Include credit sales (charge invoices)
      },
      select: { invoiceNumber: true },
      orderBy: [
        { saleDate: 'asc' },
        { id: 'asc' } // Secondary sort by ID for deterministic ordering
      ],
    }),
    prisma.sale.findFirst({
      where: {
        shiftId: shift.id,
        status: { in: ['completed', 'partial', 'pending'] }, // Include credit sales (charge invoices)
      },
      select: { invoiceNumber: true },
      orderBy: [
        { saleDate: 'desc' },
        { id: 'desc' } // Secondary sort by ID for deterministic ordering
      ],
    }),
  ])

  // Build payment breakdown from running totals (includes direct sales + AR collections)
  const paymentBreakdown: Record<string, number> = {}

  // Direct sale payments + AR payment collections
  const totalCash = parseFloat(shift.runningCashSales.toString()) + parseFloat(shift.runningArPaymentsCash.toString())
  const totalCard = parseFloat(shift.runningCardSales.toString()) + parseFloat(shift.runningArPaymentsCard.toString())
  const totalGcash = parseFloat(shift.runningGcashSales.toString()) + parseFloat(shift.runningArPaymentsGcash.toString())
  const totalPaymaya = parseFloat(shift.runningPaymayaSales.toString()) + parseFloat(shift.runningArPaymentsPaymaya.toString())
  const totalBank = parseFloat(shift.runningBankSales.toString()) + parseFloat(shift.runningArPaymentsBank.toString())
  const totalCheck = parseFloat(shift.runningCheckSales.toString()) + parseFloat(shift.runningArPaymentsCheck.toString())
  const totalOther = parseFloat(shift.runningOtherPayments.toString()) + parseFloat(shift.runningArPaymentsOther.toString())

  if (totalCash > 0) paymentBreakdown['cash'] = totalCash
  if (totalCard > 0) paymentBreakdown['card'] = totalCard
  if (totalGcash > 0) paymentBreakdown['gcash'] = totalGcash
  if (totalPaymaya > 0) paymentBreakdown['paymaya'] = totalPaymaya
  if (totalBank > 0) paymentBreakdown['bank_transfer'] = totalBank
  if (totalCheck > 0) paymentBreakdown['check'] = totalCheck
  if (parseFloat(shift.runningCreditSales.toString()) > 0)
    paymentBreakdown['credit'] = parseFloat(shift.runningCreditSales.toString())
  if (totalOther > 0) paymentBreakdown['other'] = totalOther

  // Calculate clearer breakdown fields
  const cashFromSales = parseFloat(shift.runningCashSales.toString()) // Cash collected from direct sales only
  const totalNonCashPayments = totalGcash + totalPaymaya + totalCheck + totalCard + totalBank + parseFloat(shift.runningCreditSales.toString()) + totalOther
  const totalPaymentsReceived = expectedCash + totalNonCashPayments

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
    receiptNumber: receiptNumber, // Location-based receipt number
    beginningCash: parseFloat(shift.beginningCash.toString()),
    cashFromSales, // NEW: Clearer field showing only cash from direct sales
    grossSales: parseFloat(shift.runningGrossSales.toString()),
    totalDiscounts: parseFloat(shift.runningTotalDiscounts.toString()),
    netSales: parseFloat(shift.runningNetSales.toString()),
    voidAmount: parseFloat(shift.runningVoidedSales.toString()),
    transactionCount: shift.runningTransactions,
    voidCount: shift.runningVoidCount,
    paymentBreakdown,
    totalNonCashPayments, // NEW: Sum of all non-cash payment methods
    totalPaymentsReceived, // NEW: Grand total of all payments (expected cash + non-cash)
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
    // BIR Compliance Fields
    vatRegTin: business?.taxNumber1 || undefined,
    minNumber: business?.birMinNumber || undefined,
    serialNumber: business?.birSerialNumber || undefined,
    permitNumber: business?.birPermitNumber || undefined,
    operatedBy: business?.operatedBy || undefined,
    businessAddress: business?.businessAddress || address,
    startDateTime: shift.openedAt,
    endDateTime: readingTimestamp,
    beginningOrNumber: firstSale?.invoiceNumber || undefined,
    endingOrNumber: lastSale?.invoiceNumber || undefined,
    refundAmount: 0, // TODO: Calculate from refund records
    withdrawalAmount: cashOut,
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

  // Fetch location data for Z-Reading specific fields (accumulated sales, counters) - PER-LOCATION
  const location = await prisma.businessLocation.findUnique({
    where: { id: shift.locationId },
    select: {
      zCounter: true,
      resetCounter: true,
      accumulatedSales: true,
      name: true,
    },
  })

  if (!location) {
    throw new Error('Location not found for Z Reading generation')
  }

  // Calculate cash variance
  const endingCash = shift.endingCash
    ? parseFloat(shift.endingCash.toString())
    : 0
  const cashVariance = endingCash - xReadingData.expectedCash

  // BIR COMPLIANCE: Use location's global Z counter (not per-shift counter)
  // Reading number is globally sequential per location
  // When incrementCounter=true, this will be incremented in the database by shift close
  const currentLocationZCounter = location.zCounter
  const zReadingNumber = currentLocationZCounter + (incrementCounter ? 1 : 0)

  console.log(`[Z Reading] Location: ${location.name}, Current Z Counter: ${currentLocationZCounter}, This Reading #: ${zReadingNumber}`)

  // Legacy per-shift counter update (kept for backward compatibility but not used for reading number)
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

  // Calculate shift age in hours
  const shiftAgeHours = Math.floor(
    (Date.now() - new Date(shift.openedAt).getTime()) / (1000 * 60 * 60)
  )

  // Get top items sold - OPTIONAL feature, skip for old shifts to prevent timeouts
  // BIR compliance does NOT require item breakdown, only totals
  let itemsSold: Array<{
    product_id: number
    product_name: string
    category_name: string | null
    total_quantity: any
    total_amount: any
  }> = []

  // Only fetch items for shifts less than 24 hours old to prevent timeouts
  if (shiftAgeHours < 24 && shift.runningTransactions < 500) {
    console.log('[Z Reading] Fetching items sold (shift < 24h, transactions < 500)')
    itemsSold = await Promise.race([
      prisma.$queryRaw<
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
          SUM(si.unit_price * si.quantity) as total_amount
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
      `,
      // Timeout after 5 seconds (reduced from 10)
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Items query timeout')), 5000)
      )
    ]).catch(err => {
      console.warn('[Z Reading] Items query timed out or failed:', err.message)
      return [] as Array<{ product_id: number; product_name: string; category_name: string | null; total_quantity: any; total_amount: any }>
    })
  } else {
    console.log(`[Z Reading] Skipping items sold query (shift age: ${shiftAgeHours}h, transactions: ${shift.runningTransactions})`)
  }

  // Calculate VAT breakdown (Philippines: 12% VAT)
  const grossSales = parseFloat(shift.runningGrossSales.toString())
  const vatableSales = grossSales / 1.12 // Remove VAT to get vatable amount
  const vatAmount = vatableSales * 0.12 // 12% VAT
  const vatExemptSales = 0 // TODO: Track VAT-exempt sales separately
  const zeroRatedSales = 0 // TODO: Track zero-rated sales separately

  // Calculate VAT adjustments from discounts
  const seniorDiscount = parseFloat(shift.runningSeniorDiscount.toString())
  const pwdDiscount = parseFloat(shift.runningPwdDiscount.toString())
  const regularDiscount = parseFloat(shift.runningEmployeeDiscount.toString()) +
    parseFloat(shift.runningVolumeDiscount.toString()) +
    parseFloat(shift.runningOtherDiscount.toString())

  const scVatAdjustment = seniorDiscount * 0.12
  const pwdVatAdjustment = pwdDiscount * 0.12
  const regularVatAdjustment = regularDiscount * 0.12

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
    // BIR Z-Reading Specific Fields
    beginningSiNumber: xReadingData.beginningOrNumber, // From X Reading
    endingSiNumber: xReadingData.endingOrNumber, // From X Reading
    beginningVoidNumber: undefined, // TODO: Track void numbers
    endingVoidNumber: undefined,
    beginningReturnNumber: undefined, // TODO: Track return numbers
    endingReturnNumber: undefined,
    zCounter: location?.zCounter || 0,
    resetCounter: location?.resetCounter || 1,
    previousAccumulatedSales: parseFloat(location?.accumulatedSales?.toString() || '0'),
    salesForTheDay: grossSales,
    accumulatedSales: parseFloat(location?.accumulatedSales?.toString() || '0') + grossSales,
    // VAT Breakdown
    vatableSales,
    vatAmount,
    vatExemptSales,
    zeroRatedSales,
    // VAT Adjustments
    vatAdjustments: {
      scTransaction: scVatAdjustment,
      pwdTransaction: pwdVatAdjustment,
      regularDiscountTransaction: regularVatAdjustment,
      zeroRatedTransaction: 0,
      vatOnReturn: 0, // TODO: Calculate from returns
      otherVatAdjustments: 0,
    },
    // Returns
    returnAmount: 0, // TODO: Calculate from return records
    // Discount Summary
    discountSummary: {
      seniorCitizenDiscount: seniorDiscount,
      pwdDiscount: pwdDiscount,
      naacDiscount: 0, // TODO: Add NAAC discount tracking
      soloParentDiscount: 0, // TODO: Add Solo Parent discount tracking
      otherDiscount: regularDiscount,
    },
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
