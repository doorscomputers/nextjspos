import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createCompleteTransferUsers() {
  console.log('\n🔧 CREATING COMPLETE TRANSFER USER ACCOUNTS\n');
  console.log('=' .repeat(80));

  try {
    const business = await prisma.business.findFirst();
    if (!business) {
      console.error('❌ No business found!');
      process.exit(1);
    }

    console.log(`✅ Business: ${business.name} (ID: ${business.id})\n`);

    // Get all locations
    const locations = await prisma.businessLocation.findMany({
      where: { businessId: business.id },
      orderBy: { name: 'asc' }
    });

    console.log(`📍 Locations Found: ${locations.length}\n`);
    locations.forEach(loc => {
      console.log(`   - ${loc.name} (ID: ${loc.id})`);
    });

    // Get or create roles
    console.log('\n📋 Setting up Transfer Roles...\n');

    const roles = {
      creator: await getOrCreateRole(business.id, 'Transfer Creator', [
        'stock_transfer.view',
        'stock_transfer.create',
        'product.view'
      ]),
      checker: await getOrCreateRole(business.id, 'Transfer Checker', [
        'stock_transfer.view',
        'stock_transfer.check',
        'product.view'
      ]),
      sender: await getOrCreateRole(business.id, 'Transfer Sender', [
        'stock_transfer.view',
        'stock_transfer.send',
        'product.view'
      ]),
      receiver: await getOrCreateRole(business.id, 'Transfer Receiver', [
        'stock_transfer.view',
        'stock_transfer.receive',
        'stock_transfer.verify',
        'stock_transfer.complete',
        'product.view'
      ])
    };

    console.log('\n✅ All roles ready!\n');

    // Define users for each location
    const userTemplate = {
      'Main Warehouse': [
        { username: 'warehouse_clerk', role: 'creator', firstName: 'Warehouse', lastName: 'Clerk' },
        { username: 'warehouse_supervisor', role: 'checker', firstName: 'Warehouse', lastName: 'Supervisor' },
        { username: 'warehouse_manager', role: 'sender', firstName: 'Warehouse', lastName: 'Manager' },
        { username: 'warehouse_receiver', role: 'receiver', firstName: 'Warehouse', lastName: 'Receiver' }
      ],
      'Main Store': [
        { username: 'mainstore_clerk', role: 'creator', firstName: 'Main Store', lastName: 'Clerk' },
        { username: 'mainstore_supervisor', role: 'checker', firstName: 'Main Store', lastName: 'Supervisor' },
        { username: 'store_manager', role: 'sender', firstName: 'Main Store', lastName: 'Manager' },
        { username: 'mainstore_receiver', role: 'receiver', firstName: 'Main Store', lastName: 'Receiver' }
      ],
      'Bambang': [
        { username: 'bambang_clerk', role: 'creator', firstName: 'Bambang', lastName: 'Clerk' },
        { username: 'bambang_supervisor', role: 'checker', firstName: 'Bambang', lastName: 'Supervisor' },
        { username: 'bambang_manager', role: 'sender', firstName: 'Bambang', lastName: 'Manager' },
        { username: 'bambang_receiver', role: 'receiver', firstName: 'Bambang', lastName: 'Receiver' }
      ],
      'Tuguegarao': [
        { username: 'tugue_clerk', role: 'creator', firstName: 'Tuguegarao', lastName: 'Clerk' },
        { username: 'tugue_supervisor', role: 'checker', firstName: 'Tuguegarao', lastName: 'Supervisor' },
        { username: 'tugue_manager', role: 'sender', firstName: 'Tuguegarao', lastName: 'Manager' },
        { username: 'tugue_receiver', role: 'receiver', firstName: 'Tuguegarao', lastName: 'Receiver' }
      ],
      'Santiago': [
        { username: 'santiago_clerk', role: 'creator', firstName: 'Santiago', lastName: 'Clerk' },
        { username: 'santiago_supervisor', role: 'checker', firstName: 'Santiago', lastName: 'Supervisor' },
        { username: 'santiago_manager', role: 'sender', firstName: 'Santiago', lastName: 'Manager' },
        { username: 'santiago_receiver', role: 'receiver', firstName: 'Santiago', lastName: 'Receiver' }
      ],
      'Baguio': [
        { username: 'baguio_clerk', role: 'creator', firstName: 'Baguio', lastName: 'Clerk' },
        { username: 'baguio_supervisor', role: 'checker', firstName: 'Baguio', lastName: 'Supervisor' },
        { username: 'baguio_manager', role: 'sender', firstName: 'Baguio', lastName: 'Manager' },
        { username: 'baguio_receiver', role: 'receiver', firstName: 'Baguio', lastName: 'Receiver' }
      ]
    };

    // Hash password once
    const hashedPassword = await bcrypt.hash('password', 10);

    console.log('👥 Creating Users by Location...\n');
    console.log('=' .repeat(80));

    const createdUsers = [];

    for (const location of locations) {
      const locationUsers = userTemplate[location.name];

      if (!locationUsers) {
        console.log(`⚠️  No user template found for location: ${location.name} - Skipping\n`);
        continue;
      }

      console.log(`\n📍 LOCATION: ${location.name.toUpperCase()}`);
      console.log('─'.repeat(80));

      for (const userDef of locationUsers) {
        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { username: userDef.username }
        });

        let user;

        if (existingUser) {
          console.log(`   ⚠️  User "${userDef.username}" already exists - Skipping creation`);
          user = existingUser;
        } else {
          // Create user
          user = await prisma.user.create({
            data: {
              username: userDef.username,
              password: hashedPassword,
              email: `${userDef.username}@example.com`,
              surname: userDef.lastName,
              firstName: userDef.firstName,
              lastName: userDef.lastName,
              businessId: business.id,
              allowLogin: true
            }
          });

          console.log(`   ✅ Created user: ${userDef.username}`);
        }

        // Assign role
        const roleToAssign = roles[userDef.role];

        const existingUserRole = await prisma.userRole.findUnique({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: roleToAssign.id
            }
          }
        });

        if (!existingUserRole) {
          await prisma.userRole.create({
            data: {
              userId: user.id,
              roleId: roleToAssign.id
            }
          });
          console.log(`      → Assigned role: ${roleToAssign.name}`);
        } else {
          console.log(`      → Role already assigned: ${roleToAssign.name}`);
        }

        // Assign location
        const existingUserLocation = await prisma.userLocation.findUnique({
          where: {
            userId_locationId: {
              userId: user.id,
              locationId: location.id
            }
          }
        });

        if (!existingUserLocation) {
          await prisma.userLocation.create({
            data: {
              userId: user.id,
              locationId: location.id
            }
          });
          console.log(`      → Assigned location: ${location.name}`);
        } else {
          console.log(`      → Location already assigned: ${location.name}`);
        }

        createdUsers.push({
          username: userDef.username,
          password: 'password',
          role: roleToAssign.name,
          location: location.name,
          firstName: userDef.firstName,
          lastName: userDef.lastName
        });
      }
    }

    // Print final summary
    console.log('\n\n');
    console.log('=' .repeat(80));
    console.log('✅ USER CREATION COMPLETE - REFERENCE TABLE');
    console.log('=' .repeat(80));

    console.log('\n📋 COMPLETE USER LIST FOR TESTING & TRAINING\n');

    // Group by location for display
    const locationMap = {};
    for (const loc of locations) {
      locationMap[loc.name] = [];
    }

    for (const user of createdUsers) {
      locationMap[user.location].push(user);
    }

    // Print by location
    for (const location of locations) {
      const users = locationMap[location.name];

      if (!users || users.length === 0) continue;

      console.log(`\n${'▓'.repeat(80)}`);
      console.log(`📍 ${location.name.toUpperCase()}`);
      console.log(`${'▓'.repeat(80)}`);
      console.log('\n| Username              | Password | Role                 | Full Name                |');
      console.log('|----------------------|----------|----------------------|--------------------------|');

      for (const user of users) {
        const username = user.username.padEnd(20);
        const password = user.password.padEnd(8);
        const role = user.role.padEnd(20);
        const fullName = `${user.firstName} ${user.lastName}`.padEnd(24);
        console.log(`| ${username} | ${password} | ${role} | ${fullName} |`);
      }
    }

    console.log('\n\n');
    console.log('=' .repeat(80));
    console.log('📚 QUICK REFERENCE GUIDE');
    console.log('=' .repeat(80));

    console.log('\n🔄 TRANSFER WORKFLOW STEPS:\n');
    console.log('   1. CREATOR     → Creates the transfer (from their location)');
    console.log('   2. CHECKER     → Verifies and approves the transfer');
    console.log('   3. SENDER      → Confirms physical shipment (stock deducted)');
    console.log('   4. RECEIVER    → Receives at destination (stock added)\n');

    console.log('💡 USAGE EXAMPLES:\n');
    console.log('   📦 Main Warehouse → Main Store:');
    console.log('      1. Login: warehouse_clerk → Create transfer');
    console.log('      2. Login: warehouse_supervisor → Check/Approve');
    console.log('      3. Login: warehouse_manager → Send');
    console.log('      4. Login: mainstore_receiver → Receive\n');

    console.log('   📦 Main Store → Bambang (Store-to-Store):');
    console.log('      1. Login: mainstore_clerk → Create transfer');
    console.log('      2. Login: mainstore_supervisor → Check/Approve');
    console.log('      3. Login: store_manager → Send');
    console.log('      4. Login: bambang_receiver → Receive\n');

    console.log('   📦 Bambang → Main Warehouse (Return/Consolidation):');
    console.log('      1. Login: bambang_clerk → Create transfer');
    console.log('      2. Login: bambang_supervisor → Check/Approve');
    console.log('      3. Login: bambang_manager → Send');
    console.log('      4. Login: warehouse_receiver → Receive\n');

    console.log('   📦 Tuguegarao → Main Store (Inter-branch Support):');
    console.log('      1. Login: tugue_clerk → Create transfer');
    console.log('      2. Login: tugue_supervisor → Check/Approve');
    console.log('      3. Login: tugue_manager → Send');
    console.log('      4. Login: mainstore_receiver → Receive\n');

    console.log('=' .repeat(80));
    console.log('🎓 TRAINING NOTES');
    console.log('=' .repeat(80));

    console.log('\n✅ All users have password: "password"');
    console.log('✅ Each location has 4 users (Creator, Checker, Sender, Receiver)');
    console.log('✅ Users can ONLY transfer FROM their assigned location');
    console.log('✅ Receivers can accept transfers AT their assigned location');
    console.log('✅ Any location can transfer to any other location (including Main Warehouse)');
    console.log('✅ Separation of duties enforced (Creator ≠ Checker ≠ Sender ≠ Receiver)\n');

    console.log('💡 BUSINESS SCENARIOS:\n');
    console.log('   📦 Warehouse Distribution: Main Warehouse → Branches');
    console.log('   🔄 Stock Consolidation: Branches → Main Warehouse');
    console.log('   🤝 Inter-branch Support: Branch A → Branch B (when stock needed)');
    console.log('   ↩️  Returns: Branches → Main Warehouse (damaged/excess stock)\n');

    console.log('=' .repeat(80));
    console.log(`✅ TOTAL USERS CREATED: ${createdUsers.length}`);
    console.log('=' .repeat(80));
    console.log('\n🎉 Setup complete! Users are ready for testing and training.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function getOrCreateRole(businessId, roleName, permissions) {
  // Check if role exists
  let role = await prisma.role.findFirst({
    where: {
      name: roleName,
      businessId: businessId
    }
  });

  if (!role) {
    // Create role
    role = await prisma.role.create({
      data: {
        name: roleName,
        businessId: businessId
      }
    });
    console.log(`   ✅ Created role: ${roleName}`);
  } else {
    console.log(`   ✓  Role exists: ${roleName}`);
  }

  // Assign permissions
  for (const permName of permissions) {
    let permission = await prisma.permission.findFirst({
      where: { name: permName }
    });

    if (!permission) {
      permission = await prisma.permission.create({
        data: { name: permName }
      });
      console.log(`      → Created permission: ${permName}`);
    }

    const existing = await prisma.rolePermission.findUnique({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      }
    });

    if (!existing) {
      await prisma.rolePermission.create({
        data: {
          roleId: role.id,
          permissionId: permission.id
        }
      });
    }
  }

  return role;
}

createCompleteTransferUsers();
