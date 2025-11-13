/**
 * ============================================================================
 * PRODUCTS API (src/app/api/products/route.ts)
 * ============================================================================
 *
 * PURPOSE: Handles product CRUD operations (Create and Read in this file)
 *
 * WHAT THIS FILE DOES:
 * 1. GET: Fetches list of products for user's business
 * 2. POST: Creates new products (single, variable, or combo types)
 *
 * BUSINESS LOGIC:
 * - Multi-tenant: Only shows products from user's business
 * - Field-level security: Hides sensitive data based on permissions
 * - Auto-generates SKUs if not provided
 * - Creates default variations for single products
 * - Initializes inventory at zero for all locations
 * - Validates pricing (selling price must >= purchase price)
 *
 * DATABASE TABLES AFFECTED:
 * - Product (main product data)
 * - ProductVariation (variations/SKUs)
 * - VariationLocationDetails (inventory by location)
 * - ComboProduct (for combo product items)
 *
 * RELATED FILES:
 * - src/app/api/products/[id]/route.ts (GET, PUT, DELETE single product)
 * - src/app/dashboard/products/page.tsx (products list page)
 * - src/app/dashboard/products/add/page.tsx (create product form)
 * - src/lib/sku-generator.ts (SKU generation logic)
 *
 * PERMISSIONS REQUIRED:
 * - GET: User must be authenticated (no specific permission, but field-level security applies)
 * - POST: PERMISSIONS.PRODUCT_CREATE
 */

// ============================================================================
// IMPORTS
// ============================================================================
import { NextRequest, NextResponse } from 'next/server' // Next.js types for API routes
import { getServerSession } from 'next-auth' // Get current user session
import { authOptions } from '@/lib/auth.simple' // NextAuth configuration
import { prisma } from '@/lib/prisma.simple' // Database client
import { PERMISSIONS } from '@/lib/rbac' // Permission constants
import { generateProductSKU, generateVariationSKU, isSkuEmpty } from '@/lib/sku-generator' // SKU utilities

// ============================================================================
// GET METHOD - Fetch Products List
// ============================================================================
/**
 * Retrieves all products for the user's business with filtering capabilities
 *
 * WHAT HAPPENS HERE:
 * 1. Validates user session (authentication)
 * 2. Checks user's business ID (multi-tenant isolation)
 * 3. Checks user's field-level permissions
 * 4. Parses query parameters for filtering
 * 5. Builds database query with filters
 * 6. Fetches products with related data (variations, categories, stock)
 * 7. Sanitizes response based on permissions
 * 8. Returns JSON response
 *
 * QUERY PARAMETERS SUPPORTED:
 * - active: Filter by active status (true/false)
 * - forTransaction: Only show active products for POS
 * - stockEnabled: Only show products with stock tracking
 * - search: Search in name/description
 * - sku: Filter by SKU
 * - categoryName, brandName, unitName: Filter by related entities
 * - stockMin, stockMax: Filter by stock quantity
 * - purchasePriceMin/Max, sellingPriceMin/Max: Filter by price ranges
 * - limit: Limit number of results
 *
 * RESPONSE FORMAT:
 * {
 *   products: [
 *     {
 *       id, name, sku, type, purchasePrice, sellingPrice,
 *       category: {...}, brand: {...}, unit: {...},
 *       variations: [{ id, name, sku, purchasePrice, sellingPrice, variationLocationDetails: [...] }]
 *     }
 *   ]
 * }
 *
 * FIELD-LEVEL SECURITY:
 * - purchasePrice: Hidden if user lacks PRODUCT_VIEW_PURCHASE_PRICE permission
 * - supplier info: Hidden if user lacks PRODUCT_VIEW_SUPPLIER permission
 */
