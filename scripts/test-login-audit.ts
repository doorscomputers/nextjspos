/**
 * Test Login Audit Log Creation
 *
 * Creates a test audit log to verify the system is working
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAuditLog() {
  console.log('🧪 Testing audit log creation...\n')

  try {
    // Get a user to test with
    const user = await prisma.user.findFirst({
      where: {
        username: 'superadmin'
      }
    })

    if (!user) {
      console.log('❌ No superadmin user found')
      return
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id}, Business: ${user.businessId})`)

    // Create a test login audit log
    const testLog = await prisma.auditLog.create({
      data: {
        businessId: user.businessId!,
        userId: user.id,
        username: user.username,
        action: 'user_login',
        entityType: 'user',
        entityIds: JSON.stringify([user.id]),
        description: `TEST: User logged in successfully`,
        metadata: {
          selectedLocation: 'Test Location',
          selectedLocationId: null,
          assignedLocations: [],
          assignedLocationIds: [],
          roles: ['Super Admin'],
          loginTimestamp: new Date().toISOString(),
          isTest: true,
        },
        ipAddress: '127.0.0.1',
        userAgent: 'Test Script',
      }
    })

    console.log('\n✅ Test audit log created successfully!')
    console.log(`Log ID: ${testLog.id}`)
    console.log(`Action: ${testLog.action}`)
    console.log(`Description: ${testLog.description}`)

    // Verify it can be read back
    const verifyLog = await prisma.auditLog.findUnique({
      where: { id: testLog.id }
    })

    if (verifyLog) {
      console.log('\n✅ Test log verified - can be read from database')
    }

    // Check total USER_LOGIN logs
    const loginLogCount = await prisma.auditLog.count({
      where: { action: 'user_login' }
    })

    console.log(`\n📊 Total USER_LOGIN logs in database: ${loginLogCount}`)

  } catch (error: any) {
    console.error('❌ Error creating test audit log:', error)
    console.error('Error details:', error.message)
    console.error('Error code:', error.code)
  } finally {
    await prisma.$disconnect()
  }
}

testAuditLog()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
