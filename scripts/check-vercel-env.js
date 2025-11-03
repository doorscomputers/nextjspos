#!/usr/bin/env node

/**
 * Verify Vercel environment variables are set correctly
 * Run: node scripts/check-vercel-env.js
 */

const { execSync } = require('child_process');

console.log('\n🔍 Checking Vercel Environment Variables...\n');

try {
  // Get environment variables from Vercel
  const output = execSync('vercel env ls production', { encoding: 'utf-8' });

  console.log('📋 Production Environment Variables:');
  console.log(output);

  // Required variables for NextAuth
  const required = [
    'NEXTAUTH_URL',
    'NEXTAUTH_SECRET',
    'DATABASE_URL'
  ];

  console.log('\n✅ Checking required variables...\n');

  required.forEach(varName => {
    if (output.includes(varName)) {
      console.log(`✅ ${varName} - Found`);
    } else {
      console.log(`❌ ${varName} - MISSING! This will cause login to fail!`);
    }
  });

  console.log('\n💡 If any variables are missing, add them with:');
  console.log('   vercel env add NEXTAUTH_URL production');
  console.log('   vercel env add NEXTAUTH_SECRET production');
  console.log('   vercel env add DATABASE_URL production');

} catch (error) {
  console.error('\n❌ Error checking Vercel env vars:', error.message);
  console.log('\n💡 Make sure you are logged in: vercel login');
}
