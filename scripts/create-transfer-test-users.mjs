import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createTransferTestUsers() {
  console.log('\n🧪 Creating Transfer Test Users...\n');

  // Get the first business
  const business = await prisma.business.findFirst();

  if (!business) {
    console.error('❌ No business found!');
    process.exit(1);
  }

  console.log(`📊 Business: ${business.name} (ID: ${business.id})\n`);

  // Get locations
  const mainWarehouse = await prisma.businessLocation.findFirst({
    where: { name: 'Main Warehouse', businessId: business.id }
  });

  const mainStore = await prisma.businessLocation.findFirst({
    where: { name: 'Main Store', businessId: business.id }
  });

  const bambang = await prisma.businessLocation.findFirst({
    where: { name: 'Bambang', businessId: business.id }
  });

  if (!mainWarehouse || !mainStore) {
    console.error('❌ Main Warehouse or Main Store not found!');
    process.exit(1);
  }

  console.log(`📍 Locations found:`);
  console.log(`   - Main Warehouse (ID: ${mainWarehouse.id})`);
  console.log(`   - Main Store (ID: ${mainStore.id})`);
  if (bambang) console.log(`   - Bambang (ID: ${bambang.id})`);
  console.log('');

  // Get the transfer roles
  const creatorRole = await prisma.role.findFirst({
    where: { name: 'Transfer Creator', businessId: business.id }
  });

  const checkerRole = await prisma.role.findFirst({
    where: { name: 'Transfer Checker', businessId: business.id }
  });

  const senderRole = await prisma.role.findFirst({
    where: { name: 'Transfer Sender', businessId: business.id }
  });

  const receiverRole = await prisma.role.findFirst({
    where: { name: 'Transfer Receiver', businessId: business.id }
  });

  if (!creatorRole || !checkerRole || !senderRole || !receiverRole) {
    console.error('❌ One or more transfer roles not found! Run create-transfer-roles.mjs first.');
    process.exit(1);
  }

  console.log(`✅ All transfer roles found\n`);

  // Define test users
  const users = [
    // Main Warehouse Users (for sending transfers OUT)
    {
      username: 'warehouse_clerk',
      firstName: 'Warehouse',
      lastName: 'Clerk',
      email: 'warehouse.clerk@test.com',
      password: 'password',
      roleId: creatorRole.id,
      roleName: 'Transfer Creator',
      locationIds: [mainWarehouse.id],
      locationNames: ['Main Warehouse']
    },
    {
      username: 'warehouse_supervisor',
      firstName: 'Warehouse',
      lastName: 'Supervisor',
      email: 'warehouse.supervisor@test.com',
      password: 'password',
      roleId: checkerRole.id,
      roleName: 'Transfer Checker',
      locationIds: [mainWarehouse.id],
      locationNames: ['Main Warehouse']
    },
    {
      username: 'warehouse_manager',
      firstName: 'Warehouse',
      lastName: 'Manager',
      email: 'warehouse.manager@test.com',
      password: 'password',
      roleId: senderRole.id,
      roleName: 'Transfer Sender',
      locationIds: [mainWarehouse.id],
      locationNames: ['Main Warehouse']
    },

    // Main Store Users (for receiving transfers IN)
    {
      username: 'store_manager',
      firstName: 'Store',
      lastName: 'Manager',
      email: 'store.manager@test.com',
      password: 'password',
      roleId: receiverRole.id,
      roleName: 'Transfer Receiver',
      locationIds: [mainStore.id],
      locationNames: ['Main Store']
    },

    // Bambang Users (for receiving transfers IN)
    ...(bambang ? [{
      username: 'bambang_manager',
      firstName: 'Bambang',
      lastName: 'Manager',
      email: 'bambang.manager@test.com',
      password: 'password',
      roleId: receiverRole.id,
      roleName: 'Transfer Receiver',
      locationIds: [bambang.id],
      locationNames: ['Bambang']
    }] : [])
  ];

  // Create users
  for (const userData of users) {
    try {
      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: { username: userData.username }
      });

      if (existingUser) {
        console.log(`⚠️  User '${userData.username}' already exists - skipping`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(userData.password, 10);

      // Create user
      const user = await prisma.user.create({
        data: {
          username: userData.username,
          firstName: userData.firstName,
          surname: userData.lastName,
          email: userData.email,
          password: hashedPassword,
          businessId: business.id,
        }
      });

      console.log(`✅ Created user: ${userData.username}`);

      // Assign role
      await prisma.userRole.create({
        data: {
          userId: user.id,
          roleId: userData.roleId
        }
      });

      console.log(`   ✅ Assigned role: ${userData.roleName}`);

      // Assign location(s)
      for (let i = 0; i < userData.locationIds.length; i++) {
        await prisma.userLocation.create({
          data: {
            userId: user.id,
            locationId: userData.locationIds[i]
          }
        });

        console.log(`   ✅ Assigned location: ${userData.locationNames[i]}`);
      }

      console.log('');
    } catch (error) {
      console.error(`❌ Error creating user '${userData.username}':`, error.message);
    }
  }

  console.log('\n✨ Transfer test users creation complete!\n');

  // Display summary
  console.log('=== TEST USERS SUMMARY ===\n');
  console.log('For MAIN WAREHOUSE → MAIN STORE transfer test:\n');
  console.log('1️⃣  warehouse_clerk     (Transfer Creator)');
  console.log('2️⃣  warehouse_supervisor (Transfer Checker)');
  console.log('3️⃣  warehouse_manager    (Transfer Sender)');
  console.log('4️⃣  store_manager        (Transfer Receiver)\n');

  if (bambang) {
    console.log('For MAIN WAREHOUSE → BAMBANG transfer test:\n');
    console.log('1️⃣  warehouse_clerk     (Transfer Creator)');
    console.log('2️⃣  warehouse_supervisor (Transfer Checker)');
    console.log('3️⃣  warehouse_manager    (Transfer Sender)');
    console.log('4️⃣  bambang_manager      (Transfer Receiver)\n');
  }

  console.log('All passwords: password\n');
  console.log('📖 See TRANSFER_WORKFLOW_COMPLETE_GUIDE.md for testing steps\n');

  await prisma.$disconnect();
}

createTransferTestUsers().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
