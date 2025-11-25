const bcrypt = require('bcryptjs');

// Hash "password" the same way the seed file does
const hashedPassword = bcrypt.hashSync('password', 10);
console.log('Generated hash:', hashedPassword);

// Test comparison
const testResult = bcrypt.compareSync('password', hashedPassword);
console.log('Test comparison result:', testResult);

// Try comparing with a hash we know exists in DB
// We'll need to query the actual hash from the database
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPassword() {
  const user = await prisma.user.findUnique({
    where: { username: 'superadmin' },
    select: { password: true, allowLogin: true }
  });

  if (!user) {
    console.log('❌ User not found');
    return;
  }

  console.log('User found:', {
    allowLogin: user.allowLogin,
    passwordHash: user.password.substring(0, 20) + '...'
  });

  const isValid = await bcrypt.compare('password', user.password);
  console.log('Password comparison result:', isValid);

  await prisma.$disconnect();
}

checkPassword();
