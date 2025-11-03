import { PrismaClient } from '@prisma/client'
import { PERMISSIONS } from '../src/lib/rbac'

const prisma = new PrismaClient()

async function createMissingPermissions() {
  console.log('🔧 Creating Missing Permissions...\n')

  try {
    const allPermissionsInCode = Object.values(PERMISSIONS)
    console.log(`📊 Permissions defined in code: ${allPermissionsInCode.length}`)

    const existingPermissions = await prisma.permission.findMany()
    console.log(`📊 Permissions in database: ${existingPermissions.length}`)

    const existingPermissionNames = new Set(existingPermissions.map(p => p.name))
    const missingPermissions = allPermissionsInCode.filter(p => !existingPermissionNames.has(p))

    console.log(`📊 Missing permissions: ${missingPermissions.length}\n`)

    if (missingPermissions.length === 0) {
      console.log('✅ All permissions already exist!')
      return
    }

    console.log('Creating missing permissions...')
    let created = 0

    for (const permissionName of missingPermissions) {
      await prisma.permission.create({
        data: {
          name: permissionName,
          guardName: 'web'
        }
      })
      created++

      if (created % 50 === 0) {
        console.log(`   ✅ Created ${created}/${missingPermissions.length} permissions...`)
      }
    }

    console.log(`\n✅ Created ${created} new permissions`)
    console.log(`📊 Total permissions now: ${existingPermissions.length + created}`)

    console.log('\n📝 Next step:')
    console.log('Run: npx tsx scripts/fix-super-admin-permissions.ts')
    console.log('This will assign ALL permissions to Super Admin roles')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createMissingPermissions()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
