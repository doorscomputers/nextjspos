/**
 * Fix Menu Permission Issues
 *
 * This script removes direct menu permissions from a user,
 * allowing only role-based permissions to control menu visibility.
 */

import { PrismaClient } from '@prisma/client'
import * as readline from 'readline'

const prisma = new PrismaClient()

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve))
}

async function fixMenuPermissions() {
  console.log('\n' + '='.repeat(80))
  console.log('🔧 MENU PERMISSION FIX TOOL')
  console.log('='.repeat(80))

  try {
    // Step 1: Find users
    console.log('\n📋 Finding all users...\n')
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true
      },
      where: {
        deletedAt: null
      },
      orderBy: {
        username: 'asc'
      }
    })

    if (users.length === 0) {
      console.log('❌ No users found')
      return
    }

    console.log('Available users:')
    users.forEach(u => {
      const name = [u.firstName, u.lastName].filter(Boolean).join(' ')
      console.log(`   ${u.id}. ${u.username} - ${name} (${u.email || 'no email'})`)
    })

    // Step 2: Get user selection
    const userIdStr = await question('\nEnter the user ID to fix: ')
    const userId = parseInt(userIdStr)

    if (isNaN(userId)) {
      console.log('❌ Invalid user ID')
      return
    }

    const selectedUser = users.find(u => u.id === userId)
    if (!selectedUser) {
      console.log('❌ User not found')
      return
    }

    console.log(`\n✅ Selected: ${selectedUser.username} - ${selectedUser.firstName} ${selectedUser.lastName}`)

    // Step 3: Check current direct menu permissions
    const directMenus = await prisma.userMenuPermission.findMany({
      where: { userId },
      include: {
        menuPermission: true
      }
    })

    if (directMenus.length === 0) {
      console.log('\n✅ This user has no direct menu permissions.')
      console.log('   The issue might be in role-based permissions or session cache.')
      console.log('\n💡 Try logging out and logging back in to refresh the session.')
      return
    }

    console.log(`\n⚠️  Found ${directMenus.length} direct menu permissions:`)
    directMenus.forEach(dm => {
      console.log(`   - ${dm.menuPermission.name} (${dm.menuPermission.key})`)
    })

    // Step 4: Confirm removal
    const confirm = await question('\n❓ Remove ALL direct menu permissions for this user? (yes/no): ')

    if (confirm.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled')
      return
    }

    // Step 5: Remove direct permissions
    console.log('\n🗑️  Removing direct menu permissions...')

    const result = await prisma.userMenuPermission.deleteMany({
      where: { userId }
    })

    console.log(`\n✅ Successfully removed ${result.count} direct menu permissions!`)
    console.log('\n📝 Next steps:')
    console.log('   1. User should log out')
    console.log('   2. User should log back in')
    console.log('   3. Menus should now be controlled by role permissions only')
    console.log('\n' + '='.repeat(80))

  } catch (error) {
    console.error('\n❌ Error:', error)
  } finally {
    rl.close()
    await prisma.$disconnect()
  }
}

fixMenuPermissions()
