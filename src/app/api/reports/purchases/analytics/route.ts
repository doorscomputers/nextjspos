import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const user = session.user as any
    const businessId = parseInt(user.businessId as string)

    if (!Number.isInteger(businessId)) {
      return NextResponse.json(
        { error: 'Invalid business context' },
        { status: 400 }
      )
    }

    // Fetch all purchases within date range
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        purchaseDate: {
          gte: new Date(startDate + 'T00:00:00'),
          lte: new Date(endDate + 'T23:59:59.999')
        },
        status: {
          in: ['pending', 'ordered', 'received', 'completed']
        }
      },
      include: {
        supplier: true,
        items: {
          include: {
            productVariation: {
              include: {
                product: {
                  include: {
                    category: true
                  }
                }
              }
            }
          }
        }
      }
    })

    // Calculate summary statistics
    const totalPurchases = purchases.length
    const totalAmount = purchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const totalQuantity = purchases.reduce((sum, p) =>
      sum + p.items.reduce((itemSum, item) => itemSum + Number(item.quantity), 0), 0
    )

    const uniqueSuppliers = new Set(purchases.map(p => p.supplierId).filter(Boolean)).size
    const uniqueProducts = new Set(
      purchases.flatMap(p => p.items.map(item => item.productVariation?.productId)).filter(Boolean)
    ).size

    const avgOrderValue = totalPurchases > 0 ? totalAmount / totalPurchases : 0
    const avgItemsPerOrder = totalPurchases > 0 ? totalQuantity / totalPurchases : 0

    // Calculate period growth (compare with previous period of same length)
    const periodDays = Math.ceil((new Date(endDate + 'T23:59:59.999').getTime() - new Date(startDate + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24))
    const prevStartDate = new Date(startDate + 'T00:00:00')
    prevStartDate.setDate(prevStartDate.getDate() - periodDays)
    const prevEndDate = new Date(startDate + 'T00:00:00')
    prevEndDate.setHours(23, 59, 59, 999)

    const prevPurchases = await prisma.purchase.findMany({
      where: {
        businessId,
        purchaseDate: {
          gte: prevStartDate,
          lte: prevEndDate
        }
      }
    })

    const prevTotalAmount = prevPurchases.reduce((sum, p) => sum + Number(p.totalAmount), 0)
    const periodGrowth = prevTotalAmount > 0
      ? ((totalAmount - prevTotalAmount) / prevTotalAmount) * 100
      : 0

    // Monthly trends
    const monthlyData: Record<string, { totalAmount: number; orderCount: number }> = {}

    purchases.forEach(purchase => {
      const monthKey = new Date(purchase.purchaseDate).toISOString().substring(0, 7) // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { totalAmount: 0, orderCount: 0 }
      }
      monthlyData[monthKey].totalAmount += Number(purchase.totalAmount)
      monthlyData[monthKey].orderCount += 1
    })

    const monthlyTrends = Object.entries(monthlyData)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        totalAmount: data.totalAmount,
        orderCount: data.orderCount,
        avgOrderValue: data.orderCount > 0 ? data.totalAmount / data.orderCount : 0
      }))

    // Top suppliers
    const supplierStats: Record<number, { name: string; totalAmount: number; orderCount: number }> = {}

    purchases.forEach(purchase => {
      if (purchase.supplierId) {
        if (!supplierStats[purchase.supplierId]) {
          supplierStats[purchase.supplierId] = {
            name: purchase.supplier?.name || 'Unknown',
            totalAmount: 0,
            orderCount: 0
          }
        }
        supplierStats[purchase.supplierId].totalAmount += Number(purchase.totalAmount)
        supplierStats[purchase.supplierId].orderCount += 1
      }
    })

    const topSuppliers = Object.entries(supplierStats)
      .map(([id, data]) => ({
        supplierId: parseInt(id),
        supplierName: data.name,
        totalAmount: data.totalAmount,
        orderCount: data.orderCount,
        percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10)

    // Category breakdown
    const categoryStats: Record<string, { totalAmount: number; quantity: number }> = {}

    purchases.forEach(purchase => {
      purchase.items.forEach(item => {
        const category = item.productVariation?.product?.category?.name || 'Uncategorized'
        if (!categoryStats[category]) {
          categoryStats[category] = { totalAmount: 0, quantity: 0 }
        }
        categoryStats[category].totalAmount += Number(item.quantity) * Number(item.unitCost)
        categoryStats[category].quantity += Number(item.quantity)
      })
    })

    const categoryBreakdown = Object.entries(categoryStats)
      .map(([category, data]) => ({
        category,
        totalAmount: data.totalAmount,
        quantity: data.quantity,
        percentage: totalAmount > 0 ? (data.totalAmount / totalAmount) * 100 : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

    // Top products
    const productStats: Record<number, {
      name: string
      sku: string
      category: string
      totalQuantity: number
      totalAmount: number
      orderCount: number
    }> = {}

    purchases.forEach(purchase => {
      purchase.items.forEach(item => {
        const productId = item.productVariation?.productId
        if (productId) {
          if (!productStats[productId]) {
            productStats[productId] = {
              name: item.productVariation?.product?.name || 'Unknown',
              sku: item.productVariation?.sku || item.productVariation?.product?.sku || 'N/A',
              category: item.productVariation?.product?.category?.name || 'Uncategorized',
              totalQuantity: 0,
              totalAmount: 0,
              orderCount: 0
            }
          }
          productStats[productId].totalQuantity += Number(item.quantity)
          productStats[productId].totalAmount += Number(item.quantity) * Number(item.unitCost)
          productStats[productId].orderCount += 1
        }
      })
    })

    const topProducts = Object.entries(productStats)
      .map(([id, data]) => ({
        productId: parseInt(id),
        productName: data.name,
        productSku: data.sku,
        category: data.category,
        totalQuantity: data.totalQuantity,
        totalAmount: data.totalAmount,
        orderCount: data.orderCount,
        avgUnitCost: data.totalQuantity > 0 ? data.totalAmount / data.totalQuantity : 0
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 20)

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          totalPurchases,
          totalAmount,
          totalQuantity,
          uniqueSuppliers,
          uniqueProducts,
          avgOrderValue,
          avgItemsPerOrder,
          periodGrowth
        },
        monthlyTrends,
        topSuppliers,
        categoryBreakdown,
        topProducts
      }
    })
  } catch (error) {
    console.error('Error generating purchase analytics:', error)
    return NextResponse.json(
      { error: 'Failed to generate analytics' },
      { status: 500 }
    )
  }
}
