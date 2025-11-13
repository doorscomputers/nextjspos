/**
 * Test Shift Closing Workflow - Diagnostic Tool
 * Run with: node test-shift-close.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testShiftClose() {
  try {
    console.log('\n🔍 SHIFT CLOSE DIAGNOSTIC TEST\n');
    console.log('='.repeat(50));

    // Test Shift 15
    const shiftId = 15;
    console.log(`\n📋 Testing Shift ID: ${shiftId}`);

    // Step 1: Fetch shift
    console.log('\n[1/5] Fetching shift data...');
    const shift = await prisma.cashierShift.findUnique({
      where: { id: shiftId },
      include: {
        cashInOutRecords: true,
      }
    });

    if (!shift) {
      console.log('❌ FAIL: Shift not found');
      return;
    }
    console.log(`✅ PASS: Shift found - ${shift.shiftNumber}`);
    console.log(`   Status: ${shift.status}`);
    console.log(`   Opened: ${shift.openedAt}`);
    console.log(`   Running Transactions: ${shift.runningTransactions}`);
    console.log(`   Running Gross Sales: ${shift.runningGrossSales}`);

    // Step 2: Check user assignment
    console.log('\n[2/5] Checking user-location assignment...');
    const assignment = await prisma.userLocation.findFirst({
      where: {
        userId: shift.userId,
        locationId: shift.locationId
      }
    });

    if (!assignment) {
      console.log(`❌ FAIL: User ${shift.userId} is NOT assigned to Location ${shift.locationId}`);
      console.log('   This will prevent X/Z Reading generation!');
      return;
    }
    console.log('✅ PASS: User is assigned to shift location');

    // Step 3: Check running totals
    console.log('\n[3/5] Checking running totals...');
    const hasRunningTotals =
      parseFloat(shift.runningGrossSales.toString()) > 0 ||
      shift.runningTransactions > 0;

    if (hasRunningTotals) {
      console.log('✅ PASS: Running totals initialized (INSTANT mode)');
    } else {
      console.log('⚠️  WARN: Running totals are ZERO (will use SQL aggregation fallback)');
    }

    // Step 4: Check sales
    console.log('\n[4/5] Checking sales records...');
    const salesCount = await prisma.sale.count({
      where: {
        shiftId: shift.id,
        deletedAt: null
      }
    });

    console.log(`   Sales found: ${salesCount}`);
    if (salesCount > 0) {
      console.log('✅ PASS: Sales records exist');
    } else {
      console.log('⚠️  WARN: No sales found (shift may have no transactions)');
    }

    // Step 5: Calculate expected cash
    console.log('\n[5/5] Calculating expected cash...');
    let systemCash = shift.beginningCash;
    const cashSales = parseFloat(shift.runningCashSales.toString());
    systemCash = systemCash.add(cashSales);

    for (const record of shift.cashInOutRecords) {
      if (record.type === 'cash_in') {
        systemCash = systemCash.add(record.amount);
      } else if (record.type === 'cash_out') {
        systemCash = systemCash.subtract(record.amount);
      }
    }

    const arPaymentsCash = parseFloat(shift.runningArPaymentsCash.toString());
    systemCash = systemCash.add(arPaymentsCash);

    console.log(`   Beginning Cash: ₱${shift.beginningCash}`);
    console.log(`   + Cash Sales: ₱${cashSales}`);
    console.log(`   + AR Payments: ₱${arPaymentsCash}`);
    console.log(`   + Cash In/Out: ${shift.cashInOutRecords.length} records`);
    console.log(`   = Expected Cash: ₱${systemCash}`);
    console.log('✅ PASS: Cash calculation successful');

    // Final verdict
    console.log('\n' + '='.repeat(50));
    console.log('\n🎯 FINAL VERDICT:');
    console.log(`\n✅ Shift ${shift.shiftNumber} SHOULD be closeable!`);
    console.log('\nIf closing still fails in the browser:');
    console.log('1. Open browser DevTools (F12)');
    console.log('2. Go to Console tab');
    console.log('3. Click "Close Shift with BIR Readings"');
    console.log('4. Copy any RED error messages');
    console.log('5. Share the error with me\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ ERROR during diagnostic test:');
    console.error(error.message);
    console.error('\nFull error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testShiftClose();
