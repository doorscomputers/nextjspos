import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Local PostgreSQL
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:Seepeeyusss999%21%40%23@localhost:5432/ultimatepos_modern',
    },
  },
});

// Supabase (from environment)
const supabasePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?pgbouncer=true&connection_limit=1',
    },
  },
});

async function migrateData() {
  try {
    console.log('🚀 Starting comprehensive migration to Supabase...\n');

    // Step 1: Update Business Name
    console.log('📝 Step 1: Updating business name...');
    const localBusiness = await localPrisma.business.findFirst();
    const supabaseBusiness = await supabasePrisma.business.findFirst();

    if (localBusiness && supabaseBusiness) {
      await supabasePrisma.business.update({
        where: { id: supabaseBusiness.id },
        data: {
          name: localBusiness.name,
          currencyId: localBusiness.currencyId,
          timeZone: localBusiness.timeZone,
          ownerId: localBusiness.ownerId,
        },
      });
      console.log(`✅ Business updated to: ${localBusiness.name}\n`);
    }

    const businessId = supabaseBusiness!.id;

    // Step 2: Migrate Business Locations
    console.log('📍 Step 2: Migrating business locations...');
    const localLocations = await localPrisma.businessLocation.findMany({
      orderBy: { id: 'asc' },
    });

    // Keep Main Warehouse, add others
    const existingLocations = await supabasePrisma.businessLocation.findMany();
    const locationsToMigrate = localLocations.filter(
      loc => !existingLocations.some(existing => existing.name === loc.name)
    );

    for (const location of locationsToMigrate) {
      await supabasePrisma.businessLocation.create({
        data: {
          name: location.name,
          businessId: businessId,
          parentId: location.parentId,
          mobile: location.mobile,
          altContactNumber: location.altContactNumber,
          email: location.email,
          website: location.website,
          city: location.city,
          state: location.state,
          country: location.country,
          zipCode: location.zipCode,
          invoiceScheme: location.invoiceScheme,
          invoicePrefix: location.invoicePrefix,
          printerType: location.printerType,
          printAfterSale: location.printAfterSale,
          autoInvoiceNo: location.autoInvoiceNo,
          address: location.address,
          landmark: location.landmark,
          receiptHeader: location.receiptHeader,
          receiptFooter: location.receiptFooter,
        },
      });
      console.log(`   ✓ Created: ${location.name}`);
      // Small delay to prevent connection pooling issues
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`✅ Migrated ${locationsToMigrate.length} new locations\n`);

    // Step 3: Migrate Roles
    console.log('👔 Step 3: Migrating roles...');
    const localRoles = await localPrisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        locations: {
          include: {
            location: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const existingRoles = await supabasePrisma.role.findMany();
    const rolesToMigrate = localRoles.filter(
      role => !existingRoles.some(existing => existing.name === role.name)
    );

    console.log(`   Found ${rolesToMigrate.length} new roles to migrate...`);

    for (const role of rolesToMigrate) {
      // Create role
      const newRole = await supabasePrisma.role.create({
        data: {
          name: role.name,
          businessId: businessId,
        },
      });

      // Add permissions
      for (const rp of role.permissions) {
        // Find permission in Supabase
        const permission = await supabasePrisma.permission.findFirst({
          where: { name: rp.permission.name },
        });

        if (permission) {
          await supabasePrisma.rolePermission.create({
            data: {
              roleId: newRole.id,
              permissionId: permission.id,
            },
          }).catch(() => {}); // Ignore duplicates
        }
      }

      // Add location assignments
      for (const rl of role.locations) {
        const location = await supabasePrisma.businessLocation.findFirst({
          where: { name: rl.location.name },
        });

        if (location) {
          await supabasePrisma.roleLocation.create({
            data: {
              roleId: newRole.id,
              locationId: location.id,
            },
          }).catch(() => {}); // Ignore duplicates
        }
      }

      console.log(`   ✓ Created: ${role.name} (${role.permissions.length} permissions)`);
      // Small delay to prevent connection pooling issues
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log(`✅ Migrated ${rolesToMigrate.length} roles\n`);

    // Step 4: Migrate Specific Users
    console.log('👤 Step 4: Migrating specific users...');
    const usersToMigrate = [
      'EricsonChanTransferReceiverTugue',
      'EricsonChanCashierTugue',
      'JASMINKATECashierMain',
      'JASMINKATECashierBambang',
      'JASMINKATETransferReceiverBambang',
      'JASMINKATETransferReceiverMain',
      'JOJITKATECashierBambang',
      'JOJITKATECashierMain',
      'JOJITKATETransferReceiverBambang',
      'JOJITKATETransferReceiverMain',
      'Jheiron',
      'PriceMgrMain',
      'PriceMgrTugue',
      'PriceMgrBambang',
    ];

    // Hash the password "111111"
    const hashedPassword = await bcrypt.hash('111111', 10);

    let migratedUserCount = 0;
    for (const username of usersToMigrate) {
      const localUser = await localPrisma.user.findFirst({
        where: { username },
        include: {
          roles: {
            include: {
              role: true,
            },
          },
          userLocations: {
            include: {
              location: true,
            },
          },
        },
      });

      if (!localUser) {
        console.log(`   ⚠️  User not found in local DB: ${username}`);
        continue;
      }

      // Check if user already exists in Supabase
      const existingUser = await supabasePrisma.user.findFirst({
        where: { username },
      });

      if (existingUser) {
        console.log(`   ⏭️  Already exists: ${username}`);
        continue;
      }

      // Create user in Supabase
      const newUser = await supabasePrisma.user.create({
        data: {
          username: localUser.username,
          password: hashedPassword,
          email: localUser.email,
          firstName: localUser.firstName,
          surname: localUser.lastName || '',
          lastName: localUser.lastName,
          contactNumber: localUser.contactNumber,
          allowLogin: localUser.allowLogin,
          businessId: businessId,
          rfid: localUser.rfid,
          status: localUser.status,
        },
      });

      // Assign roles
      for (const userRole of localUser.roles) {
        const role = await supabasePrisma.role.findFirst({
          where: { name: userRole.role.name, businessId },
        });

        if (role) {
          await supabasePrisma.userRole.create({
            data: {
              userId: newUser.id,
              roleId: role.id,
            },
          }).catch(() => {}); // Ignore duplicates
        }
      }

      // Assign locations
      for (const userLocation of localUser.userLocations) {
        const location = await supabasePrisma.businessLocation.findFirst({
          where: { name: userLocation.location.name, businessId },
        });

        if (location) {
          await supabasePrisma.userLocation.create({
            data: {
              userId: newUser.id,
              locationId: location.id,
            },
          }).catch(() => {}); // Ignore duplicates
        }
      }

      console.log(`   ✓ Created: ${username} (${localUser.roles.length} roles, ${localUser.userLocations.length} locations)`);
      migratedUserCount++;
      // Small delay to prevent connection pooling issues
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    console.log(`✅ Migrated ${migratedUserCount} users\n`);

    // Step 5: Migrate Suppliers
    console.log('🏭 Step 5: Migrating suppliers...');
    const localSuppliers = await localPrisma.supplier.findMany({
      orderBy: { id: 'asc' },
    });

    const existingSuppliers = await supabasePrisma.supplier.findMany();
    const suppliersToMigrate = localSuppliers.filter(
      supplier => !existingSuppliers.some(existing => existing.name === supplier.name)
    );

    for (const supplier of suppliersToMigrate) {
      await supabasePrisma.supplier.create({
        data: {
          businessId: businessId,
          name: supplier.name,
          mobile: supplier.mobile,
          email: supplier.email,
          address: supplier.address,
          taxNumber: supplier.taxNumber,
          creditLimit: supplier.creditLimit,
          payTerm: supplier.payTerm,
          payTermType: supplier.payTermType,
          city: supplier.city,
          state: supplier.state,
          country: supplier.country,
          zipCode: supplier.zipCode,
          createdById: supplier.createdById,
        },
      });
      console.log(`   ✓ Created: ${supplier.name}`);
      // Small delay to prevent connection pooling issues
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    console.log(`✅ Migrated ${suppliersToMigrate.length} suppliers\n`);

    // Summary
    console.log('📊 Migration Summary:');
    const finalBusinessCount = await supabasePrisma.business.count();
    const finalLocationCount = await supabasePrisma.businessLocation.count();
    const finalRoleCount = await supabasePrisma.role.count();
    const finalUserCount = await supabasePrisma.user.count();
    const finalSupplierCount = await supabasePrisma.supplier.count();

    console.log(`   Businesses: ${finalBusinessCount}`);
    console.log(`   Locations: ${finalLocationCount}`);
    console.log(`   Roles: ${finalRoleCount}`);
    console.log(`   Users: ${finalUserCount}`);
    console.log(`   Suppliers: ${finalSupplierCount}`);
    console.log(`\n✅ Migration completed successfully!`);

    console.log(`\n💡 Next Steps:`);
    console.log(`   1. Test login at https://nextjspos-six.vercel.app/login`);
    console.log(`   2. Username: superadmin`);
    console.log(`   3. Password: password`);
    console.log(`   4. RFID field can be skipped for admin roles`);

  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  } finally {
    await localPrisma.$disconnect();
    await supabasePrisma.$disconnect();
  }
}

migrateData();
