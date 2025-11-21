/**
 * Check Audit Logs for Login History
 *
 * This script checks if any USER_LOGIN audit logs exist in the database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAuditLogs() {
  console.log('🔍 Checking for USER_LOGIN audit logs...\n')

  try {
    // Check total audit logs
    const totalLogs = await prisma.auditLog.count()
    console.log(`📊 Total audit logs in database: ${totalLogs}`)

    // Check USER_LOGIN logs specifically
    const loginLogs = await prisma.auditLog.findMany({
      where: {
        action: 'user_login'
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        userId: true,
        username: true,
        action: true,
        description: true,
        createdAt: true,
        metadata: true,
      }
    })

    console.log(`\n🔐 USER_LOGIN logs found: ${loginLogs.length}\n`)

    if (loginLogs.length > 0) {
      console.log('Recent login logs:')
      console.log('='.repeat(80))
      for (const log of loginLogs) {
        console.log(`ID: ${log.id}`)
        console.log(`User: ${log.username} (ID: ${log.userId})`)
        console.log(`Action: ${log.action}`)
        console.log(`Description: ${log.description}`)
        console.log(`Timestamp: ${log.createdAt}`)
        console.log(`Metadata:`, JSON.stringify(log.metadata, null, 2))
        console.log('-'.repeat(80))
      }
    } else {
      console.log('❌ No USER_LOGIN logs found!')
      console.log('\nThis means the audit logging in auth.simple.ts is not working.')
      console.log('Possible reasons:')
      console.log('1. The code changes haven\'t been deployed yet')
      console.log('2. No one has logged in since the changes were made')
      console.log('3. There\'s an error in the audit log creation (check server logs)')
    }

    // Check what actions exist
    const actions = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: {
        action: true
      }
    })

    console.log('\n📋 All audit log actions in database:')
    console.log('='.repeat(80))
    for (const action of actions) {
      console.log(`${action.action}: ${action._count.action} records`)
    }

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAuditLogs()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
