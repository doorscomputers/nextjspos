/**
 * Import Production Data Script
 *
 * This script imports data from the JSON export file to the production database.
 * Run this AFTER pushing the Prisma schema to production.
 *
 * Usage:
 * 1. Set DATABASE_URL to production database
 * 2. node scripts/import-data.mjs path/to/export-file.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importData(filePath) {
  console.log('Starting data import...\n');

  try {
    // Read export file
    if (!fs.existsSync(filePath)) {
      throw new Error(`Export file not found: ${filePath}`);
    }

    console.log(`Reading export file: ${filePath}`);
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(rawData);

    console.log('✓ File loaded successfully\n');

    // Import order matters due to foreign key constraints!

    // 1. Businesses (no dependencies)
    console.log('Importing businesses...');
    for (const business of data.businesses || []) {
      const { locations, currencies, ...businessData } = business;
      await prisma.business.upsert({
        where: { id: businessData.id },
        update: businessData,
        create: businessData,
      });
    }
    console.log(`✓ Imported ${data.businesses?.length || 0} businesses`);

    // 2. Business Locations
    console.log('Importing business locations...');
    for (const business of data.businesses || []) {
      for (const location of business.locations || []) {
        await prisma.businessLocation.upsert({
          where: { id: location.id },
          update: location,
          create: location,
        });
      }
    }
    console.log('✓ Imported business locations');

    // 3. Currencies
    console.log('Importing currencies...');
    for (const business of data.businesses || []) {
      for (const currency of business.currencies || []) {
        await prisma.currency.upsert({
          where: { id: currency.id },
          update: currency,
          create: currency,
        });
      }
    }
    console.log('✓ Imported currencies');

    // 4. Permissions
    console.log('Importing permissions...');
    for (const permission of data.permissions || []) {
      await prisma.permission.upsert({
        where: { id: permission.id },
        update: permission,
        create: permission,
      });
    }
    console.log(`✓ Imported ${data.permissions?.length || 0} permissions`);

    // 5. Roles (without permissions first)
    console.log('Importing roles...');
    for (const role of data.roles || []) {
      const { rolePermissions, ...roleData } = role;
      await prisma.role.upsert({
        where: { id: roleData.id },
        update: roleData,
        create: roleData,
      });
    }
    console.log(`✓ Imported ${data.roles?.length || 0} roles`);

    // 6. Role Permissions (junction table)
    console.log('Importing role permissions...');
    for (const role of data.roles || []) {
      for (const rp of role.rolePermissions || []) {
        await prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: rp.roleId,
              permissionId: rp.permissionId,
            },
          },
          update: {},
          create: {
            roleId: rp.roleId,
            permissionId: rp.permissionId,
          },
        });
      }
    }
    console.log('✓ Imported role permissions');

    // 7. Users (without roles/permissions first)
    console.log('Importing users...');
    for (const user of data.users || []) {
      const { userRoles, userPermissions, ...userData } = user;
      await prisma.user.upsert({
        where: { id: userData.id },
        update: userData,
        create: userData,
      });
    }
    console.log(`✓ Imported ${data.users?.length || 0} users`);

    // 8. User Roles
    console.log('Importing user roles...');
    for (const user of data.users || []) {
      for (const ur of user.userRoles || []) {
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: ur.userId,
              roleId: ur.roleId,
            },
          },
          update: {},
          create: {
            userId: ur.userId,
            roleId: ur.roleId,
          },
        });
      }
    }
    console.log('✓ Imported user roles');

    // 9. User Permissions
    console.log('Importing user permissions...');
    for (const user of data.users || []) {
      for (const up of user.userPermissions || []) {
        await prisma.userPermission.upsert({
          where: {
            userId_permissionId: {
              userId: up.userId,
              permissionId: up.permissionId,
            },
          },
          update: {},
          create: {
            userId: up.userId,
            permissionId: up.permissionId,
          },
        });
      }
    }
    console.log('✓ Imported user permissions');

    // 10. Categories
    console.log('Importing categories...');
    for (const category of data.categories || []) {
      await prisma.category.upsert({
        where: { id: category.id },
        update: category,
        create: category,
      });
    }
    console.log(`✓ Imported ${data.categories?.length || 0} categories`);

    // 11. Brands
    console.log('Importing brands...');
    for (const brand of data.brands || []) {
      await prisma.brand.upsert({
        where: { id: brand.id },
        update: brand,
        create: brand,
      });
    }
    console.log(`✓ Imported ${data.brands?.length || 0} brands`);

    // 12. Units
    console.log('Importing units...');
    for (const unit of data.units || []) {
      await prisma.unit.upsert({
        where: { id: unit.id },
        update: unit,
        create: unit,
      });
    }
    console.log(`✓ Imported ${data.units?.length || 0} units`);

    // 13. Suppliers
    console.log('Importing suppliers...');
    for (const supplier of data.suppliers || []) {
      await prisma.supplier.upsert({
        where: { id: supplier.id },
        update: supplier,
        create: supplier,
      });
    }
    console.log(`✓ Imported ${data.suppliers?.length || 0} suppliers`);

    // 14. Customers
    console.log('Importing customers...');
    for (const customer of data.customers || []) {
      await prisma.customer.upsert({
        where: { id: customer.id },
        update: customer,
        create: customer,
      });
    }
    console.log(`✓ Imported ${data.customers?.length || 0} customers`);

    // 15. Tax Rates
    console.log('Importing tax rates...');
    for (const taxRate of data.taxRates || []) {
      await prisma.taxRate.upsert({
        where: { id: taxRate.id },
        update: taxRate,
        create: taxRate,
      });
    }
    console.log(`✓ Imported ${data.taxRates?.length || 0} tax rates`);

    // 16. Products (without variations first)
    console.log('Importing products...');
    for (const product of data.products || []) {
      const { variations, category, brand, unit, ...productData } = product;
      await prisma.product.upsert({
        where: { id: productData.id },
        update: productData,
        create: productData,
      });
    }
    console.log(`✓ Imported ${data.products?.length || 0} products`);

    // 17. Product Variations
    console.log('Importing product variations...');
    for (const variation of data.productVariations || []) {
      const { product, ...variationData } = variation;
      await prisma.productVariation.upsert({
        where: { id: variationData.id },
        update: variationData,
        create: variationData,
      });
    }
    console.log(`✓ Imported ${data.productVariations?.length || 0} variations`);

    // 18. Stock
    console.log('Importing stock/inventory...');
    for (const stock of data.stock || []) {
      await prisma.stock.upsert({
        where: { id: stock.id },
        update: stock,
        create: stock,
      });
    }
    console.log(`✓ Imported ${data.stock?.length || 0} stock records`);

    console.log('\n✅ Import completed successfully!');
    console.log('\n⚠️  IMPORTANT NEXT STEPS:');
    console.log('1. Create a new admin user for production (demo accounts were excluded)');
    console.log('2. Verify data in Prisma Studio: npx prisma studio');
    console.log('3. Test login and basic operations');
    console.log('4. Update environment variables in Vercel');

  } catch (error) {
    console.error('❌ Import failed:', error);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get file path from command line argument
const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/import-data.mjs <path-to-export-file.json>');
  process.exit(1);
}

importData(filePath);
