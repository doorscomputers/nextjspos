import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Users in database but NOT documented (should be removed)
const usersToRemove = [
  'baguio_clerk',
  'baguio_supervisor',
  'baguio_manager',
  'baguio_receiver',
  'santiago_clerk',
  'santiago_supervisor',
  'santiago_manager',
  'santiago_receiver',
  'makati_mgr',
  'pasig_mgr',
  'cebu_mgr',
  // Sales users in warehouse (violate business rule)
  'mainwarehouse_cashier',
  'mainwarehouse_sales_mgr'
];

async function removeUsers() {
  console.log('🗑️  REMOVING UNDOCUMENTED AND RULE-VIOLATING USERS\n');
  console.log('─'.repeat(100));

  for (const username of usersToRemove) {
    const user = await prisma.user.findUnique({
      where: { username },
      include: {
        userLocations: {
          include: {
            location: true
          }
        },
        roles: {
          include: {
            role: true
          }
        }
      }
    });

    if (user) {
      const locations = user.userLocations.map(ul => ul.location.name).join(', ') || 'No Location';
      const roles = user.roles.map(r => r.role.name).join(', ') || 'No Role';

      console.log(`\n❌ Removing: ${username.padEnd(35)}`);
      console.log(`   Location: ${locations}`);
      console.log(`   Roles: ${roles}`);

      // Delete user (cascade will handle related records)
      await prisma.user.delete({
        where: { id: user.id }
      });

      console.log(`   ✅ Deleted successfully`);
    } else {
      console.log(`\n⚠️  User not found: ${username} (already deleted or never existed)`);
    }
  }

  console.log('\n\n✅ CLEANUP COMPLETE\n');
  console.log('─'.repeat(100));

  // Show remaining users count
  const remainingCount = await prisma.user.count();
  console.log(`\nTotal users remaining in database: ${remainingCount}`);
}

removeUsers().finally(() => prisma.$disconnect());
