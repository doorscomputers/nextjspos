/**
 * Remove Workflow Permissions from Cross-Location Approver Role
 *
 * PURPOSE: Enforce proper Separation of Duties (SOD)
 *
 * BEFORE: Cross-Location Approver could do everything (approve + send + receive + verify)
 * AFTER: Cross-Location Approver can ONLY approve (ensures 2 people minimum)
 *
 * PROPER SOD WORKFLOW:
 * ==================
 * SENDER SIDE (Origin Location):
 *   1. User A creates transfer → "Draft"
 *   2. jayvillalon APPROVES → "Checked" (Different person - SOD enforced)
 *   3. User A SENDS transfer → "In Transit" (Stock deducted)
 *
 * RECEIVER SIDE (Destination Location):
 *   4. User B marks ARRIVED → "Arrived"
 *   5. User B VERIFIES items → "Verified"
 *   6. User B COMPLETES → "Completed" (Stock added)
 *
 * RESULT: Minimum 2 people involved on each side = Fraud prevention
 *
 * Permissions to REMOVE:
 * - stock_transfer.send (creator should send)
 * - stock_transfer.receive (receiver should mark arrived)
 * - stock_transfer.verify (receiver should verify)
 * - stock_transfer.complete (receiver should complete)
 *
 * Permissions to KEEP:
 * - stock_transfer.check (APPROVE - this is the main job)
 * - stock_transfer.cancel (can cancel invalid transfers)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Removing workflow permissions from Cross-Location Approver role...')
  console.log('   (Enforcing proper Separation of Duties)\n')

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
    return
  }

  console.log(`✓ Found role: ${role.name} (ID: ${role.id})`)
  console.log(`  Current permissions: ${role.permissions.length}\n`)

  // Permissions to remove
  const permissionsToRemove = [
    'stock_transfer.send',
    'stock_transfer.receive',
    'stock_transfer.verify',
    'stock_transfer.complete'
  ]

  const results = []
  for (const permName of permissionsToRemove) {
    // Find the permission
    const permission = await prisma.permission.findFirst({
      where: { name: permName }
    })

    if (!permission) {
      console.log(`⚠️  Permission "${permName}" does not exist - skipping`)
      continue
    }

    // Find the role-permission link
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: role.id,
        permissionId: permission.id
      }
    })

    if (!rolePermission) {
      console.log(`⏭️  Role doesn't have "${permName}" - skipping`)
      results.push({ permission: permName, status: 'not_found' })
      continue
    }

    // Remove the permission from role (using compound key)
    await prisma.rolePermission.delete({
      where: {
        roleId_permissionId: {
          roleId: role.id,
          permissionId: permission.id
        }
      }
    })

    console.log(`✅ Removed permission: ${permName}`)
    results.push({ permission: permName, status: 'removed' })
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
  console.log(`   - Removed: ${results.filter(r => r.status === 'removed').length}`)
  console.log(`   - Not found: ${results.filter(r => r.status === 'not_found').length}`)

  console.log('\n🎉 Proper Separation of Duties (SOD) enforced!')
  console.log('\n✅ Cross-Location Approver can ONLY:')
  console.log('   - View transfers')
  console.log('   - APPROVE transfers (CHECK)')
  console.log('   - Cancel invalid transfers')
  console.log('\n❌ Cross-Location Approver CANNOT:')
  console.log('   - Send transfers (creator must send)')
  console.log('   - Mark arrived (receiver must mark)')
  console.log('   - Verify items (receiver must verify)')
  console.log('   - Complete transfer (receiver must complete)')
  console.log('\n🔒 Result: Minimum 2 people required on each side')
  console.log('   - SENDER: Creator + Approver')
  console.log('   - RECEIVER: Location user verifies & completes')
}

main()
  .catch((e) => {
    console.error('❌ Error updating role:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
