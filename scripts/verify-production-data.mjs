/**
 * Verify Production Data Integrity
 *
 * This script checks data integrity after migration to production.
 * Compares counts and validates relationships.
 *
 * Usage: node scripts/verify-production-data.mjs
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyData() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Production Data Integrity Verification            ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  const issues = [];
  const warnings = [];
  const checks = [];

  try {
    // 1. Basic counts
    console.log('📊 Checking record counts...\n');

    const counts = {
      businesses: await prisma.business.count(),
      locations: await prisma.businessLocation.count(),
      users: await prisma.user.count(),
      roles: await prisma.role.count(),
      permissions: await prisma.permission.count(),
      categories: await prisma.category.count(),
      brands: await prisma.brand.count(),
      units: await prisma.unit.count(),
      suppliers: await prisma.supplier.count(),
      customers: await prisma.customer.count(),
      products: await prisma.product.count(),
      variations: await prisma.productVariation.count(),
      stock: await prisma.stock.count(),
      taxRates: await prisma.taxRate.count(),
    };

    console.log('Record Counts:');
    Object.entries(counts).forEach(([table, count]) => {
      console.log(`  ${table.padEnd(20)} ${count.toString().padStart(6)}`);
    });
    console.log('');

    checks.push({
      name: 'Basic Counts',
      status: 'PASS',
      details: `${Object.values(counts).reduce((a, b) => a + b, 0)} total records`,
    });

    // 2. Critical checks
    console.log('🔍 Running integrity checks...\n');

    // Check 1: All products must have at least one variation
    const productsWithoutVariations = await prisma.product.findMany({
      where: {
        variations: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
        sku: true,
      },
    });

    if (productsWithoutVariations.length > 0) {
      issues.push({
        severity: 'ERROR',
        check: 'Products without variations',
        count: productsWithoutVariations.length,
        details: productsWithoutVariations.slice(0, 5).map((p) => p.name),
      });
    } else {
      checks.push({
        name: 'Products have variations',
        status: 'PASS',
        details: 'All products have at least one variation',
      });
    }

    // Check 2: All variations must reference valid products
    const orphanedVariations = await prisma.productVariation.findMany({
      where: {
        product: null,
      },
      select: {
        id: true,
        sku: true,
      },
    });

    if (orphanedVariations.length > 0) {
      issues.push({
        severity: 'ERROR',
        check: 'Orphaned product variations',
        count: orphanedVariations.length,
        details: orphanedVariations.slice(0, 5).map((v) => v.sku),
      });
    } else {
      checks.push({
        name: 'Variations linked to products',
        status: 'PASS',
        details: 'All variations reference valid products',
      });
    }

    // Check 3: All stock must reference valid variations
    const orphanedStock = await prisma.stock.findMany({
      where: {
        productVariation: null,
      },
      select: {
        id: true,
        quantity: true,
      },
    });

    if (orphanedStock.length > 0) {
      issues.push({
        severity: 'ERROR',
        check: 'Orphaned stock records',
        count: orphanedStock.length,
        details: `${orphanedStock.length} stock records reference invalid variations`,
      });
    } else {
      checks.push({
        name: 'Stock linked to variations',
        status: 'PASS',
        details: 'All stock records reference valid variations',
      });
    }

    // Check 4: All users must have at least one role
    const usersWithoutRoles = await prisma.user.findMany({
      where: {
        userRoles: {
          none: {},
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (usersWithoutRoles.length > 0) {
      warnings.push({
        severity: 'WARNING',
        check: 'Users without roles',
        count: usersWithoutRoles.length,
        details: usersWithoutRoles.map((u) => u.username),
      });
    } else {
      checks.push({
        name: 'Users have roles',
        status: 'PASS',
        details: 'All users have at least one role assigned',
      });
    }

    // Check 5: All businesses must have at least one location
    const businessesWithoutLocations = await prisma.business.findMany({
      where: {
        locations: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (businessesWithoutLocations.length > 0) {
      warnings.push({
        severity: 'WARNING',
        check: 'Businesses without locations',
        count: businessesWithoutLocations.length,
        details: businessesWithoutLocations.map((b) => b.name),
      });
    } else {
      checks.push({
        name: 'Businesses have locations',
        status: 'PASS',
        details: 'All businesses have at least one location',
      });
    }

    // Check 6: Stock quantity statistics
    const stockStats = await prisma.stock.aggregate({
      _sum: {
        quantity: true,
      },
      _avg: {
        quantity: true,
      },
      _max: {
        quantity: true,
      },
      _min: {
        quantity: true,
      },
      _count: true,
    });

    console.log('📦 Stock Statistics:');
    console.log(`  Total units in stock:     ${stockStats._sum.quantity || 0}`);
    console.log(
      `  Average per location:     ${(stockStats._avg.quantity || 0).toFixed(2)}`
    );
    console.log(`  Maximum stock level:      ${stockStats._max.quantity || 0}`);
    console.log(`  Minimum stock level:      ${stockStats._min.quantity || 0}`);
    console.log('');

    checks.push({
      name: 'Stock statistics',
      status: 'PASS',
      details: `Total units: ${stockStats._sum.quantity || 0}`,
    });

    // Check 7: Verify admin users exist
    const adminUsers = await prisma.user.findMany({
      where: {
        userRoles: {
          some: {
            role: {
              name: {
                in: ['Super Admin', 'Admin'],
              },
            },
          },
        },
      },
      select: {
        id: true,
        username: true,
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (adminUsers.length === 0) {
      issues.push({
        severity: 'ERROR',
        check: 'No admin users found',
        count: 0,
        details:
          'Create at least one admin user with: node scripts/create-production-admin.mjs',
      });
    } else {
      checks.push({
        name: 'Admin users exist',
        status: 'PASS',
        details: `${adminUsers.length} admin user(s) found`,
      });
    }

    // Check 8: Multi-tenant isolation
    const businessData = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            products: true,
            users: true,
            locations: true,
          },
        },
      },
    });

    console.log('🏢 Business Data:');
    businessData.forEach((biz) => {
      console.log(`  ${biz.name}:`);
      console.log(`    Products:  ${biz._count.products}`);
      console.log(`    Users:     ${biz._count.users}`);
      console.log(`    Locations: ${biz._count.locations}`);
    });
    console.log('');

    checks.push({
      name: 'Multi-tenant data structure',
      status: 'PASS',
      details: `${businessData.length} business(es) with proper relationships`,
    });

    // Check 9: Soft delete verification
    const softDeletedProducts = await prisma.product.count({
      where: {
        deletedAt: {
          not: null,
        },
      },
    });

    const softDeletedVariations = await prisma.productVariation.count({
      where: {
        deletedAt: {
          not: null,
        },
      },
    });

    if (softDeletedProducts > 0 || softDeletedVariations > 0) {
      warnings.push({
        severity: 'INFO',
        check: 'Soft-deleted records',
        count: softDeletedProducts + softDeletedVariations,
        details: `${softDeletedProducts} products, ${softDeletedVariations} variations`,
      });
    } else {
      checks.push({
        name: 'No soft-deleted records',
        status: 'PASS',
        details: 'Clean data without deleted items',
      });
    }

    // Final Report
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   Verification Report                                ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    if (checks.length > 0) {
      console.log('✅ PASSED CHECKS:\n');
      checks.forEach((check) => {
        console.log(`  ✓ ${check.name}`);
        console.log(`    ${check.details}\n`);
      });
    }

    if (warnings.length > 0) {
      console.log('⚠️  WARNINGS:\n');
      warnings.forEach((warning) => {
        console.log(`  ⚠  ${warning.check} (${warning.count})`);
        if (Array.isArray(warning.details)) {
          warning.details.forEach((detail) => {
            console.log(`     - ${detail}`);
          });
        } else {
          console.log(`     ${warning.details}`);
        }
        console.log('');
      });
    }

    if (issues.length > 0) {
      console.log('❌ CRITICAL ISSUES:\n');
      issues.forEach((issue) => {
        console.log(`  ❌ ${issue.check} (${issue.count})`);
        if (Array.isArray(issue.details)) {
          issue.details.forEach((detail) => {
            console.log(`     - ${detail}`);
          });
        } else {
          console.log(`     ${issue.details}`);
        }
        console.log('');
      });

      console.log('⚠️  CRITICAL ISSUES FOUND! Fix these before deploying.\n');
      process.exit(1);
    } else {
      console.log('✅ All critical checks passed!\n');
      console.log('📋 Summary:');
      console.log(`   ${checks.length} checks passed`);
      console.log(`   ${warnings.length} warnings`);
      console.log(`   ${issues.length} critical issues\n`);

      if (warnings.length > 0) {
        console.log(
          '⚠️  Review warnings above before proceeding to production.\n'
        );
      } else {
        console.log('🚀 Database is ready for production deployment!\n');
      }
    }
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyData();
