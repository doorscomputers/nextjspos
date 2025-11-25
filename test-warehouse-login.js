const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function testLogin() {
  console.log('\n=== Testing Warehouse Manager Login ===\n');
  
  // Simulate login attempt WITHOUT locationId
  const username = 'warehousemanager';
  const password = 'password';
  const locationId = null; // NO RFID SCAN
  
  console.log('Username:', username);
  console.log('Password:', '***');
  console.log('Location ID:', locationId);
  console.log('');
  
  // Get user with roles
  const user = await prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      password: true,
      allowLogin: true,
      roles: {
        select: {
          role: {
            select: {
              name: true
            }
          }
        }
      }
    }
  });
  
  if (!user || !user.allowLogin) {
    console.log('❌ User not found or login not allowed');
    await prisma.$disconnect();
    return;
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    console.log('❌ Invalid password');
    await prisma.$disconnect();
    return;
  }
  
  console.log('✅ User found and password valid');
  console.log('');
  
  // Check role
  const roleNames = user.roles.map(r => r.role.name);
  console.log('User roles:', roleNames.join(', '));
  console.log('');
  
  // Check if admin role
  const isAdminRole = roleNames.some(role =>
    role === 'Super Admin' ||
    role === 'System Administrator' ||
    role === 'Admin' ||
    role === 'All Branch Admin' ||
    role === 'Cross Location Approver' ||
    role === 'Cross-Location Approver'
  );
  
  console.log('Is Admin Role:', isAdminRole);
  console.log('');
  
  // Check RFID requirement
  if (!isAdminRole && !locationId) {
    console.log('❌ BLOCKED - Location RFID scan required!');
    console.log('Error: Location verification required.');
    console.log('');
    console.log('✅ TEST PASSED - Warehouse Manager is correctly blocked without RFID');
  } else if (isAdminRole) {
    console.log('✅ Admin role detected - location scan not required');
  } else {
    console.log('✅ Location verified - login allowed');
  }
  
  await prisma.$disconnect();
}

testLogin().catch(console.error);
