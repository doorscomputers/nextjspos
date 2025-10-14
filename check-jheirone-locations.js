const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUser() {
  try {
    console.log('Checking Jheirone user and locations...\n');

    const user = await prisma.user.findFirst({
      where: {
        username: 'Jheirone',
      },
      include: {
        userLocations: {
          include: {
            location: true,
          },
        },
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log('User not found!');
      return;
    }

    console.log('User Details:');
    console.log(`  ID: ${user.id}`);
    console.log(`  Username: ${user.username}`);
    console.log(`  Business ID: ${user.businessId}`);
    console.log('');

    console.log('User Locations:');
    if (user.userLocations.length === 0) {
      console.log('  ⚠️ NO LOCATIONS ASSIGNED!');
    } else {
      user.userLocations.forEach(ul => {
        console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`);
      });
    }
    console.log('');

    console.log('User Roles:');
    user.roles.forEach(ur => {
      console.log(`  - ${ur.role.name} (ID: ${ur.role.id})`);
      console.log('    Permissions:');
      ur.role.permissions.forEach(rp => {
        console.log(`      - ${rp.permission.name}`);
      });
    });
    console.log('');

    // Check all locations in business
    const allLocations = await prisma.businessLocation.findMany({
      where: {
        businessId: user.businessId,
        deletedAt: null,
      },
    });

    console.log('All locations in business:');
    allLocations.forEach(loc => {
      console.log(`  - ${loc.name} (ID: ${loc.id}, Type: ${loc.type})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkUser();
