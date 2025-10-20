import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { generateProductSKU, generateVariationSKU, isSkuEmpty } from '@/lib/sku-generator'

// GET - Fetch all products for user's business
export async function GET(request: NextRequest) {
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

    // Parse query parameters for filtering
    const { searchParams } = new URL(request.url)
    const activeFilter = searchParams.get('active') // 'true', 'false', or null (all)
    const forTransaction = searchParams.get('forTransaction') === 'true' // Only active products

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

    let products = await prisma.product.findMany({
      where: whereClause,
      include: {
        category: true,
        brand: true,
        unit: true,
        tax: true,
        variations: {
          where: { deletedAt: null },
          include: {
            variationLocationDetails: true
          }
        }
      },
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
    const canViewPurchasePrice = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW_PURCHASE_PRICE)
    const canViewSupplier = user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW_SUPPLIER)

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

// POST - Create new product
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

      // Auto-create zero inventory for all existing locations
      const locations = await tx.businessLocation.findMany({
        where: {
          businessId: parseInt(businessId),
          deletedAt: null
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
        const inventoryRecords = []
        for (const location of locations) {
          for (const variation of productVariations) {
            inventoryRecords.push({
              productId: product.id,
              productVariationId: variation.id,
              locationId: location.id,
              qtyAvailable: 0,
              sellingPrice: variation.sellingPrice
            })
          }
        }

        if (inventoryRecords.length > 0) {
          await tx.variationLocationDetails.createMany({
            data: inventoryRecords,
            skipDuplicates: true
          })

          console.log(`Created ${inventoryRecords.length} zero-inventory records for product: ${product.name} across ${locations.length} location(s)`)
        }
      } else {
        console.log(`No locations exist yet. Zero-inventory records will be created when locations are added.`)
      }

      return { ...product, sku: finalSku }
    })

    return NextResponse.json({ product: result, message: 'Product created successfully' }, { status: 201 })
  } catch (error) {
    console.error('Error creating product:', error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
