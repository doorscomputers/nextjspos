/**
 * Migration Script: Add Z Reading Permission to Cashier Roles
 *
 * This script adds the 'reading.z_reading' permission to all cashier roles
 * that already have the 'reading.x_reading' permission but are missing Z Reading.
 *
 * This is critical for BIR compliance - cashiers MUST be able to generate
 * Z Readings when closing their shifts.
 *
 * Usage:
 *   npx tsx scripts/add-z-reading-permission-to-cashiers.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Finding cashier roles that need Z Reading permission...\n')

  // Find all roles that have:
  // 1. reading.x_reading permission (can generate X Reading)
  // 2. shift.close permission (can close shifts)
  // 3. BUT are missing reading.z_reading permission

  const allRoles = await prisma.role.findMany({
    include: {
      permissions: {
        include: {
          permission: true,
        },
      },
    },
  })

  const rolesToUpdate: Array<{ id: number; name: string; businessId: number }> = []

  for (const role of allRoles) {
    const permissionNames = role.permissions.map(rp => rp.permission.name)

    const hasXReading = permissionNames.includes('reading.x_reading')
    const hasShiftClose = permissionNames.includes('shift.close')
    const hasZReading = permissionNames.includes('reading.z_reading')

    // If role can close shifts and generate X Reading but NOT Z Reading, it needs updating
    if ((hasShiftClose || hasXReading) && !hasZReading) {
      rolesToUpdate.push({
        id: role.id,
        name: role.name,
        businessId: role.businessId,
      })
    }
  }

  if (rolesToUpdate.length === 0) {
    console.log('✅ All cashier roles already have Z Reading permission!')
    console.log('   No updates needed.')
    return
  }

  console.log(`📋 Found ${rolesToUpdate.length} role(s) that need Z Reading permission:\n`)
  rolesToUpdate.forEach(role => {
    console.log(`   - ${role.name} (ID: ${role.id}, Business ID: ${role.businessId})`)
  })
  console.log()

  // For each role, add the Z Reading permission
  let updatedCount = 0

  for (const role of rolesToUpdate) {
    try {
      // Find or create the Z Reading permission for this business
      const zReadingPermission = await prisma.permission.upsert({
        where: {
          name_businessId: {
            name: 'reading.z_reading',
            businessId: role.businessId,
          },
        },
        update: {},
        create: {
          name: 'reading.z_reading',
          businessId: role.businessId,
          displayName: 'Generate Z Reading',
          description: 'Can generate Z Reading (end-of-day, BIR-compliant)',
        },
      })

      // Add permission to role
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: zReadingPermission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: zReadingPermission.id,
        },
      })

      console.log(`✅ Added Z Reading permission to: ${role.name}`)
      updatedCount++
    } catch (error) {
      console.error(`❌ Failed to update role ${role.name}:`, error)
    }
  }

  console.log(`\n🎉 Successfully updated ${updatedCount} role(s)!`)
  console.log('\n📝 Summary:')
  console.log(`   - Roles checked: ${allRoles.length}`)
  console.log(`   - Roles updated: ${updatedCount}`)
  console.log(`   - Permission added: reading.z_reading`)
  console.log('\n💡 Cashiers can now generate Z Readings when closing shifts (BIR compliant)')
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    console.error('❌ Migration failed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
