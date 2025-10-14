const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkUserPermissions() {
  try {
    console.log('Checking user permissions...\n');

    // Get all users
    const users = await prisma.user.findMany({
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        permissions: {
          include: {
            permission: true
          }
        }
      }
    });

    for (const user of users) {
      console.log(`\n👤 User: ${user.username} (${user.firstName} ${user.surname})`);
      console.log(`   ID: ${user.id}`);

      // Get all permissions from roles
      const rolePermissions = new Set();
      user.roles.forEach(ur => {
        console.log(`   Role: ${ur.role.name}`);
        ur.role.permissions.forEach(rp => {
          rolePermissions.add(rp.permission.name);
        });
      });

      // Get direct permissions
      user.permissions.forEach(up => {
        rolePermissions.add(up.permission.name);
      });

      // Check for payment permissions
      const hasPaymentView = rolePermissions.has('payment.view');
      const hasAccountsPayableView = rolePermissions.has('accounts_payable.view');
      const hasPurchaseViewCost = rolePermissions.has('purchase.view_cost');

      console.log(`   📋 Total Permissions: ${rolePermissions.size}`);
      console.log(`   💰 payment.view: ${hasPaymentView ? '✅' : '❌'}`);
      console.log(`   📄 accounts_payable.view: ${hasAccountsPayableView ? '✅' : '❌'}`);
      console.log(`   💲 purchase.view_cost: ${hasPurchaseViewCost ? '✅' : '❌'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkUserPermissions();
