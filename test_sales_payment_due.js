const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSalesPaymentDue() {
  console.log('Testing Sales Payment Due Query...\n');

  // Simulate the dashboard stats query
  const businessId = 1; // Adjust as needed
  const locationId = 4; // Adjust as needed

  const whereClause = {
    businessId: businessId,
    locationId: locationId
  };

  const salesPaymentDueRaw = await prisma.sale.findMany({
    where: {
      ...whereClause,
      status: {
        notIn: ['voided', 'cancelled']
      }
    },
    include: {
      customer: { select: { name: true } },
      payments: {
        select: { amount: true }
      },
    },
    orderBy: { saleDate: 'desc' },
    take: 100,
  });

  const salesPaymentDue = salesPaymentDueRaw
    .map((sale) => {
      const totalAmount = parseFloat(sale.totalAmount.toString());
      const paidAmount = sale.payments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount.toString());
      }, 0);
      const balance = Math.max(0, parseFloat((totalAmount - paidAmount).toFixed(2)));

      return {
        id: sale.id,
        invoiceNumber: sale.invoiceNumber,
        customer: sale.customer ? sale.customer.name : 'Walk-in Customer',
        date: sale.saleDate.toISOString().split('T')[0],
        amount: balance,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        status: sale.status
      };
    })
    .filter((sale) => sale.amount > 0)
    .slice(0, 10);

  console.log(`Found ${salesPaymentDue.length} sales with outstanding balance:\n`);

  salesPaymentDue.forEach((sale) => {
    console.log(`Invoice: ${sale.invoiceNumber}`);
    console.log(`Customer: ${sale.customer}`);
    console.log(`Date: ${sale.date}`);
    console.log(`Status: ${sale.status}`);
    console.log(`Total Amount: ₱${sale.totalAmount.toFixed(2)}`);
    console.log(`Paid Amount: ₱${sale.paidAmount.toFixed(2)}`);
    console.log(`Balance Due: ₱${sale.amount.toFixed(2)}`);
    console.log('---');
  });

  // Calculate total
  const totalDue = salesPaymentDue.reduce((sum, sale) => sum + sale.amount, 0);
  console.log(`\nTotal Outstanding: ₱${totalDue.toFixed(2)}`);
}

testSalesPaymentDue()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
