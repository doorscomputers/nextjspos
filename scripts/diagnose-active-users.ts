/**
 * ============================================================================
 * ACTIVE USERS DIAGNOSTIC SCRIPT
 * ============================================================================
 *
 * PURPOSE: Debug Active Users Monitor by showing actual database data
 *
 * USAGE: npx tsx scripts/diagnose-active-users.ts
 */

import { prisma } from '../src/lib/prisma'

async function diagnoseActiveUsers() {
  console.log('========================================')
  console.log('ACTIVE USERS DIAGNOSTIC REPORT')
  console.log('========================================\n')

  // 1. Check all users with allowLogin = true
  console.log('1. ALL USERS (allowLogin = true):')
  console.log('-----------------------------------')
  const users = await prisma.user.findMany({
    where: {
      allowLogin: true
    },
    select: {
      id: true,
      username: true,
      firstName: true,
      lastName: true,
      businessId: true,
      roles: {
        include: {
          role: {
            select: {
              name: true
            }
          }
        }
      },
      userLocations: {
        include: {
          location: {
            select: {
              id: true,
              name: true,
              locationCode: true
            }
          }
        }
      }
    }
  })

  for (const user of users) {
    const roleNames = user.roles.map(ur => ur.role.name)
    const locations = user.userLocations.map(ul => ul.location.name)

    console.log(`\nUser ID: ${user.id}`)
    console.log(`  Username: ${user.username}`)
    console.log(`  Name: ${user.firstName} ${user.lastName}`)
    console.log(`  Business ID: ${user.businessId}`)
    console.log(`  Roles: ${roleNames.join(', ') || 'NONE'}`)
    console.log(`  Locations: ${locations.join(', ') || 'UNASSIGNED'}`)

    // Check if would be detected as cashier
    const isCashier = roleNames.some(role =>
      role.toLowerCase().includes('cashier') || role.toLowerCase().includes('sale')
    )
    console.log(`  Would be detected as Cashier: ${isCashier ? 'YES ✓' : 'NO ✗'}`)
  }

  // 2. Check UserActivity table
  console.log('\n\n2. USER ACTIVITY RECORDS:')
  console.log('-----------------------------------')
  const activities = await prisma.userActivity.findMany({
    include: {
      user: {
        select: {
          username: true,
          businessId: true
        }
      }
    },
    orderBy: {
      lastSeenAt: 'desc'
    }
  })

  if (activities.length === 0) {
    console.log('❌ NO ACTIVITY RECORDS FOUND!')
    console.log('This means trackUserActivity() is not being called.')
    console.log('Activity tracking must be added to API routes.')
  } else {
    for (const activity of activities) {
      const now = new Date()
      const minutesAgo = Math.floor((now.getTime() - activity.lastSeenAt.getTime()) / 60000)

      console.log(`\nUser: ${activity.user.username}`)
      console.log(`  Last Seen: ${activity.lastSeenAt.toISOString()}`)
      console.log(`  Minutes Ago: ${minutesAgo}`)
      console.log(`  Active (5 min window): ${minutesAgo <= 5 ? 'YES ✓' : 'NO ✗'}`)
      console.log(`  Active (15 min window): ${minutesAgo <= 15 ? 'YES ✓' : 'NO ✗'}`)
      console.log(`  Active (30 min window): ${minutesAgo <= 30 ? 'YES ✓' : 'NO ✗'}`)
      console.log(`  IP Address: ${activity.ipAddress || 'N/A'}`)
      console.log(`  Device: ${activity.deviceType || 'N/A'}`)
      console.log(`  Browser: ${activity.browser || 'N/A'}`)
      console.log(`  Current URL: ${activity.currentUrl || 'N/A'}`)
    }
  }

  // 3. Test the Active Users query with different time windows
  console.log('\n\n3. ACTIVE USERS QUERY SIMULATION:')
  console.log('-----------------------------------')

  const timeWindows = [5, 15, 30, 60]

  for (const minutes of timeWindows) {
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000)

    const activeUsers = await prisma.userActivity.findMany({
      where: {
        lastSeenAt: {
          gte: cutoffTime
        },
        user: {
          allowLogin: true
        }
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            roles: {
              include: {
                role: {
                  select: {
                    name: true
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
        }
      }
    })

    console.log(`\nTime Window: Last ${minutes} minutes`)
    console.log(`Active Users Count: ${activeUsers.length}`)

    if (activeUsers.length > 0) {
      const cashiers = activeUsers.filter(activity => {
        const roleNames = activity.user.roles.map(ur => ur.role.name)
        return roleNames.some(role =>
          role.toLowerCase().includes('cashier') || role.toLowerCase().includes('sale')
        )
      })

      const unassigned = activeUsers.filter(activity =>
        activity.user.userLocations.length === 0
      )

      console.log(`  - Cashiers: ${cashiers.length}`)
      console.log(`  - Unassigned: ${unassigned.length}`)

      for (const activity of activeUsers) {
        const roleNames = activity.user.roles.map(ur => ur.role.name)
        const isCashier = roleNames.some(role =>
          role.toLowerCase().includes('cashier') || role.toLowerCase().includes('sale')
        )
        const isUnassigned = activity.user.userLocations.length === 0

        console.log(`  - ${activity.user.username}: ${roleNames.join(', ')} ${isCashier ? '[CASHIER]' : ''} ${isUnassigned ? '[UNASSIGNED]' : ''}`)
      }
    }
  }

  console.log('\n========================================')
  console.log('END OF DIAGNOSTIC REPORT')
  console.log('========================================\n')
}

// Run the diagnostic
diagnoseActiveUsers()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
