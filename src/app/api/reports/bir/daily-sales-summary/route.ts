import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/bir/daily-sales-summary
 * BIR-Compliant Daily Sales Summary Report
 * Based on RR 18-2012 and RR 11-2004 requirements
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!hasPermission(session.user as any, PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json({ error: 'Forbidden - Missing report.view permission' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const cashierId = searchParams.get('cashierId')

    const businessId = parseInt((session.user as any).businessId)

    // Date range for the day
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)
    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // Build where clause
    const where: any = {
      businessId,
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ['completed', 'voided'] }, // Include voided for reporting
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    if (cashierId) {
      where.createdBy = parseInt(cashierId)
    }

    // Get all sales for the day
    const allSales = await prisma.sale.findMany({
      where,
      include: {
        payments: true,
        items: true,
      },
      orderBy: { invoiceNumber: 'asc' },
    })

    // Separate completed and voided sales
    const completedSales = allSales.filter(s => s.status === 'completed')
    const voidedSales = allSales.filter(s => s.status === 'voided')

    // Get invoice range
    const beginningInvoice = completedSales[0]?.invoiceNumber || 'N/A'
    const endingInvoice = completedSales[completedSales.length - 1]?.invoiceNumber || 'N/A'

    // Calculate totals
    let grossSales = 0
    let vatableSales = 0
    let vatAmount = 0
    let vatExemptSales = 0
    let zeroRatedSales = 0
    let totalDiscount = 0
    let seniorDiscount = 0
    let pwdDiscount = 0
    let regularDiscount = 0
    let cashSales = 0
    let creditSales = 0
    let digitalSales = 0
    let seniorCount = 0
    let pwdCount = 0

    completedSales.forEach(sale => {
      const saleTotal = parseFloat(sale.totalAmount.toString())
      const discount = parseFloat(sale.discountAmount.toString())

      grossSales += saleTotal
      totalDiscount += discount

      // VAT Calculation (BIR Standard: 12% VAT)
      if (sale.vatExempt) {
        // VAT-Exempt (Senior Citizen, PWD)
        vatExemptSales += saleTotal
        if (sale.discountType === 'senior') {
          seniorDiscount += discount
          seniorCount++
        } else if (sale.discountType === 'pwd') {
          pwdDiscount += discount
          pwdCount++
        }
      } else {
        // VAT-Inclusive calculation
        const vatable = saleTotal / 1.12  // Extract base amount
        const vat = vatable * 0.12         // Calculate 12% VAT
        vatableSales += vatable
        vatAmount += vat
      }

      // Regular discounts (not SC/PWD)
      if (!sale.discountType || sale.discountType === 'regular') {
        regularDiscount += discount
      }

      // Payment method breakdown
      sale.payments.forEach(payment => {
        const amount = parseFloat(payment.amount.toString())
        const method = payment.paymentMethod.toLowerCase()

        if (method === 'cash') {
          cashSales += amount
        } else if (method === 'credit' || method === 'credit_card') {
          creditSales += amount
        } else {
          // digital payments (gcash, paymaya, etc.)
          digitalSales += amount
        }
      })
    })

    // Calculate voided totals
    const voidAmount = voidedSales.reduce((sum, sale) => {
      return sum + parseFloat(sale.totalAmount.toString())
    }, 0)

    // Get location and business info
    const location = locationId
      ? await prisma.businessLocation.findUnique({
          where: { id: parseInt(locationId) },
          select: { name: true, landmark: true, city: true, state: true, country: true },
        })
      : null

    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        taxNumber1: true,
        taxLabel1: true,
        accumulatedSales: true, // BIR Grand Accumulated Total
        resetCounter: true,     // BIR Reset Counter
        zCounter: true,         // Z-Reading count
        lastZReadingDate: true, // Last Z-Reading date
      },
    })

    // Get cashier info if filtered
    const cashier = cashierId
      ? await prisma.user.findUnique({
          where: { id: parseInt(cashierId) },
          select: { firstName: true, lastName: true, username: true },
        })
      : null

    // Net sales calculation
    const netSales = grossSales - totalDiscount

    // BIR Accumulated Sales Calculation
    // Beginning Balance = Grand total from last Z-Reading (accumulated sales before today)
    const beginningBalance = parseFloat(business?.accumulatedSales?.toString() || '0')

    // Ending Balance = Beginning Balance + Today's Gross Sales
    const endingBalance = beginningBalance + grossSales

    // Format response
    const summary = {
      // Report Header
      reportDate: date,
      businessName: business?.name || '',
      businessTIN: business?.taxNumber1 || '',
      businessAddress: '', // Business address stored in locations
      location: location?.name || 'All Locations',
      locationAddress: location ? `${location.landmark || ''}, ${location.city}, ${location.state}, ${location.country}`.replace(/^, /, '') : '',
      cashier: cashier
        ? `${cashier.firstName || ''} ${cashier.lastName || ''}`.trim() || cashier.username
        : 'All Cashiers',

      // Invoice Range
      beginningInvoice,
      endingInvoice,
      totalInvoices: completedSales.length,

      // Sales Breakdown
      grossSales,
      totalDiscount,
      netSales,

      // VAT Analysis
      vatableSales,
      vatAmount,
      vatExemptSales,
      zeroRatedSales,

      // Payment Methods
      cashSales,
      creditSales,
      digitalSales,
      totalCollections: cashSales + creditSales + digitalSales,

      // Discounts
      seniorDiscount,
      seniorCount,
      pwdDiscount,
      pwdCount,
      regularDiscount,

      // Transactions
      totalTransactions: completedSales.length,
      voidTransactions: voidedSales.length,
      voidAmount,

      // BIR Compliance Fields
      outputVAT: vatAmount, // 12% VAT on vatable sales
      netVATableSales: vatableSales, // Sales amount before VAT

      // BIR Accumulated Grand Total (Running Balance)
      beginningBalance,  // Grand total before this period
      endingBalance,     // Grand total after this period
      resetCounter: business?.resetCounter || 1,  // BIR Reset Counter
      zCounter: business?.zCounter || 0,          // Z-Reading count
      lastZReadingDate: business?.lastZReadingDate || null,  // Last Z-Reading timestamp
    }

    // Get detailed transactions if requested
    const includeDetails = searchParams.get('includeDetails') === 'true'
    const transactions = includeDetails
      ? completedSales.map(sale => ({
          invoiceNumber: sale.invoiceNumber,
          dateTime: sale.createdAt,
          grossAmount: parseFloat(sale.totalAmount.toString()),
          discount: parseFloat(sale.discountAmount.toString()),
          netAmount:
            parseFloat(sale.totalAmount.toString()) -
            parseFloat(sale.discountAmount.toString()),
          vatExempt: sale.vatExempt,
          discountType: sale.discountType,
          paymentMethods: sale.payments.map(p => ({
            method: p.paymentMethod,
            amount: parseFloat(p.amount.toString()),
          })),
        }))
      : []

    return NextResponse.json({
      summary,
      transactions,
      reportGenerated: new Date(),
    })
  } catch (error: any) {
    console.error('Error generating daily sales summary:', error)
    return NextResponse.json(
      { error: 'Failed to generate daily sales summary', details: error.message },
      { status: 500 }
    )
  }
}
