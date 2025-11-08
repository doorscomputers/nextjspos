/**
 * BIR-Compliant Reading Generation Library
 *
 * Provides shared logic for generating X-Readings and Z-Readings
 * Used by both standalone reading endpoints and integrated shift close workflow
 */

import { prisma } from '@/lib/prisma'
import { Decimal } from '@prisma/client/runtime/library'

/**
 * X Reading Data Structure
 */
export interface XReadingData {
  shiftNumber: string
  cashierName: string
  cashierId: string
  locationName: string
  locationAddress: string
  businessName: string
  openedAt: Date
  readingTime: Date
  xReadingNumber: number
  beginningCash: number
  grossSales: number
  totalDiscounts: number
  netSales: number
  voidAmount: number
  transactionCount: number
  voidCount: number
  paymentBreakdown: Record<string, number>
  cashIn: number
  cashOut: number
  arPaymentsCash: number // AR payments collected (cash only)
  expectedCash: number
  discountBreakdown: {
    senior: number
    pwd: number
    regular: number
  }
}

/**
 * Z Reading Data Structure
 */
export interface ZReadingData {
  reportType: string
  reportNumber: string
  generatedAt: string
  zCounter: number
  resetCounter: number
  previousAccumulatedSales: number
  salesForTheDay: number
  accumulatedSales: number
  lastZReadingDate: Date | null
  business: {
    name: string
    tin: string | null
  }
  shift: {
    shiftNumber: string
    cashier: string
    cashierId: string
    openedAt: string
    closedAt: string | null
    status: string
    xReadingCount: number
  }
  sales: {
    transactionCount: number
    voidCount: number
    grossSales: number
    totalDiscounts: number
    netSales: number
    voidAmount: number
  }
  payments: Record<string, number>
  cash: {
    beginningCash: number
    endingCash: number
    systemCash: number
    cashOver: number
    cashShort: number
    cashIn: number
    cashOut: number
    arPaymentsCash: number // AR payments collected (cash only)
    cashInCount: number
    cashOutCount: number
  }
  discounts: {
    senior: { amount: number; count: number }
    pwd: { amount: number; count: number }
    regular: { amount: number; count: number }
  }
  categorySales: Record<string, number>
  cashDenomination: {
    count1000: number
    count500: number
    count200: number
    count100: number
    count50: number
    count20: number
    count10: number
    count5: number
    count1: number
    count025: number
    totalAmount: number
  } | null
}

/**
 * Generate X Reading Data (Non-Resetting Mid-Shift Report)
 *
 * @param shiftId - ID of the shift to generate reading for
 * @param businessId - Business ID for multi-tenant isolation
 * @param cashierName - Name of the cashier
 * @param incrementCounter - Whether to increment X reading counter (default: true)
 * @returns X Reading data object
 */
