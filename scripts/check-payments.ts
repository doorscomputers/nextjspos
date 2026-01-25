import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Checking SalePayment Records ===\n");

  // Count total payments
  const totalCount = await prisma.salePayment.count();
  console.log("Total SalePayment count:", totalCount);

  if (totalCount === 0) {
    console.log("\nNo SalePayment records found in database!");

    // Check if there are any sales
    const salesCount = await prisma.sale.count();
    console.log("Total Sale count:", salesCount);

    // Check sales by status
    const salesByStatus = await prisma.sale.groupBy({
      by: ['status'],
      _count: { id: true }
    });
    console.log("\nSales by status:");
    salesByStatus.forEach(s => console.log(`  ${s.status}: ${s._count.id}`));

    // Check sales with payments info
    const salesWithPaymentInfo = await prisma.sale.findMany({
      take: 10,
      orderBy: { saleDate: 'desc' },
      select: {
        id: true,
        invoiceNumber: true,
        status: true,
        paymentStatus: true,
        totalAmount: true,
        totalPaid: true,
        saleDate: true
      }
    });
    console.log("\nRecent 10 sales:");
    salesWithPaymentInfo.forEach(s => {
      console.log(`  ${s.invoiceNumber} | status: ${s.status} | paymentStatus: ${s.paymentStatus} | total: ${s.totalAmount} | paid: ${s.totalPaid}`);
    });

    return;
  }

  // Get recent payments
  const payments = await prisma.salePayment.findMany({
    take: 20,
    orderBy: { paidAt: 'desc' },
    include: {
      sale: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          businessId: true,
          totalAmount: true
        }
      }
    }
  });

  console.log("\nRecent 20 payments:");
  payments.forEach(p => {
    console.log({
      paymentId: p.id,
      amount: Number(p.amount),
      method: p.paymentMethod,
      paidAt: p.paidAt,
      invoiceNumber: p.sale?.invoiceNumber,
      saleStatus: p.sale?.status,
      businessId: p.sale?.businessId
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
