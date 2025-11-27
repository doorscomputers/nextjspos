const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
  console.log('=== DIAGNOSTIC QUERIES ===\n');

  // Get locations first
  const locations = await prisma.businessLocation.findMany();
  const locationMap = new Map(locations.map(l => [l.id, l.name]));

  // Query 1: Check SKUs
  console.log('1. Checking if SKUs exist...');
  const variations = await prisma.productVariation.findMany({
    where: { sku: { in: ['4711421000116', '4711421978583'] } },
    include: { product: true, variationLocationDetails: true }
  });

  if (variations.length === 0) {
    console.log('   SKUs NOT FOUND in database!');
  } else {
    variations.forEach(v => {
      console.log('   SKU:', v.sku);
      console.log('   Product:', v.product.name);
      console.log('   Product Active:', v.product.isActive);
      console.log('   Product Deleted:', v.product.deletedAt ? 'YES' : 'No');
      console.log('   Stock at locations:');
      if (v.variationLocationDetails.length === 0) {
        console.log('     NO STOCK RECORDS');
      } else {
        v.variationLocationDetails.forEach(vld => {
          const locName = locationMap.get(vld.locationId) || 'Unknown';
          console.log('     -', locName, ':', vld.qtyAvailable.toString());
        });
      }
      console.log('');
    });
  }

  // Query 2: Check Main Store location
  console.log('2. All locations:');
  locations.forEach(l => console.log('   -', l.name, '(ID:', l.id + ')'));

  // Query 3: Check user's shift
  console.log('\n3. Checking JASMINKATECashierMain user and shift...');
  const user = await prisma.user.findFirst({
    where: { username: 'JASMINKATECashierMain' },
    include: { userLocations: { include: { location: true } } }
  });

  if (!user) {
    console.log('   User NOT FOUND!');
  } else {
    console.log('   User ID:', user.id);
    console.log('   Assigned Locations:', user.userLocations.map(ul => ul.location.name).join(', ') || 'NONE');

    // Check active shift
    const shift = await prisma.cashierShift.findFirst({
      where: { userId: user.id, closedAt: null },
      include: { location: true }
    });

    if (shift) {
      console.log('   Active Shift Location:', shift.location.name, '(ID:', shift.locationId + ')');
    } else {
      console.log('   NO ACTIVE SHIFT');
    }
  }

  await prisma.$disconnect();
}

diagnose().catch(e => { console.error('Error:', e.message); process.exit(1); });
