const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: 'Jheiron' },
    select: {
      id: true,
      username: true,
      roles: {
        select: {
          role: {
            select: {
              name: true,
              permissions: {
                select: {
                  permission: {
                    select: {
                      name: true
                    }
                  }
                }
              }
            }
          }
        }
      },
      permissions: {
        select: {
          permission: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  console.log('User:', user?.username);
  console.log('ID:', user?.id);
  console.log('\nRoles:');
  user?.roles.forEach(ur => {
    console.log('  -', ur.role.name);
  });
  
  console.log('\nRole Permissions:');
  const rolePerms = user?.roles.flatMap(ur => ur.role.permissions.map(p => p.permission.name)) || [];
  const uniqueRolePerms = [...new Set(rolePerms)];
  uniqueRolePerms.forEach(p => console.log('  -', p));
  
  console.log('\nDirect Permissions:');
  user?.permissions.forEach(up => {
    console.log('  -', up.permission.name);
  });
  
  console.log('\nChecking for ACCESS_ALL_LOCATIONS:');
  const allPerms = [...uniqueRolePerms, ...user.permissions.map(p => p.permission.name)];
  const hasAccessAll = allPerms.some(p => p.toLowerCase().includes('access') && p.toLowerCase().includes('location'));
  console.log('Has ACCESS_ALL_LOCATIONS or similar:', hasAccessAll);
  if (hasAccessAll) {
    console.log('Found:', allPerms.filter(p => p.toLowerCase().includes('access') && p.toLowerCase().includes('location')));
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
