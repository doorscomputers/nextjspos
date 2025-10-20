import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkSetup() {
  console.log('=== BUSINESS LOCATIONS ===');
  const locations = await prisma.businessLocation.findMany({
    select: {
      id: true,
      name: true,
      isActive: true,
      businessId: true
    },
    orderBy: { name: 'asc' }
  });
  locations.forEach(loc => {
    console.log(`ID: ${loc.id} | Name: ${loc.name} | Active: ${loc.isActive}`);
  });

  console.log('\n=== EXISTING USERS AND LOCATIONS ===');
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      businessId: true,
      roles: {
        select: {
          role: {
            select: { name: true }
          }
        }
      },
      userLocations: {
        select: {
          location: {
            select: { name: true }
          }
        }
      }
    },
    orderBy: { username: 'asc' }
  });

  users.forEach(user => {
    const roles = user.roles.map(r => r.role.name).join(', ');
    const locations = user.userLocations.map(l => l.location.name).join(', ');
    console.log(`Username: ${user.username}`);
    console.log(`  Roles: ${roles}`);
    console.log(`  Locations: ${locations || 'NONE'}`);
    console.log('');
  });

  console.log('\n=== AVAILABLE ROLES ===');
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
      businessId: true
    },
    orderBy: { name: 'asc' }
  });
  roles.forEach(role => {
    console.log(`ID: ${role.id} | Name: ${role.name}`);
  });

  await prisma.$disconnect();
}

checkSetup().catch(console.error);
