/**
 * Create Production Admin User
 *
 * This script creates a new admin user for production environment.
 * Demo accounts are excluded from export, so you need a real admin.
 *
 * Usage: node scripts/create-production-admin.mjs
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import readline from 'readline';

const prisma = new PrismaClient();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createProductionAdmin() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║   Production Admin User Creation                     ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  try {
    // Get all businesses
    const businesses = await prisma.business.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    if (businesses.length === 0) {
      console.error('❌ No businesses found! Import business data first.');
      process.exit(1);
    }

    // Display businesses
    console.log('Available Businesses:');
    businesses.forEach((biz, index) => {
      console.log(`  ${index + 1}. ${biz.name} (ID: ${biz.id})`);
    });
    console.log('');

    // Get business selection
    const bizIndexStr = await question(
      `Select business (1-${businesses.length}): `
    );
    const bizIndex = parseInt(bizIndexStr) - 1;

    if (bizIndex < 0 || bizIndex >= businesses.length) {
      console.error('❌ Invalid business selection');
      process.exit(1);
    }

    const selectedBusiness = businesses[bizIndex];
    console.log(`✓ Selected: ${selectedBusiness.name}\n`);

    // Get user details
    const username = await question('Enter username: ');
    if (!username || username.length < 3) {
      console.error('❌ Username must be at least 3 characters');
      process.exit(1);
    }

    // Check if username exists
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      console.error(`❌ Username "${username}" already exists!`);
      process.exit(1);
    }

    const email = await question('Enter email: ');
    const firstName = await question('Enter first name: ');
    const lastName = await question('Enter last name: ');

    // Get password (with confirmation)
    const password = await question('Enter password (min 8 characters): ');
    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    const passwordConfirm = await question('Confirm password: ');
    if (password !== passwordConfirm) {
      console.error('❌ Passwords do not match');
      process.exit(1);
    }

    // Hash password
    console.log('\n🔐 Hashing password...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    console.log('👤 Creating user...');
    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        email,
        firstName,
        lastName,
        businessId: selectedBusiness.id,
      },
    });

    console.log(`✓ User created with ID: ${newUser.id}`);

    // Find Super Admin role for this business
    const superAdminRole = await prisma.role.findFirst({
      where: {
        businessId: selectedBusiness.id,
        name: 'Super Admin',
      },
    });

    if (!superAdminRole) {
      console.warn(
        '⚠️  Super Admin role not found. Creating default roles...'
      );

      // Get all permissions
      const allPermissions = await prisma.permission.findMany();

      // Create Super Admin role
      const newSuperAdminRole = await prisma.role.create({
        data: {
          name: 'Super Admin',
          businessId: selectedBusiness.id,
          description:
            'Full system access with all permissions. Can manage users, roles, and system settings.',
        },
      });

      // Assign all permissions to Super Admin
      await prisma.rolePermission.createMany({
        data: allPermissions.map((perm) => ({
          roleId: newSuperAdminRole.id,
          permissionId: perm.id,
        })),
      });

      console.log('✓ Created Super Admin role with all permissions');

      // Assign role to user
      await prisma.userRole.create({
        data: {
          userId: newUser.id,
          roleId: newSuperAdminRole.id,
        },
      });

      console.log('✓ Assigned Super Admin role to user');
    } else {
      // Assign existing Super Admin role
      await prisma.userRole.create({
        data: {
          userId: newUser.id,
          roleId: superAdminRole.id,
        },
      });

      console.log('✓ Assigned Super Admin role to user');
    }

    // Summary
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   ✅ Production Admin Created Successfully!          ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    console.log('📋 User Details:');
    console.log(`   Username:     ${username}`);
    console.log(`   Email:        ${email}`);
    console.log(`   Name:         ${firstName} ${lastName}`);
    console.log(`   Business:     ${selectedBusiness.name}`);
    console.log(`   Role:         Super Admin`);
    console.log(`   User ID:      ${newUser.id}`);

    console.log('\n🔑 Login Credentials:');
    console.log(`   Username: ${username}`);
    console.log(`   Password: [the password you entered]`);

    console.log('\n⚠️  IMPORTANT:');
    console.log('   1. Save these credentials securely!');
    console.log('   2. Do NOT share the password');
    console.log('   3. Consider enabling 2FA in the future');
    console.log('   4. Change password after first login\n');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

createProductionAdmin();
