import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  try {
    // Find Main Warehouse location
    const locations = await prisma.$queryRaw`
      SELECT id, name FROM business_locations WHERE name ILIKE '%Main%' LIMIT 1
    ` as any[];

    const mainWarehouse = locations[0];
    console.log('Main Warehouse:', mainWarehouse);

    if (!mainWarehouse) {
      console.log('Main Warehouse not found!');
      return;
    }

    // Find products starting with Sample
    const products = await prisma.$queryRaw`
      SELECT p.id, p.name
      FROM products p
      WHERE p.name ILIKE 'Sample%'
        AND p.is_active = true
        AND p.deleted_at IS NULL
    ` as any[];

    console.log('\n=== Sample Products Found:', products.length, '===');

    for (const p of products) {
      console.log('\nProduct:', p.name, '(ID:', p.id, ')');

      // Get variations for this product
      const variations = await prisma.$queryRaw`
        SELECT id, name, sku
        FROM product_variations
        WHERE product_id = ${p.id} AND deleted_at IS NULL
      ` as any[];

      for (const v of variations) {
        // Check stock at Main Warehouse
        const stock = await prisma.$queryRaw`
          SELECT qty_available
          FROM variation_location_details
          WHERE product_variation_id = ${v.id} AND location_id = ${mainWarehouse.id}
          LIMIT 1
        ` as any[];

        const qty = stock.length > 0 ? Number(stock[0].qty_available) : 0;
        console.log('  Variation:', v.name, '| SKU:', v.sku, '| ID:', v.id);
        console.log('    Stock at Main Warehouse:', qty);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

check();
