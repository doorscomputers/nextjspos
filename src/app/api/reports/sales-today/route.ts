import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPORT_SALES_TODAY)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null

    // Get today's date range (start of day to end of day)
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0)
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59)

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
      status: 'completed', // Only completed sales
      saleDate: {
        gte: startOfDay,
        lte: endOfDay,
      },
    }

    // Enforce user location access by default
    // Retrieve user's assigned locations
    const userLocations = await prisma.userLocation.findMany({
      where: { userId: parseInt(user.id) },
      select: { locationId: true },
    })
    const assignedLocationIds = userLocations.map((ul) => ul.locationId)

    if (assignedLocationIds.length > 0) {
      const defaultAssigned = assignedLocationIds[0]
      // If a specific location is requested, only accept if within assignments
      if (locationId && locationId !== 'all') {
        const requested = parseInt(locationId)
        if (assignedLocationIds.includes(requested)) {
          where.locationId = requested
        } else {
          // Requested location not allowed; fall back to user's default assigned location
          where.locationId = defaultAssigned
        }
      } else {
        // No explicit location -> default to the user's first assigned location
        where.locationId = defaultAssigned
      }
    } else {
      // If user has no explicit assignments
      if (locationId && locationId !== 'all') {
        where.locationId = parseInt(locationId)
      } else if (!user.permissions?.includes(PERMISSIONS.ACCESS_ALL_LOCATIONS)) {
        // Prevent leakage for users without global access and no assignments
        return NextResponse.json({
          summary: {
            date: startOfDay.toISOString(),
            totalSales: 0,
            totalAmount: 0,
            totalSubtotal: 0,
            totalTax: 0,
            totalDiscount: 0,
            totalCOGS: 0,
            grossProfit: 0,
            grossMargin: 0,
          },
          paymentMethods: { cash: { amount: 0, percentage: 0 }, credit: { amount: 0, percentage: 0 }, digital: { amount: 0, percentage: 0, breakdown: { card: 0, mobilePayment: 0, bankTransfer: 0 } }, cheque: { amount: 0, percentage: 0 }, total: 0 },
          paymentBreakdown: [],
          discountBreakdown: { senior: 0, pwd: 0, regular: 0, total: 0 },
          sales: [],
        })
      }
      // Admins with global access proceed without extra filter
    }

    // Fetch today's sales with payments
    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        items: true,
        payments: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get unique product and variation IDs from sale items
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        productIds.add(item.productId)
        variationIds.add(item.productVariationId)
      })
    })

    // Fetch product and variation data
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true },
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, name: true, sku: true },
    })

    // Create lookup maps
    const productMap = new Map(products.map((p) => [p.id, p]))
    const variationMap = new Map(variations.map((v) => [v.id, v]))

    // Calculate payment method totals
    let cashTotal = 0
    let creditTotal = 0
    let digitalTotal = 0
    let cardTotal = 0
    let chequeTotal = 0
    let bankTransferTotal = 0
    let mobilePaymentTotal = 0

    const paymentBreakdown: Array<{
      method: string
      amount: number
      count: number
      percentage: number
    }> = []

    // Aggregate payments by method
    const paymentMethodMap: Record<string, { amount: number; count: number }> = {}

    sales.forEach((sale) => {
      sale.payments.forEach((payment) => {
        const method = payment.paymentMethod.toLowerCase()
        const amount = parseFloat(payment.amount.toString())

        if (!paymentMethodMap[method]) {
          paymentMethodMap[method] = { amount: 0, count: 0 }
        }
        paymentMethodMap[method].amount += amount
        paymentMethodMap[method].count += 1

        // Categorize into main groups
        if (method === 'cash') {
          cashTotal += amount
        } else if (method === 'credit') {
          creditTotal += amount
        } else if (method === 'card' || method === 'debit_card' || method === 'credit_card') {
          digitalTotal += amount
          cardTotal += amount
        } else if (method === 'mobile_payment' || method === 'gcash' || method === 'paymaya') {
          digitalTotal += amount
          mobilePaymentTotal += amount
        } else if (method === 'bank_transfer') {
          digitalTotal += amount
          bankTransferTotal += amount
        } else if (method === 'cheque') {
          chequeTotal += amount
        }
      })
    })

    const totalSalesAmount = cashTotal + creditTotal + digitalTotal + chequeTotal

    // Build payment breakdown array
    Object.entries(paymentMethodMap).forEach(([method, data]) => {
      paymentBreakdown.push({
        method: method.charAt(0).toUpperCase() + method.slice(1).replace(/_/g, ' '),
        amount: data.amount,
        count: data.count,
        percentage: totalSalesAmount > 0 ? (data.amount / totalSalesAmount) * 100 : 0,
      })
    })

    // Sort by amount descending
    paymentBreakdown.sort((a, b) => b.amount - a.amount)

    // Calculate summary metrics
    const totalSales = sales.length
    const totalAmount = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.totalAmount.toString()),
      0
    )
    const totalSubtotal = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.subtotal.toString()),
      0
    )
    const totalTax = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.taxAmount.toString()),
      0
    )
    const totalDiscount = sales.reduce(
      (sum, sale) => sum + parseFloat(sale.discountAmount.toString()),
      0
    )

    // Calculate COGS (Cost of Goods Sold)
    let totalCOGS = 0
    sales.forEach((sale) => {
      sale.items.forEach((item) => {
        const quantity = parseFloat(item.quantity.toString())
        const unitCost = parseFloat(item.unitCost.toString())
        totalCOGS += quantity * unitCost
      })
    })

    const grossProfit = totalAmount - totalCOGS

    // Calculate discount breakdown
    const discountBreakdown = {
      senior: 0,
      pwd: 0,
      regular: 0,
      total: totalDiscount,
    }

    sales.forEach((sale) => {
      const discount = parseFloat(sale.discountAmount.toString())
      if (sale.discountType === 'senior') {
        discountBreakdown.senior += discount
      } else if (sale.discountType === 'pwd') {
        discountBreakdown.pwd += discount
      } else if (discount > 0) {
        discountBreakdown.regular += discount
      }
    })

    return NextResponse.json({
      summary: {
        date: today.toISOString().split('T')[0],
        totalSales,
        totalAmount,
        totalSubtotal,
        totalTax,
        totalDiscount,
        totalCOGS,
        grossProfit,
        grossMargin: totalAmount > 0 ? (grossProfit / totalAmount) * 100 : 0,
      },
      paymentMethods: {
        cash: {
          amount: cashTotal,
          percentage: totalSalesAmount > 0 ? (cashTotal / totalSalesAmount) * 100 : 0,
        },
        credit: {
          amount: creditTotal,
          percentage: totalSalesAmount > 0 ? (creditTotal / totalSalesAmount) * 100 : 0,
        },
        digital: {
          amount: digitalTotal,
          percentage: totalSalesAmount > 0 ? (digitalTotal / totalSalesAmount) * 100 : 0,
          breakdown: {
            card: cardTotal,
            mobilePayment: mobilePaymentTotal,
            bankTransfer: bankTransferTotal,
          },
        },
        cheque: {
          amount: chequeTotal,
          percentage: totalSalesAmount > 0 ? (chequeTotal / totalSalesAmount) * 100 : 0,
        },
        total: totalSalesAmount,
      },
      paymentBreakdown,
      discountBreakdown,
      sales: sales.map((sale) => ({
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        saleDate: sale.saleDate.toISOString().split('T')[0],
        customer: sale.customer?.name || 'Walk-in Customer',
        customerId: sale.customerId,
        totalAmount: parseFloat(sale.totalAmount.toString()),
        discountAmount: parseFloat(sale.discountAmount.toString()),
        discountType: sale.discountType,
        payments: sale.payments.map((p) => ({
          method: p.paymentMethod,
          amount: parseFloat(p.amount.toString()),
        })),
        itemCount: sale.items.length,
        items: sale.items.map((item) => {
          const product = productMap.get(item.productId)
          const variation = variationMap.get(item.productVariationId)
          return {
            productName: product?.name || 'Unknown Product',
            variationName: variation?.name || 'Unknown Variation',
            sku: variation?.sku || 'N/A',
            quantity: parseFloat(item.quantity.toString()),
            unitPrice: parseFloat(item.unitPrice.toString()),
            total: parseFloat(item.quantity.toString()) * parseFloat(item.unitPrice.toString()),
          }
        }),
      })),
    })
  } catch (error) {
    console.error('Error fetching sales today report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sales today report' },
      { status: 500 }
    )
  }
}
