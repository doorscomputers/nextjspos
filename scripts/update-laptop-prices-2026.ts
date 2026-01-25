import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== BULK PRICE UPDATE FROM EXCEL ===');
  console.log('Reading Excel file...');

  // Read Excel file
  const workbook = XLSX.readFile('c:/Users/Warenski/Downloads/BEST PRICE FOR 2026 (PARTIAL) laptop.xlsx');
  const sheetName = workbook.SheetNames[0];
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as any[];

  console.log('Total rows in Excel:', data.length);

  // Get all active locations
  const locations = await prisma.businessLocation.findMany({
    where: { businessId: 1, isActive: true },
    select: { id: true, name: true }
  });
  console.log('Active locations:', locations.length);

  const now = new Date();
  const userId = 1; // superadmin
  const businessId = 1;

  let updated = 0;
  const notFound: string[] = [];
  const errors: any[] = [];

  for (const row of data) {
    const itemName = row['Item Name']?.toString().trim();
    const newPrice = parseFloat(row['Selling Price'] || row['Retail Price']);

    if (!itemName || isNaN(newPrice)) {
      errors.push({ itemName, error: 'Invalid data' });
      continue;
    }

    // Find product by exact name match
    const product = await prisma.product.findFirst({
      where: {
        businessId,
        name: itemName
      },
      include: {
        variations: {
          include: {
            variationLocationDetails: {
              where: { locationId: { in: locations.map(l => l.id) } }
            }
          }
        }
      }
    });

    if (!product) {
      notFound.push(itemName);
      continue;
    }

    // Update each variation
    for (const variation of product.variations) {
      // Update master variation price
      await prisma.productVariation.update({
        where: { id: variation.id },
        data: { sellingPrice: newPrice }
      });

      // Update all location prices
      for (const location of locations) {
        const existingVld = variation.variationLocationDetails.find(v => v.locationId === location.id);
        const oldPrice = existingVld ? Number(existingVld.sellingPrice || 0) : 0;

        await prisma.variationLocationDetails.upsert({
          where: {
            productVariationId_locationId: {
              productVariationId: variation.id,
              locationId: location.id
            }
          },
          update: {
            sellingPrice: newPrice,
            lastPriceUpdate: now,
            lastPriceUpdatedBy: userId
          },
          create: {
            productId: product.id,
            productVariationId: variation.id,
            locationId: location.id,
            qtyAvailable: 0,
            sellingPrice: newPrice,
            lastPriceUpdate: now,
            lastPriceUpdatedBy: userId
          }
        });

        // Log to PriceChangeHistory if price changed
        if (oldPrice !== newPrice) {
          await prisma.priceChangeHistory.create({
            data: {
              businessId,
              productVariationId: variation.id,
              locationId: location.id,
              oldPrice: oldPrice || null,
              newPrice,
              changedBy: userId,
              changeSource: 'script',
              sku: product.sku || null,
              productName: product.name
            }
          });
        }
      }
    }

    updated++;
    if (updated % 10 === 0) {
      console.log('Progress:', updated, '/', data.length);
    }
  }

  console.log('');
  console.log('=== RESULTS ===');
  console.log('✅ Updated:', updated);
  console.log('❌ Not Found:', notFound.length);

  if (notFound.length > 0) {
    console.log('');
    console.log('Products NOT found in database:');
    for (const name of notFound) {
      console.log('  -', name);
    }
  }

  if (errors.length > 0) {
    console.log('');
    console.log('Errors:', errors.length);
  }
}

main()
  .catch(e => console.error('Error:', e.message))
  .finally(() => prisma.$disconnect());
