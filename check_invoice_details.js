const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Checking invoice INVT-202510-0002...\n');

  const sale = await prisma.sale.findFirst({
    where: {
      invoiceNumber: 'INVT-202510-0002'
    },
    include: {
      customer: { select: { name: true } },
      payments: true
    }
  });

  if (!sale) {
    console.log('Invoice not found!');
    return;
  }

  console.log('Sale Details:');
  console.log(`ID: ${sale.id}`);
  console.log(`Invoice Number: ${sale.invoiceNumber}`);
  console.log(`Business ID: ${sale.businessId}`);
  console.log(`Location ID: ${sale.locationId}`);
  console.log(`Customer: ${sale.customer ? sale.customer.name : 'Walk-in Customer'}`);
  console.log(`Status: ${sale.status}`);
  console.log(`Sale Date: ${sale.saleDate.toISOString().split('T')[0]}`);
  console.log(`Total Amount: ₱${parseFloat(sale.totalAmount.toString()).toFixed(2)}`);
  console.log(`\nPayments:`);

  if (sale.payments.length === 0) {
    console.log('  No payments recorded');
  } else {
    sale.payments.forEach((payment, idx) => {
      console.log(`  Payment ${idx + 1}:`);
      console.log(`    Method: ${payment.paymentMethod}`);
      console.log(`    Amount: ₱${parseFloat(payment.amount.toString()).toFixed(2)}`);
    });
  }

  const totalPaid = sale.payments.reduce((sum, p) => sum + parseFloat(p.amount.toString()), 0);
  const balance = parseFloat(sale.totalAmount.toString()) - totalPaid;
  console.log(`\nTotal Paid: ₱${totalPaid.toFixed(2)}`);
  console.log(`Balance Due: ₱${balance.toFixed(2)}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
