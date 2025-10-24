#!/usr/bin/env node

/**
 * Grant ACCESS_ALL_LOCATIONS permission to warehouse_super role
 * This simulates the original bug scenario where a user with this permission
 * would incorrectly get "Baguio" selected instead of their assigned "Main Warehouse"
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function grantPermission() {
  try {
    console.log('\n🔧 Granting ACCESS_ALL_LOCATIONS permission to Warehouse Manager role...\n')

    // Find or create the permission
    let permission = await prisma.permission.findUnique({
      where: { name: 'location.access_all' }
    })

    if (!permission) {
      permission = await prisma.permission.create({
        data: {
          name: 'location.access_all',
          guardName: 'web'
        }
      })
      console.log('✅ Created permission: location.access_all')
    } else {
      console.log('✓ Permission already exists: location.access_all')
    }

    // Find Warehouse Manager role
    const warehouseRole = await prisma.role.findFirst({
      where: {
        name: { contains: 'Warehouse', mode: 'insensitive' }
      },
      include: {
        permissions: {
          include: {
            permission: true
          }
        }
      }
    })

    if (!warehouseRole) {
      console.log('❌ Warehouse role not found')
      return
    }

    console.log(`✓ Found role: ${warehouseRole.name} (ID: ${warehouseRole.id})`)

    // Check if already has the permission
    const hasPermission = warehouseRole.permissions.some(
      rp => rp.permission.name === 'location.access_all'
    )

    if (hasPermission) {
      console.log('✓ Role already has ACCESS_ALL_LOCATIONS permission')
    } else {
      // Grant the permission
      await prisma.rolePermission.create({
        data: {
          roleId: warehouseRole.id,
          permissionId: permission.id
        }
      })
      console.log('✅ Granted ACCESS_ALL_LOCATIONS permission to role')
    }

    console.log('\n✅ Done!\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

grantPermission()
