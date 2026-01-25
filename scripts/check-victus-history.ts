import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check what entity types are being logged
  console.log('=== Audit Log Entity Types & Actions ===');
  const entityTypes = await prisma.auditLog.groupBy({
    by: ['entityType', 'action'],
    _count: true,
    orderBy: { _count: { id: 'desc' } }
  });

  entityTypes.forEach(e => {
    console.log(`${e.entityType} | ${e.action} | Count: ${e._count}`);
  });

  // Check recent audit logs
  console.log('\n=== Recent Audit Logs (last 20) ===');
  const recent = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  recent.forEach((log, i) => {
    console.log(`${i+1}. ${log.createdAt.toISOString().substring(0,10)} | ${log.entityType} | ${log.action} | ${log.username}`);
    console.log(`   ${(log.description || '').substring(0, 100)}`);
  });

  // Check audit logs for this product
  console.log('\n=== Audit Logs for HP VICTUS ===');
  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { description: { contains: 'VICTUS', mode: 'insensitive' } },
          { description: { contains: '377794947713' } },
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    console.log('Total audit logs found:', logs.length);
    logs.forEach((log, i) => {
      console.log(`${i+1}. ${log.createdAt.toISOString()} | ${log.action} | ${log.username}`);
      console.log(`   ${log.description?.substring(0, 120)}`);
    });
  } catch (e) {
    console.log('Error checking audit logs:', e);
  }

  console.log('\n');

  // Find all history for SKU 377794947713 (HP VICTUS)
  const variation = await prisma.productVariation.findFirst({
    where: { sku: '377794947713' },
    include: {
      product: true
    }
  });

  if (!variation) {
    console.log('Product not found');
    return;
  }

  console.log('=== HP VICTUS Product Details ===');
  console.log('Product ID:', variation.productId);
  console.log('Variation ID:', variation.id);
  console.log('SKU:', variation.sku);
  console.log('Name:', variation.product.name);
  console.log('Default Selling Price:', Number(variation.defaultSellingPrice));
  console.log('Default Purchase Price:', Number(variation.defaultPurchasePrice));
  console.log('Product Created At:', variation.product.createdAt);
  console.log('Product Updated At:', variation.product.updatedAt);
  console.log('');

  // Check all history for this variation
  const history = await prisma.productHistory.findMany({
    where: { productVariationId: variation.id },
    orderBy: { createdAt: 'asc' }
  });

  console.log('=== All Product History Records ===');
  console.log('Total records:', history.length);
  console.log('');

  history.forEach((h, i) => {
    console.log(`${i+1}. Date: ${h.createdAt.toISOString()}`);
    console.log(`   Type: ${h.transactionType} | ${h.referenceType}`);
    console.log(`   Unit Cost: ${h.unitCost ? Number(h.unitCost) : 'N/A'}`);
    console.log(`   Created By: ${h.createdByName}`);
    console.log('');
  });

  // Check VariationLocationDetails for price info
  const vld = await prisma.variationLocationDetails.findMany({
    where: { productVariationId: variation.id }
  });

  // Get locations
  const locationIds = vld.map(v => v.locationId);
  const locations = await prisma.businessLocation.findMany({
    where: { id: { in: locationIds } },
    select: { id: true, name: true }
  });
  const locationMap = new Map(locations.map(l => [l.id, l.name]));

  console.log('=== Location Price Details ===');
  vld.forEach(v => {
    console.log(`${locationMap.get(v.locationId) || 'Location ' + v.locationId}:`);
    console.log(`  Selling Price: ${Number(v.sellingPrice)}`);
    console.log(`  Updated At: ${v.updatedAt}`);
    console.log(`  Last Price Updated By: ${v.lastPriceUpdatedBy || 'N/A'}`);
    console.log(`  Last Price Updated At: ${v.lastPriceUpdatedAt || 'N/A'}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
