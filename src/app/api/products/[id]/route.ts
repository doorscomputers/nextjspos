import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS } from '@/lib/rbac'
import { generateProductSKU, generateVariationSKU, isSkuEmpty } from '@/lib/sku-generator'
import { sendTelegramProductEditAlert } from '@/lib/telegram'
import { detectFieldChanges, formatChangesDescription, getCriticalFields } from '@/lib/auditFieldChanges'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { refreshStockView } from '@/lib/refreshStockView'

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

    const product = await prisma.product.findFirst({
      where: {
        id: parseInt(id),
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        category: true,
        brand: true,
        unit: true,
        tax: true,
        variations: {
          where: { deletedAt: null },
          include: {
            variationLocationDetails: {
              include: {
                lastPriceUpdatedByUser: {
                  select: {
                    id: true,
                    username: true,
                    firstName: true,
                    lastName: true
                  }
                }
              }
            }
          }
        },
        comboProducts: {
          include: {
            childProduct: true
          }
        }
      }
    })

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    // Fetch stock transactions to calculate sold, transferred, and adjusted quantities
    const stockTransactions = await prisma.stockTransaction.groupBy({
      by: ['locationId', 'productVariationId', 'type'],
      where: {
        productId: parseInt(id),
        businessId: parseInt(businessId)
      },
      _sum: {
        quantity: true
      }
    })

    // Get all active locations for this business
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: parseInt(businessId),
        deletedAt: null,
        isActive: true
      },
      select: {
        id: true,
        name: true
      }
    })

    // Get business name for print header
    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) },
      select: { name: true }
    })

    // Organize stock data by variation and location
    const stockDetails: any[] = []

    for (const variation of product.variations) {
      for (const locationDetail of variation.variationLocationDetails) {
        const location = locations.find(l => l.id === locationDetail.locationId)

        // Only include stock details for active locations
        if (!location) {
          continue // Skip if location is not active (not found in active locations list)
        }

        // Calculate aggregated values from stock transactions
        const transactionsForLocation = stockTransactions.filter(
          st => st.locationId === locationDetail.locationId &&
                st.productVariationId === variation.id
        )

        const soldQty = transactionsForLocation
          .filter(st => st.type === 'sale')
          .reduce((sum, st) => sum + (parseFloat(st._sum.quantity?.toString() || '0') * -1), 0)

        const transferredQty = transactionsForLocation
          .filter(st => st.type === 'transfer_in' || st.type === 'transfer_out')
          .reduce((sum, st) => sum + Math.abs(parseFloat(st._sum.quantity?.toString() || '0')), 0)

        const adjustedQty = transactionsForLocation
          .filter(st => st.type === 'adjustment')
          .reduce((sum, st) => sum + Math.abs(parseFloat(st._sum.quantity?.toString() || '0')), 0)

        const currentStock = parseFloat(locationDetail.qtyAvailable.toString())
        const unitPrice = parseFloat((locationDetail.sellingPrice || variation.sellingPrice).toString())
        const stockValue = currentStock * unitPrice

        stockDetails.push({
          sku: variation.sku,
          productName: variation.name,
          locationId: locationDetail.locationId,
          locationName: location.name,
          unitPrice,
          currentStock,
          stockValue,
          totalUnitSold: soldQty,
          totalUnitTransferred: transferredQty,
          totalUnitAdjusted: adjustedQty
        })
      }
    }

    return NextResponse.json({
      product,
      stockDetails,
      locations,
      businessName: business?.name || 'Business'
    })
  } catch (error) {
    console.error('Error fetching product:', error)
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 })
  }
}

