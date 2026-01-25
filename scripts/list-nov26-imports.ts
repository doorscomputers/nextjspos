import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all ProductHistory entries from November 26, 2025 with csv_import reference
  const startDate = new Date('2025-11-26T00:00:00.000Z');
  const endDate = new Date('2025-11-26T23:59:59.999Z');

  const history = await prisma.productHistory.findMany({
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      referenceType: 'csv_import'
    },
    orderBy: {
      createdAt: 'asc'
    }
  });

  console.log('=== Products Imported via CSV on November 26, 2025 ===\n');
  console.log('Total records found:', history.length);
  console.log('');

  if (history.length > 0) {
    // Get unique product variation IDs
    const variationIds = [...new Set(history.map(h => h.productVariationId))];

    // Fetch variations with product info
    const variations = await prisma.productVariation.findMany({
      where: { id: { in: variationIds } },
      include: {
        product: {
          select: { id: true, name: true, sku: true }
        }
      }
    });

    const variationMap = new Map(variations.map(v => [v.id, v]));

    // Get unique user IDs
    const userIds = [...new Set(history.map(h => h.createdBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, username: true }
    });
    const userMap = new Map(users.map(u => [u.id, u]));

    // Filter to show only notebooks (products with high prices > 50000 likely laptops)
    const laptopHistory = history.filter(h => {
      const variation = variationMap.get(h.productVariationId);
      const price = variation?.defaultSellingPrice ? Number(variation.defaultSellingPrice) : 0;
      const name = variation?.product?.name || '';
      return price > 50000 || name.toLowerCase().includes('victus') || name.toLowerCase().includes('notebook') || name.toLowerCase().includes('laptop');
    });

    console.log(`\nFiltered to laptops/high-value items: ${laptopHistory.length} records\n`);

    laptopHistory.forEach((h, i) => {
      const variation = variationMap.get(h.productVariationId);
      const user = userMap.get(h.createdBy);

      const sku = variation?.sku || 'N/A';
      const name = (variation?.product?.name || 'N/A').substring(0, 70);
      const unitCost = h.unitCost ? Number(h.unitCost).toLocaleString() : 'N/A';
      const currentPrice = variation?.defaultSellingPrice ? Number(variation.defaultSellingPrice).toLocaleString() : 'N/A';
      const username = user?.username || h.createdByName || 'N/A';
      const time = h.createdAt.toISOString();

      console.log(`${i+1}. SKU: ${sku}`);
      console.log(`   Product: ${name}`);
      console.log(`   Unit Cost: ${unitCost} | Current Price: ${currentPrice}`);
      console.log(`   Created By: ${username} | Time: ${time}`);
      console.log('');
    });
  }

  // Also check if there are any other reference types on that day
  console.log('\n=== All ProductHistory Reference Types on November 26, 2025 ===\n');

  const allHistory = await prisma.productHistory.groupBy({
    by: ['referenceType', 'transactionType'],
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true
  });

  allHistory.forEach(h => {
    console.log(`Reference: ${h.referenceType} | Transaction: ${h.transactionType} | Count: ${h._count}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
