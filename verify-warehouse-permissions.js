const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
  const role = await prisma.role.findFirst({
    where: { name: 'Warehouse Manager' },
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  });

  console.log('Warehouse Manager role permissions:');
  console.log('Total:', role.permissions.length);

  const paymentPerms = role.permissions.filter(p => p.permission.name.includes('payment'));
  console.log('\nPayment-related permissions:');
  paymentPerms.forEach(p => console.log('  ✅', p.permission.name));

  const hasPaymentView = role.permissions.find(p => p.permission.name === 'payment.view');
  console.log('\nHas payment.view:', hasPaymentView ? 'YES ✅' : 'NO ❌');

  await prisma.$disconnect();
}

verify();
