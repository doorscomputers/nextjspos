/**
 * Database Migration Script - Local to Supabase
 *
 * Migrates all data from local PostgreSQL/MySQL to Supabase
 * while maintaining referential integrity and multi-tenant structure
 *
 * Usage:
 * 1. Set SOURCE_DATABASE_URL to your local database
 * 2. Set TARGET_DATABASE_URL to your Supabase database
 * 3. Run: npx tsx scripts/migrate-to-supabase.ts
 */

import { PrismaClient } from '@prisma/client'

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

// Source database (local)
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SOURCE_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
})

// Target database (Supabase)
const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TARGET_DATABASE_URL || process.env.SUPABASE_DATABASE_URL,
    },
  },
})

interface MigrationStats {
  table: string
  sourceCount: number
  migratedCount: number
  failedCount: number
  duration: number
}

const stats: MigrationStats[] = []

/**
 * Log functions
 */
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

/**
 * Validate database connections
 */
async function validateConnections(): Promise<boolean> {
  logSection('Validating Database Connections')

  try {
    logInfo('Testing source database connection...')
    await sourcePrisma.$queryRaw`SELECT 1`
    logSuccess('Source database connected successfully')

    logInfo('Testing target database connection...')
    await targetPrisma.$queryRaw`SELECT 1`
    logSuccess('Target database connected successfully')

    return true
  } catch (error) {
    logError(`Connection validation failed: ${error}`)
    return false
  }
}

/**
 * Get table counts for comparison
 */
async function getTableCounts() {
  logSection('Comparing Table Counts')

  const tables = [
    'currency',
    'business',
    'businessLocation',
    'user',
    'role',
    'permission',
    'category',
    'brand',
    'unit',
    'tax',
    'supplier',
    'customer',
    'product',
    'productVariation',
    'expenseCategory',
    'expense',
    'chartOfAccounts',
    'journalEntry',
  ]

  for (const table of tables) {
    try {
      const sourceCount = await (sourcePrisma as any)[table].count()
      const targetCount = await (targetPrisma as any)[table].count()

      console.log(
        `${table.padEnd(25)} Source: ${String(sourceCount).padStart(6)} | Target: ${String(targetCount).padStart(6)}`
      )
    } catch (error) {
      logWarning(`Could not count ${table}: ${error}`)
    }
  }
}

/**
 * Migrate a table with progress tracking
 */
async function migrateTable<T>(
  tableName: string,
  fetchData: () => Promise<T[]>,
  insertData: (data: T) => Promise<void>
): Promise<MigrationStats> {
  const startTime = Date.now()

  logInfo(`Migrating ${tableName}...`)

  try {
    // Fetch source data
    const sourceData = await fetchData()
    const sourceCount = sourceData.length

    if (sourceCount === 0) {
      logWarning(`${tableName}: No data to migrate`)
      return {
        table: tableName,
        sourceCount: 0,
        migratedCount: 0,
        failedCount: 0,
        duration: Date.now() - startTime,
      }
    }

    logInfo(`${tableName}: Found ${sourceCount} records`)

    // Migrate each record
    let migratedCount = 0
    let failedCount = 0

    for (let i = 0; i < sourceData.length; i++) {
      const record = sourceData[i]

      try {
        await insertData(record)
        migratedCount++

        // Progress indicator
        if ((i + 1) % 100 === 0 || (i + 1) === sourceData.length) {
          process.stdout.write(
            `\r${colors.yellow}⟳${colors.reset} ${tableName}: ${i + 1}/${sourceCount} (${Math.round(((i + 1) / sourceCount) * 100)}%)`
          )
        }
      } catch (error: any) {
        failedCount++

        // Check if it's a unique constraint error (record already exists)
        if (error.code === 'P2002') {
          // Skip duplicate records
          migratedCount++
        } else {
          logError(`Failed to migrate record in ${tableName}: ${error.message}`)
        }
      }
    }

    console.log('') // New line after progress

    const duration = Date.now() - startTime

    logSuccess(
      `${tableName}: Migrated ${migratedCount}/${sourceCount} records (${failedCount} failed) in ${(duration / 1000).toFixed(2)}s`
    )

    return {
      table: tableName,
      sourceCount,
      migratedCount,
      failedCount,
      duration,
    }
  } catch (error) {
    logError(`Error migrating ${tableName}: ${error}`)
    return {
      table: tableName,
      sourceCount: 0,
      migratedCount: 0,
      failedCount: 0,
      duration: Date.now() - startTime,
    }
  }
}

/**
 * Main migration function
 */
