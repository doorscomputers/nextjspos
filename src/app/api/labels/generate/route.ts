import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { createAuditLog, AuditAction, EntityType, getIpAddress, getUserAgent } from '@/lib/auditLog'

/**
 * POST - Generate Barcode Labels for Products
 *
 * Supports multiple barcode formats:
 * - CODE128: Most common, alphanumeric
 * - CODE39: Alphanumeric, legacy systems
 * - EAN13: European Article Number (13 digits)
 * - EAN8: European Article Number (8 digits)
 * - UPC: Universal Product Code (12 digits)
 * - ITF14: Interleaved 2 of 5 (14 digits)
 *
 * For products without SKUs, generates unique SKUs automatically
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId
    const userId = user.id

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_UPDATE)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions to generate labels' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const {
      productIds, // Array of product IDs to generate labels for
      barcodeFormat, // CODE128, CODE39, EAN13, EAN8, UPC, ITF14
      autoGenerateSKU, // If true, generate SKUs for products without them
      includePrice, // If true, include price on label
      includeProductName, // If true, include product name on label
      copies, // Number of copies per label (default: 1)
    } = body

    // Validation
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: 'productIds array is required' },
        { status: 400 }
      )
    }

    if (!barcodeFormat) {
      return NextResponse.json(
        { error: 'barcodeFormat is required (CODE128, CODE39, EAN13, EAN8, UPC, ITF14, QR)' },
        { status: 400 }
      )
    }

    // Enhanced with QR code support (from pos-barcode-label-printer skill)
    const validFormats = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14', 'QR']
    if (!validFormats.includes(barcodeFormat)) {
      return NextResponse.json(
        { error: `Invalid barcode format. Must be one of: ${validFormats.join(', ')}` },
        { status: 400 }
      )
    }

    const numberOfCopies = copies || 1

    // Get products with variations
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds.map(id => parseInt(id)) },
        businessId: parseInt(businessId),
        deletedAt: null,
      },
      include: {
        category: { select: { name: true } },
        brand: { select: { name: true } },
        unit: { select: { name: true, shortName: true } },
        variations: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            sku: true,
            sellingPrice: true,
          },
        },
      },
    })

    if (products.length === 0) {
      return NextResponse.json(
        { error: 'No products found with the provided IDs' },
        { status: 404 }
      )
    }

    const labels: any[] = []
    const updatedProducts: any[] = []

    // Process each product
    for (const product of products) {
      // Check if product needs SKU generation
      if (!product.sku && autoGenerateSKU) {
        // Generate unique SKU
        const timestamp = Date.now()
        const randomSuffix = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        const generatedSKU = `SKU-${timestamp}-${randomSuffix}`

        // Update product with generated SKU
        await prisma.product.update({
          where: { id: product.id },
          data: { sku: generatedSKU },
        })

        product.sku = generatedSKU
        updatedProducts.push({ id: product.id, sku: generatedSKU })
      }

      // Generate labels for product and its variations
      if (product.variations.length > 0) {
        // Product has variations - generate label for each variation
        for (const variation of product.variations) {
          let barcodeValue = variation.sku || product.sku

          // If no SKU exists and autoGenerateSKU is false, skip
          if (!barcodeValue) {
            continue
          }

          // Validate barcode value for specific formats (QR codes accept any string)
          if (barcodeFormat !== 'QR') {
            if (barcodeFormat === 'EAN13' && barcodeValue.length !== 13) {
              // Pad or truncate to 13 digits
              barcodeValue = barcodeValue.padStart(13, '0').slice(-13)
            } else if (barcodeFormat === 'EAN8' && barcodeValue.length !== 8) {
              barcodeValue = barcodeValue.padStart(8, '0').slice(-8)
            } else if (barcodeFormat === 'UPC' && barcodeValue.length !== 12) {
              barcodeValue = barcodeValue.padStart(12, '0').slice(-12)
            } else if (barcodeFormat === 'ITF14' && barcodeValue.length !== 14) {
              barcodeValue = barcodeValue.padStart(14, '0').slice(-14)
            }
          }

          // Create label data
          const label = {
            productId: product.id,
            productName: includeProductName ? product.name : null,
            variationId: variation.id,
            variationName: variation.name !== 'Default' ? variation.name : null,
            sku: variation.sku || product.sku,
            barcodeValue,
            barcodeFormat,
            price: includePrice ? parseFloat(variation.sellingPrice.toString()) : null,
            category: product.category?.name,
            brand: product.brand?.name,
            unit: product.unit?.shortName || product.unit?.name,
            copies: numberOfCopies,
          }

          labels.push(label)
        }
      } else {
        // Product has no variations - generate single label
        let barcodeValue = product.sku

        if (!barcodeValue) {
          continue
        }

        // Validate barcode value for specific formats (QR codes accept any string)
        if (barcodeFormat !== 'QR') {
          if (barcodeFormat === 'EAN13' && barcodeValue.length !== 13) {
            barcodeValue = barcodeValue.padStart(13, '0').slice(-13)
          } else if (barcodeFormat === 'EAN8' && barcodeValue.length !== 8) {
            barcodeValue = barcodeValue.padStart(8, '0').slice(-8)
          } else if (barcodeFormat === 'UPC' && barcodeValue.length !== 12) {
            barcodeValue = barcodeValue.padStart(12, '0').slice(-12)
          } else if (barcodeFormat === 'ITF14' && barcodeValue.length !== 14) {
            barcodeValue = barcodeValue.padStart(14, '0').slice(-14)
          }
        }

        const label = {
          productId: product.id,
          productName: includeProductName ? product.name : null,
          variationId: null,
          variationName: null,
          sku: product.sku,
          barcodeValue,
          barcodeFormat,
          price: includePrice && product.variations[0]
            ? parseFloat(product.variations[0].sellingPrice.toString())
            : null,
          category: product.category?.name,
          brand: product.brand?.name,
          unit: product.unit?.shortName || product.unit?.name,
          copies: numberOfCopies,
        }

        labels.push(label)
      }
    }

    if (labels.length === 0) {
      return NextResponse.json(
        {
          error: 'No labels could be generated. Products may be missing SKUs. Enable autoGenerateSKU or add SKUs manually.',
        },
        { status: 400 }
      )
    }

    // Create audit log
    await createAuditLog({
      businessId: parseInt(businessId),
      userId: parseInt(userId),
      username: user.username,
      action: 'product_update' as AuditAction,
      entityType: EntityType.PRODUCT,
      entityIds: productIds.map(id => parseInt(id)),
      description: `Generated ${labels.length} barcode labels (${barcodeFormat}) for ${products.length} products`,
      metadata: {
        barcodeFormat,
        labelCount: labels.length,
        productCount: products.length,
        autoGenerateSKU,
        updatedProducts: updatedProducts.length > 0 ? updatedProducts : undefined,
        includePrice,
        includeProductName,
        copies: numberOfCopies,
      },
      ipAddress: getIpAddress(request),
      userAgent: getUserAgent(request),
    })

    return NextResponse.json({
      message: `Generated ${labels.length} labels for ${products.length} products`,
      labels,
      updatedProducts: updatedProducts.length > 0 ? updatedProducts : undefined,
      totalLabels: labels.reduce((sum, label) => sum + label.copies, 0),
    })
  } catch (error) {
    console.error('Error generating labels:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate labels',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

/**
 * GET - Get Products Without SKUs/Barcodes
 *
 * Helps identify products that need labels generated
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user as any
    const businessId = user.businessId

    // Check permission
    if (!user.permissions?.includes(PERMISSIONS.PRODUCT_VIEW)) {
      return NextResponse.json(
        { error: 'Forbidden - Insufficient permissions' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(request.url)
    const withoutSKU = searchParams.get('withoutSKU') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    const where: any = {
      businessId: parseInt(businessId),
      deletedAt: null,
    }

    if (withoutSKU) {
      where.OR = [
        { sku: null },
        { sku: '' },
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: { select: { name: true } },
          brand: { select: { name: true } },
          variations: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              sku: true,
              sellingPrice: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.product.count({ where }),
    ])

    return NextResponse.json({
      products,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching products:', error)
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    )
  }
}
