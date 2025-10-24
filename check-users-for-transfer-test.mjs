#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('\n🔍 Finding users with ACCESS_ALL_LOCATIONS permission...\n')

    const users = await prisma.user.findMany({
      where: {
        deletedAt: null
      },
      include: {
        business: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        },
        userLocations: {
          include: {
            location: true
          }
        }
      }
    })

    console.log(`Found ${users.length} active users\n`)

    let usersWithAccessAll = 0

    users.forEach(user => {
      const hasAccessAll = user.roles.some(ur =>
        ur.role.permissions.some(rp =>
          rp.permission.name === 'location.access_all'
        )
      )

      if (hasAccessAll) {
        usersWithAccessAll++
        console.log('─'.repeat(70))
        console.log(`👤 User: ${user.username}`)
        console.log(`   Name: ${user.firstName} ${user.lastName || ''}`)
        console.log(`   Business: ${user.business?.name || 'N/A'}`)
        console.log(`   🔓 Has ACCESS_ALL_LOCATIONS: YES`)
        console.log(`   📍 Assigned Locations:`)

        if (user.userLocations.length === 0) {
          console.log(`      ⚠️  No locations assigned`)
        } else {
          user.userLocations.forEach(ul => {
            if (ul.location && !ul.location.deletedAt) {
              console.log(`      ✓ ${ul.location.name} (ID: ${ul.location.id})`)
            }
          })
        }
        console.log('')
      }
    })

    if (usersWithAccessAll === 0) {
      console.log('⚠️  No users found with ACCESS_ALL_LOCATIONS permission')
      console.log('   Showing users with location assignments instead...\n')

      users.filter(u => u.userLocations.length > 0).slice(0, 5).forEach(user => {
        console.log('─'.repeat(70))
        console.log(`👤 User: ${user.username}`)
        console.log(`   Name: ${user.firstName} ${user.lastName || ''}`)
        console.log(`   Business: ${user.business?.name || 'N/A'}`)
        console.log(`   📍 Assigned Locations:`)
        user.userLocations.forEach(ul => {
          if (ul.location && !ul.location.deletedAt) {
            console.log(`      ✓ ${ul.location.name} (ID: ${ul.location.id})`)
          }
        })
        console.log('')
      })
    }

    console.log('─'.repeat(70))
    console.log('\n✅ Done\n')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
