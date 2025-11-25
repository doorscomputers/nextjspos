const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDamage() {
  console.log('🔍 Checking what was modified in the last hour...\n');

  // Check users modified recently
  const oneHourAgo = new Date(Date.now() - 3600000);

  const modifiedUsers = await prisma.user.findMany({
    where: {
      updatedAt: { gte: oneHourAgo }
    },
    select: {
      username: true,
      email: true,
      updatedAt: true
    }
  });

  console.log('📝 Recently Modified Users:');
  if (modifiedUsers.length === 0) {
    console.log('   None in the last hour');
  } else {
    modifiedUsers.forEach(u => {
      console.log(`   - ${u.username} (${u.email}) at ${u.updatedAt}`);
    });
  }

  // Check all users
  console.log('\n👥 All Users in Database:');
  const allUsers = await prisma.user.findMany({
    select: {
      username: true,
      email: true,
      allowLogin: true
    }
  });
  allUsers.forEach(u => {
    console.log(`   - ${u.username} (${u.email}) - Login: ${u.allowLogin ? 'YES' : 'NO'}`);
  });

  await prisma.$disconnect();
}

checkDamage().catch(console.error);
