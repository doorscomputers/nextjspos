const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        businessId: true,
        userLocations: {
          include: {
            location: true
          }
        }
      }
    });

    console.log('Available users:');
    users.forEach(user => {
      console.log(`\n- Username: ${user.username}`);
      console.log(`  Business ID: ${user.businessId}`);
      console.log(`  Accessible Locations: ${user.userLocations.length}`);
      user.userLocations.forEach(al => {
        console.log(`    - ${al.location.name}`);
      });
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUsers();
