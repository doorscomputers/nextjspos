import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern',
    },
  },
});

async function checkLocalData() {
  try {
    console.log('🔍 Checking LOCAL PostgreSQL database...\n');

    // Check businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
      },
    });
    console.log(`🏢 Businesses: ${businesses.length}`);
    businesses.forEach(b => console.log(`   - ID ${b.id}: ${b.name}`));

    // Check locations
    const locations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true,
        businessId: true,
        business: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
    console.log(`\n📍 Business Locations: ${locations.length}`);
    locations.forEach(loc => console.log(`   - ID ${loc.id}: ${loc.name} (Business: ${loc.business.name})`));

    // Check roles
    const roles = await prisma.role.findMany({
      select: {
        id: true,
        name: true,
        businessId: true,
        business: {
          select: {
            name: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
    console.log(`\n👔 Roles: ${roles.length}`);
    roles.forEach(role => {
      console.log(`   - ID ${role.id}: ${role.name} (Business: ${role.business.name}, ${role.permissions.length} permissions)`);
    });

    // Check users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        allowLogin: true,
        business: {
          select: {
            name: true,
          },
        },
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        id: 'asc',
      },
    });
    console.log(`\n👤 Users: ${users.length}`);
    users.forEach(user => {
      console.log(`   - ID ${user.id}: ${user.username} (${user.business.name})`);
      console.log(`     Roles: ${user.roles.map(r => r.role.name).join(', ') || 'None'}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocalData();
