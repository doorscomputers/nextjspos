import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma.simple'
import { PERMISSIONS, hasPermission } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'
import { updateStock, StockTransactionType } from '@/lib/stockOperations'
import { withIdempotency } from '@/lib/idempotency'
import * as XLSX from 'xlsx'

// Increase body size limit for large Excel files (default is 4.5MB on Vercel)
export const maxDuration = 60 // Allow up to 60 seconds for large files

/**
 * Excel Format Expected:
 * | DATE | BRANCH | ITEM CODE | ITEM NAME | ACTUAL COUNT |
 *
 * - BRANCH: Location name (must match exactly, case-insensitive)
 * - ITEM CODE: SKU to identify the product/variation
 * - ITEM NAME: For reference only (not used for matching)
 * - ACTUAL COUNT: The physical count (new inventory value)
 */

interface ExcelRow {
  rowNumber: number
  date: string
  branchName: string
  itemCode: string
  itemName: string
  actualCount: number
}

interface InvalidBranch {
  row: number
  providedName: string
  suggestion?: string
}

/**
 * Find closest matching location name using simple string similarity
 */
function findClosestMatch(input: string, candidates: string[]): string | undefined {
  const inputLower = input.toLowerCase().trim()

  // First try to find partial match
  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase().trim()
    if (candidateLower.includes(inputLower) || inputLower.includes(candidateLower)) {
      return candidate
    }
  }

  // Then try to find match with common typos (simple Levenshtein-like check)
  let bestMatch: string | undefined
  let bestScore = 0

  for (const candidate of candidates) {
    const candidateLower = candidate.toLowerCase().trim()
    let score = 0
    const minLen = Math.min(inputLower.length, candidateLower.length)

    for (let i = 0; i < minLen; i++) {
      if (inputLower[i] === candidateLower[i]) score++
    }

    const similarity = score / Math.max(inputLower.length, candidateLower.length)
    if (similarity > 0.5 && similarity > bestScore) {
      bestScore = similarity
      bestMatch = candidate
    }
  }

  return bestMatch
}

/**
 * POST /api/admin/physical-inventory-upload
 *
 * Admin upload for physical inventory with multi-location support.
 * Uses atomic transactions and idempotency for network resilience.
 *
 * Expected Excel columns: DATE, BRANCH, ITEM CODE, ITEM NAME, ACTUAL COUNT
 */
