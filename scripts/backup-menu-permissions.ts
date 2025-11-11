import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/**
 * Backup Menu Permissions
 *
 * Creates a JSON backup of all role and user menu assignments.
 * Run this BEFORE running any seed commands to preserve your configuration.
 *
 * Usage:
 *   npx tsx scripts/backup-menu-permissions.ts
 *
 * Restore with:
 *   npx tsx scripts/restore-menu-permissions.ts
 */

async function backupMenuPermissions() {
  try {
    console.log('💾 Backing up menu permissions...\n')

    // Get all role menu permissions with details
    const roleMenuPerms = await prisma.roleMenuPermission.findMany({
      include: {
        role: {
          select: {
            id: true,
            name: true,
            businessId: true
          }
        },
        menuPermission: {
          select: {
            id: true,
            key: true,
            name: true
          }
        }
      }
    })

    // Get all user menu permissions with details
    const userMenuPerms = await prisma.userMenuPermission.findMany({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            businessId: true
          }
        },
        menuPermission: {
          select: {
            id: true,
            key: true,
            name: true
          }
        }
      }
    })

    // Format data for backup
    const backup = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      roleMenuPermissions: roleMenuPerms.map(rmp => ({
        roleId: rmp.roleId,
        roleName: rmp.role.name,
        businessId: rmp.role.businessId,
        menuKey: rmp.menuPermission.key,
        menuName: rmp.menuPermission.name
      })),
      userMenuPermissions: userMenuPerms.map(ump => ({
        userId: ump.userId,
        username: ump.user.username,
        businessId: ump.user.businessId,
        menuKey: ump.menuPermission.key,
        menuName: ump.menuPermission.name
      }))
    }

    // Save to file
    const backupDir = path.join(process.cwd(), 'backups', 'menu-permissions')
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `menu-permissions-backup-${timestamp}.json`
    const filepath = path.join(backupDir, filename)

    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2), 'utf-8')

    // Also save as "latest" for easy restore
    const latestPath = path.join(backupDir, 'menu-permissions-latest.json')
    fs.writeFileSync(latestPath, JSON.stringify(backup, null, 2), 'utf-8')

    console.log('✅ Backup completed successfully!')
    console.log('')
    console.log('📊 Backup Summary:')
    console.log('=====================================')
    console.log(`Role menu assignments: ${backup.roleMenuPermissions.length}`)
    console.log(`User menu assignments: ${backup.userMenuPermissions.length}`)
    console.log('')
    console.log('📁 Backup files:')
    console.log(`  - ${filepath}`)
    console.log(`  - ${latestPath} (latest)`)
    console.log('')
    console.log('💡 To restore this backup, run:')
    console.log('   npx tsx scripts/restore-menu-permissions.ts')

    // Show breakdown by role
    const roleBreakdown = new Map<string, number>()
    backup.roleMenuPermissions.forEach(rmp => {
      roleBreakdown.set(rmp.roleName, (roleBreakdown.get(rmp.roleName) || 0) + 1)
    })

    if (roleBreakdown.size > 0) {
      console.log('')
      console.log('📋 Menu assignments by role:')
      roleBreakdown.forEach((count, roleName) => {
        console.log(`  - ${roleName}: ${count} menus`)
      })
    }

    // Show breakdown by user
    const userBreakdown = new Map<string, number>()
    backup.userMenuPermissions.forEach(ump => {
      userBreakdown.set(ump.username, (userBreakdown.get(ump.username) || 0) + 1)
    })

    if (userBreakdown.size > 0) {
      console.log('')
      console.log('👤 Direct user menu assignments:')
      userBreakdown.forEach((count, username) => {
        console.log(`  - ${username}: ${count} menus`)
      })
    }

  } catch (error) {
    console.error('❌ Backup failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backupMenuPermissions()
