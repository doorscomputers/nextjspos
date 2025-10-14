const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function assignLocation() {
  try {
    console.log('Assigning Warehouse location to Jheirone...\n');

    // Find Jheirone
    const user = await prisma.user.findFirst({
      where: { username: 'Jheirone' },
    });

    if (!user) {
      console.log('User not found!');
      return;
    }

    // Find Warehouse location
    const warehouse = await prisma.businessLocation.findFirst({
      where: {
        name: 'Warehouse',
        businessId: user.businessId,
      },
    });

    if (!warehouse) {
      console.log('Warehouse location not found!');
      return;
    }

    // Check if already assigned
    const existing = await prisma.userLocation.findUnique({
      where: {
        userId_locationId: {
          userId: user.id,
          locationId: warehouse.id,
        },
      },
    });

    if (existing) {
      console.log(`✓ Warehouse (ID: ${warehouse.id}) is already assigned to ${user.username}`);
    } else {
      // Assign location
      await prisma.userLocation.create({
        data: {
          userId: user.id,
          locationId: warehouse.id,
        },
      });
      console.log(`✓ Successfully assigned Warehouse (ID: ${warehouse.id}) to ${user.username}`);
    }

    // Verify
    const userLocs = await prisma.userLocation.findMany({
      where: { userId: user.id },
      include: { location: true },
    });

    console.log(`\nUser now has access to ${userLocs.length} location(s):`);
    userLocs.forEach(ul => {
      console.log(`  - ${ul.location.name} (ID: ${ul.locationId})`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

assignLocation();
