import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createComprehensiveDemoAccounts() {
  try {
    // Get the main business
    const business = await prisma.business.findFirst({
      where: { name: 'PciNet Computer Trading and Services' }
    });

    if (!business) {
      console.error('Business not found!');
      return;
    }

    console.log(`Found business: ${business.name} (ID: ${business.id})\n`);

    // Get all active locations
    const locations = await prisma.businessLocation.findMany({
      where: {
        businessId: business.id,
        isActive: true,
        name: {
          in: ['Main Warehouse', 'Main Store', 'Bambang', 'Tuguegarao']
        }
      }
    });

    console.log('Active Locations:');
    locations.forEach(loc => console.log(`  - ${loc.name} (ID: ${loc.id})`));
    console.log('');

    // Get or create Inventory Correction roles
    let invCreatorRole = await prisma.role.findFirst({
      where: { name: 'Inventory Correction Creator', businessId: business.id }
    });

    let invApproverRole = await prisma.role.findFirst({
      where: { name: 'Inventory Correction Approver', businessId: business.id }
    });

    // Get permission IDs
    const permissionMap = {};
    const requiredPerms = [
      'inventory_correction.create',
      'inventory_correction.view',
      'inventory_correction.approve',
      'product.view',
      'report.stock.view',
      'dashboard.view'
    ];

    for (const permName of requiredPerms) {
      const perm = await prisma.permission.findUnique({ where: { name: permName } });
      if (perm) {
        permissionMap[permName] = perm.id;
      }
    }

    // If roles don't exist, create them
    if (!invCreatorRole) {
      console.log('Creating Inventory Correction Creator role...');
      invCreatorRole = await prisma.role.create({
        data: {
          name: 'Inventory Correction Creator',
          businessId: business.id,
          permissions: {
            create: [
              { permissionId: permissionMap['inventory_correction.create'] },
              { permissionId: permissionMap['inventory_correction.view'] },
              { permissionId: permissionMap['product.view'] },
              { permissionId: permissionMap['report.stock.view'] },
              { permissionId: permissionMap['dashboard.view'] }
            ]
          }
        }
      });
    }

    if (!invApproverRole) {
      console.log('Creating Inventory Correction Approver role...');
      invApproverRole = await prisma.role.create({
        data: {
          name: 'Inventory Correction Approver',
          businessId: business.id,
          permissions: {
            create: [
              { permissionId: permissionMap['inventory_correction.view'] },
              { permissionId: permissionMap['inventory_correction.approve'] },
              { permissionId: permissionMap['product.view'] },
              { permissionId: permissionMap['report.stock.view'] },
              { permissionId: permissionMap['dashboard.view'] }
            ]
          }
        }
      });
    }

    console.log('Roles verified.\n');

    // Hash password once
    const hashedPassword = await bcrypt.hash('password', 10);

    // Create Inventory Correction accounts for each location
    const accountsToCreate = [];

    for (const location of locations) {
      const locationSlug = location.name.toLowerCase().replace(/\s+/g, '');

      // Inventory Correction Creator
      accountsToCreate.push({
        username: `${locationSlug}_inv_creator`,
        role: invCreatorRole,
        location: location,
        description: 'Creates inventory correction requests'
      });

      // Inventory Correction Approver
      accountsToCreate.push({
        username: `${locationSlug}_inv_approver`,
        role: invApproverRole,
        location: location,
        description: 'Approves inventory corrections'
      });
    }

    // Also create Sales workflow accounts if missing
    const cashierRole = await prisma.role.findFirst({
      where: { name: 'Regular Cashier Main', businessId: business.id }
    });

    const salesManagerRole = await prisma.role.findFirst({
      where: { name: 'Main Store Branch Manager', businessId: business.id }
    });

    for (const location of locations) {
      const locationSlug = location.name.toLowerCase().replace(/\s+/g, '');

      // Check if cashier exists
      const existingCashier = await prisma.user.findFirst({
        where: { username: `${locationSlug}_cashier` }
      });

      if (!existingCashier && cashierRole) {
        accountsToCreate.push({
          username: `${locationSlug}_cashier`,
          role: cashierRole,
          location: location,
          description: 'Creates sales transactions'
        });
      }

      // Check if sales manager exists
      const existingSalesManager = await prisma.user.findFirst({
        where: { username: `${locationSlug}_sales_mgr` }
      });

      if (!existingSalesManager && salesManagerRole) {
        accountsToCreate.push({
          username: `${locationSlug}_sales_mgr`,
          role: salesManagerRole,
          location: location,
          description: 'Manages sales, refunds, voids'
        });
      }
    }

    // Create all accounts
    console.log('Creating demo accounts...\n');
    const createdAccounts = [];

    for (const account of accountsToCreate) {
      // Check if user already exists
      const existing = await prisma.user.findFirst({
        where: { username: account.username }
      });

      if (existing) {
        console.log(`⚠️  User ${account.username} already exists, skipping...`);
        continue;
      }

      const user = await prisma.user.create({
        data: {
          username: account.username,
          password: hashedPassword,
          businessId: business.id,
          surname: account.username,
          firstName: account.username,
          lastName: 'Demo Account',
          allowLogin: true,
          roles: {
            create: {
              roleId: account.role.id
            }
          },
          userLocations: {
            create: {
              locationId: account.location.id
            }
          }
        },
        include: {
          roles: {
            include: {
              role: true
            }
          },
          userLocations: {
            include: {
              location: true
            }
          }
        }
      });

      createdAccounts.push({
        username: user.username,
        role: user.roles[0].role.name,
        location: user.userLocations[0].location.name,
        description: account.description
      });

      console.log(`✅ Created: ${user.username}`);
      console.log(`   Role: ${user.roles[0].role.name}`);
      console.log(`   Location: ${user.userLocations[0].location.name}`);
      console.log(`   Purpose: ${account.description}\n`);
    }

    console.log('\n========================================');
    console.log('SUMMARY OF CREATED ACCOUNTS');
    console.log('========================================\n');

    if (createdAccounts.length === 0) {
      console.log('No new accounts were created. All accounts already exist.');
    } else {
      console.log(`Created ${createdAccounts.length} new demo accounts:\n`);
      createdAccounts.forEach(acc => {
        console.log(`Username: ${acc.username}`);
        console.log(`Password: password`);
        console.log(`Location: ${acc.location}`);
        console.log(`Role: ${acc.role}`);
        console.log(`Purpose: ${acc.description}`);
        console.log('---');
      });
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error creating demo accounts:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

createComprehensiveDemoAccounts();
