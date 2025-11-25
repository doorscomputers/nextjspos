const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Get Jheiron's role IDs
  const jheiron = await prisma.user.findUnique({
    where: { username: 'Jheiron' },
    select: {
      id: true,
      roles: {
        select: {
          roleId: true,
          role: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  const roleIds = jheiron.roles.map(r => r.roleId);
  console.log('Jheiron Role IDs:', roleIds);
  console.log('Jheiron Roles:', jheiron.roles.map(r => r.role.name));
  console.log('');
  
  // Find access_all_locations permission
  const perm = await prisma.permission.findFirst({
    where: { name: 'access_all_locations' }
  });
  
  if (!perm) {
    console.log('access_all_locations permission not found!');
    await prisma.$disconnect();
    return;
  }
  
  console.log('access_all_locations permission ID:', perm.id);
  console.log('');
  
  // Find which roles have this permission
  const rolePerms = await prisma.rolePermission.findMany({
    where: {
      permissionId: perm.id,
      roleId: { in: roleIds }
    },
    include: {
      role: {
        select: {
          name: true
        }
      }
    }
  });
  
  console.log('Roles granting access_all_locations to Jheiron:');
  rolePerms.forEach(rp => {
    console.log('  -', rp.role.name, '(Role ID:', rp.roleId, ')');
  });
  
  await prisma.$disconnect();
}

main().catch(console.error);
