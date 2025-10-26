const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking for recent sales...\n');

  const sales = await prisma.sale.findMany({
    where: {
      saleDate: {
        gte: new Date('2025-10-24')
      },
      status: {
        notIn: ['voided', 'cancelled']
      }
    },
    include: {
      customer: {
        select: { name: true }
      },
      payments: {
        select: { amount: true, paymentMethod: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  });

  console.log(`Found ${sales.length} recent sales:\n`);

  for (const sale of sales) {
    const totalAmount = parseFloat(sale.totalAmount.toString());
    const paidAmount = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
    const balance = totalAmount - paidAmount;

    console.log(`Invoice: ${sale.invoiceNumber}`);
    console.log(`Customer: ${sale.customer ? sale.customer.name : 'Walk-in Customer'}`);
    console.log(`Date: ${sale.saleDate.toISOString().split('T')[0]}`);
    console.log(`Total Amount: ₱${totalAmount.toFixed(2)}`);
    console.log(`Paid Amount: ₱${paidAmount.toFixed(2)}`);
    console.log(`Balance Due: ₱${balance.toFixed(2)}`);
    console.log(`Status: ${sale.status}`);
    console.log(`Payment Methods: ${sale.payments.map(p => p.paymentMethod).join(', ') || 'None'}`);
    console.log('---');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
