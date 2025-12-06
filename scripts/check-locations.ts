import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const locations = await prisma.businessLocation.findMany({
    select: { id: true, name: true }
  });
  console.log('=== ALL LOCATIONS ===');
  for (const loc of locations) {
    console.log(`ID: ${loc.id} | Name: ${loc.name}`);
  }
  await prisma.$disconnect();
}

main().catch(console.error);
