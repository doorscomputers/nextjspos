import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updateReceiverRole() {
  console.log('\n🔧 Updating Transfer Receiver Role...\n');

  const business = await prisma.business.findFirst();

  if (!business) {
    console.error('❌ No business found!');
    process.exit(1);
  }

  // Find Transfer Receiver role
  const receiverRole = await prisma.role.findFirst({
    where: {
      name: 'Transfer Receiver',
      businessId: business.id
    }
  });

  if (!receiverRole) {
    console.error('❌ Transfer Receiver role not found!');
    process.exit(1);
  }

  console.log(`✅ Found role: ${receiverRole.name} (ID: ${receiverRole.id})\n`);

  // Get or create the verify and complete permissions
  const permissionsToAdd = [
    'stock_transfer.verify',
    'stock_transfer.complete'
  ];

  for (const permName of permissionsToAdd) {
    let permission = await prisma.permission.findFirst({
      where: { name: permName }
    });

    if (!permission) {
      permission = await prisma.permission.create({
        data: { name: permName }
      });
      console.log(`✅ Created permission: ${permName}`);
    } else {
      console.log(`✓  Permission exists: ${permName}`);
    }

    // Check if already assigned
    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: receiverRole.id,
          permissionId: permission.id
        }
      }
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId: receiverRole.id,
          permissionId: permission.id
        }
      });
      console.log(`✅ Assigned ${permName} to Transfer Receiver role`);
    } else {
      console.log(`⚠️  ${permName} already assigned to Transfer Receiver`);
    }
  }

  console.log('\n✨ Transfer Receiver role updated!\n');

  // Show updated permissions
  const updatedRole = await prisma.role.findUnique({
    where: { id: receiverRole.id },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  console.log('=== UPDATED PERMISSIONS ===\n');
  console.log(`📌 ${updatedRole.name}`);
  console.log(`   Permissions (${updatedRole.permissions.length}):`);
  updatedRole.permissions.forEach(rp => {
    console.log(`   ✓ ${rp.permission.name}`);
  });

  await prisma.$disconnect();
}

updateReceiverRole().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
