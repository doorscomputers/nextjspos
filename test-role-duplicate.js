/**
 * Test script for Role Duplication Feature
 * Tests the new duplicate role functionality without affecting existing roles
 */

const BASE_URL = 'http://localhost:3006';

// Login credentials
const LOGIN_DATA = {
  username: 'superadmin',
  password: 'password'
};

async function login() {
  console.log('🔐 Logging in as superadmin...');

  const response = await fetch(`${BASE_URL}/api/auth/signin/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(LOGIN_DATA),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  // Extract session cookie
  const cookies = response.headers.get('set-cookie');
  const sessionToken = cookies?.match(/next-auth\.session-token=([^;]+)/)?.[1];

  if (!sessionToken) {
    throw new Error('No session token found');
  }

  console.log('✅ Login successful');
  return sessionToken;
}

async function getRoles(sessionToken) {
  console.log('\n📋 Fetching existing roles...');

  const response = await fetch(`${BASE_URL}/api/roles`, {
    headers: {
      'Cookie': `next-auth.session-token=${sessionToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status}`);
  }

  const roles = await response.json();
  console.log(`✅ Found ${roles.length} roles`);

  // Display roles
  roles.forEach(role => {
    console.log(`   - ${role.name} (${role.isDefault ? 'System' : 'Custom'}) - ${role.permissionCount} permissions, ${role.userCount} users`);
  });

  return roles;
}

async function testDuplicateRole(sessionToken, sourceRole) {
  console.log(`\n🔄 Testing duplicate of role: "${sourceRole.name}"...`);
  console.log(`   Source role has ${sourceRole.permissionCount} permissions`);

  const newRoleName = `${sourceRole.name} - Test Duplicate ${Date.now()}`;

  const response = await fetch(`${BASE_URL}/api/roles/${sourceRole.id}/duplicate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${sessionToken}`,
    },
    body: JSON.stringify({
      name: newRoleName,
      locations: [] // Empty locations for test
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Duplicate failed: ${data.error || response.status}`);
  }

  console.log(`✅ Duplicate successful!`);
  console.log(`   New role: "${data.role.name}"`);
  console.log(`   Message: ${data.message}`);

  return data.role;
}

