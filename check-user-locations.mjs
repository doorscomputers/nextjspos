import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkUser() {
  // Get all users with their assigned locations
  const users = await prisma.user.findMany({
    include: {
      userLocations: {
        include: {
          location: true
        }
      },
      business: true
    },
    take: 10
  });

  console.log('\n=== USERS AND THEIR ASSIGNED LOCATIONS ===\n');
  users.forEach(user => {
    console.log(`User: ${user.username} (ID: ${user.id}) | Business: ${user.business?.name || 'N/A'}`);
    console.log(`  Assigned Locations: ${user.userLocations.length}`);
    user.userLocations.forEach(ul => {
      console.log(`    - ${ul.location.name} (ID: ${ul.location.id})`);
    });
    console.log('');
  });

  // Get all locations
  const locations = await prisma.businessLocation.findMany({
    where: { deletedAt: null },
    take: 20
  });

  console.log('\n=== ALL AVAILABLE LOCATIONS ===\n');
  locations.forEach(loc => {
    console.log(`ID: ${loc.id} | Name: ${loc.name} | Business ID: ${loc.businessId}`);
  });

  await prisma.$disconnect();
}

checkUser().catch(console.error);
