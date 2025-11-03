import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

async function checkSupabaseData() {
  try {
    console.log('🔍 Checking Supabase database...\n');

    // Check users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        allowLogin: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });
    console.log(`👤 Users: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ${user.username} (allowLogin: ${user.allowLogin})`);
      console.log(`     Roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`);
    });

    // Check businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    console.log(`\n🏢 Businesses: ${businesses.length}`);
    businesses.forEach(b => console.log(`   - ${b.name}`));

    // Check locations
    const locations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true,
        businessId: true,
      },
    });
    console.log(`\n📍 Business Locations: ${locations.length}`);
    locations.forEach(loc => console.log(`   - ${loc.name} (Business ID: ${loc.businessId})`));

    // Check roles
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        businessId: true,
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    console.log(`\n👔 Roles: ${roles.length}`);
    roles.forEach(role => {
      console.log(`   - ${role.name} (${role.permissions.length} permissions)`);
    });

    // Check permissions
    const permissions = await prisma.permission.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    console.log(`\n🔐 Permissions: ${permissions.length}`);

    // Check currencies
    const currencies = await prisma.currency.findMany({
      select: {
        id: true,
        code: true,
        name: true,
      },
    });
    console.log(`\n💰 Currencies: ${currencies.length}`);
    currencies.forEach(c => console.log(`   - ${c.code} (${c.name})`));

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSupabaseData();
