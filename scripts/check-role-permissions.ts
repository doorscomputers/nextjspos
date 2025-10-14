/**
 * Check permissions for WarehouseManager role
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('📋 Checking WarehouseManager role permissions...\n')

  const role = await prisma.role.findFirst({
    where: {
      name: 'WarehouseManager'
    },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  if (!role) {
    console.log('❌ WarehouseManager role not found')
    return
  }

  console.log(`✅ Found role: ${role.name}`)
  console.log(`   Description: ${role.description || 'N/A'}`)
  console.log(`   Business ID: ${role.businessId}\n`)

  console.log('Permissions:')
  if (role.permissions.length === 0) {
    console.log('  ⚠️  No permissions assigned!')
  } else {
    role.permissions.forEach(rp => {
      console.log(`  - ${rp.permission.name}`)
    })
  }

  // Check specifically for ACCESS_ALL_LOCATIONS
  const hasAccessAll = role.permissions.some(rp =>
    rp.permission.name === 'access_all_locations'
  )

  console.log('\n🔍 Has ACCESS_ALL_LOCATIONS permission:', hasAccessAll ? '✅ YES' : '❌ NO')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
