import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createTestReturn() {
  try {
    console.log('Creating test supplier return...');

    // Get first supplier
    const supplier = await prisma.supplier.findFirst({
      where: { deletedAt: null }
    });

    if (!supplier) {
      console.log('❌ No suppliers found. Please create a supplier first.');
      process.exit(1);
    }

    // Get first location
    const location = await prisma.businessLocation.findFirst({
      where: { deletedAt: null }
    });

    if (!location) {
      console.log('❌ No locations found. Please create a location first.');
      process.exit(1);
    }

    // Get first product with variation
    const product = await prisma.product.findFirst({
      where: { deletedAt: null },
      include: { variations: true }
    });

    if (!product || !product.variations[0]) {
      console.log('❌ No products found. Please create a product first.');
      process.exit(1);
    }

    console.log('Found:', {
      supplier: supplier.name,
      location: location.name,
      product: product.name,
      variation: product.variations[0].name
    });

    // Create test return
    const returnData = await prisma.supplierReturn.create({
      data: {
        businessId: supplier.businessId,
        locationId: location.id,
        supplierId: supplier.id,
        returnNumber: `SR-TEST-${Date.now()}`,
        returnDate: new Date(),
        status: 'pending',
        returnReason: 'defective',
        totalAmount: 500.00,
        notes: 'Test return for report verification',
        createdBy: 1,
        items: {
          create: [
            {
              productId: product.id,
              productVariationId: product.variations[0].id,
              quantity: 2,
              unitCost: 250.00,
              condition: 'defective',
              notes: 'Test item - defective units'
            }
          ]
        }
      }
    });

    console.log('\n✅ Test return created successfully!');
    console.log('Return Number:', returnData.returnNumber);
    console.log('Supplier:', supplier.name);
    console.log('Location:', location.name);
    console.log('Total Amount:', returnData.totalAmount.toString());
    console.log('\n🎯 Now refresh your Purchase Returns Report at:');
    console.log('http://localhost:3004/dashboard/reports/purchase-returns');

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createTestReturn();
