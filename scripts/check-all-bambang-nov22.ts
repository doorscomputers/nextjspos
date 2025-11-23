import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function checkAllSales() {
  const bambang = await prisma.sale.findMany({
    where: { locationId: 3, saleDate: new Date('2025-11-22') },
    select: { id: true, invoiceNumber: true, saleType: true, status: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log(`\n📊 All sales at Bambang on Nov 22, 2025: ${bambang.length} total\n`);
  console.log('=' .repeat(80));

  bambang.forEach((s, idx) => {
    console.log(`\n${idx + 1}. Invoice: ${s.invoiceNumber}`);
    console.log(`   Type: ${s.saleType}`);
    console.log(`   Status: ${s.status}`);
    console.log(`   Created: ${s.createdAt.toISOString()}`);
  });

  console.log('\n' + '='.repeat(80));

  // Check sequence
  const bambangSeq = await prisma.invoiceSequence.findFirst({
    where: {
      locationId: 3,
      year: 2025,
      month: 11,
      day: 22
    }
  });

  console.log(`\n📈 Sequence Record:`);
  console.log(`   Current sequence value: ${bambangSeq?.sequence || 'N/A'}`);

  await prisma.$disconnect();
}

checkAllSales();
