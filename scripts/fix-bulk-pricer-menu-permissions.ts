import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Fixing Bulk Pricer role menu permissions...\n')

  // Get the first business
  const business = await prisma.business.findFirst()

  if (!business) {
    console.log('❌ No business found in database!')
    return
  }

  console.log(`✅ Found business: ${business.name} (ID: ${business.id})`)

  // Find Bulk Pricer role
  const bulkPricerRole = await prisma.role.findFirst({
    where: {
      businessId: business.id,
      name: 'Bulk Pricer'
    }
  })

  if (!bulkPricerRole) {
    console.log('❌ Bulk Pricer role not found! Please run create-bulk-pricer-role.ts first.')
    return
  }

  console.log(`\n✅ Found Bulk Pricer role: "${bulkPricerRole.name}" (ID: ${bulkPricerRole.id})`)

  // Check current menu permissions
  const currentMenuPermissions = await prisma.roleMenuPermission.findMany({
    where: { roleId: bulkPricerRole.id },
    include: {
      menuPermission: true,
    },
  })

  console.log(`\n📋 Current menu permissions (${currentMenuPermissions.length}):`)
  currentMenuPermissions.forEach(rmp => {
    console.log(`   • ${rmp.menuPermission.key} - ${rmp.menuPermission.name}`)
  })

  // Find the pricing_management menu
  const pricingMenu = await prisma.menuPermission.findUnique({
    where: { key: 'pricing_management' }
  })

  if (!pricingMenu) {
    console.log('\n❌ "pricing_management" menu not found! Checking if menu exists...')

    // List all available menus
    const allMenus = await prisma.menuPermission.findMany({
      orderBy: { order: 'asc' }
    })

    console.log('\n📋 Available menus:')
    allMenus.forEach(menu => {
      console.log(`   • ${menu.key} - ${menu.name}`)
    })
    return
  }

  console.log(`\n✅ Found pricing_management menu: "${pricingMenu.name}" (ID: ${pricingMenu.id})`)

  // Check if role already has this menu permission
  const hasPricingMenu = currentMenuPermissions.some(
    rmp => rmp.menuPermissionId === pricingMenu.id
  )

  if (hasPricingMenu) {
    console.log('\n✅ Bulk Pricer role already has pricing_management menu permission!')
  } else {
    console.log('\n⚠️  Bulk Pricer role missing pricing_management menu permission. Adding it...')

    // Add the menu permission
    await prisma.roleMenuPermission.create({
      data: {
        roleId: bulkPricerRole.id,
        menuPermissionId: pricingMenu.id,
      },
    })

    console.log('✅ Added pricing_management menu permission to Bulk Pricer role!')
  }

  // Also check for simple_price_editor menu
  const simplePriceEditorMenu = await prisma.menuPermission.findUnique({
    where: { key: 'simple_price_editor' }
  })

  if (simplePriceEditorMenu) {
    const hasSimplePriceEditorMenu = currentMenuPermissions.some(
      rmp => rmp.menuPermissionId === simplePriceEditorMenu.id
    )

    if (hasSimplePriceEditorMenu) {
      console.log('✅ Bulk Pricer role already has simple_price_editor menu permission!')
    } else {
      console.log('⚠️  Adding simple_price_editor menu permission...')

      await prisma.roleMenuPermission.create({
        data: {
          roleId: bulkPricerRole.id,
          menuPermissionId: simplePriceEditorMenu.id,
        },
      })

      console.log('✅ Added simple_price_editor menu permission to Bulk Pricer role!')
    }
  } else {
    console.log('ℹ️  simple_price_editor menu not found (might be a child menu)')
  }

  // Show final menu permissions
  const finalMenuPermissions = await prisma.roleMenuPermission.findMany({
    where: { roleId: bulkPricerRole.id },
    include: {
      menuPermission: true,
    },
    orderBy: {
      menuPermission: {
        order: 'asc',
      },
    },
  })

  console.log(`\n📋 Final Bulk Pricer role menu permissions (${finalMenuPermissions.length}):`)
  finalMenuPermissions.forEach(rmp => {
    console.log(`   ✓ ${rmp.menuPermission.key} - ${rmp.menuPermission.name}`)
  })

  console.log('\n✨ Bulk Pricer role menu permissions are ready!')
  console.log('\n📌 The Bulk Pricer role should now be able to see the Price Editor menu.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())