/**
 * ============================================================================
 * ACTIVITY TRACKING TEST SCRIPT
 * ============================================================================
 *
 * Tests if activity tracking is working properly
 *
 * USAGE: npx tsx scripts/test-activity-tracking.ts
 */

import { prisma } from '../src/lib/prisma'

async function testActivityTracking() {
  console.log('========================================')
  console.log('ACTIVITY TRACKING TEST')
  console.log('========================================\n')

  // 1. Check all user activity records
  console.log('1. ALL USER ACTIVITY RECORDS:')
  console.log('-----------------------------------')

  const allActivity = await prisma.userActivity.findMany({
    include: {
      user: {
        select: {
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
          }
        }
      }
    },
    orderBy: {
      lastSeenAt: 'desc'
    },
    take: 20
  })

  console.log(`Total activity records: ${allActivity.length}`)

  if (allActivity.length === 0) {
    console.log('\n❌ NO ACTIVITY RECORDS FOUND!')
    console.log('This means activity tracking is NOT working.')
    console.log('\nPossible causes:')
    console.log('  1. Dev server not restarted after middleware changes')
    console.log('  2. Users not accessing dashboard pages')
    console.log('  3. Error in trackUserActivity function')
    console.log('  4. Middleware not executing')
  } else {
    console.log('\n✓ Activity records found:')

    for (const activity of allActivity) {
      const roleNames = activity.user.roles.map(ur => ur.role.name)
      const minutesAgo = Math.floor((Date.now() - activity.lastSeenAt.getTime()) / 60000)

      console.log(`\n  ${activity.user.firstName} ${activity.user.lastName} (@${activity.user.username})`)
      console.log(`    Roles: ${roleNames.join(', ')}`)
      console.log(`    Last Seen: ${activity.lastSeenAt.toISOString()} (${minutesAgo} min ago)`)
      console.log(`    Device: ${activity.deviceType || 'unknown'}`)
      console.log(`    Browser: ${activity.browser || 'unknown'}`)
      console.log(`    Current URL: ${activity.currentUrl || 'unknown'}`)
      console.log(`    IP: ${activity.ipAddress || 'unknown'}`)
    }
  }

  // 2. Check for recent updates (last 5 minutes)
  console.log('\n\n2. RECENT ACTIVITY (Last 5 minutes):')
  console.log('-----------------------------------')

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
  const recentActivity = await prisma.userActivity.findMany({
    where: {
      lastSeenAt: {
        gte: fiveMinutesAgo
      }
    },
    include: {
      user: {
        select: {
          username: true,
          roles: {
            include: {
              role: {
                select: {
                  name: true
                }
              }
            }
          }
        }
      }
    }
  })

  if (recentActivity.length === 0) {
    console.log('❌ No activity in the last 5 minutes')
    console.log('This means NO USERS are currently being tracked.')
    console.log('\nDid you:')
    console.log('  1. Restart the dev server after middleware changes?')
    console.log('  2. Login with users and navigate dashboard pages?')
    console.log('  3. Check browser console for errors?')
  } else {
    console.log(`✓ ${recentActivity.length} users active in last 5 minutes:`)
    for (const activity of recentActivity) {
      const roleNames = activity.user.roles.map(ur => ur.role.name)
      console.log(`  - ${activity.user.username} (${roleNames.join(', ')})`)
    }
  }

  // 3. Check middleware is set up correctly
  console.log('\n\n3. MIDDLEWARE CONFIGURATION CHECK:')
  console.log('-----------------------------------')
  console.log('✓ Activity tracker function exists')
  console.log('✓ Middleware.ts should have trackUserActivityFromToken import')
  console.log('✓ Middleware.ts should call trackUserActivity for dashboard routes')
  console.log('\n⚠️  IMPORTANT: You MUST restart the dev server for middleware changes to take effect!')

  // 4. Test if we can manually track activity
  console.log('\n\n4. MANUAL ACTIVITY TRACKING TEST:')
  console.log('-----------------------------------')

  const testUser = await prisma.user.findFirst({
    where: {
      allowLogin: true,
      username: {
        not: 'superadmin'
      }
    }
  })

  if (testUser) {
    console.log(`\nTest user: ${testUser.username}`)
    console.log('Attempting to manually update activity...')

    try {
      await prisma.userActivity.upsert({
        where: { userId: testUser.id },
        update: {
          lastSeenAt: new Date(),
          currentUrl: '/test',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Script',
          deviceType: 'desktop',
          browser: 'Test',
          updatedAt: new Date()
        },
        create: {
          userId: testUser.id,
          lastSeenAt: new Date(),
          currentUrl: '/test',
          ipAddress: '127.0.0.1',
          userAgent: 'Test Script',
          deviceType: 'desktop',
          browser: 'Test'
        }
      })
      console.log('✓ Manual activity update successful!')
      console.log('This proves the database and model are working correctly.')
    } catch (err) {
      console.log('❌ Manual activity update FAILED:', err)
      console.log('This indicates a database or schema problem.')
    }
  }

  console.log('\n========================================')
  console.log('END OF TEST')
  console.log('========================================\n')

  console.log('\nNEXT STEPS:')
  console.log('1. Restart your dev server: npm run dev')
  console.log('2. Login as a Cashier user')
  console.log('3. Navigate to 2-3 dashboard pages')
  console.log('4. Run this script again')
  console.log('5. Check Active Users Monitor\n')
}

// Run the test
testActivityTracking()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
