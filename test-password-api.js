const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function testPasswordChange() {
  try {
    console.log('Testing password change for Jheirone user...\n');

    // Get the user
    const user = await prisma.user.findUnique({
      where: { username: 'Jheirone' },
      select: {
        id: true,
        username: true,
        password: true,
      },
    });

    if (!user) {
      console.log('❌ User "Jheirone" not found');
      return;
    }

    console.log(`✅ Found user: ${user.username} (ID: ${user.id})\n`);

    // Test passwords
    const testPasswords = ['111111', 'password', '123456', 'Password', 'PASSWORD'];

    console.log('Testing which password is correct...');
    for (const testPassword of testPasswords) {
      const isValid = await bcrypt.compare(testPassword, user.password);
      console.log(`  "${testPassword}": ${isValid ? '✅ CORRECT' : '❌ Wrong'}`);

      if (isValid) {
        console.log(`\n✅ Current password for Jheirone is: "${testPassword}"`);
        break;
      }
    }

    console.log('\nPassword hash in database:');
    console.log(user.password.substring(0, 50) + '...');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testPasswordChange();