export async function generateXReadingData(
  shiftId: number,
  businessId: number,
  cashierName: string,
  cashierId: string,
  incrementCounter: boolean = true
): Promise<XReadingData> {
  // Fetch shift with all related data
  const shift = await prisma.cashierShift.findFirst({
    where: {
      id: shiftId,
      businessId: businessId,
    },
    include: {
      sales: {
        include: {
          payments: true,
          items: true,
        },
      },
      cashInOutRecords: true,
    },
  })

  if (!shift) {
    throw new Error('Shift not found')
  }

  // Fetch location and business details
  const location = await prisma.businessLocation.findUnique({
    where: { id: shift.locationId },
    select: {
      name: true,
      landmark: true,
      city: true,
      state: true,
      country: true,
      zipCode: true,
    },
  })

  const business = await prisma.business.findUnique({
    where: { id: shift.businessId },
    select: { name: true },
  })

  // Construct address from location fields
  const address = location
    ? [location.landmark, location.city, location.state, location.country, location.zipCode]
        .filter(Boolean)
        .join(', ')
    : ''

  // Calculate totals
  const completedSales = shift.sales.filter(sale => sale.status === 'completed')
  const voidedSales = shift.sales.filter(sale => sale.status === 'voided')

  const grossSales = completedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.subtotal.toString())
  }, 0)

  const totalDiscounts = completedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.discountAmount.toString())
  }, 0)

  const netSales = completedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.totalAmount.toString())
  }, 0)

  const voidAmount = voidedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.totalAmount.toString())
  }, 0)

  // Payment method breakdown
  // IMPORTANT: Handle overpayment (change) correctly
  const paymentBreakdown: Record<string, number> = {}
  completedSales.forEach(sale => {
    const saleTotal = parseFloat(sale.totalAmount.toString())
    const paymentsTotal = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

    // If overpaid (change given), allocate proportionally
    const allocationRatio = paymentsTotal > saleTotal ? saleTotal / paymentsTotal : 1

    sale.payments.forEach(payment => {
      const method = payment.paymentMethod
      const amount = parseFloat(payment.amount.toString())
      const allocatedAmount = amount * allocationRatio
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + allocatedAmount
    })
  })

  // Cash movements
  const cashIn = shift.cashInOutRecords
    .filter(r => r.type === 'cash_in')
    .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

  const cashOut = shift.cashInOutRecords
    .filter(r => r.type === 'cash_out')
    .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

  // AR Payments collected during this shift (cash only)
  const arPayments = await prisma.salePayment.findMany({
    where: {
      shiftId: shift.id,
      paymentMethod: 'cash'
    }
  })

  const arPaymentsCash = arPayments.reduce(
    (sum, payment) => sum + parseFloat(payment.amount.toString()),
    0
  )

  // Expected cash in drawer
  const expectedCash =
    parseFloat(shift.beginningCash.toString()) +
    (paymentBreakdown['cash'] || 0) +
    cashIn -
    cashOut +
    arPaymentsCash

  // Increment X Reading count if requested
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
  const transactionCount = completedSales.length

  const readingData: XReadingData = {
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
    grossSales,
    totalDiscounts,
    netSales,
    voidAmount,
    transactionCount,
    voidCount: voidedSales.length,
    paymentBreakdown,
    cashIn,
    cashOut,
    arPaymentsCash,
    expectedCash,
    discountBreakdown: {
      senior: completedSales
        .filter(s => s.discountType === 'senior')
        .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
      pwd: completedSales
        .filter(s => s.discountType === 'pwd')
        .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
      regular: completedSales
        .filter(s => !s.discountType || s.discountType === 'regular')
        .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
    },
  }

  if (incrementCounter) {
    await recordShiftReadingLog({
      shiftId: shift.id,
      businessId: shift.businessId,
      locationId: shift.locationId,
      userId: shift.userId,
      type: 'X',
      readingNumber,
      readingTime: readingTimestamp,
      grossSales,
      netSales,
      totalDiscounts,
      expectedCash,
      transactionCount,
      payload: readingData,
    })
  }

  return readingData
}

/**
 * Generate Z Reading Data (End-of-Day BIR-Compliant Report)
 *
 * @param shiftId - ID of the shift to generate reading for
 * @param businessId - Business ID for multi-tenant isolation
 * @param cashierName - Name of the cashier
 * @param incrementCounter - Whether to increment Z counter (default: true)
 * @returns Z Reading data object
 */
