const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateCashierPermissions() {
  try {
    console.log('=== UPDATING CASHIER ROLE WITH NEW SALES REPORT PERMISSIONS ===\n');

    // Get all cashier roles (any role with "Cashier" in name)
    const cashierRoles = await prisma.role.findMany({
      where: {
        name: {
          contains: 'Cashier'
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

    console.log(`Found ${cashierRoles.length} cashier roles:\n`);
    cashierRoles.forEach(role => {
      console.log(`  - ${role.name} (ID: ${role.id}) - ${role.permissions.length} permissions`);
    });

    // New sales report permissions to add
    const newPermissions = [
      'sales_report.journal',
      'sales_report.per_item',
      'sales_report.per_cashier',
      'sales_report.analytics'
    ];

    console.log('\n=== ADDING NEW PERMISSIONS ===\n');

    for (const role of cashierRoles) {
      console.log(`\nProcessing role: ${role.name}`);
      
      for (const permName of newPermissions) {
        // Check if permission exists
        let permission = await prisma.permission.findFirst({
          where: { name: permName }
        });

        // Create permission if it doesn't exist
        if (!permission) {
          console.log(`  Creating permission: ${permName}`);
          permission = await prisma.permission.create({
            data: { name: permName }
          });
        }

        // Check if role already has this permission
        const existingRolePerm = await prisma.rolePermission.findUnique({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id
            }
          }
        });

        if (!existingRolePerm) {
          console.log(`  Adding permission: ${permName}`);
          await prisma.rolePermission.create({
            data: {
              roleId: role.id,
              permissionId: permission.id
            }
          });
        } else {
          console.log(`  Permission already exists: ${permName}`);
        }
      }
    }

    console.log('\n=== VERIFICATION ===\n');

    // Verify the updates
    for (const role of cashierRoles) {
      const updatedRole = await prisma.role.findUnique({
        where: { id: role.id },
        include: {
          permissions: {
            include: {
              permission: true
            }
          }
        }
      });

      console.log(`\n${updatedRole.name} now has ${updatedRole.permissions.length} permissions`);
      const salesReportPerms = updatedRole.permissions.filter(rp => 
        rp.permission.name.includes('sales_report')
      );
      console.log('Sales Report Permissions:');
      salesReportPerms.forEach(rp => console.log(`  - ${rp.permission.name}`));
    }

    console.log('\n✅ CASHIER PERMISSIONS UPDATED SUCCESSFULLY!\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

updateCashierPermissions();
