import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?pgbouncer=true&connection_limit=1',
    },
  },
});

async function addCategories() {
  try {
    const business = await prisma.business.findFirst();
    if (!business) throw new Error('No business found');
    const businessId = business.id;

    const categories = ['NUC', 'SIM BUNDLE', 'EARBUDS'];

    console.log('📁 Adding 3 more missing categories...\n');
    let added = 0;

    for (const name of categories) {
      const existing = await prisma.category.findFirst({
        where: { name, businessId },
      });

      if (!existing) {
        await prisma.category.create({
          data: {
            name,
            businessId,
            description: `Category for ${name}`,
          },
        });
        console.log(`   ✓ Created: ${name}`);
        added++;
      } else {
        console.log(`   ⏭️  Already exists: ${name}`);
      }
    }

    const total = await prisma.category.count({ where: { businessId } });
    console.log(`\n✅ Added ${added} categories`);
    console.log(`📊 Total categories in Supabase: ${total}`);
    console.log('\n💡 CSV ID Mapper should work perfectly now!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addCategories();
