#!/usr/bin/env node

/**
 * Assign Approval Role to User - UltimatePOS Modern
 *
 * This utility helps administrators assign approval roles to users.
 *
 * Usage:
 *   node scripts/assign-approval-role.mjs
 *
 * Then follow the interactive prompts.
 */

import { PrismaClient } from '@prisma/client'
import readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise((resolve) => {
    rl.question(query, resolve)
  })
}

async function main() {
  console.log('\n╔═══════════════════════════════════════════════════════╗')
  console.log('║   Assign Approval Role to User - UltimatePOS Modern  ║')
  console.log('╚═══════════════════════════════════════════════════════╝\n')

  try {
    // Step 1: Select Business
    console.log('📊 STEP 1: Select Business\n')
    const businesses = await prisma.business.findMany({
      select: { id: true, name: true }
    })

    if (businesses.length === 0) {
      console.log('❌ No businesses found. Please seed the database first.')
      return
    }

    console.log('Available businesses:')
    businesses.forEach((b) => {
      console.log(`  [${b.id}] ${b.name}`)
    })

    const businessId = parseInt(await question('\nEnter business ID: '))
    const selectedBusiness = businesses.find((b) => b.id === businessId)

    if (!selectedBusiness) {
      console.log('❌ Invalid business ID')
      return
    }

    console.log(`✅ Selected: ${selectedBusiness.name}\n`)

    // Step 2: Select User
    console.log('👤 STEP 2: Select User\n')
    const users = await prisma.user.findMany({
      where: { businessId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        surname: true,
        roles: {
          include: {
            role: {
              select: { name: true }
            }
          }
        }
      }
    })

    if (users.length === 0) {
      console.log('❌ No users found for this business.')
      return
    }

    console.log('Available users:')
    users.forEach((u) => {
      const currentRoles = u.roles.map((r) => r.role.name).join(', ') || 'None'
      const fullName = `${u.surname} ${u.firstName} ${u.lastName || ''}`.trim()
      console.log(`  [${u.id}] ${u.username} (${fullName})`)
      console.log(`      Current roles: ${currentRoles}`)
    })

    const userId = parseInt(await question('\nEnter user ID: '))
    const selectedUser = users.find((u) => u.id === userId)

    if (!selectedUser) {
      console.log('❌ Invalid user ID')
      return
    }

    const currentRoles = selectedUser.roles.map((r) => r.role.name).join(', ') || 'None'
    console.log(`✅ Selected: ${selectedUser.username}`)
    console.log(`   Current roles: ${currentRoles}\n`)

    // Step 3: Select Approval Role
    console.log('🎭 STEP 3: Select Approval Role to Assign\n')

    const approvalRoles = await prisma.role.findMany({
      where: {
        businessId,
        name: {
          in: [
            'Transfer Approver',
            'GRN Approver',
            'Inventory Correction Approver',
            'Return Approver',
            'Purchase Approver',
            'QC Inspector'
          ]
        }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        },
        users: true
      }
    })

    if (approvalRoles.length === 0) {
      console.log('❌ No approval roles found. Please run create-approval-roles.mjs first.')
      return
    }

    console.log('Available approval roles:')
    approvalRoles.forEach((r) => {
      const alreadyAssigned = r.users.some((u) => u.userId === userId)
      const status = alreadyAssigned ? '(already assigned)' : ''
      console.log(`  [${r.id}] ${r.name} ${status}`)
      console.log(`      Permissions: ${r.permissions.length}`)
    })

    const roleId = parseInt(await question('\nEnter role ID to assign: '))
    const selectedRole = approvalRoles.find((r) => r.id === roleId)

    if (!selectedRole) {
      console.log('❌ Invalid role ID')
      return
    }

    // Check if already assigned
    const alreadyAssigned = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId
        }
      }
    })

    if (alreadyAssigned) {
      console.log(`\n⚠️  User already has the "${selectedRole.name}" role.`)
      const confirm = await question('Do you want to continue anyway? (y/n): ')
      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Cancelled.')
        return
      }
    }

    console.log(`✅ Selected: ${selectedRole.name}\n`)

    // Step 4: Optional Location Assignment
    console.log('📍 STEP 4: (Optional) Assign Specific Locations\n')
    console.log('You can restrict this role to specific locations.')
    console.log('Leave empty to allow access to all assigned locations.\n')

    const locations = await prisma.businessLocation.findMany({
      where: { businessId },
      select: { id: true, name: true }
    })

    if (locations.length > 0) {
      console.log('Available locations:')
      locations.forEach((l) => {
        console.log(`  [${l.id}] ${l.name}`)
      })

      const assignLocations = await question('\nAssign specific locations? (y/n): ')

      let locationIds = []
      if (assignLocations.toLowerCase() === 'y') {
        const locationIdsInput = await question('Enter location IDs (comma-separated, e.g., 1,2,3): ')
        locationIds = locationIdsInput.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id))

        if (locationIds.length === 0) {
          console.log('⚠️  No valid location IDs entered. Skipping location assignment.')
        } else {
          console.log(`✅ Will assign locations: ${locationIds.join(', ')}\n`)
        }
      }

      // Step 5: Confirmation
      console.log('\n═══════════════════════════════════════════════════════')
      console.log('📋 SUMMARY')
      console.log('═══════════════════════════════════════════════════════')
      console.log(`Business: ${selectedBusiness.name}`)
      console.log(`User: ${selectedUser.username}`)
      console.log(`Role: ${selectedRole.name}`)
      console.log(`Locations: ${locationIds.length > 0 ? locationIds.join(', ') : 'All assigned locations'}`)
      console.log('═══════════════════════════════════════════════════════\n')

      const confirm = await question('Proceed with assignment? (y/n): ')

      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Cancelled.')
        return
      }

      // Step 6: Execute Assignment
      console.log('\n⏳ Assigning role...')

      // Assign role to user
      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId
          }
        },
        create: {
          userId,
          roleId
        },
        update: {}
      })

      console.log('✅ Role assigned successfully!')

      // Assign locations if specified
      if (locationIds.length > 0) {
        console.log('⏳ Assigning locations...')

        for (const locationId of locationIds) {
          await prisma.userLocation.upsert({
            where: {
              userId_locationId: {
                userId,
                locationId
              }
            },
            create: {
              userId,
              locationId
            },
            update: {}
          })
        }

        console.log(`✅ Assigned ${locationIds.length} location(s) successfully!`)
      }

      // Display final result
      console.log('\n╔═══════════════════════════════════════════════════════╗')
      console.log('║                  ✅ SUCCESS!                          ║')
      console.log('╚═══════════════════════════════════════════════════════╝\n')

      console.log(`User "${selectedUser.username}" now has the following role:`)
      console.log(`  🎭 ${selectedRole.name}`)

      if (locationIds.length > 0) {
        console.log(`\nWith access to ${locationIds.length} location(s):`)
        const assignedLocations = locations.filter((l) => locationIds.includes(l.id))
        assignedLocations.forEach((l) => {
          console.log(`  📍 ${l.name}`)
        })
      }

      console.log('\n💡 Next steps:')
      console.log('  1. Ask the user to logout and login again')
      console.log('  2. Verify the user can see approval options in the UI')
      console.log('  3. Test the approval workflow\n')

    } else {
      console.log('⚠️  No locations found for this business.')

      // Still assign the role
      const confirm = await question('\nProceed with role assignment (without location restriction)? (y/n): ')

      if (confirm.toLowerCase() !== 'y') {
        console.log('❌ Cancelled.')
        return
      }

      await prisma.userRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId
          }
        },
        create: {
          userId,
          roleId
        },
        update: {}
      })

      console.log('✅ Role assigned successfully!\n')
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    throw error
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
  .finally(async () => {
    rl.close()
    await prisma.$disconnect()
  })
