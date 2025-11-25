const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing Warehouse Manager role permissions...\n');
  
  // Find Warehouse Manager role
  const role = await prisma.role.findFirst({
    where: { name: 'Warehouse Manager' }
  });
  
  if (!role) {
    console.log('❌ Warehouse Manager role not found!');
    await prisma.$disconnect();
    return;
  }
  
  console.log('✓ Found Warehouse Manager role (ID:', role.id, ')\n');
  
  // Find access_all_locations permission
  const perm = await prisma.permission.findFirst({
    where: { name: 'access_all_locations' }
  });
  
  if (!perm) {
    console.log('❌ access_all_locations permission not found!');
    await prisma.$disconnect();
    return;
  }
  
  console.log('✓ Found access_all_locations permission (ID:', perm.id, ')\n');
  
  // Delete the permission from Warehouse Manager role
  const deleted = await prisma.rolePermission.deleteMany({
    where: {
      roleId: role.id,
      permissionId: perm.id
    }
  });
  
  if (deleted.count > 0) {
    console.log('✅ Removed access_all_locations from Warehouse Manager role');
    console.log('   Deleted', deleted.count, 'record(s)\n');
    console.log('🎯 Warehouse Manager users will now be REQUIRED to scan RFID location codes during login!');
  } else {
    console.log('⚠️  No permission found to delete (might already be removed)');
  }
  
  await prisma.$disconnect();
}

main().catch(console.error);
