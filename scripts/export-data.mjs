/**
 * Export Production Data Script
 *
 * This script exports essential production data (products, inventory, business settings)
 * while excluding demo accounts and test data.
 *
 * Usage: node scripts/export-data.mjs
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function exportData() {
  console.log('Starting data export...\n');

  try {
    // Create backup directory
    const backupDir = path.join(process.cwd(), 'backup');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
    const exportData = {};

    // Export Business data
    console.log('Exporting businesses...');
    exportData.businesses = await prisma.business.findMany({
      include: {
        locations: true,
        currency: true,
      },
    });
    console.log(`✓ Exported ${exportData.businesses.length} businesses`);

    // Export Users (excluding demo accounts)
    console.log('Exporting users...');
    exportData.users = await prisma.user.findMany({
      where: {
        username: {
          notIn: ['superadmin', 'admin', 'manager', 'cashier'], // Exclude demo accounts
        },
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    console.log(`✓ Exported ${exportData.users.length} users (demo accounts excluded)`);

    // Export Roles and Permissions
    console.log('Exporting roles and permissions...');
    exportData.roles = await prisma.role.findMany({
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });
    exportData.permissions = await prisma.permission.findMany();
    console.log(`✓ Exported ${exportData.roles.length} roles and ${exportData.permissions.length} permissions`);

    // Export Categories
    console.log('Exporting categories...');
    exportData.categories = await prisma.category.findMany();
    console.log(`✓ Exported ${exportData.categories.length} categories`);

    // Export Brands
    console.log('Exporting brands...');
    exportData.brands = await prisma.brand.findMany();
    console.log(`✓ Exported ${exportData.brands.length} brands`);

    // Export Units
    console.log('Exporting units...');
    exportData.units = await prisma.unit.findMany();
    console.log(`✓ Exported ${exportData.units.length} units`);

    // Export Products
    console.log('Exporting products...');
    exportData.products = await prisma.product.findMany({
      include: {
        variations: true,
        category: true,
        brand: true,
        unit: true,
      },
    });
    console.log(`✓ Exported ${exportData.products.length} products`);

    // Export Product Variations
    console.log('Exporting product variations...');
    exportData.productVariations = await prisma.productVariation.findMany({
      include: {
        product: true,
      },
    });
    console.log(`✓ Exported ${exportData.productVariations.length} variations`);

    // Export Stock (Inventory)
    console.log('Exporting stock/inventory...');
    exportData.stock = await prisma.variationLocationDetails.findMany();
    console.log(`✓ Exported ${exportData.stock.length} stock records`);

    // Export Suppliers
    console.log('Exporting suppliers...');
    exportData.suppliers = await prisma.supplier.findMany();
    console.log(`✓ Exported ${exportData.suppliers.length} suppliers`);

    // Export Customers
    console.log('Exporting customers...');
    exportData.customers = await prisma.customer.findMany();
    console.log(`✓ Exported ${exportData.customers.length} customers`);

    // Export Tax Rates
    console.log('Exporting tax rates...');
    exportData.taxRates = await prisma.taxRate.findMany();
    console.log(`✓ Exported ${exportData.taxRates.length} tax rates`);

    // Save to file
    const filename = path.join(backupDir, `export-${timestamp}.json`);
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));

    console.log(`\n✅ Export completed successfully!`);
    console.log(`📁 File saved to: ${filename}`);
    console.log(`📊 Total file size: ${(fs.statSync(filename).size / 1024 / 1024).toFixed(2)} MB`);

    // Create summary
    const summary = {
      timestamp,
      totalRecords: Object.values(exportData).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
      breakdown: {
        businesses: exportData.businesses.length,
        users: exportData.users.length,
        roles: exportData.roles.length,
        permissions: exportData.permissions.length,
        categories: exportData.categories.length,
        brands: exportData.brands.length,
        units: exportData.units.length,
        products: exportData.products.length,
        variations: exportData.productVariations.length,
        stock: exportData.stock.length,
        suppliers: exportData.suppliers.length,
        customers: exportData.customers.length,
        taxRates: exportData.taxRates.length,
      },
    };

    console.log('\n📋 Export Summary:');
    console.log(JSON.stringify(summary.breakdown, null, 2));

  } catch (error) {
    console.error('❌ Export failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();
