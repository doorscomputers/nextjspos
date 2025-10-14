import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const variationId = parseInt(params.id)
    const body = await request.json()
    const { supplierId } = body

    if (!supplierId) {
      return NextResponse.json(
        { error: 'Supplier ID is required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(session.user.businessId)

    // Verify the variation belongs to this business
    const variation = await prisma.productVariation.findFirst({
      where: {
        id: variationId,
        businessId,
      },
    })

    if (!variation) {
      return NextResponse.json(
        { error: 'Product variation not found' },
        { status: 404 }
      )
    }

    // Verify the supplier belongs to this business
    const supplier = await prisma.supplier.findFirst({
      where: {
        id: parseInt(supplierId),
        businessId,
      },
    })

    if (!supplier) {
      return NextResponse.json(
        { error: 'Supplier not found' },
        { status: 404 }
      )
    }

    // Update the variation with the supplier
    const updatedVariation = await prisma.productVariation.update({
      where: { id: variationId },
      data: {
        supplierId: parseInt(supplierId),
      },
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        variationId: updatedVariation.id,
        supplierId: updatedVariation.supplierId,
        supplierName: updatedVariation.supplier?.name,
      },
    })
  } catch (error) {
    console.error('Assign supplier error:', error)
    return NextResponse.json(
      {
        error: 'Failed to assign supplier',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
