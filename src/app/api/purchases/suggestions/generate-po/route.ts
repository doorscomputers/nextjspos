import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { suggestions, locationId, expectedDeliveryDays } = body

    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json(
        { error: 'No suggestions selected' },
        { status: 400 }
      )
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)
    const userId = parseInt(session.user.id)

    // Fetch all selected variations with their details
    const variations = await prisma.productVariation.findMany({
      where: {
        id: { in: suggestions },
        product: { businessId },
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            leadTimeDays: true,
            reorderQuantity: true,
          },
        },
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (variations.length === 0) {
      return NextResponse.json(
        { error: 'No valid products found' },
        { status: 404 }
      )
    }

    // Group variations by supplier
    const supplierGroups = new Map<number, typeof variations>()

    for (const variation of variations) {
      const supplierId = variation.supplierId
      if (!supplierId) {
        // Skip products without suppliers
        continue
      }

      if (!supplierGroups.has(supplierId)) {
        supplierGroups.set(supplierId, [])
      }
      supplierGroups.get(supplierId)!.push(variation)
    }

    if (supplierGroups.size === 0) {
      return NextResponse.json(
        { error: 'No products have suppliers assigned' },
        { status: 400 }
      )
    }

    // Calculate delivery date
    const expectedDelivery = new Date()
    const deliveryDays = expectedDeliveryDays || 7
    expectedDelivery.setDate(expectedDelivery.getDate() + deliveryDays)

    const createdPurchaseOrders = []

    // Create a purchase order for each supplier
    for (const [supplierId, supplierVariations] of supplierGroups.entries()) {
      const supplier = supplierVariations[0].supplier
      if (!supplier) continue

      // Calculate total for this supplier
      let subtotal = 0
      const items = []

      for (const variation of supplierVariations) {
        // Get suggested order quantity from product reorderQuantity or calculate it
        const product = variation.product
        let quantity = product.reorderQuantity
          ? parseFloat(product.reorderQuantity.toString())
          : 100 // Default fallback

        const unitCost = parseFloat(variation.purchasePrice?.toString() || '0')
        const lineTotal = quantity * unitCost

        subtotal += lineTotal

        items.push({
          productVariationId: variation.id,
          productId: product.id,
          quantity,
          unitCost,
          lineTotal,
        })
      }

      // Generate reference number
      const refNumber = `PO-${Date.now()}-${supplierId}`

      // Create the purchase order
      const purchaseOrder = await prisma.purchase.create({
        data: {
          businessId,
          supplierId,
          locationId: parseInt(locationId),
          refNo: refNumber,
          status: 'draft',
          subtotal,
          totalAmount: subtotal,
          expectedDelivery,
          createdBy: userId,
          purchaseLines: {
            create: items,
          },
        },
        include: {
          supplier: {
            select: { name: true },
          },
          purchaseLines: true,
        },
      })

      createdPurchaseOrders.push({
        purchaseOrderId: purchaseOrder.id,
        refNo: purchaseOrder.refNo,
        supplierId,
        supplierName: supplier.name,
        totalAmount: subtotal,
        itemCount: items.length,
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        message: `Created ${createdPurchaseOrders.length} purchase order(s)`,
        purchaseOrders: createdPurchaseOrders,
      },
    })
  } catch (error) {
    console.error('Generate PO error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate purchase orders',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
