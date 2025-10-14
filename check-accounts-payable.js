const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkAccountsPayable() {
  try {
    console.log('=== CHECKING ACCOUNTS PAYABLE ===\n');

    // Get all accounts payable
    const allPayables = await prisma.accountsPayable.findMany({
      include: {
        supplier: { select: { name: true } },
        purchase: { select: { purchaseOrderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    console.log(`Total Accounts Payable Records: ${allPayables.length}\n`);

    if (allPayables.length > 0) {
      console.log('Accounts Payable Records:');
      allPayables.forEach((ap, idx) => {
        console.log(`\n${idx + 1}. Invoice: ${ap.invoiceNumber}`);
        console.log(`   PO: ${ap.purchase?.purchaseOrderNumber}`);
        console.log(`   Supplier: ${ap.supplier.name}`);
        console.log(`   Total Amount: ${ap.totalAmount}`);
        console.log(`   Paid Amount: ${ap.paidAmount}`);
        console.log(`   Balance Amount: ${ap.balanceAmount}`);
        console.log(`   Payment Status: ${ap.paymentStatus}`);
        console.log(`   Due Date: ${ap.dueDate}`);
      });
    } else {
      console.log('⚠️  NO ACCOUNTS PAYABLE RECORDS FOUND!');
      console.log('This explains why Purchase Due is showing ZERO on the dashboard.\n');
    }

    // Get summary by payment status
    console.log('\n=== ACCOUNTS PAYABLE SUMMARY ===\n');
    const summary = await prisma.accountsPayable.groupBy({
      by: ['paymentStatus'],
      _sum: {
        totalAmount: true,
        paidAmount: true,
        balanceAmount: true,
      },
      _count: true,
    });

    if (summary.length > 0) {
      summary.forEach(group => {
        console.log(`Status: ${group.paymentStatus}`);
        console.log(`  Count: ${group._count}`);
        console.log(`  Total Amount: ${group._sum.totalAmount}`);
        console.log(`  Paid Amount: ${group._sum.paidAmount}`);
        console.log(`  Balance Amount: ${group._sum.balanceAmount}\n`);
      });
    }

    // Check total outstanding balance
    const outstandingBalance = await prisma.accountsPayable.aggregate({
      where: {
        paymentStatus: { in: ['unpaid', 'partial', 'overdue'] },
      },
      _sum: {
        balanceAmount: true,
      },
    });

    console.log('=== DASHBOARD METRICS ===\n');
    console.log('Total Outstanding Balance (Purchase Due):', outstandingBalance._sum.balanceAmount || 0);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAccountsPayable();
