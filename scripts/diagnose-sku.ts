import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('=== DIAGNOSTIC: SKU cp678w ===\n');

  // Step 0: Check active shifts
  console.log('0. Checking active cashier shifts...');
  const activeShifts = await prisma.cashierShift.findMany({
    where: {
      closedAt: null  // Still open
    }
  });

  // Get locations to map IDs
  const locations = await prisma.businessLocation.findMany();
  const locationMap = new Map(locations.map(l => [l.id, l.name]));

  if (activeShifts.length === 0) {
    console.log('   ⚠️ No active shifts found!');
  } else {
    console.log(`   Found ${activeShifts.length} active shift(s):`);
    activeShifts.forEach(shift => {
      const locName = locationMap.get(shift.locationId) || 'Unknown';
      console.log(`   - Shift #${shift.shiftNumber} | Location: ${locName} (ID: ${shift.locationId}) | User ID: ${shift.userId}`);
    });
  }
  console.log('');

  // Step 1: Find the variation with SKU cp678w
  console.log('1. Searching for SKU cp678w...');
  const variation = await prisma.productVariation.findFirst({
    where: {
      sku: { equals: 'cp678w', mode: 'insensitive' }
    },
    include: {
      product: true,
      variationLocationDetails: true
    }
  });

  if (!variation) {
    console.log('   ❌ SKU cp678w NOT FOUND in database!');

    // Try partial match
    console.log('\n   Trying partial match...');
    const partialMatches = await prisma.productVariation.findMany({
      where: {
        sku: { contains: 'cp678', mode: 'insensitive' }
      },
      include: { product: true },
      take: 5
    });

    if (partialMatches.length > 0) {
      console.log('   Similar SKUs found:');
      partialMatches.forEach(v => {
        console.log(`   - SKU: ${v.sku} | Product: ${v.product.name}`);
      });
    } else {
      console.log('   No similar SKUs found.');
    }

    await prisma.$disconnect();
    return;
  }

  console.log('   ✓ Found variation:');
  console.log(`     - Variation ID: ${variation.id}`);
  console.log(`     - SKU: ${variation.sku}`);
  console.log(`     - Product: ${variation.product.name}`);
  console.log(`     - Product Active: ${variation.product.isActive}`);
  console.log(`     - Product Deleted: ${variation.product.deletedAt ? 'YES' : 'No'}`);
  console.log(`     - Variation Deleted: ${variation.deletedAt ? 'YES' : 'No'}`);

  // Step 2: Check stock at all locations
  console.log('\n2. Stock at locations:');

  if (variation.variationLocationDetails.length === 0) {
    console.log('   ❌ NO STOCK ENTRIES for this SKU at any location!');
  } else {
    variation.variationLocationDetails.forEach(vld => {
      const locationName = locationMap.get(vld.locationId) || 'Unknown';
      console.log(`   - ${locationName} (ID: ${vld.locationId}): qtyAvailable=${vld.qtyAvailable}`);
    });
  }

  // Step 3: Check Main Store location
  console.log('\n3. Main Store location check:');
  const mainStore = locations.find(l =>
    l.name.toLowerCase().includes('main') || l.name.toLowerCase().includes('store')
  );

  if (mainStore) {
    console.log(`   Main Store ID: ${mainStore.id}`);
    console.log(`   Main Store Name: ${mainStore.name}`);

    const stockAtMain = variation.variationLocationDetails.find(
      vld => vld.locationId === mainStore.id
    );

    if (stockAtMain) {
      console.log(`   Stock at Main Store: ${stockAtMain.qtyAvailable}`);
      if (parseFloat(String(stockAtMain.qtyAvailable)) <= 0) {
        console.log('   ⚠️ ISSUE: Stock is 0 or negative - product will be filtered out!');
      } else {
        console.log('   ✓ Stock is positive - should be visible on POS');
      }
    } else {
      console.log('   ❌ NO STOCK ENTRY for Main Store!');
    }
  } else {
    console.log('   Locations in database:');
    locations.forEach(l => console.log(`   - ${l.name} (ID: ${l.id})`));
  }

  // Step 4: Simulate API call - check how products API returns this product
  console.log('\n4. Checking API response format...');
  const productFromApi = await prisma.product.findFirst({
    where: {
      isActive: true,
      deletedAt: null,
      variations: {
        some: {
          sku: { equals: 'cp678w', mode: 'insensitive' },
          deletedAt: null
        }
      }
    },
    include: {
      variations: {
        where: { deletedAt: null },
        include: {
          variationLocationDetails: true
        }
      }
    }
  });

  if (productFromApi) {
    console.log('   ✓ Product found via API-style query');
    console.log(`   Variations: ${productFromApi.variations.length}`);
    productFromApi.variations.forEach(v => {
      console.log(`   - Variation SKU: ${v.sku}`);
      console.log(`     Location details: ${v.variationLocationDetails.length} entries`);
      v.variationLocationDetails.forEach(vld => {
        const locName = locationMap.get(vld.locationId) || 'Unknown';
        console.log(`       - ${locName} (ID: ${vld.locationId}): qty=${vld.qtyAvailable}`);
      });
    });

    // Check if filtering would work
    const currentLocationId = 2; // Main Store
    const hasStock = productFromApi.variations.some(v => {
      const locationStock = v.variationLocationDetails.find(
        vl => vl.locationId === currentLocationId
      );
      return locationStock && parseFloat(String(locationStock.qtyAvailable)) > 0;
    });
    console.log(`\n   Filter result for Main Store (ID: ${currentLocationId}): ${hasStock ? '✓ PASSES' : '❌ FAILS'}`);
  } else {
    console.log('   ❌ Product NOT found via API-style query!');
  }

  await prisma.$disconnect();
}

diagnose().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