export async function GET(request: NextRequest) {
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

    // Check permissions for field-level access
    const canViewSupplier = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW_SUPPLIER)
    const canViewPurchasePrice = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const activeFilter = searchParams.get('active') // 'true', 'false', or null (all)
    const forTransaction = searchParams.get('forTransaction') === 'true' // Only active products
    const stockEnabledOnly = searchParams.get('stockEnabled') === 'true' // Only products with stock tracking enabled

    // Parse limit parameter
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined

    // Multi-column filter parameters
    const search = searchParams.get('search')?.trim() || ''
    const sku = searchParams.get('sku')?.trim() || ''
    const categoryName = searchParams.get('categoryName')?.trim() || ''
    const brandName = searchParams.get('brandName')?.trim() || ''
    const unitName = searchParams.get('unitName')?.trim() || ''
    const productType = searchParams.get('productType')?.trim() || ''
    const stockMin = searchParams.get('stockMin') ? parseFloat(searchParams.get('stockMin')!) : undefined
    const stockMax = searchParams.get('stockMax') ? parseFloat(searchParams.get('stockMax')!) : undefined
    const purchasePriceMin = searchParams.get('purchasePriceMin') ? parseFloat(searchParams.get('purchasePriceMin')!) : undefined
    const purchasePriceMax = searchParams.get('purchasePriceMax') ? parseFloat(searchParams.get('purchasePriceMax')!) : undefined
    const sellingPriceMin = searchParams.get('sellingPriceMin') ? parseFloat(searchParams.get('sellingPriceMin')!) : undefined
    const sellingPriceMax = searchParams.get('sellingPriceMax') ? parseFloat(searchParams.get('sellingPriceMax')!) : undefined
    const taxName = searchParams.get('taxName')?.trim() || ''

    // Build where clause
    const whereClause: any = {
      businessId: parseInt(businessId),
      deletedAt: null
    }

    // Apply active filter
    if (forTransaction) {
      // For transaction forms, only show active products
      whereClause.isActive = true
    } else if (activeFilter !== null) {
      // For product list with filter dropdown
      whereClause.isActive = activeFilter === 'true'
    }
    // If no filter, show all products (active and inactive)

    // Apply stock enabled filter (for reorder management pages)
    if (stockEnabledOnly) {
      whereClause.enableStock = true
    }

    // Apply multi-column filters
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { productDescription: { contains: search, mode: 'insensitive' } }
      ]
    }

    if (sku) {
      whereClause.sku = { contains: sku, mode: 'insensitive' }
    }

    if (categoryName) {
      whereClause.category = {
        name: { contains: categoryName, mode: 'insensitive' }
      }
    }

    if (brandName) {
      whereClause.brand = {
        name: { contains: brandName, mode: 'insensitive' }
      }
    }

    if (unitName) {
      whereClause.unit = {
        OR: [
          { name: { contains: unitName, mode: 'insensitive' } },
          { shortName: { contains: unitName, mode: 'insensitive' } }
        ]
      }
    }

    if (productType) {
      whereClause.type = productType
    }

    if (taxName) {
      whereClause.tax = {
        name: { contains: taxName, mode: 'insensitive' }
      }
    }

    if (purchasePriceMin !== undefined || purchasePriceMax !== undefined) {
      whereClause.purchasePrice = {}
      if (purchasePriceMin !== undefined) {
        whereClause.purchasePrice.gte = purchasePriceMin
      }
      if (purchasePriceMax !== undefined) {
        whereClause.purchasePrice.lte = purchasePriceMax
      }
    }

    if (sellingPriceMin !== undefined || sellingPriceMax !== undefined) {
      whereClause.sellingPrice = {}
      if (sellingPriceMin !== undefined) {
        whereClause.sellingPrice.gte = sellingPriceMin
      }
      if (sellingPriceMax !== undefined) {
        whereClause.sellingPrice.lte = sellingPriceMax
      }
    }

    // Build include clause dynamically based on permissions
    const variationInclude: any = {
      variationLocationDetails: true
    }

    // Only include supplier if user has permission (prevents SQL errors for cashiers)
    if (canViewSupplier) {
      variationInclude.supplier = {
        select: {
          id: true,
          name: true
        }
      }
    }

    // ✅ NEW: Pre-load unit information for multi-unit products
    // This prevents delays in POS by including all unit data upfront
    const productInclude: any = {
      category: true,
      brand: true,
      unit: true, // Primary unit
      tax: true,
      variations: {
        where: { deletedAt: null },
        include: variationInclude
      },
      // ✅ Load unit price details for multi-unit products (includes unit relation)
      unitPrices: {
        select: {
          unitId: true,
          purchasePrice: true,
          sellingPrice: true,
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
              allowDecimal: true,
              baseUnitId: true,
              baseUnitMultiplier: true,
            }
          }
        }
      },
      // ✅ Load location-specific unit prices (includes unit relation)
      unitLocationPrices: {
        select: {
          locationId: true,
          unitId: true,
          purchasePrice: true,
          sellingPrice: true,
          unit: {
            select: {
              id: true,
              name: true,
              shortName: true,
              allowDecimal: true,
              baseUnitId: true,
              baseUnitMultiplier: true,
            }
          }
        }
      }
    }

    let products = await prisma.product.findMany({
      where: whereClause,
      include: productInclude,
      orderBy: { createdAt: 'desc' },
      ...(limit && { take: limit })
    })

    // Apply stock filtering (client-side since it requires calculation)
    if (stockMin !== undefined || stockMax !== undefined) {
      products = products.filter(product => {
        if (!product.enableStock) return false // Only filter products that have stock enabled

        let totalStock = 0
        if (product.type === 'variable') {
          totalStock = product.variations.reduce((total, variation) => {
            const varStock = variation.variationLocationDetails.reduce((sum, detail) => sum + Number(detail.qtyAvailable), 0)
            return total + varStock
          }, 0)
        } else if (product.type === 'single') {
          totalStock = product.variations.reduce((total, variation) => {
            const varStock = variation.variationLocationDetails.reduce((sum, detail) => sum + Number(detail.qtyAvailable), 0)
            return total + varStock
          }, 0)
        }

        if (stockMin !== undefined && totalStock < stockMin) return false
        if (stockMax !== undefined && totalStock > stockMax) return false
        return true
      })
    }

    console.log(`[API /api/products] Found ${products.length} products for businessId ${businessId}`)
    console.log('[API /api/products] First 3 products:', products.slice(0, 3).map(p => ({ id: p.id, sku: p.sku, name: p.name, variations: p.variations.length })))

    // Serialize Decimal fields to numbers for JSON
    const serializedProducts = products.map(product => ({
      ...product,
      purchasePrice: product.purchasePrice ? Number(product.purchasePrice) : null,
      sellingPrice: product.sellingPrice ? Number(product.sellingPrice) : null,
      alertQuantity: product.alertQuantity ? Number(product.alertQuantity) : null,
      weight: product.weight ? Number(product.weight) : null,
      tax: product.tax ? {
        ...product.tax,
        amount: Number(product.tax.amount)
      } : null,
      variations: product.variations.map(variation => ({
        ...variation,
        variationName: variation.name, // Add alias for frontend compatibility
        purchasePrice: Number(variation.purchasePrice),
        sellingPrice: Number(variation.sellingPrice),
        variationLocationDetails: variation.variationLocationDetails.map(detail => ({
          ...detail,
          qtyAvailable: Number(detail.qtyAvailable)
        }))
      }))
    }))

    // Field-Level Security: Sanitize response based on user permissions
    // (Permission checks already done at query level, this is for additional sanitization)
    const sanitizedProducts = serializedProducts.map(product => {
      const sanitized: any = { ...product }

      // Remove purchase price if user doesn't have permission
      if (!canViewPurchasePrice) {
        sanitized.purchasePrice = null
        // Also remove from variations
        if (sanitized.variations) {
          sanitized.variations = sanitized.variations.map((v: any) => ({
            ...v,
            purchasePrice: null
          }))
        }
      }

      // Remove supplier information if user doesn't have permission
      if (!canViewSupplier && sanitized.supplier) {
        sanitized.supplier = null
        sanitized.supplierId = null
      }

      return sanitized
    })

    return NextResponse.json({ products: sanitizedProducts })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