export async function generateZReadingData(
  shiftId: number,
  businessId: number,
  cashierName: string,
  cashierId: string,
  incrementCounter: boolean = true
): Promise<ZReadingData> {
  // Fetch shift with all related data
  // NOTE: SaleItem model has NO product relation, only productId field
  const shift = await prisma.cashierShift.findFirst({
    where: {
      id: shiftId,
      businessId: businessId,
    },
    include: {
      sales: {
        include: {
          payments: true,
          items: true, // Just items, we'll fetch products separately
        },
      },
      cashInOutRecords: true,
      cashDenominations: {
        where: { countType: 'closing' },
      },
    },
  })

  if (!shift) {
    throw new Error('Shift not found')
  }

  // Fetch products with categories for all items in this shift
  // Collect all unique productIds from all sale items
  const productIds = [...new Set(
    shift.sales.flatMap(sale =>
      sale.items.map(item => item.productId)
    )
  )]

  // Fetch all products with their categories in one query
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      categoryId: true,
    },
  })

  // Fetch all categories for these products
  const categoryIds = [...new Set(products.map(p => p.categoryId).filter(Boolean))] as number[]
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true },
  })

  // Build lookup maps
  const categoryMap = new Map(categories.map(c => [c.id, c.name]))
  const productCategoryMap = new Map(
    products.map(p => [
      p.id,
      p.categoryId ? categoryMap.get(p.categoryId) || 'Uncategorized' : 'Uncategorized'
    ])
  )

  // Calculate all totals
  const completedSales = shift.sales.filter(sale => sale.status === 'completed')
  const voidedSales = shift.sales.filter(sale => sale.status === 'voided')

  const grossSales = completedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.subtotal.toString())
  }, 0)

  const totalDiscounts = completedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.discountAmount.toString())
  }, 0)

  const netSales = completedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.totalAmount.toString())
  }, 0)

  const voidAmount = voidedSales.reduce((sum, sale) => {
    return sum + parseFloat(sale.totalAmount.toString())
  }, 0)

  // Payment method breakdown
  const paymentBreakdown: Record<string, number> = {}
  completedSales.forEach(sale => {
    const saleTotal = parseFloat(sale.totalAmount.toString())
    const paymentsTotal = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0)

    const allocationRatio = paymentsTotal > saleTotal ? saleTotal / paymentsTotal : 1

    sale.payments.forEach(payment => {
      const method = payment.paymentMethod
      const amount = parseFloat(payment.amount.toString())
      const allocatedAmount = amount * allocationRatio
      paymentBreakdown[method] = (paymentBreakdown[method] || 0) + allocatedAmount
    })
  })

  // Category sales breakdown using the category map we built earlier
  const categorySales: Record<string, number> = {}
  completedSales.forEach(sale => {
    sale.items.forEach(item => {
      const category = productCategoryMap.get(item.productId) || 'Uncategorized'
      const amount = parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString())
      categorySales[category] = (categorySales[category] || 0) + amount
    })
  })

  // Get business info for Z-Counter tracking
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      zCounter: true,
      resetCounter: true,
      accumulatedSales: true,
      lastZReadingDate: true,
      name: true,
      taxNumber1: true,
    },
  })

  if (!business) {
    throw new Error('Business not found')
  }

  const previousAccumulatedSales = parseFloat(business.accumulatedSales.toString())
  const salesForTheDay = netSales
  const newAccumulatedSales = previousAccumulatedSales + salesForTheDay

  // Increment Z-Counter and update accumulated sales if requested
  let currentZCounter = business.zCounter
  if (incrementCounter) {
    const updatedBusiness = await prisma.business.update({
      where: { id: businessId },
      data: {
        zCounter: {
          increment: 1,
        },
        accumulatedSales: newAccumulatedSales,
        lastZReadingDate: new Date(),
      },
    })
    currentZCounter = updatedBusiness.zCounter
  }

  // Cash movements
  const cashIn = shift.cashInOutRecords
    .filter(r => r.type === 'cash_in')
    .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

  const cashOut = shift.cashInOutRecords
    .filter(r => r.type === 'cash_out')
    .reduce((sum, r) => sum + parseFloat(r.amount.toString()), 0)

  // AR Payments collected during this shift (cash only)
  const arPaymentsZ = await prisma.salePayment.findMany({
    where: {
      shiftId: shift.id,
      paymentMethod: 'cash'
    }
  })

  const arPaymentsCashZ = arPaymentsZ.reduce(
    (sum, payment) => sum + parseFloat(payment.amount.toString()),
    0
  )

  // Get cash denomination if available
  const cashDenomination = shift.cashDenominations[0] || null

  const generatedAt = new Date()

  const zReadingData: ZReadingData = {
    reportType: 'Z-Reading',
    reportNumber: `Z${String(currentZCounter).padStart(4, '0')}`,
    generatedAt: generatedAt.toISOString(),
    zCounter: currentZCounter,
    resetCounter: business.resetCounter,
    previousAccumulatedSales,
    salesForTheDay,
    accumulatedSales: incrementCounter ? newAccumulatedSales : previousAccumulatedSales + salesForTheDay,
    lastZReadingDate: business.lastZReadingDate,
    business: {
      name: business.name,
      tin: business.taxNumber1,
    },
    shift: {
      shiftNumber: shift.shiftNumber,
      cashier: cashierName,
      cashierId: cashierId,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() || null,
      status: shift.status,
      xReadingCount: shift.xReadingCount,
    },
    sales: {
      transactionCount: completedSales.length,
      voidCount: voidedSales.length,
      grossSales,
      totalDiscounts,
      netSales,
      voidAmount,
    },
    payments: paymentBreakdown,
    cash: {
      beginningCash: parseFloat(shift.beginningCash.toString()),
      endingCash: shift.endingCash ? parseFloat(shift.endingCash.toString()) : 0,
      // FIX: Calculate systemCash dynamically if shift is still open (not yet closed)
      // System Cash = Beginning Cash + Cash Sales + Cash In - Cash Out + AR Payments (cash)
      systemCash: shift.systemCash
        ? parseFloat(shift.systemCash.toString())
        : parseFloat(shift.beginningCash.toString()) +
          (paymentBreakdown['cash'] || 0) +
          cashIn -
          cashOut +
          arPaymentsCashZ,
      cashOver: shift.cashOver ? parseFloat(shift.cashOver.toString()) : 0,
      cashShort: shift.cashShort ? parseFloat(shift.cashShort.toString()) : 0,
      cashIn,
      cashOut,
      arPaymentsCash: arPaymentsCashZ,
      cashInCount: shift.cashInOutRecords.filter(r => r.type === 'cash_in').length,
      cashOutCount: shift.cashInOutRecords.filter(r => r.type === 'cash_out').length,
    },
    discounts: {
      senior: {
        amount: completedSales
          .filter(s => s.discountType === 'senior')
          .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
        count: completedSales.filter(s => s.discountType === 'senior').length,
      },
      pwd: {
        amount: completedSales
          .filter(s => s.discountType === 'pwd')
          .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
        count: completedSales.filter(s => s.discountType === 'pwd').length,
      },
      regular: {
        amount: completedSales
          .filter(s => !s.discountType || s.discountType === 'regular')
          .reduce((sum, s) => sum + parseFloat(s.discountAmount.toString()), 0),
        count: completedSales.filter(s => !s.discountType || s.discountType === 'regular').length,
      },
    },
    categorySales,
    cashDenomination: cashDenomination
      ? {
          count1000: cashDenomination.count1000,
          count500: cashDenomination.count500,
          count200: cashDenomination.count200,
          count100: cashDenomination.count100,
          count50: cashDenomination.count50,
          count20: cashDenomination.count20,
          count10: cashDenomination.count10,
          count5: cashDenomination.count5,
          count1: cashDenomination.count1,
          count025: cashDenomination.count025,
          totalAmount: parseFloat(cashDenomination.totalAmount.toString()),
        }
      : null,
  }

  if (incrementCounter) {
    const expectedCashForLog = zReadingData.cash.systemCash
    await recordShiftReadingLog({
      shiftId: shift.id,
      businessId: shift.businessId,
      locationId: shift.locationId,
      userId: shift.userId,
      type: 'Z',
      readingNumber: 1,
      readingTime: generatedAt,
      grossSales,
      netSales,
      totalDiscounts,
      expectedCash: expectedCashForLog,
      transactionCount: zReadingData.sales.transactionCount,
      reportNumber: zReadingData.reportNumber,
      payload: zReadingData,
    })
  }

  return zReadingData
}

