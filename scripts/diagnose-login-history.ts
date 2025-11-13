/**
 * ============================================================================
 * LOGIN HISTORY DIAGNOSTIC SCRIPT
 * ============================================================================
 */

import { prisma } from '../src/lib/prisma'

async function diagnoseLoginHistory() {
  console.log('========================================')
  console.log('LOGIN HISTORY DIAGNOSTIC REPORT')
  console.log('========================================\n')

  // 1. Check all audit log actions
  console.log('1. ALL AUDIT LOG ACTIONS IN DATABASE:')
  console.log('-----------------------------------')

  const actions = await prisma.auditLog.groupBy({
    by: ['action'],
    _count: {
      action: true
    },
    orderBy: {
      _count: {
        action: 'desc'
      }
    }
  })

  console.log('Distinct actions found:')
  for (const action of actions) {
    console.log(`  - "${action.action}": ${action._count.action} records`)
  }

  // 2. Check for USER_LOGIN variations
  console.log('\n\n2. SEARCHING FOR LOGIN-RELATED ACTIONS:')
  console.log('-----------------------------------')

  const loginVariations = [
    'USER_LOGIN',    // Uppercase
    'user_login',    // Lowercase
    'User_Login',    // Mixed case
    'USER_LOGIN',    // What API is searching for
  ]

  for (const variation of loginVariations) {
    const count = await prisma.auditLog.count({
      where: {
        action: variation
      }
    })
    console.log(`"${variation}": ${count} records ${count > 0 ? '✓' : '✗'}`)
  }

  // 3. Check recent audit logs (last 10)
  console.log('\n\n3. RECENT AUDIT LOGS (Last 10):')
  console.log('-----------------------------------')

  const recentLogs = await prisma.auditLog.findMany({
    take: 10,
    orderBy: {
      createdAt: 'desc'
    },
    select: {
      id: true,
      action: true,
      username: true,
      description: true,
      createdAt: true
    }
  })

  for (const log of recentLogs) {
    console.log(`\nID: ${log.id}`)
    console.log(`  Action: "${log.action}"`)
    console.log(`  Username: ${log.username}`)
    console.log(`  Description: ${log.description}`)
    console.log(`  Created: ${log.createdAt.toISOString()}`)
  }

  // 4. Check if login logs exist today
  console.log('\n\n4. LOGIN LOGS FROM TODAY:')
  console.log('-----------------------------------')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const todayLogins = await prisma.auditLog.findMany({
    where: {
      action: {
        in: ['user_login', 'USER_LOGIN']  // Check both
      },
      createdAt: {
        gte: todayStart
      }
    },
    include: {
      user: {
        select: {
          username: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  if (todayLogins.length === 0) {
    console.log('❌ NO LOGIN LOGS FOUND TODAY!')
    console.log('This means either:')
    console.log('  1. No users have logged in today')
    console.log('  2. Audit log creation is failing silently')
    console.log('  3. The action string is wrong')
  } else {
    console.log(`✓ Found ${todayLogins.length} login(s) today:`)
    for (const log of todayLogins) {
      console.log(`\n  - ${log.user?.firstName} ${log.user?.lastName} (${log.username})`)
      console.log(`    Action: "${log.action}"`)
      console.log(`    Time: ${log.createdAt.toLocaleString()}`)
      console.log(`    Description: ${log.description}`)
    }
  }

  console.log('\n========================================')
  console.log('END OF DIAGNOSTIC REPORT')
  console.log('========================================\n')
}

// Run the diagnostic
diagnoseLoginHistory()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
