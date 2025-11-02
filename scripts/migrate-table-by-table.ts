import { PrismaClient } from '@prisma/client'

// Source database (local)
const sourcePrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.SOURCE_DATABASE_URL,
    },
  },
})

// Target database (Supabase)
const targetPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TARGET_DATABASE_URL,
    },
  },
})

interface MigrationResult {
  table: string
  success: boolean
  recordCount: number
  error?: string
}

const results: MigrationResult[] = []

async function logProgress(message: string) {
  console.log(`\n${'='.repeat(80)}`)
  console.log(message)
  console.log('='.repeat(80))
}

async function migrateTable(
  tableName: string,
  fetchData: () => Promise<any[]>,
  insertData: (data: any[]) => Promise<void>
): Promise<boolean> {
  try {
    await logProgress(`Starting migration: ${tableName}`)

    // Fetch from source
    console.log('Fetching data from local database...')
    const data = await fetchData()
    console.log(`Found ${data.length} records`)

    if (data.length === 0) {
      console.log('No data to migrate, skipping...')
      results.push({ table: tableName, success: true, recordCount: 0 })
      return true
    }

    // Clear target table first
    console.log('Clearing target table...')
    await insertData([]) // This will be a delete operation

    // Insert to target
    console.log('Inserting data to Supabase...')
    await insertData(data)

    console.log(`✓ Successfully migrated ${data.length} records`)
    results.push({ table: tableName, success: true, recordCount: data.length })
    return true

  } catch (error: any) {
    console.error(`✗ Failed to migrate ${tableName}:`, error.message)
    results.push({
      table: tableName,
      success: false,
      recordCount: 0,
      error: error.message
    })
    return false
  }
}

