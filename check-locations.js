const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLocations() {
  try {
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: 1 }
    });

    console.log('Available locations:');
    locations.forEach(loc => {
      console.log(`- ID: ${loc.id}, Name: ${loc.name}`);
    });
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkLocations();
