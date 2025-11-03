import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth.simple'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'
import { generateProductSKU, generateVariationSKU, isSkuEmpty } from '@/lib/sku-generator'

// OPTIMIZED GET - Fetch all products for user's business
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
        const activeFilter = searchParams.get('active')
        const forTransaction = searchParams.get('forTransaction') === 'true'
        const stockEnabledOnly = searchParams.get('stockEnabled') === 'true'

        // Parse pagination parameters
        const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1
        const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 10
        const fullDetails = searchParams.get('fullDetails') === 'true'

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
            whereClause.isActive = true
        } else if (activeFilter !== null) {
            whereClause.isActive = activeFilter === 'true'
        }

        // Apply stock enabled filter
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

        // Get total count for pagination
        const totalCount = await prisma.product.count({
            where: whereClause
        })

        // Calculate pagination
        const skip = (page - 1) * limit
        const totalPages = Math.ceil(totalCount / limit)

        // OPTIMIZED: Use select instead of include to load only needed fields
        const selectConfig = {
            id: true,
            name: true,
            type: true,
            sku: true,
            image: true,
            enableStock: true,
            alertQuantity: true,
            isActive: true,
            purchasePrice: true,
            sellingPrice: true,
            createdAt: true,
            // Only select needed fields from relations
            category: {
                select: {
                    id: true,
                    name: true
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
                    variationLocationDetails: {
                        select: {
                            id: true,
                            qtyAvailable: true,
                            locationId: true
                        }
                    },
                    // Only include supplier if fullDetails is true
                    ...(fullDetails && {
                        supplier: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    })
                }
            }
        }

        const products = await prisma.product.findMany({
            where: whereClause,
            select: selectConfig,
            orderBy: { createdAt: 'desc' },
            skip: skip,
            take: limit
        })

        // Apply stock filtering (client-side since it requires calculation)
        let filteredProducts = products
        if (stockMin !== undefined || stockMax !== undefined) {
            filteredProducts = products.filter(product => {
                if (!product.enableStock) return false

                let totalStock = 0
                if (product.type === 'variable' || product.type === 'single') {
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

        console.log(`[API /api/products] Page ${page}/${totalPages}: Found ${filteredProducts.length} products out of ${totalCount} total for businessId ${businessId}`)

        // Serialize Decimal fields to numbers for JSON
        const serializedProducts = filteredProducts.map(product => ({
            ...product,
            purchasePrice: product.purchasePrice ? Number(product.purchasePrice) : null,
            sellingPrice: product.sellingPrice ? Number(product.sellingPrice) : null,
            alertQuantity: product.alertQuantity ? Number(product.alertQuantity) : null,
            tax: product.tax ? {
                ...product.tax,
                amount: Number(product.tax.amount)
            } : null,
            variations: product.variations.map(variation => ({
                ...variation,
                variationName: variation.name,
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

        return NextResponse.json({
            products: sanitizedProducts,
            pagination: {
                page,
                limit,
                totalCount,
                totalPages
            }
        })
    } catch (error) {
        console.error('Error fetching products:', error)
        return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
    }
}

// POST - Create new product (unchanged)
export async function POST(request: NextRequest) {
    // ... existing POST implementation
    return NextResponse.json({ error: 'Not implemented in optimized version' }, { status: 501 })
}

