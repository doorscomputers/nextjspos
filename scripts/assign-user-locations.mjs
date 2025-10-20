import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function assignUserLocations() {
  console.log('\n🔧 Starting user location assignment...\n');

  // Define user-location mappings
  const assignments = [
    // Superadmin - assign to Main Store (they also have ACCESS_ALL_LOCATIONS permission)
    { username: 'superadmin', locationIds: [1] }, // Main Store

    // Main verifier - Main Warehouse
    { username: 'mainverifier', locationIds: [2] }, // Main Warehouse

    // Warehouse sender - Main Warehouse
    { username: 'warehousesender', locationIds: [2] }, // Main Warehouse

    // Main cashier - Main Store
    { username: 'cashiermain', locationIds: [1] }, // Main Store

    // Main manager - assign to main locations
    { username: 'mainmgr', locationIds: [1, 2] }, // Main Store + Main Warehouse

    // Regional managers - assign to their specific branches
    { username: 'makati_mgr', locationIds: [3] }, // Bambang (placeholder)
    { username: 'pasig_mgr', locationIds: [4] }, // Tuguegarao (placeholder)
    { username: 'cebu_mgr', locationIds: [5] }, // Santiago (placeholder)

    // Regular users
    { username: 'Jheirone', locationIds: [1] }, // Main Store
    { username: 'Gemski', locationIds: [1] }, // Main Store
  ];

  for (const assignment of assignments) {
    try {
      // Find user
      const user = await prisma.user.findFirst({
        where: { username: assignment.username }
      });

      if (!user) {
        console.log(`⚠️  User '${assignment.username}' not found - skipping`);
        continue;
      }

      // Delete existing assignments for this user
      await prisma.userLocation.deleteMany({
        where: { userId: user.id }
      });

      // Create new assignments
      for (const locationId of assignment.locationIds) {
        const location = await prisma.businessLocation.findUnique({
          where: { id: locationId }
        });

        if (!location) {
          console.log(`⚠️  Location ID ${locationId} not found - skipping`);
          continue;
        }

        await prisma.userLocation.create({
          data: {
            userId: user.id,
            locationId: locationId
          }
        });

        console.log(`✅ Assigned '${user.username}' to '${location.name}'`);
      }
    } catch (error) {
      console.error(`❌ Error assigning locations for ${assignment.username}:`, error.message);
    }
  }

  console.log('\n✨ Location assignment complete!\n');

  // Verify assignments
  console.log('=== VERIFICATION ===\n');
  const users = await prisma.user.findMany({
    include: {
      userLocations: {
        include: {
          location: true
        }
      }
    },
    where: {
      username: {
        in: assignments.map(a => a.username)
      }
    }
  });

  users.forEach(user => {
    console.log(`${user.username}:`);
    user.userLocations.forEach(ul => {
      console.log(`  ✓ ${ul.location.name}`);
    });
    if (user.userLocations.length === 0) {
      console.log(`  ⚠️  No locations assigned`);
    }
  });

  await prisma.$disconnect();
}

assignUserLocations().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
