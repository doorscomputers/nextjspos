import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { hasPermission, PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType } from '@/lib/auditLog'

/**
 * POST /api/purchases/generate-from-suggestions
 * Generate Purchase Orders from selected suggestions
 * Groups items by supplier and creates one PO per supplier
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any

    // Check permission
    if (!hasPermission(user, PERMISSIONS.PURCHASE_CREATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Missing purchase.create permission' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { suggestions, locationId } = body

    // Validate input
    if (!suggestions || !Array.isArray(suggestions) || suggestions.length === 0) {
      return NextResponse.json(
        { error: 'No suggestions provided' },
        { status: 400 }
      )
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      )
    }

    const businessId = parseInt(user.businessId)

    // Validate location belongs to business
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: parseInt(locationId),
        businessId,
      },
    })

    if (!location) {
      return NextResponse.json(
        { error: 'Invalid location' },
        { status: 400 }
      )
    }

    // Group suggestions by supplier
    const suggestionsBySupplier = new Map<number | null, typeof suggestions>()

    for (const suggestion of suggestions) {
      const supplierId = suggestion.supplierId

      if (!suggestionsBySupplier.has(supplierId)) {
        suggestionsBySupplier.set(supplierId, [])
      }

      suggestionsBySupplier.get(supplierId)!.push(suggestion)
    }

    // Create Purchase Orders (one per supplier)
    const createdPOs = []

    for (const [supplierId, items] of suggestionsBySupplier.entries()) {
      // Skip items without supplier - they need manual assignment
      if (!supplierId) {
        continue
      }

      // Verify supplier exists
      const supplier = await prisma.supplier.findFirst({
        where: {
          id: supplierId,
          businessId,
        },
      })

      if (!supplier) {
        console.warn(`Supplier ${supplierId} not found, skipping items`)
        continue
      }

      // Generate PO reference number
      const currentYear = new Date().getFullYear()
      const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0')

      const lastPO = await prisma.purchase.findFirst({
        where: {
          businessId,
          refNo: {
            startsWith: `PO-${currentYear}${currentMonth}`,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      })

      let refNo
      if (lastPO) {
        const lastNumber = parseInt(lastPO.refNo.split('-').pop() || '0')
        refNo = `PO-${currentYear}${currentMonth}-${String(lastNumber + 1).padStart(4, '0')}`
      } else {
        refNo = `PO-${currentYear}${currentMonth}-0001`
      }

      // Calculate total amount
      let totalAmount = 0
      const purchaseItems = []

      for (const item of items) {
        const itemTotal = item.unitCost * item.suggestedOrderQty
        totalAmount += itemTotal

        purchaseItems.push({
          productId: item.productId,
          productVariationId: item.variationId,
          quantity: item.suggestedOrderQty,
          unitPrice: item.unitCost,
          netUnitCost: item.unitCost,
          lineTotal: itemTotal,
          taxAmount: 0, // Can be configured later
        })
      }

      // Create Purchase Order in transaction
      const purchase = await prisma.$transaction(async (tx) => {
        // Create purchase
        const newPurchase = await tx.purchase.create({
          data: {
            businessId,
            locationId: parseInt(locationId),
            supplierId,
            refNo,
            purchaseDate: new Date(),
            status: 'draft', // Draft status for review
            totalBeforeTax: totalAmount,
            discountType: 'fixed',
            discountAmount: 0,
            taxAmount: 0,
            shippingCost: 0,
            additionalCost: 0,
            finalTotal: totalAmount,
            paymentStatus: 'pending',
            createdBy: parseInt(user.id),
            notes: `Auto-generated from Purchase Suggestions\nBased on sales velocity and reorder points`,
          },
        })

        // Create purchase items
        for (const item of purchaseItems) {
          await tx.purchaseItem.create({
            data: {
              purchaseId: newPurchase.id,
              productId: item.productId,
              productVariationId: item.productVariationId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              netUnitCost: item.netUnitCost,
              lineTotal: item.lineTotal,
              taxAmount: item.taxAmount,
            },
          })
        }

        return newPurchase
      })

      createdPOs.push({
        id: purchase.id,
        refNo: purchase.refNo,
        supplierId: supplier.id,
        supplierName: supplier.name,
        itemCount: items.length,
        totalAmount: purchase.finalTotal,
      })

      // Create audit log
      await createAuditLog({
        businessId,
        userId: parseInt(user.id),
        username: user.username,
        action: AuditAction.PURCHASE_CREATE,
        entityType: EntityType.PURCHASE,
        entityIds: [purchase.id],
        description: `Auto-generated Purchase Order ${refNo} from suggestions. Supplier: ${supplier.name}, Items: ${items.length}, Total: ₱${totalAmount.toFixed(2)}`,
        metadata: {
          purchaseId: purchase.id,
          refNo: purchase.refNo,
          supplierId: supplier.id,
          supplierName: supplier.name,
          itemCount: items.length,
          totalAmount,
          generatedFrom: 'suggestions',
        },
      })
    }

    // Handle items without suppliers
    const itemsWithoutSupplier = suggestionsBySupplier.get(null) || []

    return NextResponse.json({
      success: true,
      message: `Generated ${createdPOs.length} Purchase Order(s) successfully`,
      data: {
        purchaseOrders: createdPOs,
        itemsSkipped: itemsWithoutSupplier.length,
        skippedReason: itemsWithoutSupplier.length > 0
          ? 'Some items have no assigned supplier and were skipped'
          : null,
      },
    })
  } catch (error: any) {
    console.error('Error generating POs from suggestions:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate Purchase Orders',
        details: error.message,
      },
      { status: 500 }
    )
  }
}
