import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixTransferRoles() {
  console.log('\n🔧 Fixing Transfer Roles with Correct Permissions...\n');

  const business = await prisma.business.findFirst();

  if (!business) {
    console.error('❌ No business found!');
    process.exit(1);
  }

  console.log(`📊 Business: ${business.name} (ID: ${business.id})\n`);

  // Step 1: Delete old incorrect permissions
  console.log('🗑️  Deleting old incorrect permissions...\n');

  const oldPermissions = [
    'stock_transfer_view',
    'stock_transfer_create',
    'stock_transfer_check',
    'stock_transfer_send',
    'stock_transfer_receive',
    'product_view'
  ];

  for (const permName of oldPermissions) {
    const perm = await prisma.permission.findFirst({
      where: { name: permName }
    });

    if (perm) {
      // Delete role-permission associations
      await prisma.rolePermission.deleteMany({
        where: { permissionId: perm.id }
      });

      // Delete user-permission associations
      await prisma.userPermission.deleteMany({
        where: { permissionId: perm.id }
      });

      // Delete permission
      await prisma.permission.delete({
        where: { id: perm.id }
      });

      console.log(`   ✅ Deleted: ${permName}`);
    }
  }

  // Step 2: Delete old transfer roles
  console.log('\n🗑️  Deleting old transfer roles...\n');

  const rolesToDelete = ['Transfer Creator', 'Transfer Checker', 'Transfer Sender', 'Transfer Receiver'];

  for (const roleName of rolesToDelete) {
    const deleted = await prisma.role.deleteMany({
      where: { name: roleName, businessId: business.id }
    });

    if (deleted.count > 0) {
      console.log(`   ✅ Deleted role: ${roleName}`);
    }
  }

  // Step 3: Get or create correct permissions
  console.log('\n📋 Ensuring correct permissions exist...\n');

  const correctPermissions = [
    'stock_transfer.view',
    'stock_transfer.create',
    'stock_transfer.check',
    'stock_transfer.send',
    'stock_transfer.receive',
    'product.view'
  ];

  const permissionMap = new Map();

  for (const permName of correctPermissions) {
    let perm = await prisma.permission.findFirst({
      where: { name: permName }
    });

    if (!perm) {
      perm = await prisma.permission.create({
        data: { name: permName }
      });
      console.log(`   ✅ Created permission: ${permName}`);
    } else {
      console.log(`   ✓  Permission exists: ${permName}`);
    }

    permissionMap.set(permName, perm);
  }

  // Step 4: Create roles with correct permissions
  console.log('\n🎭 Creating transfer roles with correct permissions...\n');

  const roles = [
    {
      name: 'Transfer Creator',
      permissions: ['stock_transfer.view', 'stock_transfer.create', 'product.view']
    },
    {
      name: 'Transfer Checker',
      permissions: ['stock_transfer.view', 'stock_transfer.check', 'product.view']
    },
    {
      name: 'Transfer Sender',
      permissions: ['stock_transfer.view', 'stock_transfer.send', 'product.view']
    },
    {
      name: 'Transfer Receiver',
      permissions: ['stock_transfer.view', 'stock_transfer.receive', 'product.view']
    }
  ];

  for (const roleData of roles) {
    // Create role
    const role = await prisma.role.create({
      data: {
        name: roleData.name,
        businessId: business.id
      }
    });

    console.log(`✅ Created role: ${role.name}`);

    // Assign permissions
    for (const permName of roleData.permissions) {
      const permission = permissionMap.get(permName);

      if (permission) {
        await prisma.rolePermission.create({
          data: {
            roleId: role.id,
            permissionId: permission.id
          }
        });

        console.log(`   ✅ Assigned: ${permName}`);
      }
    }

    console.log('');
  }

  // Step 5: Re-assign users to new roles
  console.log('👥 Re-assigning test users to new roles...\n');

  const userRoleMappings = [
    { username: 'warehouse_clerk', roleName: 'Transfer Creator' },
    { username: 'warehouse_supervisor', roleName: 'Transfer Checker' },
    { username: 'warehouse_manager', roleName: 'Transfer Sender' },
    { username: 'store_manager', roleName: 'Transfer Receiver' },
    { username: 'bambang_manager', roleName: 'Transfer Receiver' }
  ];

  for (const mapping of userRoleMappings) {
    const user = await prisma.user.findFirst({
      where: { username: mapping.username }
    });

    if (!user) {
      console.log(`   ⚠️  User '${mapping.username}' not found - skipping`);
      continue;
    }

    const role = await prisma.role.findFirst({
      where: {
        name: mapping.roleName,
        businessId: business.id
      }
    });

    if (!role) {
      console.log(`   ⚠️  Role '${mapping.roleName}' not found - skipping`);
      continue;
    }

    // Delete old role assignments
    await prisma.userRole.deleteMany({
      where: { userId: user.id }
    });

    // Assign new role
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: role.id
      }
    });

    console.log(`   ✅ ${mapping.username} → ${mapping.roleName}`);
  }

  console.log('\n✨ Transfer roles fixed successfully!\n');

  // Verification
  console.log('=== VERIFICATION ===\n');

  const verifyRoles = await prisma.role.findMany({
    where: {
      businessId: business.id,
      name: {
        in: rolesToDelete
      }
    },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  for (const role of verifyRoles) {
    console.log(`📌 ${role.name}`);
    console.log(`   Permissions (${role.permissions.length}):`);
    role.permissions.forEach(rp => {
      console.log(`   ✓ ${rp.permission.name}`);
    });
    console.log('');
  }

  await prisma.$disconnect();
}

fixTransferRoles().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
