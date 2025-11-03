import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/purchase-sale
 * Purchase & Sale Comparison Report
 *
 * Query Params:
 * - startDate: Start date for report
 * - endDate: End date for report
 * - locationId: Optional - Filter by specific location
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Requires REPORT_VIEW permission' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    // Default to last 30 days if no dates provided
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    start.setHours(0, 0, 0, 0)

    // Build base where clause
    const baseWhere: any = {
      businessId: parseInt(businessId),
    }

    if (locationId && locationId !== 'all') {
      baseWhere.locationId = parseInt(locationId)
    }

    // ============================================
    // PURCHASES
    // ============================================
    const purchasesWhere = {
      ...baseWhere,
      purchaseDate: {
        gte: start,
        lte: end,
      },
      status: { not: 'cancelled' },
    }

    const purchases = await prisma.purchase.findMany({
      where: purchasesWhere,
    })

    let totalPurchase = 0
    let totalPurchaseTax = 0
    let totalPurchasePaid = 0

    purchases.forEach((purchase) => {
      const amount = purchase.totalAmount ? parseFloat(purchase.totalAmount.toString()) : 0
      const taxAmount = purchase.taxAmount ? parseFloat(purchase.taxAmount.toString()) : 0
      const paidAmount = purchase.paidAmount ? parseFloat(purchase.paidAmount.toString()) : 0

      totalPurchase += amount
      totalPurchaseTax += taxAmount
      totalPurchasePaid += paidAmount
    })

    const purchaseIncludingTax = totalPurchase + totalPurchaseTax
    const purchaseDue = purchaseIncludingTax - totalPurchasePaid

    // ============================================
    // PURCHASE RETURNS
    // ============================================
    const purchaseReturnsWhere = {
      ...baseWhere,
      returnDate: {
        gte: start,
        lte: end,
      },
      status: { not: 'cancelled' },
    }

    const purchaseReturns = await prisma.purchaseReturn.findMany({
      where: purchaseReturnsWhere,
    })

    let totalPurchaseReturn = 0
    let totalPurchaseReturnTax = 0

    purchaseReturns.forEach((ret) => {
      const amount = ret.totalAmount ? parseFloat(ret.totalAmount.toString()) : 0
      // Assuming purchase returns also have tax (adjust if different)
      const taxRate = totalPurchase > 0 ? totalPurchaseTax / totalPurchase : 0
      const taxAmount = amount * taxRate

      totalPurchaseReturn += amount
      totalPurchaseReturnTax += taxAmount
    })

    const totalPurchaseReturnIncludingTax = totalPurchaseReturn + totalPurchaseReturnTax

    // ============================================
    // SALES
    // ============================================
    const salesWhere = {
      ...baseWhere,
      saleDate: {
        gte: start,
        lte: end,
      },
      status: { notIn: ['cancelled', 'voided'] },
    }

    const sales = await prisma.sale.findMany({
      where: salesWhere,
    })

    let totalSale = 0
    let totalSaleTax = 0
    let totalSalePaid = 0

    sales.forEach((sale) => {
      const amount = sale.totalAmount ? parseFloat(sale.totalAmount.toString()) : 0
      const taxAmount = sale.taxAmount ? parseFloat(sale.taxAmount.toString()) : 0
      const paidAmount = sale.paidAmount ? parseFloat(sale.paidAmount.toString()) : 0

      totalSale += amount
      totalSaleTax += taxAmount
      totalSalePaid += paidAmount
    })

    const saleIncludingTax = totalSale + totalSaleTax
    const saleDue = saleIncludingTax - totalSalePaid

    // ============================================
    // SALE RETURNS (from voided/cancelled sales)
    // ============================================
    const saleReturnsWhere = {
      ...baseWhere,
      saleDate: {
        gte: start,
        lte: end,
      },
      status: { in: ['voided', 'cancelled'] },
    }

    const saleReturns = await prisma.sale.findMany({
      where: saleReturnsWhere,
    })

    let totalSellReturn = 0
    let totalSellReturnTax = 0

    saleReturns.forEach((ret) => {
      const amount = ret.totalAmount ? parseFloat(ret.totalAmount.toString()) : 0
      const taxAmount = ret.taxAmount ? parseFloat(ret.taxAmount.toString()) : 0

      totalSellReturn += amount
      totalSellReturnTax += taxAmount
    })

    const totalSellReturnIncludingTax = totalSellReturn + totalSellReturnTax

    // ============================================
    // CALCULATIONS
    // ============================================
    // Sale - Purchase (both including tax)
    const salePurchaseDiff = saleIncludingTax - purchaseIncludingTax

    // Total Due = Purchase Due (we owe) + Sale Due (they owe us)
    // Positive = we owe suppliers more than customers owe us
    // Negative = customers owe us more than we owe suppliers
    const totalDue = purchaseDue - saleDue

    const response = {
      // Purchase Data
      totalPurchase,
      purchaseIncludingTax,
      totalPurchaseReturn: totalPurchaseReturnIncludingTax,
      purchaseDue,

      // Sale Data
      totalSale,
      saleIncludingTax,
      totalSellReturn: totalSellReturnIncludingTax,
      saleDue,

      // Comparisons
      salePurchaseDiff,
      totalDue,

      // Metadata
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating purchase & sale report:', error)
    return NextResponse.json(
      { error: 'Failed to generate purchase & sale report', details: error.message },
      { status: 500 }
    )
  }
}