export async function POST(request: NextRequest) {
  return withIdempotency(request, 'admin-physical-inventory-upload', async () => {
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

      // Check permission (hasPermission also checks if user is Super Admin)
      if (!hasPermission(user, PERMISSIONS.ADMIN_PHYSICAL_INVENTORY_UPLOAD)) {
        return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
      }

      // Parse form data
      const formData = await request.formData()
      const file = formData.get('file') as File
      const previewOnly = formData.get('preview') === 'true'

      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
      }

      // Read Excel file
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)
      const workbook = XLSX.read(buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]

      // Parse as JSON with headers
      const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[]

      if (!rawData || rawData.length === 0) {
        return NextResponse.json({ error: 'Excel file is empty or contains no data rows' }, { status: 400 })
      }

      console.log(`[Admin Physical Inventory] Processing ${rawData.length} rows from ${file.name}`)

      // Log found columns for debugging
      if (rawData.length > 0) {
        const foundColumns = Object.keys(rawData[0])
        console.log(`[Admin Physical Inventory] Found columns: ${foundColumns.join(', ')}`)
      }

      // ===== STEP 1: Parse Excel rows =====
      const excelRows: ExcelRow[] = []
      const parseErrors: string[] = []

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i]
        const rowNumber = i + 2 // Excel row number (1-based, plus header)

        // Get column values (support many common column name variations)
        const date = row['DATE'] || row['Date'] || row['date'] || ''

        // Branch/Location variations
        const branchName = String(
          row['BRANCH'] || row['Branch'] || row['branch'] ||
          row['LOCATION'] || row['Location'] || row['location'] ||
          row['STORE'] || row['Store'] || row['store'] ||
          row['WAREHOUSE'] || row['Warehouse'] || row['warehouse'] || ''
        ).trim()

        // Item Code/SKU variations
        const itemCode = String(
          row['ITEM CODE'] || row['Item Code'] || row['item code'] || row['ITEM_CODE'] || row['ItemCode'] ||
          row['SKU'] || row['Sku'] || row['sku'] ||
          row['PRODUCT CODE'] || row['Product Code'] || row['product code'] ||
          row['CODE'] || row['Code'] || row['code'] ||
          row['BARCODE'] || row['Barcode'] || row['barcode'] || ''
        ).trim()

        // Item Name/Description variations
        const itemName = String(
          row['ITEM NAME'] || row['Item Name'] || row['item name'] || row['ITEM_NAME'] || row['ItemName'] ||
          row['PRODUCT'] || row['Product'] || row['product'] ||
          row['PRODUCT NAME'] || row['Product Name'] || row['product name'] ||
          row['DESCRIPTION'] || row['Description'] || row['description'] ||
          row['NAME'] || row['Name'] || row['name'] || ''
        ).trim()

        // Actual Count/Quantity variations
        const actualCountRaw =
          row['ACTUAL COUNT'] || row['Actual Count'] || row['actual count'] || row['ACTUAL_COUNT'] || row['ActualCount'] ||
          row['PHYSICAL COUNT'] || row['Physical Count'] || row['physical count'] ||
          row['COUNT'] || row['Count'] || row['count'] ||
          row['QTY'] || row['Qty'] || row['qty'] ||
          row['QUANTITY'] || row['Quantity'] || row['quantity'] ||
          row['PHYSICAL QTY'] || row['Physical Qty'] || row['physical qty'] ||
          row['STOCK'] || row['Stock'] || row['stock']

        // Validate required fields
        if (!branchName) {
          parseErrors.push(`Row ${rowNumber}: Missing BRANCH`)
          continue
        }
        if (!itemCode) {
          parseErrors.push(`Row ${rowNumber}: Missing ITEM CODE`)
          continue
        }
        if (actualCountRaw === '' || actualCountRaw === null || actualCountRaw === undefined) {
          // Skip rows with empty actual count (no action needed)
          continue
        }

        const actualCount = parseFloat(String(actualCountRaw))
        if (isNaN(actualCount) || actualCount < 0) {
          parseErrors.push(`Row ${rowNumber}: Invalid ACTUAL COUNT value "${actualCountRaw}"`)
          continue
        }

        excelRows.push({
          rowNumber,
          date: String(date),
          branchName,
          itemCode,
          itemName,
          actualCount
        })
      }

      if (excelRows.length === 0) {
        const foundColumns = rawData.length > 0 ? Object.keys(rawData[0]) : []
        return NextResponse.json({
          error: 'No valid rows to process',
          details: parseErrors.length > 0 ? parseErrors : ['All rows have empty count column or are invalid'],
          hint: `Found columns in your file: ${foundColumns.join(', ')}`,
          expectedColumns: 'BRANCH (or LOCATION), ITEM CODE (or SKU), ACTUAL COUNT (or QTY/QUANTITY/COUNT)'
        }, { status: 400 })
      }

      // ===== STEP 2: Validate ALL branch names FIRST =====
      const validLocations = await prisma.businessLocation.findMany({
        where: {
          businessId,
          deletedAt: null
        },
        select: {
          id: true,
          name: true
        }
      })

      // Create case-insensitive map for lookup
      const locationMap = new Map<string, { id: number; name: string }>()
      for (const loc of validLocations) {
        locationMap.set(loc.name.toLowerCase().trim(), { id: loc.id, name: loc.name })
      }

      // Check ALL branch names before any updates
      const uniqueBranchNames = [...new Set(excelRows.map(r => r.branchName))]
      const invalidBranches: InvalidBranch[] = []

      for (const branchName of uniqueBranchNames) {
        const key = branchName.toLowerCase().trim()
        if (!locationMap.has(key)) {
          invalidBranches.push({
            row: excelRows.find(r => r.branchName === branchName)?.rowNumber || 0,
            providedName: branchName,
            suggestion: findClosestMatch(branchName, validLocations.map(l => l.name))
          })
        }
      }

      // If ANY branch name is invalid, REJECT entire upload
      if (invalidBranches.length > 0) {
        console.log(`[Admin Physical Inventory] REJECTED: ${invalidBranches.length} invalid branch names`)
        return NextResponse.json({
          success: false,
          error: 'Branch name validation failed',
          invalidBranches,
          validBranches: validLocations.map(l => l.name),
          message: 'The following branch names do not exist. Please correct them and re-upload. NO changes were made to inventory.'
        }, { status: 400 })
      }

      // ===== STEP 3: Lookup products by ITEM CODE (SKU) =====
      // Get all variations with their location details for this business
      const allVariations = await prisma.productVariation.findMany({
        where: {
          product: {
            businessId,
            deletedAt: null
          }
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              businessId: true
            }
          },
          variationLocationDetails: {
            select: {
              locationId: true,
              qtyAvailable: true
            }
          }
        }
      })

      // Create SKU lookup map (case-insensitive)
      const skuToVariationMap = new Map<string, typeof allVariations[0]>()
      for (const variation of allVariations) {
        // Use variation SKU first, then product SKU
        const sku = (variation.sku || variation.product.sku || '').toLowerCase().trim()
        if (sku) {
          skuToVariationMap.set(sku, variation)
        }
      }

      // ===== STEP 4: Validate all products exist =====
      const updateItems: Array<{
        rowNumber: number
        branchName: string
        locationId: number
        itemCode: string
        itemName: string
        productId: number
        productName: string
        variationId: number
        variationName: string
        currentStock: number
        actualCount: number
        difference: number
      }> = []
      // Items where counts match - create verification record only (no stock change)
      const verifiedItems: Array<{
        rowNumber: number
        branchName: string
        locationId: number
        itemCode: string
        itemName: string
        productId: number
        productName: string
        variationId: number
        variationName: string
        currentStock: number
      }> = []
      const productErrors: string[] = []

      for (const row of excelRows) {
        const location = locationMap.get(row.branchName.toLowerCase().trim())!
        const sku = row.itemCode.toLowerCase().trim()
        const variation = skuToVariationMap.get(sku)

        if (!variation) {
          productErrors.push(`Row ${row.rowNumber}: ITEM CODE "${row.itemCode}" not found`)
          continue
        }

        // Find current stock at this location
        const locationDetail = variation.variationLocationDetails.find(ld => ld.locationId === location.id)
        const currentStock = locationDetail ? parseFloat(locationDetail.qtyAvailable.toString()) : 0

        // If counts match, add to verified items (will create verification record)
        if (row.actualCount === currentStock) {
          verifiedItems.push({
            rowNumber: row.rowNumber,
            branchName: row.branchName,
            locationId: location.id,
            itemCode: row.itemCode,
            itemName: row.itemName,
            productId: variation.productId,
            productName: variation.product.name,
            variationId: variation.id,
            variationName: variation.name || 'Default',
            currentStock
          })
          continue
        }

        updateItems.push({
          rowNumber: row.rowNumber,
          branchName: row.branchName,
          locationId: location.id,
          itemCode: row.itemCode,
          itemName: row.itemName,
          productId: variation.productId,
          productName: variation.product.name,
          variationId: variation.id,
          variationName: variation.name || 'Default',
          currentStock,
          actualCount: row.actualCount,
          difference: row.actualCount - currentStock
        })
      }

      // If there are product errors, reject the entire upload
      if (productErrors.length > 0) {
        console.log(`[Admin Physical Inventory] REJECTED: ${productErrors.length} product lookup errors`)
        return NextResponse.json({
          success: false,
          error: 'Product validation failed',
          productErrors,
          message: 'Some ITEM CODES were not found. Please verify the SKU codes and re-upload. NO changes were made to inventory.'
        }, { status: 400 })
      }

      if (updateItems.length === 0 && verifiedItems.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No items to process',
          summary: {
            totalRows: rawData.length,
            itemsUpdated: 0,
            itemsVerified: 0
          }
        }, { status: 200 })
      }

      // ===== PREVIEW MODE - Return what would change without applying =====
      if (previewOnly) {
        const locationsAffected = [...new Set([
          ...updateItems.map(i => i.branchName),
          ...verifiedItems.map(i => i.branchName)
        ])]

        const previewUpdates = updateItems.map(item => ({
          locationName: item.branchName,
          itemCode: item.itemCode,
          productId: item.productId,
          productName: item.productName,
          variationName: item.variationName,
          previousStock: item.currentStock,
          newStock: item.actualCount,
          difference: item.difference,
          type: 'update' as const
        }))

        const previewVerified = verifiedItems.map(item => ({
          locationName: item.branchName,
          itemCode: item.itemCode,
          productId: item.productId,
          productName: item.productName,
          variationName: item.variationName,
          verifiedStock: item.currentStock,
          type: 'verified' as const
        }))

        return NextResponse.json({
          success: true,
          preview: true,
          message: `Preview: ${updateItems.length} items will be updated, ${verifiedItems.length} items verified (no changes made yet)`,
          summary: {
            totalRows: rawData.length,
            itemsToUpdate: updateItems.length,
            itemsVerified: verifiedItems.length,
            locationsAffected,
            hasDiscrepancies: updateItems.length > 0
          },
          previewUpdates,
          previewVerified
        }, { status: 200 })
      }

      console.log(`[Admin Physical Inventory] Starting ATOMIC processing: ${updateItems.length} updates, ${verifiedItems.length} verifications...`)

      // ===== STEP 5: ATOMIC TRANSACTION - Update all inventory =====
      const result = await prisma.$transaction(async (tx) => {
        const updatedResults: Array<{
          correctionId: number
          stockTransactionId: number
          locationName: string
          productId: number
          productName: string
          variationName: string
          itemCode: string
          previousStock: number
          newStock: number
          difference: number
          type: 'updated'
        }> = []
        const verifiedResults: Array<{
          correctionId: number
          locationName: string
          productId: number
          productName: string
          variationName: string
          itemCode: string
          verifiedStock: number
          type: 'verified'
        }> = []
        const userId = parseInt(user.id.toString())

        // Process items with discrepancies (update stock)
        for (const item of updateItems) {
          // 1. Create inventory correction record
          const correction = await tx.inventoryCorrection.create({
            data: {
              businessId,
              locationId: item.locationId,
              productId: item.productId,
              productVariationId: item.variationId,
              systemCount: item.currentStock,
              physicalCount: item.actualCount,
              difference: item.difference,
              reason: 'Admin Physical Inventory Upload',
              remarks: `Admin upload from ${file.name} - Row ${item.rowNumber}`,
              createdBy: userId,
              createdByName: user.username,
              status: 'approved',
              approvedBy: userId,
              approvedAt: new Date()
            }
          })

          // 2. Update stock using centralized helper (creates ProductHistory automatically)
          const stockResult = await updateStock({
            businessId,
            productId: item.productId,
            productVariationId: item.variationId,
            locationId: item.locationId,
            quantity: item.difference,
            type: StockTransactionType.ADJUSTMENT,
            referenceType: 'admin_physical_inventory',
            referenceId: correction.id,
            userId,
            userDisplayName: user.username,
            notes: `Admin Physical Inventory: Set to ${item.actualCount} (was ${item.currentStock}) - File: ${file.name}`,
            allowNegative: true, // Physical count may be lower than system stock
            tx
          })

          // 3. Link stock transaction to correction
          await tx.inventoryCorrection.update({
            where: { id: correction.id },
            data: { stockTransactionId: stockResult.transaction.id }
          })

          updatedResults.push({
            correctionId: correction.id,
            stockTransactionId: stockResult.transaction.id,
            locationName: item.branchName,
            productId: item.productId,
            productName: item.productName,
            variationName: item.variationName,
            itemCode: item.itemCode,
            previousStock: item.currentStock,
            newStock: item.actualCount,
            difference: item.difference,
            type: 'updated'
          })
        }

        // For items where counts match, just track them (no database records needed for performance)
        // These items don't need InventoryCorrection records since there's no change
        for (const item of verifiedItems) {
          verifiedResults.push({
            correctionId: null, // No correction record created for verified items
            locationName: item.branchName,
            productId: item.productId,
            productName: item.productName,
            variationName: item.variationName,
            itemCode: item.itemCode,
            verifiedStock: item.currentStock,
            type: 'verified'
          })
        }

        return { updatedResults, verifiedResults }
      }, {
        timeout: 120000, // 2 minutes for large uploads
        maxWait: 120000
      })

      console.log(`[Admin Physical Inventory] SUCCESS: ${result.updatedResults.length} items updated, ${result.verifiedResults.length} items verified`)

      // ===== STEP 6: Create audit logs (non-blocking) =====
      const allResults = [...result.updatedResults, ...result.verifiedResults]
      const locationsAffected = [...new Set(allResults.map(r => r.locationName))]

      createAuditLog({
        businessId,
        userId: parseInt(user.id.toString()),
        username: user.username,
        action: 'admin_physical_inventory_upload' as AuditAction,
        entityType: EntityType.PRODUCT,
        entityIds: allResults.map(r => r.productId),
        description: `Admin Physical Inventory Upload: ${result.updatedResults.length} items updated, ${result.verifiedResults.length} items verified across ${locationsAffected.length} location(s). File: ${file.name}`,
        metadata: {
          fileName: file.name,
          totalRows: rawData.length,
          itemsUpdated: result.updatedResults.length,
          itemsVerified: result.verifiedResults.length,
          locationsAffected,
          atomicTransaction: true,
          sampleUpdates: result.updatedResults.slice(0, 5).map(r => ({
            product: r.productName,
            location: r.locationName,
            from: r.previousStock,
            to: r.newStock
          }))
        },
        ipAddress: getIpAddress(request),
        userAgent: getUserAgent(request)
      }).catch(err => console.error(`[Admin Physical Inventory] Audit log failed:`, err))

      // ===== STEP 7: Return success response =====
      return NextResponse.json({
        success: true,
        message: `Physical inventory uploaded successfully! ${result.updatedResults.length} items updated, ${result.verifiedResults.length} items verified.`,
        summary: {
          totalRows: rawData.length,
          itemsUpdated: result.updatedResults.length,
          itemsVerified: result.verifiedResults.length,
          locationsAffected,
          atomicTransaction: true
        },
        updatedDetails: result.updatedResults,
        verifiedDetails: result.verifiedResults
      }, { status: 201 })

    } catch (error: any) {
      console.error('[Admin Physical Inventory] FAILED - ALL changes rolled back:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to update physical inventory - NO CHANGES MADE (transaction rolled back)',
        details: error.message,
        note: 'All inventory updates were rolled back to ensure data consistency. Please try again.'
      }, { status: 500 })
    }
  })
}
