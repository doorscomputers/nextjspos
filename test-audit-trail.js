const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testAuditTrail() {
  console.log('=== TESTING AUDIT TRAIL SYSTEM ===\n');

  try {
    // Test 1: Check if audit trail table has any data
    console.log('Test 1: Checking audit_logs table...');
    const auditCount = await prisma.auditLog.count();
    console.log('✓ Total audit logs in database:', auditCount);

    if (auditCount > 0) {
      const recentLogs = await prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
      });

      console.log('\n✓ Recent audit logs:');
      recentLogs.forEach(log => {
        console.log(`  - ${log.action} | ${log.entityType} | User: ${log.username} | Time: ${log.createdAt.toISOString()}`);
        console.log(`    Description: ${log.description}`);
      });
    } else {
      console.log('⚠️ WARNING: No audit logs found! Audit system may not be working.');
    }

    // Test 2: Check audit log structure
    console.log('\n\nTest 2: Checking audit log structure...');
    if (auditCount > 0) {
      const sampleLog = await prisma.auditLog.findFirst();
      console.log('✓ Sample audit log fields:');
      console.log('  - action:', sampleLog.action);
      console.log('  - entityType:', sampleLog.entityType);
      console.log('  - entityIds:', sampleLog.entityIds);
      console.log('  - description:', sampleLog.description);
      console.log('  - metadata:', typeof sampleLog.metadata, '- Keys:', sampleLog.metadata ? Object.keys(sampleLog.metadata).length : 0);
      console.log('  - ipAddress:', sampleLog.ipAddress);
      console.log('  - userAgent:', sampleLog.userAgent ? 'Present' : 'Missing');
    }

    // Test 3: Check if different action types are logged
    console.log('\n\nTest 3: Checking action type variety...');
    const actionGroups = await prisma.auditLog.groupBy({
      by: ['action'],
      _count: true,
    });
    console.log('✓ Action types logged:');
    actionGroups.forEach(group => {
      console.log(`  - ${group.action}: ${group._count} logs`);
    });

    // Test 4: Check entity types
    console.log('\n\nTest 4: Checking entity types logged...');
    const entityGroups = await prisma.auditLog.groupBy({
      by: ['entityType'],
      _count: true,
    });
    console.log('✓ Entity types logged:');
    entityGroups.forEach(group => {
      console.log(`  - ${group.entityType}: ${group._count} logs`);
    });

    // Test 5: Check for purchase-related audit logs
    console.log('\n\nTest 5: Checking purchase-related audit logs...');
    const purchaseLogs = await prisma.auditLog.findMany({
      where: {
        OR: [
          { action: { contains: 'purchase' } },
          { entityType: 'purchase' }
        ]
      },
      take: 5,
      orderBy: { createdAt: 'desc' }
    });

    if (purchaseLogs.length > 0) {
      console.log(`✓ Found ${purchaseLogs.length} purchase-related logs:`);
      purchaseLogs.forEach(log => {
        console.log(`  - ${log.action}: ${log.description}`);
      });
    } else {
      console.log('⚠️ No purchase-related audit logs found');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuditTrail();
