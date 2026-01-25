import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_SKU = '6974202728229';
const NEW_PRICE = new Prisma.Decimal(7690);

async function fixHiksemiPrice() {
  console.log('=== Fixing HIKSEMI 1TB M.2 NVME SSD GEN4 Price ===');
  console.log(`Target SKU: ${TARGET_SKU}`);
  console.log(`New Price: ${NEW_PRICE}`);
  console.log('');

  // Step 1: Find the product
  const product = await prisma.product.findFirst({
    where: { sku: TARGET_SKU },
    select: { id: true, name: true, sellingPrice: true, businessId: true }
  });

  if (!product) {
    console.error(`Product with SKU ${TARGET_SKU} not found!`);
    return;
  }

  console.log(`Found product: ${product.name} (ID: ${product.id})`);
  console.log(`Current Product.sellingPrice: ${product.sellingPrice}`);
  console.log('');

  // Step 2: Update Product.sellingPrice
  await prisma.product.update({
    where: { id: product.id },
    data: { sellingPrice: NEW_PRICE }
  });
  console.log(`[OK] Updated Product.sellingPrice to ${NEW_PRICE}`);

  // Step 3: Update ProductVariation
  const variations = await prisma.productVariation.findMany({
    where: { productId: product.id },
    select: { id: true, name: true, sellingPrice: true }
  });

  console.log(`\nFound ${variations.length} variation(s):`);
  for (const v of variations) {
    console.log(`  - ${v.name}: sellingPrice=${v.sellingPrice}`);
  }

  const variationUpdateResult = await prisma.productVariation.updateMany({
    where: { productId: product.id },
    data: { sellingPrice: NEW_PRICE }
  });
  console.log(`[OK] Updated ${variationUpdateResult.count} ProductVariation(s)`);

  // Step 4: Update VariationLocationDetails (uses productVariationId)
  const variationIds = variations.map(v => v.id);

  const locationDetails = await prisma.variationLocationDetails.findMany({
    where: { productVariationId: { in: variationIds } },
    select: { id: true, locationId: true, sellingPrice: true }
  });

  console.log(`\nFound ${locationDetails.length} VariationLocationDetails:`);
  for (const ld of locationDetails) {
    console.log(`  - LocationID ${ld.locationId}: sellingPrice=${ld.sellingPrice}`);
  }

  const vldUpdateResult = await prisma.variationLocationDetails.updateMany({
    where: { productVariationId: { in: variationIds } },
    data: { sellingPrice: NEW_PRICE }
  });
  console.log(`[OK] Updated ${vldUpdateResult.count} VariationLocationDetails`);

  // Step 5: Update ProductUnitPrice (uses productId + unitId)
  const unitPrices = await prisma.productUnitPrice.findMany({
    where: { productId: product.id },
    include: { unit: { select: { name: true } } }
  });

  console.log(`\nFound ${unitPrices.length} ProductUnitPrice(s):`);
  for (const up of unitPrices) {
    console.log(`  - ${up.unit.name}: sellingPrice=${up.sellingPrice}`);
  }

  // Update all unit prices (typically there's just one base unit)
  const upUpdateResult = await prisma.productUnitPrice.updateMany({
    where: { productId: product.id },
    data: { sellingPrice: NEW_PRICE }
  });
  console.log(`[OK] Updated ${upUpdateResult.count} ProductUnitPrice(s)`);

  // Step 6: Update ProductUnitLocationPrice (uses productId + locationId + unitId)
  const unitLocationPrices = await prisma.productUnitLocationPrice.findMany({
    where: { productId: product.id },
    include: {
      unit: { select: { name: true } },
      location: { select: { name: true } }
    }
  });

  console.log(`\nFound ${unitLocationPrices.length} ProductUnitLocationPrice(s):`);
  for (const ulp of unitLocationPrices) {
    console.log(`  - ${ulp.unit.name} @ ${ulp.location.name}: sellingPrice=${ulp.sellingPrice}`);
  }

  // Update all location prices
  const ulpUpdateResult = await prisma.productUnitLocationPrice.updateMany({
    where: { productId: product.id },
    data: { sellingPrice: NEW_PRICE }
  });
  console.log(`[OK] Updated ${ulpUpdateResult.count} ProductUnitLocationPrice(s)`);

  // Step 7: Verification
  console.log('\n=== VERIFICATION ===');

  const verifyProduct = await prisma.product.findUnique({
    where: { id: product.id },
    select: { sellingPrice: true }
  });
  console.log(`Product.sellingPrice: ${verifyProduct?.sellingPrice}`);

  const verifyVariations = await prisma.productVariation.findMany({
    where: { productId: product.id },
    select: { name: true, sellingPrice: true }
  });
  for (const v of verifyVariations) {
    console.log(`ProductVariation[${v.name}]: sellingPrice=${v.sellingPrice}`);
  }

  const verifyVLD = await prisma.variationLocationDetails.findMany({
    where: { productVariationId: { in: variationIds } },
    select: { locationId: true, sellingPrice: true }
  });
  for (const ld of verifyVLD) {
    console.log(`VariationLocationDetails[LocationID ${ld.locationId}]: sellingPrice=${ld.sellingPrice}`);
  }

  const verifyUP = await prisma.productUnitPrice.findMany({
    where: { productId: product.id },
    include: { unit: { select: { name: true } } }
  });
  for (const up of verifyUP) {
    console.log(`ProductUnitPrice[${up.unit.name}]: sellingPrice=${up.sellingPrice}`);
  }

  const verifyULP = await prisma.productUnitLocationPrice.findMany({
    where: { productId: product.id },
    include: {
      unit: { select: { name: true } },
      location: { select: { name: true } }
    }
  });
  for (const ulp of verifyULP) {
    console.log(`ProductUnitLocationPrice[${ulp.unit.name} @ ${ulp.location.name}]: sellingPrice=${ulp.sellingPrice}`);
  }

  console.log('\n=== DONE ===');
}

fixHiksemiPrice()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
