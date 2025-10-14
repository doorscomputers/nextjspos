const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addPurchasePermissions() {
  try {
    console.log('🔧 Adding purchase/payment permissions to Super Admin role...\n');

    // Get Super Admin role
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' }
    });

    if (!superAdminRole) {
      console.log('❌ Super Admin role not found!');
      return;
    }

    console.log('✅ Found Super Admin role:', superAdminRole.name);

    // Get the new permissions
    const permissionsToAdd = [
      'accounts_payable.view',
      'accounts_payable.create',
      'accounts_payable.update',
      'accounts_payable.delete',
      'payment.view',
      'payment.create',
      'payment.approve',
      'payment.update',
      'payment.delete',
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
            roleId: superAdminRole.id,
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
          roleId: superAdminRole.id,
          permissionId: permission.id
        }
      });

      console.log(`✅ Added: ${permName}`);
      added++;
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Added: ${added} permissions`);
    console.log(`   Skipped: ${skipped} permissions (already existed)`);
    console.log(`\n🎉 Done! Please refresh your browser to see the new menu items.`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addPurchasePermissions();
