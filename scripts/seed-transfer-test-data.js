/**
 * Seed Transfer Test Data
 * Creates comprehensive test data for inventory transfer testing
 * - Multiple locations (warehouses/branches)
 * - Multiple users with different roles and location assignments
 * - Products with stock in multiple locations
 * - Test scenarios for complete transfer workflow
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting transfer test data seed...\n')

  // Get existing business (assuming first business exists from seed)
  const business = await prisma.business.findFirst()
  if (!business) {
    throw new Error('No business found. Please run main seed first.')
  }

  console.log(`✓ Using business: ${business.name} (ID: ${business.id})\n`)

  // 1. Create locations (warehouses/branches)
  console.log('📍 Creating test locations...')

  const mainWarehouse = await prisma.businessLocation.upsert({
    where: { id: 100 },
    create: {
      id: 100,
      businessId: business.id,
      name: 'Main Warehouse',
      country: 'Philippines',
      state: 'Metro Manila',
      city: 'Quezon City',
      zipCode: '1100',
      mobile: '+639171234501',
      email: 'warehouse.main@test.com',
    },
    update: {},
  })

  const branch1 = await prisma.businessLocation.upsert({
    where: { id: 101 },
    create: {
      id: 101,
      businessId: business.id,
      name: 'Branch Makati',
      country: 'Philippines',
      state: 'Metro Manila',
      city: 'Makati',
      zipCode: '1200',
      mobile: '+639171234502',
      email: 'branch.makati@test.com',
    },
    update: {},
  })

  const branch2 = await prisma.businessLocation.upsert({
    where: { id: 102 },
    create: {
      id: 102,
      businessId: business.id,
      name: 'Branch Pasig',
      country: 'Philippines',
      state: 'Metro Manila',
      city: 'Pasig',
      zipCode: '1600',
      mobile: '+639171234503',
      email: 'branch.pasig@test.com',
    },
    update: {},
  })

  const branch3 = await prisma.businessLocation.upsert({
    where: { id: 103 },
    create: {
      id: 103,
      businessId: business.id,
      name: 'Branch Cebu',
      country: 'Philippines',
      state: 'Cebu',
      city: 'Cebu City',
      zipCode: '6000',
      mobile: '+639171234504',
      email: 'branch.cebu@test.com',
    },
    update: {},
  })

  console.log(`✓ Created 4 locations:`)
  console.log(`  - Main Warehouse (ID: ${mainWarehouse.id})`)
  console.log(`  - Branch Makati (ID: ${branch1.id})`)
  console.log(`  - Branch Pasig (ID: ${branch2.id})`)
  console.log(`  - Branch Cebu (ID: ${branch3.id})\n`)

  // 2. Get roles
  console.log('👥 Getting roles...')
  const branchAdminRole = await prisma.role.findFirst({
    where: { businessId: business.id, name: 'Branch Admin' },
  })
  const branchManagerRole = await prisma.role.findFirst({
    where: { businessId: business.id, name: 'Branch Manager' },
  })

  if (!branchAdminRole || !branchManagerRole) {
    throw new Error('Required roles not found. Please run main seed first.')
  }
  console.log(`✓ Found roles: Branch Admin, Branch Manager\n`)

  // 3. Create test users
  console.log('👤 Creating test users...')
  const hashedPassword = await bcrypt.hash('password123', 10)

  // Warehouse Manager (Main Warehouse)
  const warehouseManager = await prisma.user.upsert({
    where: { username: 'warehouse_mgr' },
    create: {
      username: 'warehouse_mgr',
      password: hashedPassword,
      surname: 'Santos',
      firstName: 'Carlos',
      lastName: 'Warehouse Manager',
      email: 'carlos.santos@test.com',
      businessId: business.id,
      allowLogin: true,
    },
    update: {},
  })

  // Assign role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: warehouseManager.id,
        roleId: branchManagerRole.id,
      },
    },
    create: {
      userId: warehouseManager.id,
      roleId: branchManagerRole.id,
    },
    update: {},
  })

  // Assign to Main Warehouse
  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: warehouseManager.id,
        locationId: mainWarehouse.id,
      },
    },
    create: {
      userId: warehouseManager.id,
      locationId: mainWarehouse.id,
    },
    update: {},
  })

  // Branch Manager - Makati
  const makatiManager = await prisma.user.upsert({
    where: { username: 'makati_mgr' },
    create: {
      username: 'makati_mgr',
      password: hashedPassword,
      surname: 'Garcia',
      firstName: 'Maria',
      lastName: 'Branch Manager',
      email: 'maria.garcia@test.com',
      businessId: business.id,
      allowLogin: true,
    },
    update: {},
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: makatiManager.id,
        roleId: branchManagerRole.id,
      },
    },
    create: {
      userId: makatiManager.id,
      roleId: branchManagerRole.id,
    },
    update: {},
  })

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: makatiManager.id,
        locationId: branch1.id,
      },
    },
    create: {
      userId: makatiManager.id,
      locationId: branch1.id,
    },
    update: {},
  })

  // Branch Manager - Pasig
  const pasigManager = await prisma.user.upsert({
    where: { username: 'pasig_mgr' },
    create: {
      username: 'pasig_mgr',
      password: hashedPassword,
      surname: 'Dela Cruz',
      firstName: 'Juan',
      lastName: 'Branch Manager',
      email: 'juan.delacruz@test.com',
      businessId: business.id,
      allowLogin: true,
    },
    update: {},
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: pasigManager.id,
        roleId: branchManagerRole.id,
      },
    },
    create: {
      userId: pasigManager.id,
      roleId: branchManagerRole.id,
    },
    update: {},
  })

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: pasigManager.id,
        locationId: branch2.id,
      },
    },
    create: {
      userId: pasigManager.id,
      locationId: branch2.id,
    },
    update: {},
  })

  // Branch Manager - Cebu
  const cebuManager = await prisma.user.upsert({
    where: { username: 'cebu_mgr' },
    create: {
      username: 'cebu_mgr',
      password: hashedPassword,
      surname: 'Reyes',
      firstName: 'Ana',
      lastName: 'Branch Manager',
      email: 'ana.reyes@test.com',
      businessId: business.id,
      allowLogin: true,
    },
    update: {},
  })

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: cebuManager.id,
        roleId: branchManagerRole.id,
      },
    },
    create: {
      userId: cebuManager.id,
      roleId: branchManagerRole.id,
    },
    update: {},
  })

  await prisma.userLocation.upsert({
    where: {
      userId_locationId: {
        userId: cebuManager.id,
        locationId: branch3.id,
      },
    },
    create: {
      userId: cebuManager.id,
      locationId: branch3.id,
    },
    update: {},
  })

  console.log(`✓ Created 4 test users:`)
  console.log(`  - warehouse_mgr / password123 (Main Warehouse)`)
  console.log(`  - makati_mgr / password123 (Branch Makati)`)
  console.log(`  - pasig_mgr / password123 (Branch Pasig)`)
  console.log(`  - cebu_mgr / password123 (Branch Cebu)\n`)

  // 4. Create test products with stock
  console.log('📦 Creating test products with stock...')

  // Get or create unit
  const unit = await prisma.unit.findFirst({
    where: { businessId: business.id },
  })

  if (!unit) {
    throw new Error('No unit found. Please run main seed first.')
  }

  // Product 1: Laptop
  const laptop = await prisma.product.upsert({
    where: { id: 10001 },
    create: {
      id: 10001,
      businessId: business.id,
      name: 'Dell Latitude 7490 Laptop',
      type: 'single',
      sku: 'LAPTOP-7490',
      unitId: unit.id,
      enableStock: true,
      alertQuantity: 5,
    },
    update: {},
  })

  const laptopVariation = await prisma.productVariation.upsert({
    where: { id: 10001 },
    create: {
      id: 10001,
      productId: laptop.id,
      businessId: business.id,
      name: 'Default',
      sku: 'LAPTOP-7490',
      purchasePrice: 45000,
      sellingPrice: 54000,
      unitId: unit.id,
    },
    update: {},
  })

  // Stock for Laptop at Main Warehouse: 50 units
  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: laptopVariation.id,
        locationId: mainWarehouse.id,
      },
    },
    create: {
      productId: laptop.id,
      productVariationId: laptopVariation.id,
      locationId: mainWarehouse.id,
      qtyAvailable: 50,
    },
    update: { qtyAvailable: 50 },
  })

  // Product 2: Mouse
  const mouse = await prisma.product.upsert({
    where: { id: 10002 },
    create: {
      id: 10002,
      businessId: business.id,
      name: 'Logitech MX Master 3 Mouse',
      type: 'single',
      sku: 'MOUSE-MX3',
      unitId: unit.id,
      enableStock: true,
      alertQuantity: 10,
    },
    update: {},
  })

  const mouseVariation = await prisma.productVariation.upsert({
    where: { id: 10002 },
    create: {
      id: 10002,
      productId: mouse.id,
      businessId: business.id,
      name: 'Default',
      sku: 'MOUSE-MX3',
      purchasePrice: 4500,
      sellingPrice: 5850,
      unitId: unit.id,
    },
    update: {},
  })

  // Stock for Mouse at Main Warehouse: 200 units
  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: mouseVariation.id,
        locationId: mainWarehouse.id,
      },
    },
    create: {
      productId: mouse.id,
      productVariationId: mouseVariation.id,
      locationId: mainWarehouse.id,
      qtyAvailable: 200,
    },
    update: { qtyAvailable: 200 },
  })

  // Product 3: Keyboard
  const keyboard = await prisma.product.upsert({
    where: { id: 10003 },
    create: {
      id: 10003,
      businessId: business.id,
      name: 'Keychron K8 Mechanical Keyboard',
      type: 'single',
      sku: 'KB-K8',
      unitId: unit.id,
      enableStock: true,
      alertQuantity: 15,
    },
    update: {},
  })

  const keyboardVariation = await prisma.productVariation.upsert({
    where: { id: 10003 },
    create: {
      id: 10003,
      productId: keyboard.id,
      businessId: business.id,
      name: 'Default',
      sku: 'KB-K8',
      purchasePrice: 5500,
      sellingPrice: 6875,
      unitId: unit.id,
    },
    update: {},
  })

  // Stock for Keyboard at Main Warehouse: 150 units
  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: keyboardVariation.id,
        locationId: mainWarehouse.id,
      },
    },
    create: {
      productId: keyboard.id,
      productVariationId: keyboardVariation.id,
      locationId: mainWarehouse.id,
      qtyAvailable: 150,
    },
    update: { qtyAvailable: 150 },
  })

  // Product 4: Monitor (also in Branch Makati)
  const monitor = await prisma.product.upsert({
    where: { id: 10004 },
    create: {
      id: 10004,
      businessId: business.id,
      name: 'Dell 27" UltraSharp Monitor',
      type: 'single',
      sku: 'MON-U2720Q',
      unitId: unit.id,
      enableStock: true,
      alertQuantity: 8,
    },
    update: {},
  })

  const monitorVariation = await prisma.productVariation.upsert({
    where: { id: 10004 },
    create: {
      id: 10004,
      productId: monitor.id,
      businessId: business.id,
      name: 'Default',
      sku: 'MON-U2720Q',
      purchasePrice: 22000,
      sellingPrice: 25960,
      unitId: unit.id,
    },
    update: {},
  })

  // Stock for Monitor at Main Warehouse: 30 units
  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: monitorVariation.id,
        locationId: mainWarehouse.id,
      },
    },
    create: {
      productId: monitor.id,
      productVariationId: monitorVariation.id,
      locationId: mainWarehouse.id,
      qtyAvailable: 30,
    },
    update: { qtyAvailable: 30 },
  })

  // Stock for Monitor at Branch Makati: 15 units
  await prisma.variationLocationDetails.upsert({
    where: {
      productVariationId_locationId: {
        productVariationId: monitorVariation.id,
        locationId: branch1.id,
      },
    },
    create: {
      productId: monitor.id,
      productVariationId: monitorVariation.id,
      locationId: branch1.id,
      qtyAvailable: 15,
    },
    update: { qtyAvailable: 15 },
  })

  console.log(`✓ Created 4 test products with stock:`)
  console.log(`  - Laptop (Main: 50 units)`)
  console.log(`  - Mouse (Main: 200 units)`)
  console.log(`  - Keyboard (Main: 150 units)`)
  console.log(`  - Monitor (Main: 30, Makati: 15 units)\n`)

  console.log('✅ Transfer test data seed completed!\n')
  console.log('Test Users:')
  console.log('  warehouse_mgr / password123 - Main Warehouse')
  console.log('  makati_mgr / password123 - Branch Makati')
  console.log('  pasig_mgr / password123 - Branch Pasig')
  console.log('  cebu_mgr / password123 - Branch Cebu\n')
}

main()
  .catch((e) => {
    console.error('❌ Error seeding transfer test data:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
