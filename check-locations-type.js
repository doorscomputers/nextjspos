const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkLocations() {
  try {
    console.log('Checking all locations...\n');

    const locations = await prisma.businessLocation.findMany({
      select: {
        id: true,
        name: true,
        locationType: true,
      }
    });

    console.log('All Business Locations:');
    console.log(JSON.stringify(locations, null, 2));

    // Also check user's assigned locations
    const users = await prisma.user.findMany({
      where: {
        username: 'Jheirone'
      },
      select: {
        id: true,
        username: true,
        userLocations: {
          select: {
            locationId: true,
            location: {
              select: {
                id: true,
                name: true,
                locationType: true
              }
            }
          }
        }
      }
    });

    console.log('\n\nUser Jheirone assigned locations:');
    console.log(JSON.stringify(users, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocations();