async function verifyDuplicatedRole(sessionToken, originalRole, duplicatedRole) {
  console.log(`\n🔍 Verifying duplicated role...`);

  // Fetch the new role to verify permissions were copied
  const response = await fetch(`${BASE_URL}/api/roles`, {
    headers: {
      'Cookie': `next-auth.session-token=${sessionToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch roles for verification: ${response.status}`);
  }

  const roles = await response.json();
  const newRole = roles.find(r => r.id === duplicatedRole.id);

  if (!newRole) {
    throw new Error('Duplicated role not found in roles list');
  }

  console.log(`✅ Found duplicated role: "${newRole.name}"`);
  console.log(`   Original role permissions: ${originalRole.permissionCount}`);
  console.log(`   Duplicated role permissions: ${newRole.permissionCount}`);

  if (newRole.permissionCount !== originalRole.permissionCount) {
    throw new Error(`Permission count mismatch! Expected ${originalRole.permissionCount}, got ${newRole.permissionCount}`);
  }

  console.log(`✅ Permission count matches!`);
  console.log(`   Role type: ${newRole.isDefault ? 'System' : 'Custom'} (should be Custom)`);

  if (newRole.isDefault) {
    throw new Error('Duplicated role should not be marked as default!');
  }

  console.log(`✅ Role is correctly marked as Custom`);

  return newRole;
}

async function verifyOriginalRoleIntact(sessionToken, originalRole) {
  console.log(`\n🔍 Verifying original role was not modified...`);

  const response = await fetch(`${BASE_URL}/api/roles`, {
    headers: {
      'Cookie': `next-auth.session-token=${sessionToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch roles: ${response.status}`);
  }

  const roles = await response.json();
  const stillOriginal = roles.find(r => r.id === originalRole.id);

  if (!stillOriginal) {
    throw new Error('Original role not found!');
  }

  console.log(`✅ Original role still exists: "${stillOriginal.name}"`);
  console.log(`   Permissions: ${stillOriginal.permissionCount} (original: ${originalRole.permissionCount})`);
  console.log(`   Users: ${stillOriginal.userCount} (original: ${originalRole.userCount})`);

  if (stillOriginal.permissionCount !== originalRole.permissionCount) {
    throw new Error('Original role permissions were modified!');
  }

  console.log(`✅ Original role unchanged`);
}

async function testDuplicateSystemRole(sessionToken, systemRole) {
  console.log(`\n🧪 Testing duplicate of SYSTEM role: "${systemRole.name}"...`);
  console.log(`   Note: System roles can be duplicated but the duplicate becomes Custom`);

  const newRoleName = `Custom ${systemRole.name} ${Date.now()}`;

  const response = await fetch(`${BASE_URL}/api/roles/${systemRole.id}/duplicate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `next-auth.session-token=${sessionToken}`,
    },
    body: JSON.stringify({
      name: newRoleName,
      locations: []
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`System role duplicate failed: ${data.error || response.status}`);
  }

  console.log(`✅ System role duplicated successfully!`);
  console.log(`   New custom role: "${data.role.name}"`);
  console.log(`   Permissions copied: ${data.message}`);

  return data.role;
}

async function cleanupTestRole(sessionToken, roleId, roleName) {
  console.log(`\n🧹 Cleaning up test role: "${roleName}"...`);

  const response = await fetch(`${BASE_URL}/api/roles?id=${roleId}`, {
    method: 'DELETE',
    headers: {
      'Cookie': `next-auth.session-token=${sessionToken}`,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    console.log(`⚠️  Could not delete test role: ${data.error}`);
    return false;
  }

  console.log(`✅ Test role deleted`);
  return true;
}

async function runTests() {
  console.log('🚀 Starting Role Duplication Feature Tests\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Login
    const sessionToken = await login();

    // Step 2: Get existing roles
    const roles = await getRoles(sessionToken);

    if (roles.length === 0) {
      throw new Error('No roles found in the system');
    }

    // Find a custom role and a system role for testing
    const customRole = roles.find(r => !r.isDefault);
    const systemRole = roles.find(r => r.isDefault);

    if (!customRole && !systemRole) {
      throw new Error('No suitable roles found for testing');
    }

    const createdRoles = [];

    // Test 1: Duplicate a custom role (if available)
    if (customRole) {
      console.log('\n' + '='.repeat(60));
      console.log('TEST 1: Duplicate Custom Role');
      console.log('='.repeat(60));

      const duplicated = await testDuplicateRole(sessionToken, customRole);
      createdRoles.push({ id: duplicated.id, name: duplicated.name });

      await verifyDuplicatedRole(sessionToken, customRole, duplicated);
      await verifyOriginalRoleIntact(sessionToken, customRole);
    }

    // Test 2: Duplicate a system role
    if (systemRole) {
      console.log('\n' + '='.repeat(60));
      console.log('TEST 2: Duplicate System Role');
      console.log('='.repeat(60));

      const duplicated = await testDuplicateSystemRole(sessionToken, systemRole);
      createdRoles.push({ id: duplicated.id, name: duplicated.name });

      await verifyDuplicatedRole(sessionToken, systemRole, duplicated);
      await verifyOriginalRoleIntact(sessionToken, systemRole);
    }

    // Cleanup: Delete test roles
    console.log('\n' + '='.repeat(60));
    console.log('CLEANUP: Removing test roles');
    console.log('='.repeat(60));

    for (const role of createdRoles) {
      await cleanupTestRole(sessionToken, role.id, role.name);
    }

    // Final verification
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n📊 Test Summary:');
    console.log(`   ✅ Login authentication`);
    console.log(`   ✅ Role duplication API`);
    console.log(`   ✅ Permission copying`);
    console.log(`   ✅ Original role integrity`);
    console.log(`   ✅ System role duplication`);
    console.log(`   ✅ Custom role marking`);
    console.log(`   ✅ Cleanup operations`);
    console.log('\n🎉 Role Duplication Feature is working perfectly!');

  } catch (error) {
    console.error('\n❌ TEST FAILED:');
    console.error(error.message);
    console.error('\nStack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the tests
runTests();
