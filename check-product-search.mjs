import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkProductSearch() {
  console.log('🔍 Checking Product Database for Search Issues...\n')

  try {
    // Get all products with variations
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        sku: true,
        variations: {
          select: {
            sku: true,
          }
        }
      }
    })

    // Flatten products to include variation SKUs
    const productsWithBarcodes = allProducts.map(p => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      variationSkus: p.variations.map(v => v.sku),
      barcode: null // No barcode in schema
    }))

    console.log('📦 Total products in database:', productsWithBarcodes.length)
    console.log('\n' + '='.repeat(80) + '\n')

    // Check 1: Search for exact SKU "4711085931528"
    console.log('🎯 CHECK 1: Searching for SKU "4711085931528"')
    const skuMatch = productsWithBarcodes.filter(p =>
      p.sku === '4711085931528' || p.variationSkus.includes('4711085931528')
    )

    if (skuMatch.length > 0) {
      console.log('✅ FOUND:', skuMatch.length, 'product(s)')
      skuMatch.forEach(p => {
        console.log(`   - ${p.name}`)
        console.log(`     SKU: ${p.sku}`)
        console.log(`     Barcode: ${p.barcode || 'N/A'}`)
      })
    } else {
      console.log('❌ NOT FOUND: No product with SKU "4711085931528"')
    }

    console.log('\n' + '='.repeat(80) + '\n')

    // Check 2: Search for products containing "adata"
    console.log('🎯 CHECK 2: Products containing "adata" (case-insensitive)')
    const adataProducts = productsWithBarcodes.filter(p =>
      p.name.toLowerCase().includes('adata') ||
      p.sku.toLowerCase().includes('adata')
    )

    console.log(`✅ FOUND: ${adataProducts.length} ADATA product(s)`)
    adataProducts.forEach((p, i) => {
      console.log(`\n   ${i + 1}. ${p.name}`)
      console.log(`      SKU: ${p.sku}`)
      console.log(`      Barcode: ${p.barcode || 'N/A'}`)
    })

    console.log('\n' + '='.repeat(80) + '\n')

    // Check 3: Search for products containing "512"
    console.log('🎯 CHECK 3: Products containing "512"')
    const products512 = productsWithBarcodes.filter(p =>
      p.name.toLowerCase().includes('512') ||
      p.sku.toLowerCase().includes('512')
    )

    console.log(`✅ FOUND: ${products512.length} product(s) with "512"`)
    products512.forEach((p, i) => {
      console.log(`\n   ${i + 1}. ${p.name}`)
      console.log(`      SKU: ${p.sku}`)
      console.log(`      Barcode: ${p.barcode || 'N/A'}`)
    })

    console.log('\n' + '='.repeat(80) + '\n')

    // Check 4: Search for products containing "adata 512" as phrase
    console.log('🎯 CHECK 4: Products containing phrase "adata 512"')
    const adata512Products = productsWithBarcodes.filter(p =>
      p.name.toLowerCase().includes('adata 512') ||
      p.sku.toLowerCase().includes('adata 512')
    )

    if (adata512Products.length > 0) {
      console.log(`✅ FOUND: ${adata512Products.length} product(s)`)
      adata512Products.forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.name}`)
        console.log(`      SKU: ${p.sku}`)
        console.log(`      Barcode: ${p.barcode || 'N/A'}`)
      })
    } else {
      console.log('❌ NOT FOUND: No products containing "adata 512" as a phrase')
    }

    console.log('\n' + '='.repeat(80) + '\n')

    // Check 5: Look for any SSD products
    console.log('🎯 CHECK 5: Looking for SSD products')
    const ssdProducts = productsWithBarcodes.filter(p =>
      p.name.toLowerCase().includes('ssd')
    )

    console.log(`✅ FOUND: ${ssdProducts.length} SSD product(s)`)
    if (ssdProducts.length > 0 && ssdProducts.length <= 20) {
      ssdProducts.forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.name}`)
        console.log(`      SKU: ${p.sku}`)
        console.log(`      Barcode: ${p.barcode || 'N/A'}`)
      })
    } else if (ssdProducts.length > 20) {
      console.log('\n   (Too many to display, showing first 20)')
      ssdProducts.slice(0, 20).forEach((p, i) => {
        console.log(`\n   ${i + 1}. ${p.name}`)
        console.log(`      SKU: ${p.sku}`)
      })
    }

    console.log('\n' + '='.repeat(80) + '\n')

    // Summary
    console.log('📊 SUMMARY:')
    console.log(`   - Total products: ${productsWithBarcodes.length}`)
    console.log(`   - ADATA products: ${adataProducts.length}`)
    console.log(`   - Products with "512": ${products512.length}`)
    console.log(`   - Products with "adata 512": ${adata512Products.length}`)
    console.log(`   - SSD products: ${ssdProducts.length}`)
    console.log(`   - SKU "4711085931528" exists: ${skuMatch.length > 0 ? 'YES' : 'NO'}`)

    console.log('\n' + '='.repeat(80) + '\n')

    // Check if the specific product exists
    const targetProduct = productsWithBarcodes.find(p =>
      p.name.toLowerCase().includes('adata') &&
      p.name.toLowerCase().includes('512') &&
      p.name.toLowerCase().includes('ssd')
    )

    if (targetProduct) {
      console.log('✅ CONCLUSION: Found "ADATA 512GB SSD" product:')
      console.log(`   - Name: ${targetProduct.name}`)
      console.log(`   - SKU: ${targetProduct.sku}`)
      console.log(`   - Barcode: ${targetProduct.barcode || 'N/A'}`)
    } else {
      console.log('❌ CONCLUSION: "ADATA 512GB 2.5 SSD" does NOT exist in the database')
      console.log('\n💡 RECOMMENDATION:')
      console.log('   The product you are searching for does not exist in your database.')
      console.log('   Please add this product first through the Products page before')
      console.log('   trying to create an inventory correction for it.')
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkProductSearch()
