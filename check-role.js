const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'warehousemanager' },
    select: {
      id: true,
      username: true,
      roles: {
        select: {
          role: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  console.log('User:', user?.username);
  console.log('Roles:', user?.roles.map(r => r.role.name).join(', '));
  
  await prisma.$disconnect();
}

main().catch(console.error);
