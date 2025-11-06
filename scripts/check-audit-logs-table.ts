import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAuditLogsTable() {
  console.log('🔍 Checking audit_logs table...\n')

  try {
    // Try to query the audit_logs table
    const count = await prisma.auditLog.count()
    console.log(`✅ audit_logs table exists!`)
    console.log(`   Total records: ${count}`)

    // Check if there are any sample records
    if (count > 0) {
      const sample = await prisma.auditLog.findFirst({
        select: {
          id: true,
          action: true,
          entityType: true,
          username: true,
          createdAt: true,
        },
      })
      console.log(`\n📝 Sample record:`)
      console.log(`   ID: ${sample?.id}`)
      console.log(`   Action: ${sample?.action}`)
      console.log(`   Entity Type: ${sample?.entityType}`)
      console.log(`   Username: ${sample?.username}`)
      console.log(`   Created: ${sample?.createdAt}`)
    } else {
      console.log(`\n⚠️  Table is empty - no audit logs yet`)
      console.log(`   This is normal if the feature was just added`)
    }

    console.log(`\n✅ audit_logs table is working correctly!`)
  } catch (error: any) {
    console.error(`\n❌ ERROR: audit_logs table does not exist or has issues!`)
    console.error(`\nError details:`)
    console.error(`   ${error.message}`)

    console.log(`\n📝 To fix this issue:`)
    console.log(`   1. Run: npx prisma generate`)
    console.log(`   2. Run: npx prisma db push`)
    console.log(`   3. Run this script again to verify`)
  } finally {
    await prisma.$disconnect()
  }
}

checkAuditLogsTable()
  .catch(console.error)
