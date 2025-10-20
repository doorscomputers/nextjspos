import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function createTransferRoles() {
  console.log('\n🔧 Creating Transfer Workflow Roles...\n');

  // Get the first business (adjust if needed)
  const business = await prisma.business.findFirst();

  if (!business) {
    console.error('❌ No business found! Please create a business first.');
    process.exit(1);
  }

  console.log(`📊 Business: ${business.name} (ID: ${business.id})\n`);

  // Define the 4 transfer roles
  const roles = [
    {
      name: 'Transfer Creator',
      permissions: [
        'stock_transfer.view',
        'stock_transfer.create',
        'product.view',
      ]
    },
    {
      name: 'Transfer Checker',
      permissions: [
        'stock_transfer.view',
        'stock_transfer.check',
        'product.view',
      ]
    },
    {
      name: 'Transfer Sender',
      permissions: [
        'stock_transfer.view',
        'stock_transfer.send',
        'product.view',
      ]
    },
    {
      name: 'Transfer Receiver',
      permissions: [
        'stock_transfer.view',
        'stock_transfer.receive',
        'product.view',
      ]
    }
  ];

  // Create roles
  for (const roleData of roles) {
    try {
      // Check if role already exists
      const existingRole = await prisma.role.findFirst({
        where: {
          name: roleData.name,
          businessId: business.id
        }
      });

      if (existingRole) {
        console.log(`⚠️  Role '${roleData.name}' already exists - skipping`);
        continue;
      }

      // Create role
      const role = await prisma.role.create({
        data: {
          name: roleData.name,
          businessId: business.id,
        }
      });

      console.log(`✅ Created role: ${role.name}`);

      // Add permissions to role
      for (const permissionName of roleData.permissions) {
        // Find permission
        const permission = await prisma.permission.findFirst({
          where: { name: permissionName }
        });

        if (!permission) {
          console.log(`   ⚠️  Permission '${permissionName}' not found - creating it`);

          // Create permission if it doesn't exist
          const newPermission = await prisma.permission.create({
            data: {
              name: permissionName
            }
          });

          // Assign to role
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: newPermission.id
            }
          });

          console.log(`   ✅ Created and assigned permission: ${permissionName}`);
        } else {
          // Assign existing permission to role
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id
            }
          });

          console.log(`   ✅ Assigned permission: ${permissionName}`);
        }
      }

      console.log('');
    } catch (error) {
      console.error(`❌ Error creating role '${roleData.name}':`, error.message);
    }
  }

  console.log('\n✨ Transfer roles creation complete!\n');

  // Display summary
  console.log('=== CREATED ROLES SUMMARY ===\n');

  const createdRoles = await prisma.role.findMany({
    where: {
      businessId: business.id,
      name: {
        in: roles.map(r => r.name)
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

  for (const role of createdRoles) {
    console.log(`📌 ${role.name}`);
    console.log(`   Permissions (${role.permissions.length}):`);
    role.permissions.forEach(rp => {
      console.log(`   - ${rp.permission.name}`);
    });
    console.log('');
  }

  await prisma.$disconnect();
}

createTransferRoles().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
