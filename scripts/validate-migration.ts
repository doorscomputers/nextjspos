/**
 * Migration Validation Script
 *
 * Validates that data was correctly migrated from source to target database
 * Checks counts, referential integrity, and data consistency
 *
 * Usage: npx tsx scripts/validate-migration.ts
 */

import { PrismaClient } from '@prisma/client'

// Color codes
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
})

const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    },
  },
})

interface ValidationResult {
  table: string
  sourceCount: number
  targetCount: number
  match: boolean
  difference: number
}

const results: ValidationResult[] = []

function logInfo(message: string) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`)
}

function logSuccess(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`)
}

function logError(message: string) {
  console.log(`${colors.red}✗${colors.reset} ${message}`)
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`)
}

function logSection(message: string) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`)
  console.log(`${colors.cyan}${message}${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`)
}

async function validateTableCount(
  tableName: string,
  sourceModel: any,
  targetModel: any
): Promise<ValidationResult> {
  try {
    const sourceCount = await sourceModel.count()
    const targetCount = await targetModel.count()
    const match = sourceCount === targetCount
    const difference = Math.abs(sourceCount - targetCount)

    results.push({
      table: tableName,
      sourceCount,
      targetCount,
      match,
      difference,
    })

    if (match) {
      logSuccess(`${tableName.padEnd(25)} ✓ ${sourceCount} records`)
    } else {
      logError(
        `${tableName.padEnd(25)} ✗ Source: ${sourceCount}, Target: ${targetCount} (diff: ${difference})`
      )
    }

    return results[results.length - 1]
  } catch (error) {
    logError(`Failed to validate ${tableName}: ${error}`)
    return {
      table: tableName,
      sourceCount: 0,
      targetCount: 0,
      match: false,
      difference: 0,
    }
  }
}

async function validateReferentialIntegrity() {
  logSection('Validating Referential Integrity')

  try {
    // Check orphaned users (users without business)
    const orphanedUsers = await targetPrisma.user.count({
      where: {
        business: null,
      },
    })

    if (orphanedUsers === 0) {
      logSuccess('No orphaned users found')
    } else {
      logError(`Found ${orphanedUsers} users without business`)
    }

    // Check orphaned products (products without business)
    const orphanedProducts = await targetPrisma.product.count({
      where: {
        business: null,
      },
    })

    if (orphanedProducts === 0) {
      logSuccess('No orphaned products found')
    } else {
      logError(`Found ${orphanedProducts} products without business`)
    }

    // Check orphaned expenses (expenses without business/location/category)
    const orphanedExpenses = await targetPrisma.expense.count({
      where: {
        OR: [{ business: null }, { location: null }, { category: null }],
      },
    })

    if (orphanedExpenses === 0) {
      logSuccess('No orphaned expenses found')
    } else {
      logError(`Found ${orphanedExpenses} expenses with missing relationships`)
    }

    // Check product variations without product
    const orphanedVariations = await targetPrisma.productVariation.count({
      where: {
        product: null,
      },
    })

    if (orphanedVariations === 0) {
      logSuccess('No orphaned product variations found')
    } else {
      logError(
        `Found ${orphanedVariations} product variations without product`
      )
    }

    return {
      orphanedUsers,
      orphanedProducts,
      orphanedExpenses,
      orphanedVariations,
    }
  } catch (error) {
    logError(`Referential integrity check failed: ${error}`)
    return {
      orphanedUsers: -1,
      orphanedProducts: -1,
      orphanedExpenses: -1,
      orphanedVariations: -1,
    }
  }
}

