/**
 * Add Serial Number Import Permission to Cross-Location Approver
 *
 * PURPOSE: Allow Cross-Location Approver to import historical serial numbers
 *
 * The "Import Serial Numbers" menu requires PURCHASE_CREATE permission.
 * This is for importing products purchased BEFORE the app was created,
 * to link serial numbers to suppliers for warranty tracking.
 *
 * This is NOT creating new purchases - it's historical data entry.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Adding serial number import permission to Cross-Location Approver...\n')

  // Find the Cross-Location Approver role
  const role = await prisma.role.findFirst({
    where: {
      name: 'Cross-Location Approver'
    }
  })

  if (!role) {
    console.error('❌ Cross-Location Approver role not found!')
    return
  }

  console.log(`✓ Found role: ${role.name} (ID: ${role.id})\n`)

  // Find the PURCHASE_CREATE permission
  const permission = await prisma.permission.findFirst({
    where: { name: 'purchase.create' }
  })

  if (!permission) {
    console.error('❌ PURCHASE_CREATE permission not found in database!')
    return
  }

  // Check if already exists
  const existing = await prisma.rolePermission.findFirst({
    where: {
      roleId: role.id,
      permissionId: permission.id
    }
  })

  if (existing) {
    console.log('⏭️  Role already has PURCHASE_CREATE permission - no changes needed')
    return
  }

  // Add permission
  await prisma.rolePermission.create({
    data: {
      roleId: role.id,
      permissionId: permission.id
    }
  })

  console.log('✅ Added PURCHASE_CREATE permission')
  console.log('\n🎉 Cross-Location Approver can now:')
  console.log('   - See "Import Serial Numbers" menu in sidebar')
  console.log('   - Import historical serial numbers for warranty tracking')
  console.log('   - Link pre-existing inventory to suppliers')
  console.log('\n⚠️  NOTE: jayvillalon must log out and log back in for changes to take effect')
}

main()
  .catch((e) => {
    console.error('❌ Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
