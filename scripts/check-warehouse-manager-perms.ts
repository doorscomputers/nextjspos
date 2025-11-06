import { prisma } from '../src/lib/prisma.simple'

async function checkPermissions() {
  console.log('🔍 Checking Warehouse Manager permissions...\n')

  try {
    // Find Warehouse Manager role
    const role = await prisma.role.findFirst({
      where: { name: 'Warehouse Manager' },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!role) {
      console.log('❌ Warehouse Manager role not found!')
      return
    }

    console.log(`✅ Found Warehouse Manager role (ID: ${role.id})`)
    console.log(`   Business ID: ${role.businessId || 'NULL (system role)'}`)
    console.log(`   Total permissions: ${role.permissions.length}\n`)

    // Check for purchase return permissions
    const purchaseReturnPerms = role.permissions.filter(rp =>
      rp.permission.name.includes('purchase_return')
    )

    console.log('📋 Purchase Return Permissions:')
    if (purchaseReturnPerms.length === 0) {
      console.log('   ❌ NO PURCHASE RETURN PERMISSIONS FOUND!')
      console.log('   \n   Missing:')
      console.log('   - purchase_return.view')
      console.log('   - purchase_return.approve')
    } else {
      purchaseReturnPerms.forEach(rp => {
        console.log(`   ✅ ${rp.permission.name}`)
      })
    }

    // Check for supplier return permissions
    console.log('\n📋 Supplier Return Permissions:')
    const supplierReturnPerms = role.permissions.filter(rp =>
      rp.permission.name.includes('supplier_return')
    )

    if (supplierReturnPerms.length === 0) {
      console.log('   ⚠️  No supplier return permissions')
    } else {
      supplierReturnPerms.forEach(rp => {
        console.log(`   ✅ ${rp.permission.name}`)
      })
    }

    // List all permissions for reference
    console.log('\n📜 All Warehouse Manager Permissions:')
    role.permissions
      .sort((a, b) => a.permission.name.localeCompare(b.permission.name))
      .forEach(rp => {
        console.log(`   - ${rp.permission.name}`)
      })

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkPermissions()
