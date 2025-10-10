import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PERMISSIONS } from '@/lib/rbac'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = session.user
    const businessId = user.businessId

    // Check permission
    if (!user.permissions.includes(PERMISSIONS.PRODUCT_CREATE)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { products } = body

    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 })
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ row: number; error: string; data?: any }>
    }

    // Process each product
    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      const rowNumber = i + 2 // Account for header row

      try {
        // Validate required fields
        if (!product.name) {
          throw new Error('Product name is required')
        }

        if (!product.unit) {
          throw new Error('Unit is required')
        }

        if (!product.productType) {
          throw new Error('Product type is required')
        }

        if (!['single', 'variable'].includes(product.productType)) {
          throw new Error('Product type must be "single" or "variable"')
        }

        // Find or create brand
        let brandId = null
        if (product.brand) {
          let brand = await prisma.brand.findFirst({
            where: {
              name: product.brand,
              businessId
            }
          })

          if (!brand) {
            brand = await prisma.brand.create({
              data: {
                name: product.brand,
                businessId,
                createdBy: user.id
              }
            })
          }
          brandId = brand.id
        }

        // Find or create unit
        let unit = await prisma.unit.findFirst({
          where: {
            name: product.unit,
            businessId
          }
        })

        if (!unit) {
          unit = await prisma.unit.create({
            data: {
              name: product.unit,
              shortName: product.unit.substring(0, 3).toUpperCase(),
              allowDecimal: true,
              businessId
            }
          })
        }

        // Find or create category
        let categoryId = null
        if (product.category) {
          let category = await prisma.category.findFirst({
            where: {
              name: product.category,
              businessId
            }
          })

          if (!category) {
            category = await prisma.category.create({
              data: {
                name: product.category,
                businessId,
                createdBy: user.id
              }
            })
          }
          categoryId = category.id
        }

        // Find or create subcategory
        let subCategoryId = null
        if (product.subCategory && categoryId) {
          let subCategory = await prisma.category.findFirst({
            where: {
              name: product.subCategory,
              parentId: categoryId,
              businessId
            }
          })

          if (!subCategory) {
            subCategory = await prisma.category.create({
              data: {
                name: product.subCategory,
                parentId: categoryId,
                businessId,
                createdBy: user.id
              }
            })
          }
          subCategoryId = subCategory.id
        }

        // Create product
        const createdProduct = await prisma.product.create({
          data: {
            name: product.name,
            sku: product.sku || null,
            barcodeType: product.barcodeType || 'C128',
            productType: product.productType,
            unitId: unit.id,
            brandId,
            categoryId: subCategoryId || categoryId,
            manageStock: product.manageStock === '1' || product.manageStock === 1,
            alertQuantity: product.alertQuantity ? parseFloat(product.alertQuantity) : null,
            expiryPeriod: product.expiresIn ? parseFloat(product.expiresIn) : null,
            expiryPeriodType: product.expiryPeriodUnit || null,
            weight: product.weight ? parseFloat(product.weight) : null,
            productDescription: product.productDescription || null,
            customField1: product.customField1 || null,
            customField2: product.customField2 || null,
            customField3: product.customField3 || null,
            customField4: product.customField4 || null,
            notForSelling: product.notForSelling === '1' || product.notForSelling === 1,
            businessId,
            createdBy: user.id,
            isActive: true
          }
        })

        // Handle variations for variable products
        if (product.productType === 'variable' && product.variationName && product.variationValues) {
          const variationTemplate = await prisma.variationTemplate.create({
            data: {
              name: product.variationName,
              businessId
            }
          })

          const variationValueNames = product.variationValues.split('|').map((v: string) => v.trim())
          const variationValues = await Promise.all(
            variationValueNames.map((name: string) =>
              prisma.variationTemplateValue.create({
                data: {
                  name,
                  templateId: variationTemplate.id,
                  businessId
                }
              })
            )
          )

          // Create product variations
          const skus = product.variationSKUs ? product.variationSKUs.split('|').map((s: string) => s.trim()) : []
          const purchasePricesIncl = product.purchasePriceInclTax ? product.purchasePriceInclTax.split('|').map((p: string) => p.trim()) : []
          const purchasePricesExcl = product.purchasePriceExclTax ? product.purchasePriceExclTax.split('|').map((p: string) => p.trim()) : []
          const profitMargins = product.profitMargin ? product.profitMargin.split('|').map((p: string) => p.trim()) : []
          const sellingPrices = product.sellingPrice ? product.sellingPrice.split('|').map((p: string) => p.trim()) : []

          for (let j = 0; j < variationValues.length; j++) {
            await prisma.productVariation.create({
              data: {
                productId: createdProduct.id,
                variationTemplateId: variationTemplate.id,
                variationValueId: variationValues[j].id,
                sku: skus[j] || null,
                purchasePriceIncTax: purchasePricesIncl[j] ? parseFloat(purchasePricesIncl[j]) : null,
                purchasePriceExcTax: purchasePricesExcl[j] ? parseFloat(purchasePricesExcl[j]) : null,
                profitMargin: profitMargins[j] ? parseFloat(profitMargins[j]) : null,
                sellingPrice: sellingPrices[j] ? parseFloat(sellingPrices[j]) : null,
                businessId
              }
            })
          }
        } else if (product.productType === 'single') {
          // Create single variation
          await prisma.productVariation.create({
            data: {
              productId: createdProduct.id,
              sku: product.sku || null,
              purchasePriceIncTax: product.purchasePriceInclTax ? parseFloat(product.purchasePriceInclTax) : null,
              purchasePriceExcTax: product.purchasePriceExclTax ? parseFloat(product.purchasePriceExclTax) : null,
              profitMargin: product.profitMargin ? parseFloat(product.profitMargin) : null,
              sellingPrice: product.sellingPrice ? parseFloat(product.sellingPrice) : null,
              businessId
            }
          })
        }

        // Handle opening stock for multiple locations
        if (product.openingStock && product.openingStockLocation) {
          const quantities = product.openingStock.split('|').map((q: string) => q.trim())
          const locationNames = product.openingStockLocation.split('|').map((l: string) => l.trim())

          for (let j = 0; j < quantities.length; j++) {
            const quantity = parseFloat(quantities[j])
            const locationName = locationNames[j]

            if (!quantity || !locationName) continue

            const location = await prisma.businessLocation.findFirst({
              where: {
                name: locationName,
                businessId
              }
            })

            if (location) {
              const variation = await prisma.productVariation.findFirst({
                where: {
                  productId: createdProduct.id
                }
              })

              if (variation) {
                await prisma.variationLocationDetail.create({
                  data: {
                    productVariationId: variation.id,
                    locationId: location.id,
                    qtyAvailable: quantity,
                    businessId
                  }
                })
              }
            }
          }
        }

        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push({
          row: rowNumber,
          error: error.message,
          data: product
        })
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Import products error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to import products' },
      { status: 500 }
    )
  }
}
