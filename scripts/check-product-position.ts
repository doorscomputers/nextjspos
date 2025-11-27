import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function countProducts() {
  // Count total active products
  const totalActive = await prisma.product.count({
    where: { isActive: true, deletedAt: null }
  });

  // Get ALL active products to find the exact position
  const allProducts = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, sku: true, createdAt: true }
  });

  console.log('Total active products:', totalActive);
  console.log('Products fetched:', allProducts.length);

  // Find CP678W position
  const cp678wIndex = allProducts.findIndex(p =>
    p.sku?.toLowerCase() === 'cp678w' || p.name?.toLowerCase().includes('cp678w')
  );

  if (cp678wIndex !== -1) {
    const product = allProducts[cp678wIndex];
    console.log('\n=== CP678W FOUND ===');
    console.log('Position:', cp678wIndex + 1, 'of', allProducts.length);
    console.log('Product name:', product.name);
    console.log('SKU:', product.sku);
    console.log('Created at:', product.createdAt);

    if (cp678wIndex >= 1000) {
      console.log('\n⚠️ ROOT CAUSE IDENTIFIED!');
      console.log('CP678W is at position', cp678wIndex + 1);
      console.log('The Products API has MAX_PAGE_SIZE = 1000');
      console.log('So CP678W is NEVER loaded on the POS page!');
      console.log('\nSOLUTION: Increase MAX_PAGE_SIZE in src/lib/pagination.ts');
      console.log('Or implement proper search that queries the API directly');
    } else {
      console.log('\n✓ CP678W is within the first 1000 products');
    }
  } else {
    console.log('CP678W not found by SKU, trying by variation...');

    // Try finding via variation
    const variation = await prisma.productVariation.findFirst({
      where: { sku: { equals: 'cp678w', mode: 'insensitive' } },
      include: { product: true }
    });

    if (variation) {
      const productIndex = allProducts.findIndex(p => p.id === variation.productId);
      console.log('\nFound via variation!');
      console.log('Product:', variation.product.name);
      console.log('Position in createdAt DESC order:', productIndex + 1, 'of', allProducts.length);

      if (productIndex >= 1000) {
        console.log('\n⚠️ ROOT CAUSE: Product is at position', productIndex + 1);
        console.log('MAX_PAGE_SIZE = 1000, so this product is NOT loaded!');
      }
    }
  }

  await prisma.$disconnect();
}

countProducts();