async function validateDataConsistency() {
  logSection('Validating Data Consistency')

  try {
    // Check if all businesses have at least one user
    const businessesWithoutUsers = await targetPrisma.business.findMany({
      where: {
        users: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (businessesWithoutUsers.length === 0) {
      logSuccess('All businesses have at least one user')
    } else {
      logWarning(
        `Found ${businessesWithoutUsers.length} businesses without users`
      )
      businessesWithoutUsers.forEach((b) => {
        console.log(`  - Business ${b.id}: ${b.name}`)
      })
    }

    // Check if all users have at least one role
    const usersWithoutRoles = await targetPrisma.user.findMany({
      where: {
        roles: {
          none: {},
        },
      },
      select: {
        id: true,
        username: true,
      },
    })

    if (usersWithoutRoles.length === 0) {
      logSuccess('All users have at least one role')
    } else {
      logWarning(`Found ${usersWithoutRoles.length} users without roles`)
      usersWithoutRoles.slice(0, 5).forEach((u) => {
        console.log(`  - User ${u.id}: ${u.username}`)
      })
      if (usersWithoutRoles.length > 5) {
        console.log(`  ... and ${usersWithoutRoles.length - 5} more`)
      }
    }

    // Check if all products have at least one variation
    const productsWithoutVariations = await targetPrisma.product.findMany({
      where: {
        variations: {
          none: {},
        },
      },
      select: {
        id: true,
        name: true,
      },
    })

    if (productsWithoutVariations.length === 0) {
      logSuccess('All products have at least one variation')
    } else {
      logWarning(
        `Found ${productsWithoutVariations.length} products without variations`
      )
      productsWithoutVariations.slice(0, 5).forEach((p) => {
        console.log(`  - Product ${p.id}: ${p.name}`)
      })
      if (productsWithoutVariations.length > 5) {
        console.log(
          `  ... and ${productsWithoutVariations.length - 5} more`
        )
      }
    }

    return {
      businessesWithoutUsers: businessesWithoutUsers.length,
      usersWithoutRoles: usersWithoutRoles.length,
      productsWithoutVariations: productsWithoutVariations.length,
    }
  } catch (error) {
    logError(`Data consistency check failed: ${error}`)
    return {
      businessesWithoutUsers: -1,
      usersWithoutRoles: -1,
      productsWithoutVariations: -1,
    }
  }
}

async function validateSampleRecords() {
  logSection('Validating Sample Records')

  try {
    // Get first business from source and target
    const sourceBusiness = await sourcePrisma.business.findFirst({
      include: {
        currency: true,
      },
    })

    const targetBusiness = await targetPrisma.business.findFirst({
      where: { id: sourceBusiness?.id },
      include: {
        currency: true,
      },
    })

    if (
      sourceBusiness &&
      targetBusiness &&
      sourceBusiness.name === targetBusiness.name &&
      sourceBusiness.currencyId === targetBusiness.currencyId
    ) {
      logSuccess('Sample business record matches')
    } else {
      logError('Sample business record does not match')
    }

    // Get first user from source and target
    const sourceUser = await sourcePrisma.user.findFirst()
    const targetUser = await targetPrisma.user.findFirst({
      where: { id: sourceUser?.id },
    })

    if (
      sourceUser &&
      targetUser &&
      sourceUser.username === targetUser.username &&
      sourceUser.businessId === targetUser.businessId
    ) {
      logSuccess('Sample user record matches')
    } else {
      logError('Sample user record does not match')
    }

    // Get first product from source and target
    const sourceProduct = await sourcePrisma.product.findFirst()
    const targetProduct = await targetPrisma.product.findFirst({
      where: { id: sourceProduct?.id },
    })

    if (
      sourceProduct &&
      targetProduct &&
      sourceProduct.name === targetProduct.name &&
      sourceProduct.sku === targetProduct.sku
    ) {
      logSuccess('Sample product record matches')
    } else {
      logError('Sample product record does not match')
    }
  } catch (error) {
    logError(`Sample record validation failed: ${error}`)
  }
}

async function runValidation() {
  logSection('Database Migration Validation')

  // Test connections
  logInfo('Testing database connections...')
  try {
    await sourcePrisma.$queryRaw`SELECT 1`
    logSuccess('Source database connected')
  } catch (error) {
    logError(`Source database connection failed: ${error}`)
    process.exit(1)
  }

  try {
    await targetPrisma.$queryRaw`SELECT 1`
    logSuccess('Target database connected')
  } catch (error) {
    logError(`Target database connection failed: ${error}`)
    process.exit(1)
  }

  // Validate table counts
  logSection('Validating Table Counts')

  await validateTableCount('currencies', sourcePrisma.currency, targetPrisma.currency)
  await validateTableCount('businesses', sourcePrisma.business, targetPrisma.business)
  await validateTableCount('businessLocations', sourcePrisma.businessLocation, targetPrisma.businessLocation)
  await validateTableCount('users', sourcePrisma.user, targetPrisma.user)
  await validateTableCount('roles', sourcePrisma.role, targetPrisma.role)
  await validateTableCount('permissions', sourcePrisma.permission, targetPrisma.permission)
  await validateTableCount('categories', sourcePrisma.category, targetPrisma.category)
  await validateTableCount('brands', sourcePrisma.brand, targetPrisma.brand)
  await validateTableCount('units', sourcePrisma.unit, targetPrisma.unit)
  await validateTableCount('taxes', sourcePrisma.tax, targetPrisma.tax)
  await validateTableCount('suppliers', sourcePrisma.supplier, targetPrisma.supplier)
  await validateTableCount('customers', sourcePrisma.customer, targetPrisma.customer)
  await validateTableCount('products', sourcePrisma.product, targetPrisma.product)
  await validateTableCount('productVariations', sourcePrisma.productVariation, targetPrisma.productVariation)
  await validateTableCount('chartOfAccounts', sourcePrisma.chartOfAccounts, targetPrisma.chartOfAccounts)
  await validateTableCount('expenseCategories', sourcePrisma.expenseCategory, targetPrisma.expenseCategory)
  await validateTableCount('expenses', sourcePrisma.expense, targetPrisma.expense)

  // Validate referential integrity
  const integrityResults = await validateReferentialIntegrity()

  // Validate data consistency
  const consistencyResults = await validateDataConsistency()

  // Validate sample records
  await validateSampleRecords()

  // Final summary
  logSection('Validation Summary')

  const matchedTables = results.filter((r) => r.match).length
  const totalTables = results.length
  const mismatchedTables = totalTables - matchedTables

  console.log(`Total tables validated: ${totalTables}`)
  console.log(`${colors.green}Matched: ${matchedTables}${colors.reset}`)
  console.log(`${colors.red}Mismatched: ${mismatchedTables}${colors.reset}`)

  if (mismatchedTables > 0) {
    console.log('\n' + colors.red + 'Mismatched Tables:' + colors.reset)
    results
      .filter((r) => !r.match)
      .forEach((r) => {
        console.log(
          `  - ${r.table.padEnd(25)} Source: ${r.sourceCount}, Target: ${r.targetCount} (diff: ${r.difference})`
        )
      })
  }

  const hasIntegrityIssues =
    integrityResults.orphanedUsers > 0 ||
    integrityResults.orphanedProducts > 0 ||
    integrityResults.orphanedExpenses > 0 ||
    integrityResults.orphanedVariations > 0

  const hasConsistencyIssues =
    consistencyResults.businessesWithoutUsers > 0 ||
    consistencyResults.usersWithoutRoles > 0 ||
    consistencyResults.productsWithoutVariations > 0

  console.log('\n')

  if (mismatchedTables === 0 && !hasIntegrityIssues && !hasConsistencyIssues) {
    logSuccess('✅ Migration validation PASSED! All checks successful.')
  } else {
    logWarning('⚠️  Migration validation completed with issues.')

    if (mismatchedTables > 0) {
      logError(`- ${mismatchedTables} tables have count mismatches`)
    }

    if (hasIntegrityIssues) {
      logError('- Referential integrity issues detected')
    }

    if (hasConsistencyIssues) {
      logWarning('- Data consistency warnings (may not be critical)')
    }
  }

  // Disconnect
  await sourcePrisma.$disconnect()
  await targetPrisma.$disconnect()
}

// Run validation
runValidation().catch((error) => {
  logError(`Validation failed: ${error}`)
  process.exit(1)
})
