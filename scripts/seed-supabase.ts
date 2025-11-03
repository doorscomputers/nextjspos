/**
 * Seed Supabase Database with Fresh Demo Data
 * This creates a clean database with 1 super admin user for testing
 */

import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

// Connect to Supabase
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

async function main() {
  console.log('\n' + '='.repeat(60))
  console.log('🌱 SEEDING SUPABASE DATABASE')
  console.log('='.repeat(60))
  console.log('⚠️  This will create fresh demo data in Supabase')
  console.log('='.repeat(60))

  try {
    console.log('\n🔌 Connecting to Supabase...')
    await prisma.$connect()
    console.log('✅ Connected to Supabase')

    // ==========================================
    // Step 1: Create Currency
    // ==========================================
    console.log('\n📦 Creating Currency...')
    const currency = await prisma.currency.upsert({
      where: { code: 'USD' },
      create: {
        name: 'US Dollar',
        code: 'USD',
        symbol: '$',
      },
      update: {},
    })
    console.log('✅ Currency created: USD')

    // ==========================================
    // Step 2: Create User (without business first)
    // ==========================================
    console.log('\n📦 Creating Super Admin User (step 1)...')
    const hashedPassword = await bcrypt.hash('password', 10)
    const superAdmin = await prisma.user.upsert({
      where: { username: 'superadmin' },
      create: {
        username: 'superadmin',
        email: 'superadmin@demo.com',
        password: hashedPassword,
        surname: 'Admin',
        firstName: 'Super',
        lastName: '',
        businessId: null, // Will be updated after creating business
        allowLogin: true,
      },
      update: {
        password: hashedPassword, // Update password in case it exists
        businessId: null, // Reset to null before creating business
      },
    })
    console.log('✅ User created:', superAdmin.username)

    // ==========================================
    // Step 3: Create Business (with user as owner)
    // ==========================================
    console.log('\n📦 Creating Business...')
    const business = await prisma.business.upsert({
      where: { id: 1 },
      create: {
        ownerId: superAdmin.id,
        name: 'Demo Business',
        currencyId: currency.id,
        startDate: new Date(),
        taxNumber1: 'TAX123456',
        taxLabel1: 'VAT',
        defaultProfitPercent: 25,
        timeZone: 'UTC',
        fyStartMonth: 1,
        accountingMethod: 'fifo',
        sellPriceTax: 'includes',
        skuPrefix: 'PROD',
        skuFormat: 'hyphen',
        enableTooltip: true,
      },
      update: {},
    })
    console.log('✅ Business created:', business.name)

    // ==========================================
    // Step 4: Update User with businessId
    // ==========================================
    console.log('\n📦 Linking User to Business...')
    await prisma.user.update({
      where: { id: superAdmin.id },
      data: { businessId: business.id },
    })
    console.log('✅ User linked to business')

    // ==========================================
    // Step 5: Create Business Location
    // ==========================================
    console.log('\n📦 Creating Business Location...')
    const location = await prisma.businessLocation.upsert({
      where: { id: 1 },
      create: {
        businessId: business.id,
        name: 'Main Warehouse',
        landmark: 'Main Street',
        country: 'United States',
        state: 'California',
        city: 'Los Angeles',
        zipCode: '90001',
        mobile: '+1234567890',
        email: 'warehouse@demo.com',
        locationCode: 'WH001',
        isActive: true,
        printReceiptOnInvoice: 1,
        receiptPrinterType: 'browser',
      },
      update: {},
    })
    console.log('✅ Location created:', location.name)

    // ==========================================
    // Step 6: Create Permissions
    // ==========================================
    console.log('\n📦 Creating Permissions...')
    const permissions = [
      // Dashboard
      { name: 'dashboard.view', guardName: 'web' },

      // Products
      { name: 'product.view', guardName: 'web' },
      { name: 'product.create', guardName: 'web' },
      { name: 'product.edit', guardName: 'web' },
      { name: 'product.delete', guardName: 'web' },

      // Inventory
      { name: 'inventory.view', guardName: 'web' },
      { name: 'inventory.adjust', guardName: 'web' },

      // Sales
      { name: 'sale.view', guardName: 'web' },
      { name: 'sale.create', guardName: 'web' },

      // Purchases
      { name: 'purchase.view', guardName: 'web' },
      { name: 'purchase.create', guardName: 'web' },

      // Expenses
      { name: 'expense.view', guardName: 'web' },
      { name: 'expense.create', guardName: 'web' },

      // Reports
      { name: 'report.view', guardName: 'web' },

      // Users
      { name: 'user.view', guardName: 'web' },
      { name: 'user.create', guardName: 'web' },
      { name: 'user.edit', guardName: 'web' },
      { name: 'user.delete', guardName: 'web' },

      // Roles
      { name: 'role.view', guardName: 'web' },
      { name: 'role.create', guardName: 'web' },
      { name: 'role.edit', guardName: 'web' },
      { name: 'role.delete', guardName: 'web' },

      // Settings
      { name: 'settings.view', guardName: 'web' },
      { name: 'settings.edit', guardName: 'web' },
    ]

    const createdPermissions = []
    for (const perm of permissions) {
      const permission = await prisma.permission.upsert({
        where: { name: perm.name },
        create: perm,
        update: {},
      })
      createdPermissions.push(permission)
    }
    console.log(`✅ Created ${permissions.length} permissions`)

    // ==========================================
    // Step 7: Create Super Admin Role
    // ==========================================
    console.log('\n📦 Creating Super Admin Role...')
    const superAdminRole = await prisma.role.upsert({
      where: { id: 1 },
      create: {
        businessId: business.id,
        name: 'Super Admin',
        guardName: 'web',
        isDefault: false,
      },
      update: {},
    })
    console.log('✅ Role created:', superAdminRole.name)

    // ==========================================
    // Step 8: Assign ALL permissions to Super Admin role
    // ==========================================
    console.log('\n📦 Assigning permissions to Super Admin role...')
    for (const permission of createdPermissions) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: superAdminRole.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: superAdminRole.id,
          permissionId: permission.id,
        },
        update: {},
      })
    }
    console.log(`✅ Assigned ${createdPermissions.length} permissions to role`)

    // ==========================================
    // Step 9: Assign Super Admin role to user
    // ==========================================
    console.log('\n📦 Assigning Super Admin role to user...')
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: superAdminRole.id,
        },
      },
      create: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
      },
      update: {},
    })
    console.log('✅ Role assigned to user')

    // ==========================================
    // FINAL SUMMARY
    // ==========================================
    console.log('\n' + '='.repeat(60))
    console.log('🎉 SEEDING COMPLETE!')
    console.log('='.repeat(60))
    console.log('\n📋 Login Credentials:')
    console.log('-'.repeat(60))
    console.log('Username: superadmin')
    console.log('Password: password')
    console.log('-'.repeat(60))
    console.log('\nBusiness: Demo Business')
    console.log('Location: Main Warehouse')
    console.log(`Permissions: ${createdPermissions.length} assigned`)
    console.log('-'.repeat(60))
    console.log('\n✅ You can now login and test your application!')
    console.log('   After login, you can add your real business data')
    console.log('='.repeat(60) + '\n')
  } catch (error) {
    console.error('\n❌ Seeding failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
