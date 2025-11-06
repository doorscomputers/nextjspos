import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function testAuditTrailQueries() {
  console.log('🔍 Testing Audit Trail API Queries...\n')

  try {
    // Set date range (last 30 days)
    const end = new Date()
    end.setHours(23, 59, 59, 999)
    const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const baseWhere: any = {
      createdAt: {
        gte: start,
        lte: end,
      },
    }

    console.log('1️⃣ Testing basic count...')
    const totalCount = await prisma.auditLog.count({ where: baseWhere })
    console.log(`   ✅ Total audit logs: ${totalCount}\n`)

    console.log('2️⃣ Testing unique users count (ISSUE HERE)...')
    try {
      // This is WRONG - count doesn't support distinct
      const uniqueUsersCount = await prisma.auditLog.count({
        where: baseWhere,
        distinct: ['userId'] as any
      })
      console.log(`   ✅ Unique users: ${uniqueUsersCount}\n`)
    } catch (error: any) {
      console.log(`   ❌ ERROR: ${error.message}`)
      console.log(`   This is the problem! count() doesn't support distinct.\n`)

      // The correct way:
      console.log('   📝 Using correct method (groupBy)...')
      const uniqueUsers = await prisma.auditLog.groupBy({
        by: ['userId'],
        where: baseWhere,
      })
      console.log(`   ✅ Unique users (correct): ${uniqueUsers.length}\n`)
    }

    console.log('3️⃣ Testing groupBy for actions...')
    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      where: baseWhere,
      _count: { _all: true },
      orderBy: { _count: { _all: 'desc' } },
    })
    console.log(`   ✅ Actions grouped: ${actionCounts.length}\n`)

    console.log('4️⃣ Testing raw SQL query...')
    const dailyActivities = await prisma.$queryRaw(Prisma.sql`
      SELECT
        DATE_TRUNC('day', "created_at") as date,
        COUNT(*) as count
      FROM "audit_logs"
      WHERE
        "created_at" >= ${start}
        AND "created_at" <= ${end}
      GROUP BY DATE_TRUNC('day', "created_at")
      ORDER BY date ASC
      LIMIT 5
    `)
    console.log(`   ✅ Raw SQL results: ${(dailyActivities as any[]).length} rows\n`)

    console.log('✅ All tests completed!')

  } catch (error: any) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

testAuditTrailQueries().catch(console.error)
