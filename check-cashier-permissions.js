const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCashierUser() {
  try {
    const cashier = await prisma.user.findFirst({
      where: { username: 'cashiermain' },
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
        },
        userLocations: {
          include: {
            location: true
          }
        }
      }
    });

    if (cashier) {
      console.log('=== CASHIER USER FOUND ===');
      console.log('Username:', cashier.username);
      console.log('Name:', cashier.firstName, cashier.lastName);
      console.log('Business ID:', cashier.businessId);
      console.log('');
      console.log('=== ROLES ===');
      cashier.roles.forEach(userRole => {
        console.log('Role:', userRole.role.name);
        console.log('Permissions in role:', userRole.role.permissions.length);
      });
      console.log('');
      console.log('=== DIRECT PERMISSIONS ===');
      console.log('Count:', cashier.permissions.length);
      console.log('');
      console.log('=== LOCATIONS ===');
      if (cashier.userLocations.length === 0) {
        console.log('NO LOCATIONS ASSIGNED!');
      } else {
        cashier.userLocations.forEach(ul => {
          console.log('Location:', ul.location.name, '(ID:', ul.locationId + ')');
        });
      }
      console.log('');
      console.log('=== CHECKING SALES REPORT PERMISSIONS ===');
      const allPerms = [
        ...cashier.roles.flatMap(ur => ur.role.permissions.map(rp => rp.permission.name)),
        ...cashier.permissions.map(up => up.permission.name)
      ];
      const reportPerms = allPerms.filter(p => p.includes('report') || p.includes('sales_report') || p.includes('REPORT'));
      console.log('Report Permissions:', reportPerms.length);
      reportPerms.forEach(p => console.log('  -', p));

      console.log('\n=== ALL PERMISSIONS (First 30) ===');
      const uniquePerms = [...new Set(allPerms)];
      uniquePerms.slice(0, 30).forEach(p => console.log('  -', p));
      console.log('Total unique permissions:', uniquePerms.length);
    } else {
      console.log('Cashier user "cashiermain" not found');
      console.log('Checking all users...');
      const allUsers = await prisma.user.findMany({
        select: { username: true, firstName: true, lastName: true }
      });
      console.log('Available users:');
      allUsers.forEach(u => console.log('  -', u.username, '-', u.firstName, u.lastName));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCashierUser();