async function migrateDatabase() {
  logSection('UltimatePOS Database Migration')
  logInfo('Starting migration from local database to Supabase...')

  // Validate connections
  const connected = await validateConnections()
  if (!connected) {
    logError('Failed to connect to databases. Aborting migration.')
    process.exit(1)
  }

  // Show initial counts
  await getTableCounts()

  // Confirm migration
  console.log('\n')
  logWarning('⚠️  WARNING: This will insert data into the target database.')
  logWarning('⚠️  Make sure you have a backup of your target database!')
  console.log('\n')

  // Ask for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const confirm = await new Promise<string>((resolve) => {
    readline.question('Type "YES" to continue: ', resolve)
  })
  readline.close()

  if (confirm !== 'YES') {
    logInfo('Migration cancelled by user')
    process.exit(0)
  }

  logSection('Starting Data Migration')

  // ==========================================
  // 1. CURRENCIES (No dependencies)
  // ==========================================
  stats.push(
    await migrateTable(
      'currencies',
      () => sourcePrisma.currency.findMany(),
      (data) =>
        targetPrisma.currency.create({
          data: {
            id: data.id,
            code: data.code,
            name: data.name,
            symbol: data.symbol,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 2. BUSINESSES (Depends on: Currency)
  // ==========================================
  stats.push(
    await migrateTable(
      'businesses',
      () => sourcePrisma.business.findMany(),
      (data) =>
        targetPrisma.business.create({
          data: {
            id: data.id,
            name: data.name,
            ownerId: data.ownerId,
            currencyId: data.currencyId,
            startDate: data.startDate,
            taxNumber1: data.taxNumber1,
            taxLabel1: data.taxLabel1,
            taxNumber2: data.taxNumber2,
            taxLabel2: data.taxLabel2,
            defaultProfitPercent: data.defaultProfitPercent,
            timeZone: data.timeZone,
            fyStartMonth: data.fyStartMonth,
            accountingMethod: data.accountingMethod,
            defaultSalesDiscount: data.defaultSalesDiscount,
            sellPriceTax: data.sellPriceTax,
            logo: data.logo,
            skuPrefix: data.skuPrefix,
            skuFormat: data.skuFormat,
            enableTooltip: data.enableTooltip,
            invoiceScheme: data.invoiceScheme,
            invoiceLayoutForPos: data.invoiceLayoutForPos,
            invoiceLayoutForSale: data.invoiceLayoutForSale,
            invoiceWarrantyRemarks: data.invoiceWarrantyRemarks,
            barcodeProductSku: data.barcodeProductSku,
            barcodeProductName: data.barcodeProductName,
            barcodeBusinessName: data.barcodeBusinessName,
            barcodeProductVariation: data.barcodeProductVariation,
            barcodeProductPrice: data.barcodeProductPrice,
            barcodePackingDate: data.barcodePackingDate,
            transferWorkflowMode: data.transferWorkflowMode,
            zCounter: data.zCounter,
            resetCounter: data.resetCounter,
            accumulatedSales: data.accumulatedSales,
            lastZReadingDate: data.lastZReadingDate,
            pricingStrategy: data.pricingStrategy,
            bulkPriceSync: data.bulkPriceSync,
            priceRoundingRule: data.priceRoundingRule,
            telegramBotToken: data.telegramBotToken,
            telegramChatId: data.telegramChatId,
            enablePricingAlerts: data.enablePricingAlerts,
            belowCostThreshold: data.belowCostThreshold,
            belowRetailThreshold: data.belowRetailThreshold,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 3. BUSINESS LOCATIONS (Depends on: Business)
  // ==========================================
  stats.push(
    await migrateTable(
      'businessLocations',
      () => sourcePrisma.businessLocation.findMany(),
      (data) =>
        targetPrisma.businessLocation.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            landmark: data.landmark,
            country: data.country,
            state: data.state,
            city: data.city,
            zipCode: data.zipCode,
            mobile: data.mobile,
            alternateNumber: data.alternateNumber,
            email: data.email,
            locationCode: data.locationCode,
            isActive: data.isActive,
            printerId: data.printerId,
            printReceiptOnInvoice: data.printReceiptOnInvoice,
            receiptPrinterType: data.receiptPrinterType,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            deletedAt: data.deletedAt,
          },
        })
    )
  )

  // ==========================================
  // 4. ROLES (Depends on: Business)
  // ==========================================
  stats.push(
    await migrateTable(
      'roles',
      () => sourcePrisma.role.findMany(),
      (data) =>
        targetPrisma.role.create({
          data: {
            id: data.id,
            name: data.name,
            businessId: data.businessId,
            description: data.description,
            isSystem: data.isSystem,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 5. PERMISSIONS (No dependencies)
  // ==========================================
  stats.push(
    await migrateTable(
      'permissions',
      () => sourcePrisma.permission.findMany(),
      (data) =>
        targetPrisma.permission.create({
          data: {
            id: data.id,
            name: data.name,
            description: data.description,
            category: data.category,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 6. USERS (Depends on: Business)
  // ==========================================
  stats.push(
    await migrateTable(
      'users',
      () => sourcePrisma.user.findMany(),
      (data) =>
        targetPrisma.user.create({
          data: {
            id: data.id,
            username: data.username,
            email: data.email,
            password: data.password,
            firstName: data.firstName,
            lastName: data.lastName,
            businessId: data.businessId,
            language: data.language,
            isActive: data.isActive,
            lastLogin: data.lastLogin,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 7. JUNCTION TABLES
  // ==========================================

  // User Roles
  stats.push(
    await migrateTable(
      'userRoles',
      () => sourcePrisma.userRole.findMany(),
      (data) =>
        targetPrisma.userRole.create({
          data: {
            userId: data.userId,
            roleId: data.roleId,
          },
        })
    )
  )

  // Role Permissions
  stats.push(
    await migrateTable(
      'rolePermissions',
      () => sourcePrisma.rolePermission.findMany(),
      (data) =>
        targetPrisma.rolePermission.create({
          data: {
            roleId: data.roleId,
            permissionId: data.permissionId,
          },
        })
    )
  )

  // User Permissions (Direct)
  stats.push(
    await migrateTable(
      'userPermissions',
      () => sourcePrisma.userPermission.findMany(),
      (data) =>
        targetPrisma.userPermission.create({
          data: {
            userId: data.userId,
            permissionId: data.permissionId,
          },
        })
    )
  )

  // User Locations
  stats.push(
    await migrateTable(
      'userLocations',
      () => sourcePrisma.userLocation.findMany(),
      (data) =>
        targetPrisma.userLocation.create({
          data: {
            userId: data.userId,
            locationId: data.locationId,
          },
        })
    )
  )

  // ==========================================
  // 8. CATEGORIES, BRANDS, UNITS, TAXES
  // ==========================================

  // Categories
  stats.push(
    await migrateTable(
      'categories',
      () => sourcePrisma.category.findMany(),
      (data) =>
        targetPrisma.category.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            shortCode: data.shortCode,
            parentId: data.parentId,
            categoryType: data.categoryType,
            description: data.description,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // Brands
  stats.push(
    await migrateTable(
      'brands',
      () => sourcePrisma.brand.findMany(),
      (data) =>
        targetPrisma.brand.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            description: data.description,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // Units
  stats.push(
    await migrateTable(
      'units',
      () => sourcePrisma.unit.findMany(),
      (data) =>
        targetPrisma.unit.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            shortName: data.shortName,
            allowDecimal: data.allowDecimal,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // Taxes
  stats.push(
    await migrateTable(
      'taxes',
      () => sourcePrisma.tax.findMany(),
      (data) =>
        targetPrisma.tax.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            amount: data.amount,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 9. SUPPLIERS & CUSTOMERS
  // ==========================================

  // Suppliers
  stats.push(
    await migrateTable(
      'suppliers',
      () => sourcePrisma.supplier.findMany(),
      (data) =>
        targetPrisma.supplier.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            supplierCode: data.supplierCode,
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            alternateNumber: data.alternateNumber,
            landline: data.landline,
            city: data.city,
            state: data.state,
            country: data.country,
            address: data.address,
            zipCode: data.zipCode,
            taxNumber: data.taxNumber,
            openingBalance: data.openingBalance,
            advanceBalance: data.advanceBalance,
            payTerm: data.payTerm,
            payTermDays: data.payTermDays,
            creditLimit: data.creditLimit,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            deletedAt: data.deletedAt,
          },
        })
    )
  )

  // Customers
  stats.push(
    await migrateTable(
      'customers',
      () => sourcePrisma.customer.findMany(),
      (data) =>
        targetPrisma.customer.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            customerCode: data.customerCode,
            name: data.name,
            email: data.email,
            mobile: data.mobile,
            alternateNumber: data.alternateNumber,
            landline: data.landline,
            city: data.city,
            state: data.state,
            country: data.country,
            address: data.address,
            zipCode: data.zipCode,
            shippingAddress: data.shippingAddress,
            taxNumber: data.taxNumber,
            openingBalance: data.openingBalance,
            advanceBalance: data.advanceBalance,
            payTerm: data.payTerm,
            payTermDays: data.payTermDays,
            creditLimit: data.creditLimit,
            customerGroup: data.customerGroup,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            deletedAt: data.deletedAt,
          },
        })
    )
  )

  // ==========================================
  // 10. PRODUCTS & VARIATIONS
  // ==========================================

  // Products
  stats.push(
    await migrateTable(
      'products',
      () => sourcePrisma.product.findMany(),
      (data) =>
        targetPrisma.product.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            productType: data.productType,
            sku: data.sku,
            barcode: data.barcode,
            categoryId: data.categoryId,
            subCategoryId: data.subCategoryId,
            brandId: data.brandId,
            unitId: data.unitId,
            taxId: data.taxId,
            taxType: data.taxType,
            enableStock: data.enableStock,
            alertQuantity: data.alertQuantity,
            description: data.description,
            productImage: data.productImage,
            isActive: data.isActive,
            notForSelling: data.notForSelling,
            createdBy: data.createdBy,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // Product Variations
  stats.push(
    await migrateTable(
      'productVariations',
      () => sourcePrisma.productVariation.findMany(),
      (data) =>
        targetPrisma.productVariation.create({
          data: {
            id: data.id,
            productId: data.productId,
            name: data.name,
            isDefaultVariation: data.isDefaultVariation,
            variationValueId: data.variationValueId,
            defaultPurchasePrice: data.defaultPurchasePrice,
            dppIncTax: data.dppIncTax,
            profitPercent: data.profitPercent,
            defaultSellPrice: data.defaultSellPrice,
            sellPriceIncTax: data.sellPriceIncTax,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 11. CHART OF ACCOUNTS
  // ==========================================
  stats.push(
    await migrateTable(
      'chartOfAccounts',
      () => sourcePrisma.chartOfAccounts.findMany(),
      (data) =>
        targetPrisma.chartOfAccounts.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            accountCode: data.accountCode,
            accountName: data.accountName,
            accountType: data.accountType,
            normalBalance: data.normalBalance,
            parentAccountId: data.parentAccountId,
            description: data.description,
            currentBalance: data.currentBalance,
            ytdDebit: data.ytdDebit,
            ytdCredit: data.ytdCredit,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // 12. EXPENSE CATEGORIES & EXPENSES
  // ==========================================

  // Expense Categories
  stats.push(
    await migrateTable(
      'expenseCategories',
      () => sourcePrisma.expenseCategory.findMany(),
      (data) =>
        targetPrisma.expenseCategory.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            name: data.name,
            description: data.description,
            glAccountId: data.glAccountId,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // Expenses
  stats.push(
    await migrateTable(
      'expenses',
      () => sourcePrisma.expense.findMany(),
      (data) =>
        targetPrisma.expense.create({
          data: {
            id: data.id,
            businessId: data.businessId,
            locationId: data.locationId,
            categoryId: data.categoryId,
            referenceNumber: data.referenceNumber,
            expenseDate: data.expenseDate,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            payeeName: data.payeeName,
            description: data.description,
            attachmentUrl: data.attachmentUrl,
            glAccountId: data.glAccountId,
            journalEntryId: data.journalEntryId,
            status: data.status,
            approvedBy: data.approvedBy,
            approvedAt: data.approvedAt,
            voidedBy: data.voidedBy,
            voidedAt: data.voidedAt,
            voidReason: data.voidReason,
            createdBy: data.createdBy,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
          },
        })
    )
  )

  // ==========================================
  // MIGRATION COMPLETE
  // ==========================================

  logSection('Migration Complete')

  // Show final counts
  await getTableCounts()

  // Show migration statistics
  logSection('Migration Statistics')

  console.log('\nTable'.padEnd(30) + 'Source'.padStart(10) + 'Migrated'.padStart(12) + 'Failed'.padStart(10) + 'Duration'.padStart(12))
  console.log('='.repeat(74))

  let totalSource = 0
  let totalMigrated = 0
  let totalFailed = 0
  let totalDuration = 0

  for (const stat of stats) {
    totalSource += stat.sourceCount
    totalMigrated += stat.migratedCount
    totalFailed += stat.failedCount
    totalDuration += stat.duration

    console.log(
      stat.table.padEnd(30) +
      String(stat.sourceCount).padStart(10) +
      String(stat.migratedCount).padStart(12) +
      String(stat.failedCount).padStart(10) +
      `${(stat.duration / 1000).toFixed(2)}s`.padStart(12)
    )
  }

  console.log('='.repeat(74))
  console.log(
    'TOTAL'.padEnd(30) +
    String(totalSource).padStart(10) +
    String(totalMigrated).padStart(12) +
    String(totalFailed).padStart(10) +
    `${(totalDuration / 1000).toFixed(2)}s`.padStart(12)
  )

  console.log('\n')

  if (totalFailed > 0) {
    logWarning(`Migration completed with ${totalFailed} failed records`)
  } else {
    logSuccess('All records migrated successfully! 🎉')
  }

  // Close connections
  await sourcePrisma.$disconnect()
  await targetPrisma.$disconnect()
}

// Run migration
migrateDatabase()
  .catch((error) => {
    logError(`Migration failed: ${error}`)
    process.exit(1)
  })
