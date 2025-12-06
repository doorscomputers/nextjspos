import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function investigate() {
  // Find the product
  const product = await prisma.product.findFirst({
    where: {
      name: { contains: 'TRANSCEND JF790 32GB' }
    },
    include: {
      variations: true
    }
  });

  if (!product) {
    console.log('Product not found');
    return;
  }

  console.log('=== PRODUCT INFO ===');
  console.log('Product ID:', product.id);
  console.log('Name:', product.name);
  console.log('SKU:', product.sku);
  console.log('Created At:', product.createdAt);

  // Get all variations
  console.log('\n=== VARIATIONS ===');
  for (const v of product.variations) {
    console.log('Variation ID:', v.id, 'SKU:', v.sku);
  }

  const variationIds = product.variations.map(v => v.id);

  // Check ProductHistory - ALL records for Bambang location (ID 2)
  console.log('\n=== ALL PRODUCT HISTORY FOR BAMBANG (ordered by date) ===');
  const history = await prisma.productHistory.findMany({
    where: {
      productVariationId: { in: variationIds },
      locationId: 2 // Bambang
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('Total history records:', history.length);
  for (const h of history) {
    console.log(`[${h.createdAt.toISOString()}] ${h.transactionType} | Qty Change: ${h.quantityChange} | Balance After: ${h.quantityAfter} | Loc ID: ${h.locationId} | Ref: ${h.referenceNo || 'N/A'}`);
  }

  // Check VariationLocationDetails
  console.log('\n=== VARIATION LOCATION DETAILS ===');
  const vld = await prisma.variationLocationDetails.findMany({
    where: {
      productVariationId: { in: variationIds }
    }
  });

  for (const v of vld) {
    console.log(`Location ID: ${v.locationId} | Qty Available: ${v.qtyAvailable}`);
  }

  // Check if there's a beginning_stock record
  console.log('\n=== BEGINNING STOCK RECORDS ===');
  const beginningStock = await prisma.productHistory.findMany({
    where: {
      productVariationId: { in: variationIds },
      transactionType: 'beginning_stock'
    }
  });
  console.log('Beginning stock records found:', beginningStock.length);
  for (const b of beginningStock) {
    console.log(`[${b.createdAt.toISOString()}] ${b.transactionType} | Qty: ${b.quantityChange} | Location: ${b.locationId}`);
  }

  // Check CSV import records
  console.log('\n=== CSV IMPORT / ADJUSTMENT RECORDS ===');
  const adjustments = await prisma.productHistory.findMany({
    where: {
      productVariationId: { in: variationIds },
      transactionType: { in: ['adjustment', 'csv_import', 'beginning_stock', 'opening_stock', 'stock_adjustment'] }
    }
  });
  console.log('Adjustment/Import records:', adjustments.length);
  for (const a of adjustments) {
    console.log(`[${a.createdAt.toISOString()}] ${a.transactionType} | Qty: ${a.quantityChange} | Ref: ${a.referenceNo} | Location: ${a.locationId}`);
  }

  // Check the earliest record for this product at Bambang
  console.log('\n=== EARLIEST RECORD AT BAMBANG ===');
  const earliest = await prisma.productHistory.findFirst({
    where: {
      productVariationId: { in: variationIds },
      locationId: 2
    },
    orderBy: { createdAt: 'asc' }
  });
  if (earliest) {
    console.log(`Earliest record: ${earliest.transactionType} at ${earliest.createdAt.toISOString()}`);
    console.log(`Quantity Change: ${earliest.quantityChange}, Balance After: ${earliest.quantityAfter}`);
  }

  // Check ALL Sales for this product
  console.log('\n=== ALL SALES FOR THIS PRODUCT ===');
  const sales = await prisma.saleItem.findMany({
    where: {
      productVariationId: { in: variationIds }
    },
    include: {
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          createdAt: true,
          status: true,
          locationId: true
        }
      }
    },
    orderBy: {
      sale: { createdAt: 'asc' }
    }
  });

  console.log('Total sale items:', sales.length);
  for (const s of sales) {
    console.log(`[${s.sale.createdAt.toISOString()}] Sale ID: ${s.sale.id} | Invoice: ${s.sale.invoiceNumber} | Qty: ${s.quantity} | Status: ${s.sale.status} | Location: ${s.sale.locationId}`);
  }

  // Check ALL ProductHistory records for this product (all locations)
  console.log('\n=== ALL PRODUCT HISTORY (ALL LOCATIONS) ===');
  const allHistory = await prisma.productHistory.findMany({
    where: {
      productVariationId: { in: variationIds }
    },
    orderBy: { createdAt: 'asc' }
  });

  console.log('Total history records:', allHistory.length);
  for (const h of allHistory) {
    console.log(`[${h.createdAt.toISOString()}] ${h.transactionType} | Qty Change: ${h.quantityChange} | Balance After: ${h.quantityAfter} | Loc ID: ${h.locationId} | Ref: ${h.referenceNo || 'N/A'}`);
  }

  await prisma.$disconnect();
}

investigate().catch(console.error);