// PUT - Update product
export async function PUT(
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
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    // Verify product belongs to user's business
    const existingProduct = await prisma.product.findFirst({
      where: {
        id: productId,
        businessId: parseInt(businessId),
        deletedAt: null
      },
      include: {
        variations: {
          where: { deletedAt: null }
        },
        comboProducts: true
      }
    })

    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      name,
      type,
      categoryId,
      subCategoryId,
      brandId,
      unitId,
      subUnitIds,
      taxId,
      taxType,
      sku,
      barcodeType,
      description,
      productDescription,
      image,
      brochure,
      enableStock,
      alertQuantity,
      purchasePrice,
      sellingPrice,
      marginPercentage,
      weight,
      preparationTime,
      enableProductInfo,
      notForSelling,
      isActive,
      variations,
      variationSkuType,
      comboItems
    } = body

    // DEBUG: Log category and sub-unit values
    console.log('=== Product Update Debug ===')
    console.log('categoryId:', categoryId, 'type:', typeof categoryId)
    console.log('subCategoryId:', subCategoryId, 'type:', typeof subCategoryId)
    console.log('subUnitIds:', subUnitIds, 'type:', typeof subUnitIds, 'isArray:', Array.isArray(subUnitIds))
    if (subUnitIds) {
      console.log('subUnitIds content:', JSON.stringify(subUnitIds))
    }
    console.log('============================')


    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
    }

    // CRITICAL: Prevent product type changes to preserve data integrity
    if (type && type !== existingProduct.type) {
      return NextResponse.json({
        error: 'Product type cannot be changed after creation. Changing type would corrupt inventory records, stock history, and transaction data. To use a different type, mark this product as inactive and create a new product.'
      }, { status: 400 })
    }

    // Validate pricing for single products
    if (type === 'single') {
      const cost = purchasePrice ? parseFloat(purchasePrice) : 0
      const price = sellingPrice ? parseFloat(sellingPrice) : 0

      if (cost <= 0) {
        return NextResponse.json({ error: 'Purchase price (cost) must be greater than zero' }, { status: 400 })
      }

      if (price <= 0) {
        return NextResponse.json({ error: 'Selling price must be greater than zero' }, { status: 400 })
      }

      if (price < cost) {
        return NextResponse.json({ error: 'Selling price cannot be lower than purchase price (cost)' }, { status: 400 })
      }
    }

    // Validate pricing for variable products
    if (type === 'variable' && variations && Array.isArray(variations)) {
      for (let i = 0; i < variations.length; i++) {
        const variation = variations[i]
        const cost = variation.purchasePrice ? parseFloat(variation.purchasePrice) : 0
        const price = variation.sellingPrice ? parseFloat(variation.sellingPrice) : 0

        if (cost <= 0) {
          return NextResponse.json({
            error: `Variation "${variation.name || i + 1}": Purchase price must be greater than zero`
          }, { status: 400 })
        }

        if (price <= 0) {
          return NextResponse.json({
            error: `Variation "${variation.name || i + 1}": Selling price must be greater than zero`
          }, { status: 400 })
        }

        if (price < cost) {
          return NextResponse.json({
            error: `Variation "${variation.name || i + 1}": Selling price cannot be lower than purchase price`
          }, { status: 400 })
        }
      }
    }

    // Check SKU uniqueness if changed
    if (sku && !isSkuEmpty(sku) && sku !== existingProduct.sku) {
      const duplicateSku = await prisma.product.findFirst({
        where: {
          businessId: parseInt(businessId),
          sku,
          deletedAt: null,
          id: { not: productId }
        }
      })

      if (duplicateSku) {
        return NextResponse.json({ error: 'SKU already exists' }, { status: 400 })
      }
    }

    // Fetch business settings for SKU generation
    const business = await prisma.business.findUnique({
      where: { id: parseInt(businessId) },
      select: { skuPrefix: true, skuFormat: true }
    })

    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Use transaction for data integrity
    const result = await prisma.$transaction(async (tx) => {
      // Determine final SKU
      let finalSku = sku && !isSkuEmpty(sku) ? sku : existingProduct.sku

      // If SKU is being cleared, generate new one
      if (isSkuEmpty(sku) && isSkuEmpty(existingProduct.sku)) {
        finalSku = generateProductSKU({
          prefix: business.skuPrefix || 'PROD',
          format: (business.skuFormat as 'hyphen' | 'no_hyphen') || 'hyphen',
          productId: productId
        }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })
      }

      // Prepare subUnitIds for database
      const subUnitIdsForDb = subUnitIds && Array.isArray(subUnitIds) && subUnitIds.length > 0
        ? JSON.stringify(subUnitIds)
        : null

      console.log('💾 Saving subUnitIds to DB:', subUnitIdsForDb)

      // Update main product
      const updatedProduct = await tx.product.update({
        where: { id: productId },
        data: {
          name,
          type: type || 'single',
          categoryId: subCategoryId ? parseInt(subCategoryId) : (categoryId ? parseInt(categoryId) : null),
          brandId: brandId ? parseInt(brandId) : null,
          unitId: unitId ? parseInt(unitId) : null,
          subUnitIds: subUnitIdsForDb,
          taxId: taxId ? parseInt(taxId) : null,
          taxType,
          sku: finalSku,
          barcodeType,
          description,
          productDescription,
          image,
          brochure,
          enableStock: enableStock !== false,
          alertQuantity: alertQuantity ? parseFloat(alertQuantity) : null,
          purchasePrice: purchasePrice ? parseFloat(purchasePrice) : null,
          sellingPrice: sellingPrice ? parseFloat(sellingPrice) : null,
          marginPercentage: marginPercentage ? parseFloat(marginPercentage) : null,
          weight: weight ? parseFloat(weight) : null,
          preparationTime: preparationTime ? parseInt(preparationTime) : null,
          enableProductInfo: enableProductInfo || false,
          notForSelling: notForSelling || false,
          isActive: isActive !== undefined ? isActive : true,
        }
      })

      console.log('✅ Product updated. subUnitIds in DB:', updatedProduct.subUnitIds)

      // Handle variations for variable products
      if (type === 'variable' && variations && Array.isArray(variations)) {
        // Get existing variation IDs
        const existingVariationIds = existingProduct.variations.map(v => v.id)
        const incomingVariationIds = variations.filter(v => v.id).map(v => parseInt(v.id))

        // Delete removed variations (soft delete)
        const toDelete = existingVariationIds.filter(id => !incomingVariationIds.includes(id))
        if (toDelete.length > 0) {
          // SAFEGUARD: Check if any variations have stock before soft-deleting
          const variationsWithStock = await tx.productHistory.findMany({
            where: {
              variationId: { in: toDelete },
              transactionType: { notIn: ['DELETED', 'VARIATION_DELETED'] }
            },
            select: { variationId: true },
            distinct: ['variationId']
          })

          const variationIdsWithStock = variationsWithStock.map(v => v.variationId)
          const canDelete = toDelete.filter(id => !variationIdsWithStock.includes(id))
          const cannotDelete = toDelete.filter(id => variationIdsWithStock.includes(id))

          if (cannotDelete.length > 0) {
            const variationNames = existingProduct.variations
              .filter(v => cannotDelete.includes(v.id))
              .map(v => v.name)
              .join(', ')

            console.warn(`[Product Edit] ⚠️ Cannot soft-delete variations with stock history: ${variationNames}`)
            throw new Error(
              `Cannot delete variations that have stock transactions: ${variationNames}. ` +
              `Please use the inventory adjustment feature to zero out stock first.`
            )
          }

          if (canDelete.length > 0) {
            const deletingVariations = existingProduct.variations
              .filter(v => canDelete.includes(v.id))
              .map(v => `${v.name} (ID: ${v.id})`)
              .join(', ')

            console.log(`[Product Edit] 🗑️ Soft-deleting ${canDelete.length} variation(s): ${deletingVariations}`)

            await tx.productVariation.updateMany({
              where: { id: { in: canDelete } },
              data: { deletedAt: new Date() }
            })
          }
        }

        // Update or create variations
        let counter = 1
        for (const variation of variations) {
          // Auto-generate variation SKU if empty
          let variationSku = variation.sku
          if (isSkuEmpty(variation.sku)) {
            variationSku = generateVariationSKU({
              productSku: finalSku,
              variationType: variationSkuType || 'with_out_variation',
              counter: variationSkuType === 'with_variation' ? undefined : counter,
              variationValue: variationSkuType === 'with_variation' ? variation.name : undefined
            })
          }

          const variationData = {
            name: variation.name,
            sku: variationSku,
            purchasePrice: parseFloat(variation.purchasePrice),
            sellingPrice: parseFloat(variation.sellingPrice),
            isDefault: variation.isDefault || false,
            subSku: variation.subSku,
            unitId: variation.unitId ? parseInt(variation.unitId) : null,
          }

          if (variation.id) {
            // Update existing variation
            await tx.productVariation.update({
              where: { id: parseInt(variation.id) },
              data: variationData
            })
          } else {
            // Create new variation - businessId is required for denormalization
            await tx.productVariation.create({
              data: {
                ...variationData,
                businessId: parseInt(businessId),
                product: {
                  connect: { id: productId }
                }
              }
            })
          }

          counter++
        }
      }
      // NOTE: Removed the "soft delete all variations if type !== variable" block
      // Single products NEED their default variation for stock tracking
      // Since type changes are blocked (line 250-255), this code was incorrectly
      // soft-deleting variations on every single/combo product edit

      // Handle combo items for combo products
      if (type === 'combo' && comboItems && Array.isArray(comboItems)) {
        // Delete all existing combo items
        await tx.comboProduct.deleteMany({
          where: { parentProductId: productId }
        })

        // Create new combo items
        for (const item of comboItems) {
          await tx.comboProduct.create({
            data: {
              parentProductId: productId,
              childProductId: parseInt(item.productId),
              quantity: parseFloat(item.quantity)
            }
          })
        }
      } else if (type !== 'combo') {
        // If changing from combo to single/variable, delete all combo items
        await tx.comboProduct.deleteMany({
          where: { parentProductId: productId }
        })
      }

      return updatedProduct
    })

    // Track changes and send Telegram notification
    const changes: Array<{ field: string; oldValue: string; newValue: string }> = []

    // Track name changes
    if (existingProduct.name !== name) {
      changes.push({
        field: 'Name',
        oldValue: existingProduct.name,
        newValue: name,
      })
    }

    // Track SKU changes
    const finalSku = result.sku
    if (existingProduct.sku !== finalSku) {
      changes.push({
        field: 'SKU',
        oldValue: existingProduct.sku || 'N/A',
        newValue: finalSku,
      })
    }

    // Track purchase price changes
    if (purchasePrice && existingProduct.purchasePrice) {
      const oldPrice = parseFloat(existingProduct.purchasePrice.toString())
      const newPrice = parseFloat(purchasePrice)
      if (oldPrice !== newPrice) {
        changes.push({
          field: 'Purchase Price',
          oldValue: `₱${oldPrice.toFixed(2)}`,
          newValue: `₱${newPrice.toFixed(2)}`,
        })
      }
    }

    // Track selling price changes
    if (sellingPrice && existingProduct.sellingPrice) {
      const oldPrice = parseFloat(existingProduct.sellingPrice.toString())
      const newPrice = parseFloat(sellingPrice)
      if (oldPrice !== newPrice) {
        changes.push({
          field: 'Selling Price',
          oldValue: `₱${oldPrice.toFixed(2)}`,
          newValue: `₱${newPrice.toFixed(2)}`,
        })
      }
    }

    // Track category changes
    if (categoryId || subCategoryId) {
      const newCategoryId = subCategoryId ? parseInt(subCategoryId) : (categoryId ? parseInt(categoryId) : null)
      if (existingProduct.categoryId !== newCategoryId) {
        changes.push({
          field: 'Category',
          oldValue: existingProduct.categoryId ? `ID: ${existingProduct.categoryId}` : 'None',
          newValue: newCategoryId ? `ID: ${newCategoryId}` : 'None',
        })
      }
    }

    // Track brand changes
    if (brandId !== undefined) {
      const newBrandId = brandId ? parseInt(brandId) : null
      if (existingProduct.brandId !== newBrandId) {
        changes.push({
          field: 'Brand',
          oldValue: existingProduct.brandId ? `ID: ${existingProduct.brandId}` : 'None',
          newValue: newBrandId ? `ID: ${newBrandId}` : 'None',
        })
      }
    }

    // Send Telegram notification if any changes were made
    if (changes.length > 0) {
      try {
        await sendTelegramProductEditAlert({
          productName: name,
          sku: finalSku,
          changedBy: `${user.firstName} ${user.lastName || ''}`.trim() || user.username,
          timestamp: new Date(),
          changes,
        })
      } catch (error) {
        console.error('Failed to send Telegram product edit alert:', error)
        // Don't fail the request if Telegram notification fails
      }
    }

    // Field-level audit logging (async, non-blocking)
    setImmediate(async () => {
      try {
        // Prepare old and new data for comparison
        const oldData = {
          name: existingProduct.name,
          purchasePrice: existingProduct.purchasePrice,
          sellingPrice: existingProduct.sellingPrice,
          isActive: existingProduct.isActive,
          sku: existingProduct.sku,
          categoryId: existingProduct.categoryId,
          brandId: existingProduct.brandId,
          enableStock: existingProduct.enableStock,
          alertQuantity: existingProduct.alertQuantity,
          description: existingProduct.description
        }

        const newData = {
          name: result.name,
          purchasePrice: result.purchasePrice,
          sellingPrice: result.sellingPrice,
          isActive: result.isActive,
          sku: result.sku,
          categoryId: result.categoryId,
          brandId: result.brandId,
          enableStock: result.enableStock,
          alertQuantity: result.alertQuantity,
          description: result.description
        }

        // Detect field-level changes
        const fieldChanges = detectFieldChanges(oldData, newData, getCriticalFields('Product'))

        // Only create audit log if there are actual changes
        if (fieldChanges.length > 0) {
          await createAuditLog({
            businessId: parseInt(user.businessId),
            userId: parseInt(user.id),
            username: user.username,
            action: AuditAction.PRODUCT_UPDATE,
            entityType: EntityType.PRODUCT,
            entityIds: [result.id],
            description: `Updated product "${result.name}": ${formatChangesDescription(fieldChanges)}`,
            metadata: {
              changes: fieldChanges,
              oldValues: oldData,
              newValues: newData,
              changedFields: fieldChanges.map(c => c.field),
              changeCount: fieldChanges.length
            },
            ipAddress: getIpAddress(request),
            userAgent: getUserAgent(request)
          })

          console.log(`[AUDIT] Product update tracked: ${fieldChanges.length} field(s) changed for product ID ${result.id}`)
        }
      } catch (auditError) {
        console.error('Failed to create audit log for product update:', auditError)
        // Don't fail the request if audit logging fails
      }
    })

    // Auto-refresh materialized view if variations were soft-deleted or restored
    // This ensures the stock view reflects current product/variation state
    refreshStockView({ silent: true }).catch((error) => {
      console.error('[Product Update] Failed to refresh stock view:', error)
    })

    return NextResponse.json({ product: result, message: 'Product updated successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error updating product:', error)
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 })
  }
}

// DELETE - Soft delete product with validation
export async function DELETE(
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
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_DELETE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    const { id } = await params
    const productId = parseInt(id)

    // Use the deleteProduct utility which includes validation
    const { deleteProduct } = await import('@/lib/product-actions')
    const result = await deleteProduct(productId, parseInt(businessId))

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, errors: result.errors },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: result.message }, { status: 200 })
  } catch (error) {
    console.error('Error deleting product:', error)
    return NextResponse.json({ error: 'Failed to delete product' }, { status: 500 })
  }
}
