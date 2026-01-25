import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== Investigating AR Payment Structure ===\n");

  // 1. Check total sales count
  const totalSales = await prisma.sale.count({ where: { businessId: 1 } });
  console.log("Total sales:", totalSales);

  // 2. Check sales with outstanding balance (paidAmount < totalAmount)
  // These are AR cases - customer bought on credit
  const allSales = await prisma.sale.findMany({
    where: { businessId: 1, status: "completed" },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      paidAmount: true,
      customerId: true,
      customer: { select: { name: true } },
      payments: { select: { id: true, amount: true, paymentMethod: true, paidAt: true } }
    },
    take: 500
  });

  const salesWithBalance = allSales.filter(s =>
    Number(s.totalAmount) > Number(s.paidAmount) + 0.01
  );

  const fullyPaidSales = allSales.filter(s =>
    Math.abs(Number(s.totalAmount) - Number(s.paidAmount)) < 0.01
  );

  console.log(`\nSales breakdown:`);
  console.log(`  Fully paid: ${fullyPaidSales.length}`);
  console.log(`  With outstanding balance (AR): ${salesWithBalance.length}`);

  console.log("\n=== Sales with Outstanding Balance (AR Cases) ===");
  salesWithBalance.slice(0, 10).forEach(s => {
    console.log({
      invoice: s.invoiceNumber,
      customer: s.customer?.name || "Walk-in",
      total: Number(s.totalAmount),
      paid: Number(s.paidAmount),
      balance: (Number(s.totalAmount) - Number(s.paidAmount)).toFixed(2),
      paymentsCount: s.payments.length
    });
  });

  // 3. Check SalePayment methods
  const cashPayments = await prisma.salePayment.count({ where: { paymentMethod: "cash" } });
  const creditPayments = await prisma.salePayment.count({ where: { paymentMethod: "credit" } });
  const cardPayments = await prisma.salePayment.count({ where: { paymentMethod: "card" } });
  const chequePayments = await prisma.salePayment.count({ where: { paymentMethod: "cheque" } });

  console.log("\n=== SalePayment Methods ===");
  console.log(`  cash: ${cashPayments}`);
  console.log(`  credit: ${creditPayments}`);
  console.log(`  card: ${cardPayments}`);
  console.log(`  cheque: ${chequePayments}`);

  // 4. Check sales with CREDIT payment method (initial credit sale)
  const creditMethodPayments = await prisma.salePayment.findMany({
    where: { paymentMethod: "credit" },
    take: 20,
    orderBy: { paidAt: "desc" },
    include: {
      sale: {
        select: {
          invoiceNumber: true,
          totalAmount: true,
          paidAmount: true,
          customer: { select: { name: true } }
        }
      }
    }
  });

  console.log("\n=== Payments with method='credit' (Credit Sales) ===");
  console.log(`Found ${creditMethodPayments.length} credit payments`);
  creditMethodPayments.slice(0, 10).forEach(p => {
    console.log({
      invoice: p.sale.invoiceNumber,
      customer: p.sale.customer?.name || "Walk-in",
      creditAmount: Number(p.amount),
      totalAmount: Number(p.sale.totalAmount),
      paidAmount: Number(p.sale.paidAmount),
      balance: (Number(p.sale.totalAmount) - Number(p.sale.paidAmount)).toFixed(2)
    });
  });

  // 5. Check sales with multiple payments - these could be AR collections
  const salesWithMultiPayments = await prisma.sale.findMany({
    where: {
      businessId: 1,
      status: "completed",
      payments: { some: {} }
    },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      paidAmount: true,
      customer: { select: { name: true } },
      payments: {
        select: { id: true, amount: true, paymentMethod: true, paidAt: true },
        orderBy: { paidAt: "asc" }
      }
    },
    take: 200
  });

  const multiPaymentSales = salesWithMultiPayments.filter(s => s.payments.length > 1);
  console.log("\n=== Sales with Multiple Payments (Potential AR Collections) ===");
  console.log(`Found ${multiPaymentSales.length} sales with 2+ payments`);
  multiPaymentSales.slice(0, 10).forEach(s => {
    const firstPayment = s.payments[0];
    const subsequentPayments = s.payments.slice(1);
    console.log({
      invoice: s.invoiceNumber,
      customer: s.customer?.name || "Walk-in",
      paymentCount: s.payments.length,
      firstPaymentMethod: firstPayment?.paymentMethod,
      firstPaymentAmount: Number(firstPayment?.amount),
      arCollections: subsequentPayments.map(p => ({ method: p.paymentMethod, amount: Number(p.amount) }))
    });
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