interface ShiftReadingLogParams {
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
  expectedCash?: number
  transactionCount: number
  reportNumber?: string | null
  payload?: any
}

async function recordShiftReadingLog(params: ShiftReadingLogParams) {
  try {
    const sanitizedPayload = params.payload ? JSON.parse(JSON.stringify(params.payload)) : null

    await prisma.cashierShiftReading.upsert({
      where: {
        shiftId_type_readingNumber: {
          shiftId: params.shiftId,
          type: params.type,
          readingNumber: params.readingNumber,
        },
      },
      update: {
        readingTime: params.readingTime,
        grossSales: params.grossSales,
        netSales: params.netSales,
        totalDiscounts: params.totalDiscounts,
        expectedCash: params.expectedCash ?? null,
        transactionCount: params.transactionCount,
        reportNumber: params.reportNumber ?? null,
        payload: sanitizedPayload,
      },
      create: {
        businessId: params.businessId,
        locationId: params.locationId,
        shiftId: params.shiftId,
        userId: params.userId,
        type: params.type,
        readingNumber: params.readingNumber,
        readingTime: params.readingTime,
        grossSales: params.grossSales,
        netSales: params.netSales,
        totalDiscounts: params.totalDiscounts,
        expectedCash: params.expectedCash ?? null,
        transactionCount: params.transactionCount,
        reportNumber: params.reportNumber ?? null,
        payload: sanitizedPayload,
      },
    })
  } catch (error) {
    console.error('Failed to record shift reading log:', error)
  }
}
