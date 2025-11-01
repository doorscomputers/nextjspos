import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { updateStock, StockTransactionType } from '@/lib/stockOperations'
import * as XLSX from 'xlsx'

interface InventoryCorrectionRow {
  productId: number
  variationId: number
  productName: string
  variation: string
  sku: string
  currentStock: number
  physicalCount: number
  difference: number
}

/**
 * POST /api/physical-inventory/import-safe
 * Import physical inventory count from Excel with ATOMIC TRANSACTION
 *
 * CRITICAL: Uses SINGLE TRANSACTION for entire import
 * - Either ALL products update successfully, OR
 * - NONE of them update (complete rollback)
 * - NO partial imports possible
 */
export async function POST(request: NextRequest) {
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
    if (!user.permissions?.includes(PERMISSIONS.PHYSICAL_INVENTORY_IMPORT)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const locationId = formData.get('locationId') as string
    const reason = formData.get('reason') as string || 'Physical inventory count'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    const locId = parseInt(locationId)

    // Check location access
    const accessibleLocationIds = getUserAccessibleLocationIds(user)
    if (accessibleLocationIds !== null && !accessibleLocationIds.includes(locId)) {
      return NextResponse.json(
        { error: 'You do not have access to this location' },
        { status: 403 }
      )
    }

    // Verify location exists
    const location = await prisma.businessLocation.findFirst({
      where: {
        id: locId,
        businessId: parseInt(businessId),
        deletedAt: null
      }
    })

    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Read Excel file
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    const data = XLSX.utils.sheet_to_json(worksheet, {
      range: 3, // Start reading from row 4
      header: 1
    }) as any[][]

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty or contains no data rows' }, { status: 400 })
    }

    // Fetch all product variations for this location
    const allVariations = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: locId
      },
      select: {
        product: {
          select: {
            id: { select: { id: { select: { id: true, name: true } }, name: { select: { id: true, name: true } } } },
            businessId: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } }
          }
        },
        productVariation: {
          select: {
            id: { select: { id: true, name: true } },
            productId: { select: { id: true, name: true } },
            sku: { select: { id: true, name: true } },
            name: { select: { id: true, name: true } }
          }
        }
      }
    })

    const businessVariations = allVariations.filter(v => v.product.businessId === parseInt(businessId))

    // Create lookup maps
    const productToVariationMap = new Map<number, number>()
    const productSkuToVariationMap = new Map<string, number>()
    const variationDetailsMap = new Map<number, any>()

    businessVariations.forEach(v => {
      productToVariationMap.set(v.productId, v.productVariation.id)
      if (v.productVariation.sku) {
        const key = `${v.productId}_${v.productVariation.sku}`
        productSkuToVariationMap.set(key, v.productVariation.id)
      }
      variationDetailsMap.set(v.productVariation.id, v)
    })

    // Validate and prepare corrections
    const corrections: InventoryCorrectionRow[] = []
    const errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 4

      if (!row[0]) {
        errors.push(`Row ${rowNumber}: Missing Product ID`)
        continue
      }

      const productId = parseInt(row[0])
      const productName = row[1] || ''
      const variation = row[2] || ''
      const sku = row[3] || ''
      const currentStock = parseFloat(row[4] || '0')
      const physicalCount = parseFloat(row[5] || '0')

      if (row[5] === '' || row[5] === null || row[5] === undefined) {
        continue
      }

      if (physicalCount === currentStock) {
        continue
      }

      // Lookup variation ID
      let variationId: number | undefined

      if (sku) {
        const key = `${productId}_${sku}`
        variationId = productSkuToVariationMap.get(key)
      }

      if (!variationId) {
        variationId = productToVariationMap.get(productId)
      }

      if (!variationId) {
        errors.push(`Row ${rowNumber}: Could not find variation for Product ID ${productId}${sku ? ` with SKU ${sku}` : ''}`)
        continue
      }

      corrections.push({
        productId,
        variationId,
        productName,
        variation,
        sku,
        currentStock,
        physicalCount,
        difference: physicalCount - currentStock
      })
    }

    if (errors.length > 0) {
      return NextResponse.json({
        error: 'Validation errors found',
        details: errors
      }, { status: 400 })
    }

    if (corrections.length === 0) {
      return NextResponse.json({
        message: 'No corrections to process',
        details: 'All physical counts match current stock or are empty'
      }, { status: 200 })
    }

    console.log(`Starting ATOMIC import of ${corrections.length} inventory corrections...`)

    // CRITICAL: SINGLE TRANSACTION FOR ENTIRE IMPORT
    // Either ALL succeed or NONE succeed
    const result = await prisma.$transaction(async (tx) => {
      const createdCorrections = []
      const userId = parseInt(user.id.toString())
      const bizId = parseInt(businessId)

      for (const correction of corrections) {
        // 1. Create inventory correction record
        const inventoryCorrection = await tx.inventoryCorrection.create({
          data: {
            businessId: bizId,
            locationId: locId,
            productId: correction.productId,
            productVariationId: correction.variationId,
            systemCount: correction.currentStock,
            physicalCount: correction.physicalCount,
            difference: correction.difference,
            reason,
            remarks: `Bulk import via physical inventory count - ${file.name}`,
            createdBy: userId,
            createdByName: user.username,
            status: 'approved',
            approvedBy: userId,
            approvedAt: new Date()
          }
        })

        // 2. Get current inventory to capture old quantity for audit
        const inventory = await tx.variationLocationDetails.findFirst({
          where: {
            productVariationId: correction.variationId,
            locationId: locId
          }
        })

        if (!inventory) {
          throw new Error(`Inventory record not found for ${correction.productName} (Row will be rolled back)`)
        }

        const currentQty = parseFloat(inventory.qtyAvailable.toString())

        // 3. Update inventory using centralized helper with row locks and product_history
        const stockTransaction = await updateStock(
          correction.variationId,
          locId,
          correction.difference,
          {
            type: StockTransactionType.ADJUSTMENT,
            referenceType: 'inventory_correction',
            referenceId: inventoryCorrection.id,
            notes: `Physical inventory count: ${reason} - File: ${file.name}`,
            createdBy: userId,
            businessId: bizId,
            displayName: user.username,
          },
          tx
        )

        // 4. Link stock transaction to correction record
        await tx.inventoryCorrection.update({
          where: { id: inventoryCorrection.id },
          data: { stockTransactionId: stockTransaction.id }
        })

        createdCorrections.push({
          correction: inventoryCorrection,
          stockTransaction,
          oldQty: currentQty,
          newQty: correction.physicalCount,
          productName: correction.productName,
          variation: correction.variation
        })
      }

      console.log(`✅ Transaction completed successfully: ${createdCorrections.length} products updated atomically`)

      return createdCorrections
    }, {
      timeout: 120000, // 2 minutes for large imports
      maxWait: 120000, // Maximum wait time for transaction to start
    })

    console.log(`✅ All ${result.length} inventory updates committed to database`)

    // Create audit logs (non-blocking, after transaction commits)
    result.forEach((item) => {
      createAuditLog({
        businessId: parseInt(businessId),
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'physical_inventory_import' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: [item.correction.productId],
        description: `Physical inventory count imported: ${item.productName} (${item.variation}) at ${location.name}. Stock updated from ${item.oldQty} to ${item.newQty} (${item.correction.difference >= 0 ? '+' : ''}${item.correction.difference})`,
        metadata: {
          correctionId: item.correction.id,
          stockTransactionId: item.stockTransaction.id,
          locationId: locId,
          locationName: location.name,
          productId: item.correction.productId,
          productName: item.productName,
          variationName: item.variation,
          systemCount: parseFloat(item.correction.systemCount.toString()),
          physicalCount: parseFloat(item.correction.physicalCount.toString()),
          difference: parseFloat(item.correction.difference.toString()),
          fileName: file.name,
          reason,
          beforeQty: item.oldQty,
          afterQty: item.newQty,
          autoApproved: { select: { id: true, name: true } },
          atomicImport: { select: { id: true, name: true } }
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      }).catch(err => console.error(`Audit log failed:`, err))
    })

    const createdCorrections = result.map(r => ({
      id: r.correction.id,
      productId: r.correction.productId,
      variationId: r.correction.productVariationId,
      productName: r.productName,
      variation: r.variation,
      systemCount: parseFloat(r.correction.systemCount.toString()),
      physicalCount: parseFloat(r.correction.physicalCount.toString()),
      difference: parseFloat(r.correction.difference.toString()),
      status: r.correction.status,
      oldQty: r.oldQty,
      newQty: r.newQty,
      updated: { select: { id: true, name: true } }
    }))

    return NextResponse.json({
      message: `✅ Physical inventory imported ATOMICALLY! All ${result.length} products updated successfully.`,
      summary: {
        totalRows: data.length,
        productsUpdated: result.length,
        skipped: data.length - corrections.length,
        failed: 0,
        validationErrors: 0,
        atomicTransaction: { select: { id: true, name: true } },
        allOrNothing: { select: { id: true, name: true } }
      },
      corrections: createdCorrections
    }, { status: 201 })
  } catch (error: any) {
    console.error('❌ Physical inventory import FAILED - ALL changes rolled back:', error)
    return NextResponse.json({
      error: 'Failed to import physical inventory - NO CHANGES MADE (transaction rolled back)',
      details: error.message,
      note: 'All inventory updates were rolled back to ensure data consistency'
    }, { status: 500 })
  }
}
