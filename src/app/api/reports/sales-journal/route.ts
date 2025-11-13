import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { getUserAccessibleLocationIds } from '@/lib/rbac'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
    const cashierId = searchParams.get('cashierId')
    const paymentMethod = searchParams.get('paymentMethod')
    const statusFilter = searchParams.get('status')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const businessId = parseInt(user.businessId?.toString() || '0')

    // Build where clause
    const where: any = {
      businessId: businessId,
    }

    // Automatic location filtering based on user's assigned locations
    const accessibleLocationIds = getUserAccessibleLocationIds({
      id: user.id,
      permissions: user.permissions || [],
      roles: user.roles || [],
      businessId: user.businessId,
      locationIds: user.locationIds || []
    })

    // If user has limited location access, enforce it
    if (accessibleLocationIds !== null) {
      if (accessibleLocationIds.length === 0) {
        // User has no location access - return empty results
        return NextResponse.json({
          sales: [],
          pagination: { page, limit, totalCount: 0, totalPages: 0 },
          summary: { totalSales: 0, totalAmount: 0, totalTax: 0, totalDiscount: 0, netSales: 0 }
        })
      }
      where.locationId = { in: accessibleLocationIds }
    }

    // Automatic cashier filtering - cashiers can only see their own sales
    const isCashier = user.roles?.some((role: string) => role.toLowerCase().includes('cashier'))
    if (isCashier && !user.permissions?.includes('sell.view')) {
      // Cashiers with only sell.view_own permission can only see their own sales
      where.createdBy = parseInt(user.id)
    }

    // Status filtering
    if (statusFilter && statusFilter !== 'all') {
      where.status = statusFilter
    }

    // Date filtering - use saleDate for journal reports
    if (startDate || endDate) {
      where.saleDate = {}
      if (startDate) {
        where.saleDate.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.saleDate.lte = end
      }
    }

    // Location filtering
    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Cashier filtering
    if (cashierId) {
      where.createdBy = parseInt(cashierId)
    }

    // Payment method filtering - filter by payments relation
    if (paymentMethod && paymentMethod !== 'all') {
      where.payments = {
        some: {
          paymentMethod: paymentMethod
        }
      }
    }

    // Search by invoice number or customer name
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { customer: { name: { contains: search } } },
      ]
    }

    // Get total count
    const totalCount = await prisma.sale.count({ where })

    // Build orderBy
    const orderBy: any = {}
    if (sortBy === 'invoiceNumber') {
      orderBy.invoiceNumber = sortOrder
    } else if (sortBy === 'customer') {
      orderBy.customer = { name: sortOrder }
    } else if (sortBy === 'cashier') {
      orderBy.user = { username: sortOrder }
    } else if (sortBy === 'location') {
      orderBy.location = { name: sortOrder }
    } else if (sortBy === 'totalAmount' || sortBy === 'createdAt') {
      orderBy[sortBy] = sortOrder
    } else {
      orderBy.createdAt = sortOrder
    }

    // Get sales
    const sales: any[] = await prisma.sale.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            taxNumber: true,
            address: true,
          },
        },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            unitCost: true,
            productId: true,
            productVariationId: true,
          },
        },
        payments: {
          select: {
            paymentMethod: true,
            amount: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    })

    // Get location, user, and product info separately for better type safety
    const locationIds = [...new Set(sales.map((s: any) => s.locationId))]
    const userIds = [...new Set(sales.map((s: any) => s.createdBy))]
    const productIds = [...new Set(sales.flatMap((s: any) => s.items.map((i: any) => i.productId)))]

    const locations = await prisma.businessLocation.findMany({
      where: { id: { in: locationIds } },
      select: { id: true, name: true },
    })

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true, firstName: true, lastName: true },
    })

    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    })

    const locationMap = new Map(locations.map(l => [l.id, l]))
    const userMap = new Map(users.map(u => [u.id, u]))
    const productMap = new Map(products.map(p => [p.id, p]))

    // Calculate summary with BIR-compliant breakdown
    const summary = await prisma.sale.aggregate({
      where,
      _sum: {
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
        subtotal: true,
      },
      _count: true,
    })

    // Calculate VAT breakdown for BIR compliance
    const vatExemptSales = await prisma.sale.aggregate({
      where: { ...where, vatExempt: true },
      _sum: {
        totalAmount: true,
      },
    })

    // Get business info for BIR header
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        taxNumber1: true,
        taxLabel1: true,
        taxNumber2: true,
        taxLabel2: true,
      },
    })

    // Get beginning and ending invoice numbers
    const firstSale = await prisma.sale.findFirst({
      where,
      orderBy: { invoiceNumber: 'asc' },
      select: { invoiceNumber: true },
    })

    const lastSale = await prisma.sale.findFirst({
      where,
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    })

    // Format response with BIR-compliant fields
    const formattedSales = sales.map((sale: any) => {
      // Calculate VAT breakdown (Philippine BIR standard: 12% VAT)
      const grossSales = Number(sale.totalAmount)
      const taxAmount = Number(sale.taxAmount)
      const discountAmount = Number(sale.discountAmount)
      const subtotalAmount = Number(sale.subtotal)

      // BIR calculation: If VAT-inclusive, VATable Sales = Gross / 1.12, VAT = VATable * 0.12
      let vatableSales = 0
      let vatAmount = 0
      let vatExemptAmount = 0
      let vatZeroRated = 0

      if (sale.vatExempt) {
        // VAT Exempt transaction (e.g., senior citizen, PWD)
        vatExemptAmount = grossSales
      } else if (taxAmount > 0) {
        // Sale has explicit tax amount recorded
        vatableSales = subtotalAmount // Subtotal is already without VAT
        vatAmount = taxAmount
      } else if (grossSales > 0) {
        // VAT-inclusive transaction (standard Philippine BIR calculation)
        // Gross Sales includes 12% VAT, so we need to extract it
        vatableSales = grossSales / 1.12 // VATable amount (sales before VAT)
        vatAmount = vatableSales * 0.12  // 12% VAT
      } else {
        // Zero-rated or non-VAT
        vatZeroRated = grossSales
      }

      // Get user and location from maps
      const user = userMap.get(sale.createdBy)
      const location = locationMap.get(sale.locationId)

      // Get primary payment method (first payment or 'CASH')
      const primaryPayment = sale.payments.length > 0 ? sale.payments[0].paymentMethod : 'CASH'

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        date: sale.saleDate || sale.createdAt,
        createdAt: sale.createdAt,
        cashier: user
          ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username
          : 'N/A',
        cashierId: user?.id,
        location: location?.name || 'N/A',
        locationId: location?.id,
        customer: sale.customer?.name || 'Walk-in Customer',
        customerId: sale.customer?.id,
        customerTIN: sale.customer?.taxNumber || '',
        customerAddress: sale.customer?.address || '',
        customerContact: sale.customer?.mobile || '',
        paymentMethod: primaryPayment,
        items: sale.items.length,
        // BIR-compliant amounts
        grossSales: grossSales,
        vatExemptSales: vatExemptAmount,
        vatZeroRatedSales: vatZeroRated,
        vatableSales: vatableSales,
        vatAmount: vatAmount,
        discount: discountAmount,
        totalAmount: grossSales,
        // Discount tracking for BIR
        discountType: sale.discountType || null,
        seniorCitizenId: sale.seniorCitizenId || null,
        seniorCitizenName: sale.seniorCitizenName || null,
        pwdId: sale.pwdId || null,
        pwdName: sale.pwdName || null,
        // Status
        status: sale.status,
        vatExempt: sale.vatExempt,
        // Item details
        itemDetails: sale.items.map((item: any) => {
          const product = productMap.get(item.productId)
          return {
            product: product?.name || 'N/A',
            sku: product?.sku || '',
            quantity: Number(item.quantity),
            price: Number(item.unitPrice),
            subtotal: Number(item.quantity) * Number(item.unitPrice),
          }
        }),
      }
    })

    // Calculate BIR-compliant summary totals
    const totalGrossSales = formattedSales.reduce((sum, sale) => sum + sale.grossSales, 0)
    const totalVatExempt = formattedSales.reduce((sum, sale) => sum + sale.vatExemptSales, 0)
    const totalVatZeroRated = formattedSales.reduce((sum, sale) => sum + sale.vatZeroRatedSales, 0)
    const totalVatableSales = formattedSales.reduce((sum, sale) => sum + sale.vatableSales, 0)
    const totalVatAmount = formattedSales.reduce((sum, sale) => sum + sale.vatAmount, 0)
    const totalDiscount = formattedSales.reduce((sum, sale) => sum + sale.discount, 0)

    // Count special discount types
    const seniorCitizenDiscounts = formattedSales.filter(s => s.discountType === 'senior').length
    const pwdDiscounts = formattedSales.filter(s => s.discountType === 'pwd').length
    const seniorPwdDiscountAmount = formattedSales
      .filter(s => s.discountType === 'senior' || s.discountType === 'pwd')
      .reduce((sum, sale) => sum + sale.discount, 0)

    // Generate accounting journal entries for each sale
    const journalEntries: any[] = []

    formattedSales.forEach((sale) => {
      const saleDate = sale.date
      const invoiceNumber = sale.invoiceNumber
      const customer = sale.customer
      const totalAmount = sale.totalAmount
      const vatAmount = sale.vatAmount
      const netAmount = totalAmount - vatAmount

      // Determine if it's cash or credit sale based on payment method
      const isCashSale = sale.paymentMethod?.toLowerCase().includes('cash')

      // Entry 1: Debit - Cash or Accounts Receivable
      journalEntries.push({
        date: saleDate,
        invoiceNumber: invoiceNumber,
        customer: customer,
        account: isCashSale ? 'Cash' : 'Accounts Receivable',
        debit: totalAmount,
        credit: 0,
      })

      // Entry 2: Credit - Sales Revenue (net of VAT)
      journalEntries.push({
        date: saleDate,
        invoiceNumber: invoiceNumber,
        customer: customer,
        account: 'Sales Revenue',
        debit: 0,
        credit: netAmount,
      })

      // Entry 3: Credit - VAT Payable (if applicable)
      if (vatAmount > 0) {
        journalEntries.push({
          date: saleDate,
          invoiceNumber: invoiceNumber,
          customer: customer,
          account: 'VAT Payable',
          debit: 0,
          credit: vatAmount,
        })
      }
    })

    return NextResponse.json({
      journal: journalEntries,
      sales: formattedSales,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        // Basic totals
        totalSales: summary._count,
        totalAmount: Number(summary._sum.totalAmount || 0),
        totalTax: Number(summary._sum.taxAmount || 0),
        totalDiscount: Number(summary._sum.discountAmount || 0),
        netSales: Number(summary._sum.totalAmount || 0) - Number(summary._sum.taxAmount || 0),
        // BIR-compliant breakdown
        totalGrossSales: totalGrossSales,
        totalVatExemptSales: totalVatExempt,
        totalVatZeroRatedSales: totalVatZeroRated,
        totalVatableSales: totalVatableSales,
        totalVatAmount: totalVatAmount,
        totalDiscountAmount: totalDiscount,
        // Special discounts
        seniorCitizenDiscounts: seniorCitizenDiscounts,
        pwdDiscounts: pwdDiscounts,
        seniorPwdDiscountAmount: seniorPwdDiscountAmount,
      },
      birInfo: {
        businessName: business?.name || '',
        businessTIN: business?.taxNumber1 || '',
        tinLabel: business?.taxLabel1 || 'TIN',
        startInvoice: firstSale?.invoiceNumber || '',
        endInvoice: lastSale?.invoiceNumber || '',
      },
    })
  } catch (error) {
    console.error('Sales Journal Report Error:', error)
    return NextResponse.json(
      { error: 'Failed to generate sales journal report' },
      { status: 500 }
    )
  }
}
