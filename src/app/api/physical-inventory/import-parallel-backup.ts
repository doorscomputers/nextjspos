import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS, getUserAccessibleLocationIds } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
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
 * POST /api/physical-inventory/import
 * Import physical inventory count from Excel and create bulk corrections
 * OPTIMIZED: Uses parallel processing for maximum speed
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

    // Skip first 3 rows (title, date, empty row) - data starts at row 4
    // The export template has: Row 1 = Title, Row 2 = Date, Row 3 = Empty, Row 4+ = Data (NO HEADERS)
    const data = XLSX.utils.sheet_to_json(worksheet, {
      range: 3, // Start reading from row 4 (0-indexed, so 3 = row 4)
      header: 1 // Use array format (no headers)
    }) as any[][]

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Excel file is empty or contains no data rows' }, { status: 400 })
    }

    // STEP 1: Fetch all product variations for this location upfront
    const allVariations = await prisma.variationLocationDetails.findMany({
      where: {
        locationId: locId
      },
      include: {
        product: {
          select: {
            id: true,
            businessId: true,
            sku: true
          }
        },
        productVariation: {
          select: {
            id: true,
            productId: true,
            sku: true
          }
        }
      }
    })

    // Filter by business and create lookup maps
    const businessVariations = allVariations.filter(v => v.product.businessId === parseInt(businessId))

    // Create lookup: productId -> variationId (for single products)
    const productToVariationMap = new Map<number, number>()
    // Create lookup: productId + SKU -> variationId (for variable products)
    const productSkuToVariationMap = new Map<string, number>()

    businessVariations.forEach(v => {
      productToVariationMap.set(v.productId, v.productVariation.id)
      if (v.productVariation.sku) {
        const key = `${v.productId}_${v.productVariation.sku}`
        productSkuToVariationMap.set(key, v.productVariation.id)
      }
    })

    // STEP 2: Validate and prepare corrections
    const corrections: InventoryCorrectionRow[] = []
    const errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const rowNumber = i + 4 // Excel row number (title + date + empty = 3 rows, then data starts at row 4)

      // Row format: [Product ID, Product Name, Variation, SKU, Current Stock, Physical Count]
      // Validate required fields
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

      // Skip if physical count is empty or same as current stock
      if (row[5] === '' || row[5] === null || row[5] === undefined) {
        continue
      }

      if (physicalCount === currentStock) {
        continue // No correction needed
      }

      // Lookup variation ID: Try SKU-based lookup first, then fall back to product-based
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

    if (corrections.length === 0 && errors.length > 0) {
      return NextResponse.json({
        error: 'No valid corrections to process',
        details: errors
      }, { status: 400 })
    }

    // All corrections are already validated (variation lookup was done above)
    const validCorrections = corrections

    // OPTIMIZATION: Process corrections in PARALLEL - Create AND auto-approve
    const correctionPromises = validCorrections.map(async (correction) => {
      try {
        // Use transaction to create correction AND update inventory in one atomic operation
        const result = await prisma.$transaction(async (tx) => {
          // 1. Create inventory correction record
          const inventoryCorrection = await tx.inventoryCorrection.create({
            data: {
              businessId: parseInt(businessId),
              locationId: locId,
              productId: correction.productId,
              productVariationId: correction.variationId,
              systemCount: correction.currentStock,
              physicalCount: correction.physicalCount,
              difference: correction.difference,
              reason,
              remarks: `Bulk import via physical inventory count - ${file.name}`,
              createdBy: parseInt(user.id.toString()),
              createdByName: user.username,
              status: 'approved', // Auto-approve physical inventory imports
              approvedBy: parseInt(user.id.toString()),
              approvedAt: new Date()
            }
          })

          // 2. Get current inventory
          const inventory = await tx.variationLocationDetails.findFirst({
            where: {
              productVariationId: correction.variationId,
              locationId: locId
            }
          })

          if (!inventory) {
            throw new Error(`Inventory record not found for ${correction.productName}`)
          }

          const currentQty = parseFloat(inventory.qtyAvailable.toString())

          // 3. Create stock transaction for audit trail
          const stockTransaction = await tx.stockTransaction.create({
            data: {
              businessId: parseInt(businessId),
              locationId: locId,
              productId: correction.productId,
              productVariationId: correction.variationId,
              type: 'adjustment',
              quantity: correction.difference,
              unitCost: parseFloat(inventory.purchasePrice?.toString() || '0'),
              balanceQty: correction.physicalCount,
              referenceType: 'inventory_correction',
              referenceId: inventoryCorrection.id,
              createdBy: parseInt(user.id.toString()),
              notes: `Physical inventory count: ${reason} - File: ${file.name}`
            }
          })

          // 4. Update inventory quantity - THE CRITICAL UPDATE
          await tx.variationLocationDetails.update({
            where: { id: inventory.id },
            data: { qtyAvailable: correction.physicalCount }
          })

          // 5. Link stock transaction to correction
          await tx.inventoryCorrection.update({
            where: { id: inventoryCorrection.id },
            data: { stockTransactionId: stockTransaction.id }
          })

          return {
            correction: inventoryCorrection,
            stockTransaction,
            oldQty: currentQty,
            newQty: correction.physicalCount
          }
        })

        // Audit logging OUTSIDE main flow for better performance (non-blocking)
        createAuditLog({
          businessId: parseInt(businessId),
          userId: parseInt(user.id.toString()),
          username: user.username,
          action: 'physical_inventory_import' as AuditAction,
          entityType: EntityType.PRODUCT,
          entityIds: [correction.productId],
          description: `Physical inventory count imported and applied: ${correction.productName} (${correction.variation}) at ${location.name}. Stock updated from ${result.oldQty} to ${result.newQty} (${correction.difference >= 0 ? '+' : ''}${correction.difference})`,
          metadata: {
            correctionId: result.correction.id,
            stockTransactionId: result.stockTransaction.id,
            locationId: locId,
            locationName: location.name,
            productId: correction.productId,
            productName: correction.productName,
            variationId: correction.variationId,
            variationName: correction.variation,
            sku: correction.sku,
            systemCount: correction.currentStock,
            physicalCount: correction.physicalCount,
            difference: correction.difference,
            fileName: file.name,
            reason,
            beforeQty: result.oldQty,
            afterQty: result.newQty,
            autoApproved: true
          },
          requiresPassword: false,
          passwordVerified: false,
          ipAddress: getIpAddress(request),
          userAgent: getUserAgent(request)
        }).catch(err => console.error(`Audit log failed for correction ${result.correction.id}:`, err))

        return {
          success: true,
          correction: result.correction,
          stockTransaction: result.stockTransaction,
          oldQty: result.oldQty,
          newQty: result.newQty
        }
      } catch (error: any) {
        console.error(`Error processing correction for product ${correction.productId}:`, error)
        return {
          success: false,
          error: error.message || 'Unknown error',
          productName: correction.productName
        }
      }
    })

    // Wait for ALL corrections to complete in parallel
    const results = await Promise.all(correctionPromises)

    // Categorize results
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)

    const createdCorrections = successful.map(r => ({
      id: r.correction!.id,
      productId: r.correction!.productId,
      variationId: r.correction!.productVariationId,
      systemCount: parseFloat(r.correction!.systemCount.toString()),
      physicalCount: parseFloat(r.correction!.physicalCount.toString()),
      difference: parseFloat(r.correction!.difference.toString()),
      status: r.correction!.status,
      oldQty: r.oldQty,
      newQty: r.newQty,
      updated: true
    }))

    return NextResponse.json({
      message: `Physical inventory imported and applied successfully! ${successful.length} products updated, ${failed.length} failed.`,
      summary: {
        totalRows: data.length,
        productsUpdated: successful.length,
        skipped: data.length - corrections.length,
        failed: failed.length,
        validationErrors: errors.length,
        errors: [...errors, ...failed.map(f => `${f.productName}: ${f.error}`)]
      },
      corrections: createdCorrections
    }, { status: 201 })
  } catch (error) {
    console.error('Error importing physical inventory:', error)
    return NextResponse.json({ error: 'Failed to import physical inventory' }, { status: 500 })
  }
}
