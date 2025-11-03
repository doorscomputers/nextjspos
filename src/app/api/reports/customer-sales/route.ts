import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sortBy = searchParams.get('sortBy') || 'totalSpent'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const limit = parseInt(searchParams.get('limit') || '50')

    // Build where clause
    const where: any = {
      businessId: parseInt(session.user.businessId),
      status: { not: 'VOID' },
      customerId: { not: null }, // Only customers, not walk-ins
    }

    // Date filtering
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // Get sales by customer
    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            contactNumber: true,
            address: true,
          },
        },
        items: true,
      },
    })

    // Group by customer
    const customerMap = new Map()

    sales.forEach((sale) => {
      if (!sale.customerId) return

      const customerId = sale.customerId
      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customerId,
          customerName: sale.customer?.name || 'N/A',
          email: sale.customer?.email || '',
          contactNumber: sale.customer?.contactNumber || '',
          address: sale.customer?.address || '',
          purchaseCount: 0,
          totalSpent: 0,
          totalItems: 0,
          totalDiscount: 0,
          firstPurchase: sale.createdAt,
          lastPurchase: sale.createdAt,
          purchases: [],
        })
      }

      const customerData = customerMap.get(customerId)
      customerData.purchaseCount++
      customerData.totalSpent += sale.totalAmount
      customerData.totalDiscount += sale.discountAmount
      customerData.totalItems += sale.items.reduce(
        (sum: number, item: any) => sum + item.quantity,
        0
      )

      if (sale.createdAt < customerData.firstPurchase) {
        customerData.firstPurchase = sale.createdAt
      }
      if (sale.createdAt > customerData.lastPurchase) {
        customerData.lastPurchase = sale.createdAt
      }

      customerData.purchases.push({
        date: sale.createdAt,
        invoiceNumber: sale.invoiceNumber,
        amount: sale.totalAmount,
      })
    })

    // Convert to array and calculate derived metrics
    const customerSummary = Array.from(customerMap.values()).map((customer) => {
      const avgPurchaseValue =
        customer.purchaseCount > 0 ? customer.totalSpent / customer.purchaseCount : 0

      // Calculate customer lifetime (in days)
      const lifetimeDays = Math.ceil(
        (customer.lastPurchase.getTime() - customer.firstPurchase.getTime()) /
          (1000 * 60 * 60 * 24)
      )

      // Calculate purchase frequency (purchases per month)
      const frequency =
        lifetimeDays > 0 ? (customer.purchaseCount / lifetimeDays) * 30 : customer.purchaseCount

      return {
        ...customer,
        averagePurchaseValue: avgPurchaseValue,
        lifetimeDays,
        purchaseFrequency: frequency,
        firstPurchase: customer.firstPurchase.toISOString(),
        lastPurchase: customer.lastPurchase.toISOString(),
        purchases: customer.purchases.sort(
          (a: any, b: any) => b.date.getTime() - a.date.getTime()
        ),
      }
    })

    // Sort results
    if (sortBy === 'customerName') {
      customerSummary.sort((a, b) => {
        const aVal = a.customerName.toLowerCase()
        const bVal = b.customerName.toLowerCase()
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      })
    } else {
      customerSummary.sort((a, b) => {
        const aVal = a[sortBy as keyof typeof a] as number
        const bVal = b[sortBy as keyof typeof b] as number
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      })
    }

    // Apply limit
    const topCustomers = customerSummary.slice(0, limit)

    // Calculate overall summary
    const summary = {
      totalCustomers: customerSummary.length,
      totalSales: customerSummary.reduce((sum, c) => sum + c.totalSpent, 0),
      totalTransactions: customerSummary.reduce((sum, c) => sum + c.purchaseCount, 0),
      averageCustomerValue:
        customerSummary.length > 0
          ? customerSummary.reduce((sum, c) => sum + c.totalSpent, 0) / customerSummary.length
          : 0,
      averagePurchasesPerCustomer:
        customerSummary.length > 0
          ? customerSummary.reduce((sum, c) => sum + c.purchaseCount, 0) / customerSummary.length
          : 0,
      topCustomer: topCustomers.length > 0 ? topCustomers[0] : null,
    }

    // Customer segments
    const segments = {
      vip: customerSummary.filter((c) => c.totalSpent > summary.averageCustomerValue * 2).length,
      regular: customerSummary.filter(
        (c) =>
          c.totalSpent >= summary.averageCustomerValue &&
          c.totalSpent <= summary.averageCustomerValue * 2
      ).length,
      occasional: customerSummary.filter((c) => c.totalSpent < summary.averageCustomerValue)
        .length,
    }

    return NextResponse.json({
      customers: topCustomers,
      summary,
      segments,
    })
  } catch (error) {
    console.error('Customer Sales Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate customer sales report' },
      { status: 500 }
    )
  }
}
