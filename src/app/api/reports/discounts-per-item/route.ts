import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId)

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const locationId = searchParams.get('locationId')

    // Build date filter
    const dateFilter: any = {}
    if (startDate) {
      dateFilter.gte = new Date(startDate)
    }
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      dateFilter.lte = end
    }

    // Build where clause for sales
    const where: any = {
      businessId,
      status: { not: 'voided' },
    }

    if (Object.keys(dateFilter).length > 0) {
      where.saleDate = dateFilter
    }

    if (locationId) {
      where.locationId = parseInt(locationId)
    }

    // Get all sale items with discounts
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: where,
        discountAmount: { gt: 0 },
      },
      select: {
        id: true,
        productId: true,
        productVariationId: true,
        quantity: true,
        unitPrice: true,
        discountAmount: true,
        serialNumbers: true,
        remark: true,
        sale: {
          select: {
            id: true,
            invoiceNumber: true,
            saleDate: true,
            location: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
        productVariation: {
          select: {
            id: true,
            name: true,
            sku: true,
          },
        },
      },
      orderBy: {
        discountAmount: 'desc',
      },
    })

    // Group by product
    const productDiscounts = new Map<number, {
      productId: number
      productName: string
      sku: string | null
      totalQuantity: number
      totalDiscount: number
      totalSalesValue: number
      transactionCount: number
      transactions: Array<{
        invoiceNumber: string
        saleDate: string
        locationName: string
        quantity: number
        unitPrice: number
        discountAmount: number
        totalPrice: number
        serialNumbers: string
        remarks: string
      }>
    }>()

    saleItems.forEach((item) => {
      const productId = item.productId
      const productName = item.product?.name || item.productVariation?.name || `Product #${productId}`
      const sku = item.product?.sku || item.productVariation?.sku || null

      if (!productDiscounts.has(productId)) {
        productDiscounts.set(productId, {
          productId,
          productName,
          sku,
          totalQuantity: 0,
          totalDiscount: 0,
          totalSalesValue: 0,
          transactionCount: 0,
          transactions: [],
        })
      }

      const data = productDiscounts.get(productId)!
      const qty = parseFloat(item.quantity?.toString() || '0')
      const price = parseFloat(item.unitPrice?.toString() || '0')
      const discount = parseFloat(item.discountAmount?.toString() || '0')
      const totalPrice = (qty * price) - discount

      data.totalQuantity += qty
      data.totalDiscount += discount
      data.totalSalesValue += totalPrice + discount // Original value before discount
      data.transactionCount++

      // Parse serial numbers from JSON array
      let serialNumbersStr = ''
      if (item.serialNumbers) {
        try {
          const serialArr = Array.isArray(item.serialNumbers) ? item.serialNumbers : JSON.parse(String(item.serialNumbers))
          if (Array.isArray(serialArr)) {
            // Handle both string arrays and object arrays (with serialNumber property)
            serialNumbersStr = serialArr.map((sn: any) => {
              if (typeof sn === 'string') return sn
              if (typeof sn === 'object' && sn !== null) {
                return sn.serialNumber || sn.serial_number || sn.number || sn.code || JSON.stringify(sn)
              }
              return String(sn)
            }).join(', ')
          }
        } catch {
          serialNumbersStr = ''
        }
      }

      data.transactions.push({
        invoiceNumber: item.sale.invoiceNumber,
        saleDate: item.sale.saleDate.toISOString(),
        locationName: item.sale.location?.name || 'N/A',
        quantity: qty,
        unitPrice: price,
        discountAmount: discount,
        totalPrice: totalPrice,
        serialNumbers: serialNumbersStr,
        remarks: item.remark || '',
      })
    })

    // Convert to array and sort by total discount descending
    const products = Array.from(productDiscounts.values())
      .map((p) => ({
        ...p,
        averageDiscountPerUnit: p.totalQuantity > 0 ? p.totalDiscount / p.totalQuantity : 0,
        discountPercentage: p.totalSalesValue > 0 ? (p.totalDiscount / p.totalSalesValue) * 100 : 0,
      }))
      .sort((a, b) => b.totalDiscount - a.totalDiscount)

    // Calculate summary
    const summary = {
      totalProducts: products.length,
      totalQuantityDiscounted: products.reduce((sum, p) => sum + p.totalQuantity, 0),
      totalDiscountAmount: products.reduce((sum, p) => sum + p.totalDiscount, 0),
      totalTransactions: products.reduce((sum, p) => sum + p.transactionCount, 0),
      averageDiscountPerTransaction: products.length > 0
        ? products.reduce((sum, p) => sum + p.totalDiscount, 0) / products.reduce((sum, p) => sum + p.transactionCount, 0)
        : 0,
    }

    return NextResponse.json({
      success: true,
      summary,
      products,
    })
  } catch (error) {
    console.error('Error fetching discounts per item report:', error)
    return NextResponse.json(
      { error: 'Failed to fetch report' },
      { status: 500 }
    )
  }
}
