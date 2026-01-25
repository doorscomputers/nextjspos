import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check product_update logs
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: 'product',
      action: 'product_update'
    },
    orderBy: { createdAt: 'desc' },
    take: 15
  });

  console.log('=== Product Update Audit Logs ===');
  console.log('Total:', logs.length);

  logs.forEach((log, i) => {
    console.log(`${i+1}. ${log.createdAt.toISOString().substring(0,10)} | ${log.username}`);
    console.log(`   ${(log.description || '').substring(0, 120)}`);
    if (log.metadata) {
      const meta = typeof log.metadata === 'string' ? JSON.parse(log.metadata) : log.metadata;
      if (meta.changes) console.log(`   Changes: ${JSON.stringify(meta.changes).substring(0, 150)}`);
    }
    console.log('');
  });

  await prisma.$disconnect();
}

main().catch(console.error);
