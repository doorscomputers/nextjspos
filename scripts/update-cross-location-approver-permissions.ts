/**
 * Update Cross-Location Approver Role with Complete Transfer Workflow Permissions
 *
 * Adds missing permissions to handle entire transfer workflow:
 * - STOCK_TRANSFER_SEND (send after approval)
 * - STOCK_TRANSFER_RECEIVE (mark as arrived)
 * - STOCK_TRANSFER_VERIFY (verify items)
 * - STOCK_TRANSFER_CANCEL (cancel if needed)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Updating Cross-Location Approver role permissions...\n')

  // Find the Cross-Location Approver role
  const role = await prisma.role.findFirst({
    where: {
      name: 'Cross-Location Approver'
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
    console.error('❌ Cross-Location Approver role not found!')
    console.log('This role may not exist in your database yet.')
    return
  }

  console.log(`✓ Found role: ${role.name} (ID: ${role.id})`)
  console.log(`  Business ID: ${role.businessId || 'All businesses'}`)
  console.log(`  Current permissions: ${role.permissions.length}\n`)

  // Permissions to add
  const permissionsToAdd = [
    'stock_transfer.send',
    'stock_transfer.receive',
    'stock_transfer.verify',
    'stock_transfer.cancel'
  ]

  // Find or create these permissions
  const results = []
  for (const permName of permissionsToAdd) {
    // Check if permission exists
    const permission = await prisma.permission.findFirst({
      where: { name: permName }
    })

    if (!permission) {
      console.log(`⚠️  Permission "${permName}" does not exist in database - skipping`)
      continue
    }

    // Check if role already has this permission
    const existingRolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: role.id,
        permissionId: permission.id
      }
    })

    if (existingRolePermission) {
      console.log(`⏭️  Role already has "${permName}" - skipping`)
      results.push({ permission: permName, status: 'already_exists' })
      continue
    }

    // Add permission to role
    await prisma.rolePermission.create({
      data: {
        roleId: role.id,
        permissionId: permission.id
      }
    })

    console.log(`✅ Added permission: ${permName}`)
    results.push({ permission: permName, status: 'added' })
  }

  // Get updated role
  const updatedRole = await prisma.role.findUnique({
    where: { id: role.id },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  })

  console.log(`\n✅ Update complete!`)
  console.log(`   Total permissions now: ${updatedRole?.permissions.length}`)
  console.log(`\n📋 Summary:`)
  console.log(`   - Added: ${results.filter(r => r.status === 'added').length}`)
  console.log(`   - Already existed: ${results.filter(r => r.status === 'already_exists').length}`)

  console.log('\n🎉 Cross-Location Approver can now handle complete transfer workflow:')
  console.log('   1. Approve (CHECK)')
  console.log('   2. Send (SEND) ← NEW')
  console.log('   3. Mark Arrived (RECEIVE) ← NEW')
  console.log('   4. Verify Items (VERIFY) ← NEW')
  console.log('   5. Complete Transfer (COMPLETE)')
  console.log('   6. Cancel if needed (CANCEL) ← NEW')
}

main()
  .catch((e) => {
    console.error('❌ Error updating role:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
