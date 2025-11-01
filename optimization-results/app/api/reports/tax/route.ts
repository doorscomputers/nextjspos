import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

/**
 * GET /api/reports/tax
 * Tax Report - Input Tax (Purchase), Output Tax (Sales), and Expense Tax
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
    const locationId = searchParams.get('locationId')

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
    // INPUT TAX - From Purchases
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
      select: {
        supplier: {
          select: {
            name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            taxNumber: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: {
        purchaseDate: 'desc',
      },
    })

    const inputTaxData = purchases.map((purchase) => {
      const totalAmount = purchase.totalAmount ? parseFloat(purchase.totalAmount.toString()) : 0
      const taxAmount = purchase.taxAmount ? parseFloat(purchase.taxAmount.toString()) : 0
      const discountAmount = purchase.discountAmount ? parseFloat(purchase.discountAmount.toString()) : 0

      return {
        date: purchase.purchaseDate.toISOString(),
        referenceNo: purchase.purchaseOrderNumber,
        supplier: purchase.supplier?.name || 'Unknown Supplier',
        taxNumber: purchase.supplier?.taxNumber || 'N/A',
        totalAmount,
        paymentMethod: purchase.paymentTerms || 'N/A',
        discount: discountAmount,
        vat: taxAmount,
        taxExempt: 0, // Calculate if needed based on your tax logic
        type: 'purchase' as const,
      }
    })

    const inputTaxTotal = inputTaxData.reduce((sum, item) => sum + item.vat, 0)

    // ============================================
    // OUTPUT TAX - From Sales
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
      select: {
        customer: {
          select: {
            name: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            taxNumber: { select: { id: true, name: true } },
          },
        },
        payments: { select: { id: true, name: true } },
      },
      orderBy: {
        saleDate: 'desc',
      },
    })

    const outputTaxData = sales.map((sale) => {
      const totalAmount = sale.totalAmount ? parseFloat(sale.totalAmount.toString()) : 0
      const taxAmount = sale.taxAmount ? parseFloat(sale.taxAmount.toString()) : 0
      const discountAmount = sale.discountAmount ? parseFloat(sale.discountAmount.toString()) : 0
      const paymentMethod = sale.payments && sale.payments.length > 0
        ? sale.payments[0].paymentMethod
        : 'N/A'

      return {
        date: sale.saleDate.toISOString(),
        referenceNo: sale.invoiceNumber,
        supplier: sale.customer?.name || 'Walk-in Customer',
        taxNumber: sale.customer?.taxNumber || 'N/A',
        totalAmount,
        paymentMethod,
        discount: discountAmount,
        vat: taxAmount,
        taxExempt: 0, // Calculate if needed based on your tax logic
        type: 'sale' as const,
      }
    })

    const outputTaxTotal = outputTaxData.reduce((sum, item) => sum + item.vat, 0)

    // ============================================
    // EXPENSE TAX - From Cash Out Transactions
    // ============================================
    const expensesWhere = {
      ...baseWhere,
      type: 'cash_out',
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    const expenses = await prisma.cashInOut.findMany({
      where: expensesWhere,
      orderBy: {
        createdAt: 'desc',
      },
    })

    const expenseTaxData = expenses.map((expense) => {
      const amount = expense.amount ? parseFloat(expense.amount.toString()) : 0
      // Assuming 12% VAT on expenses (adjust based on your business logic)
      const vatRate = 0.12
      const taxExemptAmount = amount / (1 + vatRate)
      const vatAmount = amount - taxExemptAmount

      return {
        date: expense.createdAt.toISOString(),
        referenceNo: expense.id.toString(),
        supplier: expense.reason || 'Expense',
        taxNumber: 'N/A',
        totalAmount: amount,
        paymentMethod: 'Cash',
        discount: 0,
        vat: vatAmount,
        taxExempt: taxExemptAmount,
        type: 'expense' as const,
      }
    })

    const expenseTaxTotal = expenseTaxData.reduce((sum, item) => sum + item.vat, 0)

    // ============================================
    // CALCULATE NET TAX PAYABLE
    // Net Tax = Output Tax - Input Tax - Expense Tax
    // ============================================
    const netTax = outputTaxTotal - inputTaxTotal - expenseTaxTotal

    const response = {
      summary: {
        inputTax: inputTaxTotal,
        outputTax: outputTaxTotal,
        expenseTax: expenseTaxTotal,
        netTax,
      },
      inputTax: inputTaxData,
      outputTax: outputTaxData,
      expenseTax: expenseTaxData,
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      },
    }

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error generating tax report:', error)
    return NextResponse.json(
      { error: 'Failed to generate tax report', details: error.message },
      { status: 500 }
    )
  }
}
