import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

/**
 * Restore Menu Permissions
 *
 * Restores menu permissions from a backup file.
 * By default, restores from the latest backup.
 *
 * Usage:
 *   npx tsx scripts/restore-menu-permissions.ts
 *   npx tsx scripts/restore-menu-permissions.ts menu-permissions-backup-2024-01-15.json
 *
 * Create backup with:
 *   npx tsx scripts/backup-menu-permissions.ts
 */

interface BackupData {
  timestamp: string
  version: string
  roleMenuPermissions: Array<{
    roleId: number
    roleName: string
    businessId: number
    menuKey: string
    menuName: string
  }>
  userMenuPermissions: Array<{
    userId: number
    username: string
    businessId: number
    menuKey: string
    menuName: string
  }>
}

async function restoreMenuPermissions(backupFilename?: string) {
  try {
    console.log('♻️  Restoring menu permissions...\n')

    // Determine backup file to use
    const backupDir = path.join(process.cwd(), 'backups', 'menu-permissions')
    let filepath: string

    if (backupFilename) {
      filepath = path.join(backupDir, backupFilename)
    } else {
      filepath = path.join(backupDir, 'menu-permissions-latest.json')
    }

    if (!fs.existsSync(filepath)) {
      console.error(`❌ Backup file not found: ${filepath}`)
      console.log('\n💡 Available backups:')
      if (fs.existsSync(backupDir)) {
        const files = fs.readdirSync(backupDir)
        if (files.length === 0) {
          console.log('   No backups found. Create one first:')
          console.log('   npx tsx scripts/backup-menu-permissions.ts')
        } else {
          files.forEach(file => console.log(`   - ${file}`))
        }
      } else {
        console.log('   No backups directory found. Create a backup first:')
        console.log('   npx tsx scripts/backup-menu-permissions.ts')
      }
      return
    }

    // Load backup data
    const backupJson = fs.readFileSync(filepath, 'utf-8')
    const backup: BackupData = JSON.parse(backupJson)

    console.log('📁 Restoring from backup:')
    console.log(`  File: ${path.basename(filepath)}`)
    console.log(`  Created: ${new Date(backup.timestamp).toLocaleString()}`)
    console.log(`  Role assignments: ${backup.roleMenuPermissions.length}`)
    console.log(`  User assignments: ${backup.userMenuPermissions.length}`)
    console.log('')

    // Restore role menu permissions
    console.log('🔧 Restoring role menu permissions...')
    let roleRestoreCount = 0

    for (const rmp of backup.roleMenuPermissions) {
      // Find role by name and business
      const role = await prisma.role.findFirst({
        where: {
          name: rmp.roleName,
          businessId: rmp.businessId
        }
      })

      if (!role) {
        console.warn(`⚠️  Role not found: ${rmp.roleName} (business ${rmp.businessId})`)
        continue
      }

      // Find menu permission by key
      const menuPerm = await prisma.menuPermission.findUnique({
        where: { key: rmp.menuKey }
      })

      if (!menuPerm) {
        console.warn(`⚠️  Menu not found: ${rmp.menuKey}`)
        continue
      }

      // Check if assignment already exists
      const existing = await prisma.roleMenuPermission.findFirst({
        where: {
          roleId: role.id,
          menuPermissionId: menuPerm.id
        }
      })

      if (!existing) {
        await prisma.roleMenuPermission.create({
          data: {
            roleId: role.id,
            menuPermissionId: menuPerm.id
          }
        })
        roleRestoreCount++
      }
    }

    console.log(`✅ Restored ${roleRestoreCount} role menu assignments`)
    console.log('')

    // Restore user menu permissions
    console.log('🔧 Restoring user menu permissions...')
    let userRestoreCount = 0

    for (const ump of backup.userMenuPermissions) {
      // Find user by username and business
      const user = await prisma.user.findFirst({
        where: {
          username: ump.username,
          businessId: ump.businessId
        }
      })

      if (!user) {
        console.warn(`⚠️  User not found: ${ump.username} (business ${ump.businessId})`)
        continue
      }

      // Find menu permission by key
      const menuPerm = await prisma.menuPermission.findUnique({
        where: { key: ump.menuKey }
      })

      if (!menuPerm) {
        console.warn(`⚠️  Menu not found: ${ump.menuKey}`)
        continue
      }

      // Check if assignment already exists
      const existing = await prisma.userMenuPermission.findFirst({
        where: {
          userId: user.id,
          menuPermissionId: menuPerm.id
        }
      })

      if (!existing) {
        await prisma.userMenuPermission.create({
          data: {
            userId: user.id,
            menuPermissionId: menuPerm.id
          }
        })
        userRestoreCount++
      }
    }

    console.log(`✅ Restored ${userRestoreCount} user menu assignments`)
    console.log('')

    console.log('✅ Restore completed successfully!')
    console.log('')
    console.log('📊 Restore Summary:')
    console.log('=====================================')
    console.log(`Role menu assignments restored: ${roleRestoreCount}`)
    console.log(`User menu assignments restored: ${userRestoreCount}`)
    console.log('')
    console.log('💡 Users must log out and log back in to see the restored menus.')

  } catch (error) {
    console.error('❌ Restore failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Get backup filename from command line argument
const backupFilename = process.argv[2]

restoreMenuPermissions(backupFilename)
