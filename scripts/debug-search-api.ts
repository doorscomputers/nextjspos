import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testSearch() {
  try {
    const locationId = 1; // Main Warehouse
    const searchTrimmed = 'Sample';
    const withStock = true;

    console.log('=== Testing Product Search API Logic ===');
    console.log('Location ID:', locationId);
    console.log('Search term:', searchTrimmed);
    console.log('With stock filter:', withStock);

    const searchCondition = { contains: searchTrimmed, mode: 'insensitive' as const };

    // Search across multiple fields
    const searchOrConditions = [
      { name: searchCondition },
      { sku: searchCondition },
      { description: searchCondition },
      {
        variations: {
          some: {
            OR: [
              { name: searchCondition },
              { sku: searchCondition }
            ],
            deletedAt: null
          }
        }
      }
    ];

    const whereConditions: any = {
      businessId: 1,
      isActive: true,
      deletedAt: null,
    };

    // Add stock filter (same as API)
    if (withStock && locationId) {
      whereConditions.AND = [
        { OR: searchOrConditions },
        {
          OR: [
            {
              variations: {
                some: {
                  deletedAt: null,
                  variationLocationDetails: {
                    some: {
                      locationId: locationId,
                      qtyAvailable: { gt: 0 },
                    },
                  },
                },
              },
            },
            {
              notForSelling: true,
            },
          ]
        }
      ];
    } else {
      whereConditions.OR = searchOrConditions;
    }

    console.log('\nQuery whereConditions:', JSON.stringify(whereConditions, null, 2));

    const nameMatches = await prisma.product.findMany({
      where: whereConditions,
      include: {
        variations: {
          where: { deletedAt: null },
          include: {
            variationLocationDetails: {
              where: {
                locationId: locationId,
              },
              select: {
                qtyAvailable: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
      take: 20,
    });

    console.log('\n=== Raw Results from Prisma ===');
    console.log('Products found:', nameMatches.length);

    nameMatches.forEach(p => {
      console.log('\nProduct:', p.name, '(ID:', p.id, ')');
      p.variations.forEach(v => {
        const stockRecord = v.variationLocationDetails?.[0];
        const stock = stockRecord ? Number(stockRecord.qtyAvailable) : 0;
        console.log('  Variation:', v.name, '| ID:', v.id);
        console.log('    variationLocationDetails:', JSON.stringify(v.variationLocationDetails));
        console.log('    Stock:', stock);
      });
    });

    // Now filter like the API does
    const results = nameMatches
      .filter(p => p.variations && p.variations.length > 0)
      .map(product => {
        const variations = product.variations
          .filter(v => {
            if (withStock && locationId && v.variationLocationDetails && !product.notForSelling) {
              const stockRecord = v.variationLocationDetails[0];
              const stock = stockRecord ? Number(stockRecord.qtyAvailable) : 0;
              console.log(`  Filter check: ${product.name} - ${v.name}: stock=${stock}, pass=${stock > 0}`);
              return stock > 0;
            }
            return true;
          })
          .map((v: any) => ({
            id: v.id,
            name: v.name,
            sku: v.sku,
            stock: v.variationLocationDetails?.[0]?.qtyAvailable
              ? Number(v.variationLocationDetails[0].qtyAvailable)
              : 0,
          }));

        return {
          id: product.id,
          name: product.name,
          variations,
        };
      })
      .filter(p => p.variations.length > 0);

    console.log('\n=== Final Filtered Results ===');
    console.log('Products after filtering:', results.length);
    results.forEach(p => {
      console.log('\nProduct:', p.name);
      p.variations.forEach(v => {
        console.log('  Variation:', v.name, '| Stock:', v.stock);
      });
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSearch();
