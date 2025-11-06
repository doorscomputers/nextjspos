import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function testFixedQueries() {
  console.log('🔍 Testing Fixed Audit Trail Queries...\n')

  try {
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const baseWhere: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    console.log('1️⃣ Testing unique users count (FIXED)...')
    const uniqueUsersGroups = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: baseWhere,
    })
    console.log(`   ✅ Unique users: ${uniqueUsersGroups.length}\n`)

    console.log('2️⃣ Testing unique businesses count (FIXED)...')
    const uniqueBusinessesGroups = await prisma.auditLog.groupBy({
      by: ['businessId'],
      where: baseWhere,
    })
    console.log(`   ✅ Unique businesses: ${uniqueBusinessesGroups.length}\n`)

    console.log('3️⃣ Testing action distribution (FIXED)...')
    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      where: baseWhere,
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
    })
    console.log(`   ✅ Action types: ${actionCounts.length}`)
    console.log(`   First action: ${actionCounts[0]?.action} (${actionCounts[0]?._count.id} times)\n`)

    console.log('4️⃣ Testing bulk operations groupBy (FIXED)...')
    const bulkOps = await prisma.auditLog.groupBy({
      by: ['userId', 'username', 'action', 'entityType'],
      where: {
        ...baseWhere,
        action: {
          in: ['bulk_delete', 'bulk_deactivate', 'bulk_remove_from_location']
        },
      },
      _count: {
        action: true,
      },
      having: {
        action: {
          _count: {
            gt: 0, // Changed from 5 to 0 for testing
          },
        },
      },
    })
    console.log(`   ✅ Bulk operations found: ${bulkOps.length}\n`)

    console.log('5️⃣ Testing failed password attempts (FIXED)...')
    const failedAttempts = await prisma.auditLog.groupBy({
      by: ['userId', 'username', 'ipAddress'],
      where: {
        ...baseWhere,
        requiresPassword: true,
        passwordVerified: false,
      },
      _count: {
        userId: true,
      },
      having: {
        userId: {
          _count: {
            gt: 0, // Changed from 2 to 0 for testing
          },
        },
      },
    })
    console.log(`   ✅ Failed attempts found: ${failedAttempts.length}\n`)

    console.log('✅ ALL TESTS PASSED! Ready to deploy.\n')

  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testFixedQueries().catch(console.error)
