import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

// POST /api/job-orders/[id]/parts - Add part to job order
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.REPAIR_JOB_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const jobOrderId = parseInt(params.id)
    const body = await request.json()
    const { productId, productVariationId, quantity, unitPrice, serialNumber, notes } = body

    // Validation
    if (!productId || !productVariationId || !quantity || !unitPrice) {
      return NextResponse.json(
        { error: 'Missing required fields: productId, productVariationId, quantity, unitPrice' },
        { status: 400 }
      )
    }

    // Verify job order belongs to user's business
    const jobOrder = await prisma.repairJobOrder.findFirst({
      where: {
        id: jobOrderId,
        businessId: parseInt(businessId)
      }
    })

    if (!jobOrder) {
      return NextResponse.json({ error: 'Job order not found' }, { status: 404 })
    }

    // Cannot add parts to completed job orders
    if (jobOrder.status === 'completed') {
      return NextResponse.json({
        error: 'Cannot add parts to completed job orders'
      }, { status: 400 })
    }

    // Verify product variation
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: parseInt(productVariationId),
        productId: parseInt(productId),
        deletedAt: null
      }
    })

    if (!variation) {
      return NextResponse.json({ error: 'Product variation not found' }, { status: 404 })
    }

    const qty = parseFloat(quantity)
    const price = parseFloat(unitPrice)
    const subtotal = qty * price

    // Add part and recalculate job order costs in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create part
      const part = await tx.repairJobOrderPart.create({
        data: {
          businessId: parseInt(businessId),
          jobOrderId,
          productId: parseInt(productId),
          productVariationId: parseInt(productVariationId),
          quantity: qty,
          unitPrice: price,
          subtotal,
          serialNumber,
          notes
        }
      })

      // Recalculate job order costs
      const parts = await tx.repairJobOrderPart.findMany({
        where: { jobOrderId }
      })

      const partsCost = parts.reduce((sum, p) => sum + Number(p.subtotal), 0)
      const laborCost = Number(jobOrder.laborCost)
      const taxAmount = jobOrder.taxRate ? ((laborCost + partsCost) * jobOrder.taxRate / 100) : Number(jobOrder.taxAmount)
      const totalCost = laborCost + partsCost + taxAmount

      // Update job order
      await tx.repairJobOrder.update({
        where: { id: jobOrderId },
        data: {
          partsCost,
          taxAmount,
          totalCost,
          updatedAt: new Date()
        }
      })

      return part
    })

    // Fetch part with product details
    const completePart = await prisma.repairJobOrderPart.findUnique({
      where: { id: result.id },
      select: {
        product: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } }
          }
        },
        productVariation: {
          select: {
            id: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } }
          }
        }
      }
    })

    // Serialize Decimal fields
    const serializedPart = {
      ...completePart,
      quantity: completePart ? Number(completePart.quantity) : 0,
      unitPrice: completePart ? Number(completePart.unitPrice) : 0,
      subtotal: completePart ? Number(completePart.subtotal) : 0
    }

    return NextResponse.json({
      part: serializedPart,
      message: 'Part added successfully'
    }, { status: 201 })
  } catch (error) {
    console.error('Error adding part to job order:', error)
    return NextResponse.json({ error: 'Failed to add part' }, { status: 500 })
  }
}
