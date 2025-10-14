const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixAllBranchAdminPermissions() {
  try {
    console.log('🔧 Adding missing permissions to "All Branch Admin" role...\n');

    // Get the role
    const role = await prisma.role.findFirst({
      where: { name: 'All Branch Admin' }
    });

    if (!role) {
      console.log('❌ "All Branch Admin" role not found!');
      return;
    }

    console.log('✅ Found role:', role.name);
    console.log('');

    // Permissions to add
    const permissionsToAdd = [
      'payment.view',
      'payment.create',
      'payment.approve',
      'payment.update',
      'payment.delete',
      'purchase.view_cost',
    ];

    let added = 0;
    let skipped = 0;

    for (const permName of permissionsToAdd) {
      // Find permission
      const permission = await prisma.permission.findFirst({
        where: { name: permName }
      });

      if (!permission) {
        console.log(`⚠️  Permission not found: ${permName}`);
        continue;
      }

      // Check if already assigned
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id
          }
        }
      });

      if (existing) {
        console.log(`⏭️  Already has: ${permName}`);
        skipped++;
        continue;
      }

      // Add permission to role
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id
        }
      });

      console.log(`✅ Added: ${permName}`);
      added++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Added: ${added} permissions`);
    console.log(`   Skipped: ${skipped} permissions (already existed)`);
    console.log(`\n🎉 Done! User "Gemski" needs to LOGOUT and LOGIN again to see the new menu items.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

fixAllBranchAdminPermissions();
