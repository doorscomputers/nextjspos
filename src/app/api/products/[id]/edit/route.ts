import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'

/**
 * Lightweight GET endpoint for product editing
 * Only fetches essential data needed for the edit form
 * Does NOT fetch stock transactions, calculations, or heavy aggregations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    const { id } = await params

    console.log(`⚡ Fast product fetch for edit - Product ID: ${id}`)

    // Fetch ONLY what's needed for editing (no stock transactions!)
    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            parentId: true
          }
        },
        brand: {
          select: {
            id: true,
            name: true
          }
        },
        unit: {
          select: {
            id: true,
            name: true,
            shortName: true
          }
        },
        tax: {
          select: {
            id: true,
            name: true,
            amount: true
          }
        },
        variations: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            purchasePrice: true,
            sellingPrice: true,
            isDefault: true,
            subSku: true,
            unitId: true
          }
        },
        comboProducts: {
          include: {
            childProduct: {
              select: {
                id: true,
                name: true,
                sku: true
              }
            }
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    console.log(`✅ Fast fetch complete - Product: ${product.name}`)

    return NextResponse.json({ product })
  } catch (error) {
    console.error('❌ Error fetching product for edit:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}
