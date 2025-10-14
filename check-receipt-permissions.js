const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReceiptPermissions() {
  try {
    console.log('Checking for receipt-related permissions...\n');

    const perms = await prisma.permission.findMany({
      where: {
        name: {
          contains: 'receipt'
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${perms.length} permissions with "receipt" in name:\n`);
    perms.forEach(p => {
      console.log(`  ${p.name} (ID: ${p.id})`);
    });

    console.log('\n\nChecking for purchase-related permissions:\n');

    const purchasePerms = await prisma.permission.findMany({
      where: {
        name: {
          startsWith: 'purchase'
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`Found ${purchasePerms.length} purchase permissions:\n`);
    purchasePerms.forEach(p => {
      console.log(`  ${p.name} (ID: ${p.id})`);
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkReceiptPermissions();
