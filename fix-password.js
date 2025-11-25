const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixPassword() {
  console.log('🔧 Fixing superadmin password...');

  // Hash "password" the same way seed file does
  const hashedPassword = await bcrypt.hash('password', 10);

  // Update superadmin user
  const updated = await prisma.user.update({
    where: { username: 'superadmin' },
    data: { password: hashedPassword }
  });

  console.log('✅ Password updated for user:', updated.username);

  // Verify it works now
  const test = await bcrypt.compare('password', updated.password);
  console.log('✅ Password verification test:', test ? 'PASS' : 'FAIL');

  await prisma.$disconnect();
}

fixPassword().catch(console.error);
