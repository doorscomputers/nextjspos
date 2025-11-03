import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { format } from 'date-fns'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const groupBy = searchParams.get('groupBy') || 'supplier' // supplier, product, reason, date

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Build where clause for purchase returns
    const whereClause: any = {
      businessId,
      returnDate: {
        gte: new Date(startDate + 'T00:00:00'),
        lte: new Date(endDate + 'T23:59:59.999')
      }
    }

    // Get all purchase returns in date range
    const returns = await prisma.purchaseReturn.findMany({
      where: whereClause,
      include: {
        purchaseReceipt: {
          include: {
            purchase: {
              select: {
                id: true,
                purchaseOrderNumber: true,
                supplierId: true
              }
            }
          }
        },
        supplier: {
          select: {
            id: true,
            name: true
          }
        },
        items: true
      },
      orderBy: {
        returnDate: 'desc'
      }
    })

    // Get product and variation IDs
    const productIds = new Set<number>()
    const variationIds = new Set<number>()

    returns.forEach(ret => {
      ret.items.forEach(item => {
        productIds.add(item.productId)
        variationIds.add(item.productVariationId)
      })
    })

    // Fetch products and variations
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(productIds) } },
      select: { id: true, name: true, sku: true }
    })

    const variations = await prisma.productVariation.findMany({
      where: { id: { in: Array.from(variationIds) } },
      select: { id: true, name: true, sku: true }
    })

    const productMap = new Map(products.map(p => [p.id, p]))
    const variationMap = new Map(variations.map(v => [v.id, v]))

    // Calculate summary statistics
    const totalReturns = returns.length
    let totalQuantityReturned = 0
    let totalReturnAmount = 0

    const reasonCounts = new Map<string, { count: number; amount: number }>()

    returns.forEach(ret => {
      ret.items.forEach(item => {
        const quantity = parseFloat(item.quantityReturned.toString())
        const unitCost = parseFloat(item.unitCost.toString())
        const itemTotal = quantity * unitCost

        totalQuantityReturned += quantity
        totalReturnAmount += itemTotal

        // Track by reason
        const reason = ret.returnReason || 'not_specified'
        const current = reasonCounts.get(reason) || { count: 0, amount: 0 }
        reasonCounts.set(reason, {
          count: current.count + 1,
          amount: current.amount + itemTotal
        })
      })
    })

    // Group data based on groupBy parameter
    const groupedData: any[] = []

    if (groupBy === 'supplier') {
      const supplierMap = new Map<number, {
        supplierId: number
        supplierName: string
        returnCount: number
        totalQuantity: number
        totalAmount: number
      }>()

      returns.forEach(ret => {
        const supplierId = ret.supplierId
        const supplierName = ret.supplier.name

        if (!supplierMap.has(supplierId)) {
          supplierMap.set(supplierId, {
            supplierId,
            supplierName,
            returnCount: 0,
            totalQuantity: 0,
            totalAmount: 0
          })
        }

        const supplier = supplierMap.get(supplierId)!
        supplier.returnCount += 1

        ret.items.forEach(item => {
          const quantity = parseFloat(item.quantityReturned.toString())
          const unitCost = parseFloat(item.unitCost.toString())
          supplier.totalQuantity += quantity
          supplier.totalAmount += quantity * unitCost
        })
      })

      groupedData.push(...Array.from(supplierMap.values()))
    } else if (groupBy === 'product') {
      const productMapData = new Map<number, {
        productId: number
        productName: string
        returnCount: number
        totalQuantity: number
        totalAmount: number
      }>()

      returns.forEach(ret => {
        ret.items.forEach(item => {
          const product = productMap.get(item.productId)
          if (!product) return

          if (!productMapData.has(item.productId)) {
            productMapData.set(item.productId, {
              productId: item.productId,
              productName: product.name,
              returnCount: 0,
              totalQuantity: 0,
              totalAmount: 0
            })
          }

          const prodData = productMapData.get(item.productId)!
          prodData.returnCount += 1

          const quantity = parseFloat(item.quantityReturned.toString())
          const unitCost = parseFloat(item.unitCost.toString())
          prodData.totalQuantity += quantity
          prodData.totalAmount += quantity * unitCost
        })
      })

      groupedData.push(...Array.from(productMapData.values()))
    } else if (groupBy === 'reason') {
      reasonCounts.forEach((data, reason) => {
        groupedData.push({
          reason,
          returnCount: data.count,
          totalAmount: data.amount
        })
      })
    } else if (groupBy === 'date') {
      const dateMap = new Map<string, {
        month: string
        returnCount: number
        totalQuantity: number
        totalAmount: number
      }>()

      returns.forEach(ret => {
        const month = format(new Date(ret.returnDate), 'yyyy-MM')

        if (!dateMap.has(month)) {
          dateMap.set(month, {
            month,
            returnCount: 0,
            totalQuantity: 0,
            totalAmount: 0
          })
        }

        const dateData = dateMap.get(month)!
        dateData.returnCount += 1

        ret.items.forEach(item => {
          const quantity = parseFloat(item.quantityReturned.toString())
          const unitCost = parseFloat(item.unitCost.toString())
          dateData.totalQuantity += quantity
          dateData.totalAmount += quantity * unitCost
        })
      })

      groupedData.push(...Array.from(dateMap.values()))
    }

    // Sort grouped data by total amount descending
    groupedData.sort((a, b) => b.totalAmount - a.totalAmount)

    // Top reasons
    const topReasons = Array.from(reasonCounts.entries())
      .map(([reason, data]) => ({
        reason,
        count: data.count,
        amount: data.amount,
        percentage: totalReturnAmount > 0 ? (data.amount / totalReturnAmount) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount)

    return NextResponse.json({
      data: {
        summary: {
          totalReturns,
          totalQuantityReturned,
          totalReturnAmount,
          averageReturnAmount: totalReturns > 0 ? totalReturnAmount / totalReturns : 0
        },
        topReasons,
        groupedData
      }
    })
  } catch (error) {
    console.error('Return analysis error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate return analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