// ============================================================================
// POST METHOD - Create New Product
// ============================================================================
/**
 * Creates a new product in the database
 *
 * COMPLETE FLOW:
 * 1. Authenticate user
 * 2. Check PRODUCT_CREATE permission
 * 3. Validate request body (name, pricing, etc.)
 * 4. Check SKU uniqueness
 * 5. Generate SKU if not provided
 * 6. Create product record
 * 7. Create variations (for variable products) OR default variation (for single products)
 * 8. Create combo items (if combo product)
 * 9. Initialize inventory at ZERO for ALL locations
 * 10. Return success response
 *
 * PRODUCT TYPES:
 * - "single": Regular product (e.g., "Laptop") - Creates 1 default variation
 * - "variable": Product with variations (e.g., "T-Shirt" with sizes S/M/L) - Creates N variations
 * - "combo": Bundle of products (e.g., "Meal Deal") - Creates combo items
 *
 * INVENTORY INITIALIZATION:
 * When a product is created, the system automatically:
 * 1. Gets all active locations for the business
 * 2. Gets all variations for the product
 * 3. Creates VariationLocationDetails record for EACH variation at EACH location
 * 4. Sets qtyAvailable = 0 (zero inventory)
 * 5. This prevents "location not found" errors when receiving stock
 *
 * WHY ZERO INVENTORY?
 * - Prevents negative stock issues
 * - Establishes tracking baseline
 * - Stock is added later via:
 *   * Purchase Receipts (receiving from suppliers)
 *   * Inventory Corrections (manual adjustments)
 *   * Transfers (from other locations)
 *
 * DATABASE TRANSACTION:
 * All operations wrapped in $transaction to ensure:
 * - Atomicity: All operations succeed or none do
 * - Consistency: No partial product creation
 * - Rollback on any error
 *
 * PRICING VALIDATION:
 * - Purchase price (cost) must be > 0
 * - Selling price must be > 0
 * - Selling price must be >= purchase price
 * - Prevents selling products at a loss
 *
 * SKU GENERATION:
 * - If SKU provided: Use it (after uniqueness check)
 * - If SKU empty: Auto-generate using format: {PREFIX}-{PRODUCT_ID}
 * - Example: PROD-001, PROD-002, etc.
 * - Variation SKUs: Append variation name or counter
 *
 * REQUEST BODY EXAMPLE:
 * {
 *   "name": "Laptop",
 *   "type": "single",
 *   "categoryId": 5,
 *   "brandId": 3,
 *   "unitId": 1,
 *   "purchasePrice": 500,
 *   "sellingPrice": 700,
 *   "enableStock": true,
 *   "isActive": true
 * }
 *
 * RESPONSE:
 * {
 *   "product": { id, sku, name, ... },
 *   "message": "Product created successfully"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // =========================================================================
    // STEP 1: AUTHENTICATION - Verify user is logged in
    // =========================================================================
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // =========================================================================
    // STEP 2: MULTI-TENANT ISOLATION - Get user's business ID
    // =========================================================================
    const user = session.user as any
    const businessId = parseInt(String(user.businessId))
    if (!businessId) {
      return NextResponse.json({ error: 'No business associated with user' }, { status: 400 })
    }

    // =========================================================================
    // STEP 3: AUTHORIZATION - Check permission to create products
    // =========================================================================
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_CREATE)) {
      return NextResponse.json({ error: 'Forbidden - Insufficient permissions' }, { status: 403 })
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

    if (!name) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 })
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

    // Check SKU uniqueness only if provided
    if (sku && !isSkuEmpty(sku)) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          businessId: parseInt(businessId),
          sku,
          deletedAt: null
        }
      })

      if (existingProduct) {
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

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Create product with temporary SKU (space) if empty
      const product = await tx.product.create({
        data: {
          businessId: parseInt(businessId),
          name,
          type: type || 'single',
          categoryId: subCategoryId ? parseInt(subCategoryId) : (categoryId ? parseInt(categoryId) : null),
          brandId: brandId ? parseInt(brandId) : null,
          unitId: unitId ? parseInt(unitId) : null,
          subUnitIds: subUnitIds && Array.isArray(subUnitIds) && subUnitIds.length > 0
            ? JSON.stringify(subUnitIds)
            : null,
          taxId: taxId ? parseInt(taxId) : null,
          taxType,
          sku: sku && !isSkuEmpty(sku) ? sku : ' ', // Temporary placeholder
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
          isActive: isActive !== undefined ? isActive : true, // Default to active
        }
      }, {
      timeout: 60000, // 60 seconds timeout for network resilience
    })

      // Auto-generate SKU if not provided
      let finalSku = product.sku
      if (isSkuEmpty(sku)) {
        finalSku = generateProductSKU({
          prefix: business.skuPrefix || 'PROD',
          format: (business.skuFormat as 'hyphen' | 'no_hyphen') || 'hyphen',
          productId: product.id
        })

        // Update product with generated SKU
        await tx.product.update({
          where: { id: product.id },
          data: { sku: finalSku }
        })
      }

      // Create variations
      if (type === 'variable' && variations && Array.isArray(variations)) {
        // Variable product - create user-defined variations
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

          await tx.productVariation.create({
            data: {
              businessId: parseInt(businessId),
              productId: product.id,
              name: variation.name,
              sku: variationSku,
              purchasePrice: parseFloat(variation.purchasePrice),
              sellingPrice: parseFloat(variation.sellingPrice),
              isDefault: variation.isDefault || false,
              subSku: variation.subSku,
              unitId: variation.unitId ? parseInt(variation.unitId) : null,
            }
          })

          counter++
        }
      } else if (type === 'single') {
        // Single product - create default variation for stock tracking
        await tx.productVariation.create({
          data: {
            businessId: parseInt(businessId),
            productId: product.id,
            name: 'Default',
            sku: finalSku,
            purchasePrice: purchasePrice ? parseFloat(purchasePrice) : 0,
            sellingPrice: sellingPrice ? parseFloat(sellingPrice) : 0,
            isDefault: true,
            unitId: unitId ? parseInt(unitId) : null,
          }
        })
      }

      // Create combo items if type is combo
      if (type === 'combo' && comboItems && Array.isArray(comboItems)) {
        for (const item of comboItems) {
          await tx.comboProduct.create({
            data: {
              parentProductId: product.id,
              childProductId: parseInt(item.productId),
              quantity: parseFloat(item.quantity)
            }
          })
        }
      }

      // ========================================================================
      // STEP 9: INVENTORY INITIALIZATION - Create zero inventory for all locations
      // ========================================================================
      /**
       * CRITICAL: This is where inventory tracking begins!
       *
       * WHY WE DO THIS:
       * When a new product is created, it doesn't have any inventory yet.
       * But we need to establish a "baseline" record at each location so that:
       * 1. The system knows this product exists at all locations
       * 2. We can track stock movements (purchases, sales, transfers)
       * 3. Reports show the product even if stock is zero
       * 4. Prevents errors when trying to receive/sell at a location
       *
       * WHAT HAPPENS HERE:
       * 1. Query all active locations for this business
       * 2. Query all variations for this product (created above)
       * 3. Create VariationLocationDetails record for EACH combination:
       *    - Variation 1 × Location A = Record (qty: 0)
       *    - Variation 1 × Location B = Record (qty: 0)
       *    - Variation 2 × Location A = Record (qty: 0)
       *    - Variation 2 × Location B = Record (qty: 0)
       *    ... and so on
       *
       * EXAMPLE SCENARIO:
       * - Product: "T-Shirt" (variable product)
       * - Variations: Small, Medium, Large (3 variations)
       * - Locations: Store A, Store B, Warehouse (3 locations)
       * - Result: 3 × 3 = 9 inventory records created, all with qty = 0
       *
       * DATABASE TABLE: VariationLocationDetails
       * Fields:
       * - productId: Links to Product
       * - productVariationId: Links to specific variation (e.g., "Small")
       * - locationId: Links to BusinessLocation (e.g., "Store A")
       * - qtyAvailable: Current stock quantity (starts at 0)
       * - sellingPrice: Price at this location
       *
       * WHEN STOCK IS ADDED (qtyAvailable increased):
       * - Purchase Receipt: +100 units received
       * - Inventory Correction: Manual adjustment
       * - Transfer In: +50 units from another location
       *
       * WHEN STOCK IS REDUCED (qtyAvailable decreased):
       * - Sale: -1 unit sold
       * - Transfer Out: -50 units sent to another location
       * - Inventory Correction: Manual adjustment
       *
       * WHY skipDuplicates: true?
       * In rare cases, records might already exist (e.g., from a failed transaction).
       * skipDuplicates prevents errors and only creates missing records.
       */
      const locations = await tx.businessLocation.findMany({
        where: {
          businessId: parseInt(businessId),
          deletedAt: null // Only active locations
        }
      })

      if (locations.length > 0) {
        // Get all variations for this product (just created above)
        const productVariations = await tx.productVariation.findMany({
          where: {
            productId: product.id,
            deletedAt: null
          }
        })

        // Create zero inventory records for each variation at each location
        // This is a CARTESIAN PRODUCT: variations × locations
        const inventoryRecords = []
        for (const location of locations) {
          for (const variation of productVariations) {
            inventoryRecords.push({
              productId: product.id, // Link to main product
              productVariationId: variation.id, // Link to specific variation
              locationId: location.id, // Link to location
              qtyAvailable: 0, // START AT ZERO - stock added later via purchases
              sellingPrice: variation.sellingPrice // Default price (can be overridden per location)
            })
          }
        }

        if (inventoryRecords.length > 0) {
          // Bulk insert all inventory records in one query (faster than loop)
          await tx.variationLocationDetails.createMany({
            data: inventoryRecords,
            skipDuplicates: true // Ignore if record already exists
          })

          console.log(`✅ Created ${inventoryRecords.length} zero-inventory records for product: ${product.name} across ${locations.length} location(s)`)
        }
      } else {
        // Edge case: Business has no locations yet
        // Inventory records will be created automatically when first location is added
        console.log(`⚠️ No locations exist yet. Zero-inventory records will be created when locations are added.`)
      }

      return { ...product, sku: finalSku }
    })

    return NextResponse.json({ product: result, message: 'Product created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