async function main() {
  console.log('Starting table-by-table migration...\n')

  try {
    // Test connections
    await logProgress('Testing database connections')
    await sourcePrisma.$connect()
    console.log('✓ Connected to source database')
    await targetPrisma.$connect()
    console.log('✓ Connected to target database')

    // 1. Currencies (no dependencies)
    await migrateTable(
      'Currencies',
      async () => await sourcePrisma.currency.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.currency.deleteMany()
        } else {
          await targetPrisma.currency.deleteMany()
          await targetPrisma.currency.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 2. Permissions (no dependencies)
    await migrateTable(
      'Permissions',
      async () => await sourcePrisma.permission.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.permission.deleteMany()
        } else {
          await targetPrisma.permission.deleteMany()
          await targetPrisma.permission.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 3. Users WITHOUT businessId first (to break circular dependency)
    // Businesses need Users as owners, so we create users first with businessId = null
    const usersData = await sourcePrisma.user.findMany()
    await migrateTable(
      'Users (without businessId)',
      async () => usersData,
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.user.deleteMany()
        } else {
          await targetPrisma.user.deleteMany()
          // Create users with businessId set to null to break circular dependency
          const usersWithoutBusiness = data.map(user => ({
            ...user,
            businessId: null
          }))
          await targetPrisma.user.createMany({ data: usersWithoutBusiness, skipDuplicates: true })
        }
      }
    )

    // 4. Businesses (now users exist, so ownerId can reference them)
    await migrateTable(
      'Businesses',
      async () => await sourcePrisma.business.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.business.deleteMany()
        } else {
          await targetPrisma.business.deleteMany()
          await targetPrisma.business.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 5. Update Users to set correct businessId
    await migrateTable(
      'Users (update businessId)',
      async () => usersData,
      async (data) => {
        if (data.length > 0) {
          // Update each user with their correct businessId
          for (const user of data) {
            if (user.businessId !== null) {
              await targetPrisma.user.update({
                where: { id: user.id },
                data: { businessId: user.businessId }
              })
            }
          }
        }
      }
    )

    // 6. Business Locations (depends on Business)
    await migrateTable(
      'Business Locations',
      async () => await sourcePrisma.businessLocation.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.businessLocation.deleteMany()
        } else {
          await targetPrisma.businessLocation.deleteMany()
          await targetPrisma.businessLocation.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 7. Roles (depends on Business)
    await migrateTable(
      'Roles',
      async () => await sourcePrisma.role.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.role.deleteMany()
        } else {
          await targetPrisma.role.deleteMany()
          await targetPrisma.role.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 8. Role Permissions (depends on Roles and Permissions)
    await migrateTable(
      'Role Permissions',
      async () => await sourcePrisma.rolePermission.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.rolePermission.deleteMany()
        } else {
          await targetPrisma.rolePermission.deleteMany()
          await targetPrisma.rolePermission.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 8. User Roles (depends on Users and Roles)
    await migrateTable(
      'User Roles',
      async () => await sourcePrisma.userRole.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.userRole.deleteMany()
        } else {
          await targetPrisma.userRole.deleteMany()
          await targetPrisma.userRole.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 9. User Permissions (depends on Users and Permissions)
    await migrateTable(
      'User Permissions',
      async () => await sourcePrisma.userPermission.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.userPermission.deleteMany()
        } else {
          await targetPrisma.userPermission.deleteMany()
          await targetPrisma.userPermission.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 10. Categories (depends on Business)
    await migrateTable(
      'Categories',
      async () => await sourcePrisma.category.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.category.deleteMany()
        } else {
          await targetPrisma.category.deleteMany()
          await targetPrisma.category.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 11. Brands (depends on Business)
    await migrateTable(
      'Brands',
      async () => await sourcePrisma.brand.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.brand.deleteMany()
        } else {
          await targetPrisma.brand.deleteMany()
          await targetPrisma.brand.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 12. Units (depends on Business)
    await migrateTable(
      'Units',
      async () => await sourcePrisma.unit.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.unit.deleteMany()
        } else {
          await targetPrisma.unit.deleteMany()
          await targetPrisma.unit.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 13. Tax Rates (depends on Business)
    await migrateTable(
      'Tax Rates',
      async () => await sourcePrisma.taxRate.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.taxRate.deleteMany()
        } else {
          await targetPrisma.taxRate.deleteMany()
          await targetPrisma.taxRate.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 14. Suppliers (depends on Business)
    await migrateTable(
      'Suppliers',
      async () => await sourcePrisma.supplier.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.supplier.deleteMany()
        } else {
          await targetPrisma.supplier.deleteMany()
          await targetPrisma.supplier.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 15. Customers (depends on Business)
    await migrateTable(
      'Customers',
      async () => await sourcePrisma.customer.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.customer.deleteMany()
        } else {
          await targetPrisma.customer.deleteMany()
          await targetPrisma.customer.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 16. Products (depends on Business, Category, Brand, Unit, Tax)
    await migrateTable(
      'Products',
      async () => await sourcePrisma.product.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.product.deleteMany()
        } else {
          await targetPrisma.product.deleteMany()
          await targetPrisma.product.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 17. Product Variations (depends on Product, Business, Unit)
    await migrateTable(
      'Product Variations',
      async () => await sourcePrisma.productVariation.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.productVariation.deleteMany()
        } else {
          await targetPrisma.productVariation.deleteMany()
          await targetPrisma.productVariation.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 18. Chart of Accounts (depends on Business)
    await migrateTable(
      'Chart of Accounts',
      async () => await sourcePrisma.chartOfAccounts.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.chartOfAccounts.deleteMany()
        } else {
          await targetPrisma.chartOfAccounts.deleteMany()
          await targetPrisma.chartOfAccounts.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 19. Product History (depends on Product, BusinessLocation, User)
    await migrateTable(
      'Product History',
      async () => await sourcePrisma.productHistory.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.productHistory.deleteMany()
        } else {
          await targetPrisma.productHistory.deleteMany()
          await targetPrisma.productHistory.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // 20. Expenses (depends on Business, ChartOfAccounts, User, BusinessLocation)
    await migrateTable(
      'Expenses',
      async () => await sourcePrisma.expense.findMany(),
      async (data) => {
        if (data.length === 0) {
          await targetPrisma.expense.deleteMany()
        } else {
          await targetPrisma.expense.deleteMany()
          await targetPrisma.expense.createMany({ data, skipDuplicates: true })
        }
      }
    )

    // Print summary
    await logProgress('Migration Summary')
    console.log('\nResults:')
    console.log('--------')

    let successCount = 0
    let failCount = 0
    let totalRecords = 0

    results.forEach(result => {
      const status = result.success ? '✓' : '✗'
      console.log(`${status} ${result.table}: ${result.recordCount} records`)
      if (result.error) {
        console.log(`  Error: ${result.error}`)
      }

      if (result.success) {
        successCount++
        totalRecords += result.recordCount
      } else {
        failCount++
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log(`Total: ${successCount} successful, ${failCount} failed`)
    console.log(`Total records migrated: ${totalRecords}`)
    console.log('='.repeat(80))

    if (failCount > 0) {
      console.log('\n⚠️  Some tables failed to migrate. Check the errors above.')
      process.exit(1)
    } else {
      console.log('\n✓ All tables migrated successfully!')
    }

  } catch (error) {
    console.error('\n✗ Migration failed:', error)
    throw error
  } finally {
    await sourcePrisma.$disconnect()
    await targetPrisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
