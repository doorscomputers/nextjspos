import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const varianceType = searchParams.get('varianceType') || 'all' // all, quantity, amount

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Get all purchases in date range with received/completed status
    const purchases = await prisma.purchase.findMany({
      where: {
        businessId,
        deletedAt: null,
        status: {
          in: ['received', 'completed']
        },
        purchaseDate: {
          gte: new Date(startDate + 'T00:00:00'),
          lte: new Date(endDate + 'T23:59:59.999')
        }
      },
      select: {
        supplier: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } }
          }
        },
        items: { select: { id: true, name: true } }
      }
    })

    // Calculate variance for each purchase
    const variances: any[] = []
    const totalPurchases = purchases.length
    let purchasesWithVariance = 0
    let totalQuantityVariance = 0
    let totalAmountVariance = 0
    let overReceivedCount = 0
    let underReceivedCount = 0
    let exactReceivedCount = 0
    let overPaidCount = 0
    let underPaidCount = 0
    let exactPaidCount = 0

    purchases.forEach(purchase => {
      let orderedQuantity = 0
      let receivedQuantity = 0
      let orderedAmount = 0
      let receivedAmount = 0

      purchase.items.forEach(item => {
        const ordered = parseFloat(item.quantity.toString())
        const received = parseFloat(item.quantityReceived.toString())
        const unitCost = parseFloat(item.unitCost.toString())

        orderedQuantity += ordered
        receivedQuantity += received
        orderedAmount += ordered * unitCost
        receivedAmount += received * unitCost
      })

      const quantityVariance = receivedQuantity - orderedQuantity
      const amountVariance = receivedAmount - orderedAmount

      // Track variance status
      if (quantityVariance > 0) {
        overReceivedCount++
      } else if (quantityVariance < 0) {
        underReceivedCount++
      } else {
        exactReceivedCount++
      }

      if (amountVariance > 0) {
        overPaidCount++
      } else if (amountVariance < 0) {
        underPaidCount++
      } else {
        exactPaidCount++
      }

      // Check if this purchase has variance based on filter
      let hasVariance = false

      if (varianceType === 'all') {
        hasVariance = quantityVariance !== 0 || amountVariance !== 0
      } else if (varianceType === 'quantity') {
        hasVariance = quantityVariance !== 0
      } else if (varianceType === 'amount') {
        hasVariance = amountVariance !== 0
      }

      if (hasVariance) {
        purchasesWithVariance++
        totalQuantityVariance += quantityVariance
        totalAmountVariance += amountVariance

        variances.push({
          purchaseId: purchase.id,
          purchaseOrderNumber: purchase.purchaseOrderNumber,
          purchaseDate: purchase.purchaseDate.toISOString().split('T')[0],
          supplierId: purchase.supplierId,
          supplierName: purchase.supplier.name,
          orderedQuantity,
          receivedQuantity,
          quantityVariance,
          orderedAmount,
          receivedAmount,
          amountVariance,
          variancePercentage: orderedAmount > 0
            ? (amountVariance / orderedAmount) * 100
            : 0
        })
      }
    })

    // Sort variances by absolute amount variance descending
    variances.sort((a, b) => Math.abs(b.amountVariance) - Math.abs(a.amountVariance))

    // Calculate summary statistics
    const summary = {
      totalPurchases,
      purchasesWithVariance,
      varianceRate: totalPurchases > 0
        ? (purchasesWithVariance / totalPurchases) * 100
        : 0,
      totalQuantityVariance,
      totalAmountVariance,
      overReceivedCount,
      underReceivedCount,
      exactReceivedCount,
      overPaidCount,
      underPaidCount,
      exactPaidCount
    }

    return NextResponse.json({
      data: {
        summary,
        variances
      }
    })
  } catch (error) {
    console.error('Purchase variance error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate purchase variance report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
