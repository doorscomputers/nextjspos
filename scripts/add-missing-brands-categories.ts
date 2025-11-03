import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?pgbouncer=true&connection_limit=1',
    },
  },
});

async function addMissingData() {
  try {
    console.log('🚀 Adding missing brands and categories to Supabase...\n');

    // Get the business ID
    const business = await prisma.business.findFirst();
    if (!business) {
      throw new Error('No business found!');
    }
    const businessId = business.id;
    console.log(`📌 Business: ${business.name} (ID: ${businessId})\n`);

    // Missing Brands
    const missingBrands = [
      'A4TECH',
      'ASUS ROG',
      'GIGABYTE A16',
      'HMD',
      'TECNO',
      'HAVIT',
    ];

    console.log('🏷️  Creating missing brands...');
    let brandCount = 0;
    for (const brandName of missingBrands) {
      const existing = await prisma.brand.findFirst({
        where: { name: brandName, businessId },
      });

      if (!existing) {
        await prisma.brand.create({
          data: {
            name: brandName,
            businessId,
          },
        });
        console.log(`   ✓ Created brand: ${brandName}`);
        brandCount++;
      } else {
        console.log(`   ⏭️  Already exists: ${brandName}`);
      }
    }
    console.log(`✅ Created ${brandCount} brands\n`);

    // Missing Categories
    const missingCategories = [
      'BIOMETRICS',
      'NOTEBOOK - N95',
      'NOTEBOOK - R5-6600H',
      'HEADPHONE USB TYPE',
      'NOTEBOOK - R7-7445HS',
      'PROJECTOR 3LCD',
      'SMARTWATCH',
      'NOTEBOOK - X1P-42-100',
      'MEDIA DISK',
      'KBM WIRELESS',
    ];

    console.log('📁 Creating missing categories...');
    let categoryCount = 0;
    for (const categoryName of missingCategories) {
      const existing = await prisma.category.findFirst({
        where: { name: categoryName, businessId },
      });

      if (!existing) {
        await prisma.category.create({
          data: {
            name: categoryName,
            businessId,
            description: `Category for ${categoryName}`,
          },
        });
        console.log(`   ✓ Created category: ${categoryName}`);
        categoryCount++;
      } else {
        console.log(`   ⏭️  Already exists: ${categoryName}`);
      }
    }
    console.log(`✅ Created ${categoryCount} categories\n`);

    // Verify counts
    const totalBrands = await prisma.brand.count({ where: { businessId } });
    const totalCategories = await prisma.category.count({ where: { businessId } });

    console.log('📊 Summary:');
    console.log(`   Total Brands in Supabase: ${totalBrands}`);
    console.log(`   Total Categories in Supabase: ${totalCategories}`);
    console.log('\n✅ All missing brands and categories have been added!');
    console.log('\n💡 You can now run CSV ID Mapper successfully.');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addMissingData();
