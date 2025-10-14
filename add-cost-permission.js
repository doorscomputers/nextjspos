const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addCostPermission() {
  try {
    console.log('🔧 Adding purchase cost visibility permission...\n');

    // Create the permission
    const permission = await prisma.permission.upsert({
      where: { name: 'purchase.view_cost' },
      update: {},
      create: {
        name: 'purchase.view_cost'
      }
    });

    console.log('✅ Permission created:', permission.name);

    // Get Super Admin role
    const superAdminRole = await prisma.role.findFirst({
      where: { name: 'Super Admin' }
    });

    if (superAdminRole) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id
          }
        }
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: superAdminRole.id,
            permissionId: permission.id
          }
        });
        console.log('✅ Added to Super Admin role');
      } else {
        console.log('⏭️  Super Admin already has this permission');
      }
    }

    // Get Branch Admin role
    const branchAdminRole = await prisma.role.findFirst({
      where: { name: 'Branch Admin' }
    });

    if (branchAdminRole) {
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: {
            roleId: branchAdminRole.id,
            permissionId: permission.id
          }
        }
      });

      if (!existing) {
        await prisma.rolePermission.create({
          data: {
            roleId: branchAdminRole.id,
            permissionId: permission.id
          }
        });
        console.log('✅ Added to Branch Admin role');
      } else {
        console.log('⏭️  Branch Admin already has this permission');
      }
    }

    console.log('\n🎉 Done! Roles with cost viewing permission can now see purchase costs.');
    console.log('   Roles without this permission will see cost columns hidden.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

addCostPermission();
