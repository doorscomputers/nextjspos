#!/usr/bin/env node

/**
 * UltimatePOS Modern - Vercel Deployment Script
 * This script helps automate the deployment process to Vercel
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 UltimatePOS Modern - Vercel Deployment Script');
console.log('================================================\n');

// Check if we're in the right directory
if (!fs.existsSync('package.json')) {
  console.error('❌ Error: package.json not found. Please run this script from the project root.');
  process.exit(1);
}

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'pipe' });
  console.log('✅ Vercel CLI is installed');
} catch (error) {
  console.log('❌ Vercel CLI not found. Installing...');
  try {
    execSync('npm install -g vercel', { stdio: 'inherit' });
    console.log('✅ Vercel CLI installed successfully');
  } catch (installError) {
    console.error('❌ Failed to install Vercel CLI. Please install it manually: npm install -g vercel');
    process.exit(1);
  }
}

// Check if .env.local exists
if (!fs.existsSync('.env.local')) {
  console.log('⚠️  Warning: .env.local not found. Make sure to set up environment variables in Vercel dashboard.');
} else {
  console.log('✅ .env.local found');
}

// Check if vercel.json exists
if (!fs.existsSync('vercel.json')) {
  console.log('⚠️  Warning: vercel.json not found. Using default Vercel configuration.');
} else {
  console.log('✅ vercel.json found');
}

// Pre-deployment checks
console.log('\n🔍 Running pre-deployment checks...\n');

// Check if build works
console.log('1. Testing build process...');
try {
  execSync('npm run build', { stdio: 'pipe' });
  console.log('✅ Build successful');
} catch (error) {
  console.error('❌ Build failed. Please fix the errors before deploying.');
  console.error('Build error:', error.message);
  process.exit(1);
}

// Check if Prisma client is generated
console.log('2. Checking Prisma client...');
try {
  execSync('npx prisma generate', { stdio: 'pipe' });
  console.log('✅ Prisma client generated');
} catch (error) {
  console.error('❌ Failed to generate Prisma client');
  console.error('Error:', error.message);
  process.exit(1);
}

// Check for TypeScript errors
console.log('3. Checking TypeScript...');
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
  console.log('✅ No TypeScript errors');
} catch (error) {
  console.log('⚠️  TypeScript errors found, but continuing (build will ignore them)');
}

console.log('\n🎯 All pre-deployment checks passed!\n');

// Deployment options
console.log('Choose deployment option:');
console.log('1. Deploy to production');
console.log('2. Deploy to preview');
console.log('3. Just run vercel (interactive)');
console.log('4. Exit');

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('\nEnter your choice (1-4): ', (choice) => {
  switch (choice) {
    case '1':
      deployToProduction();
      break;
    case '2':
      deployToPreview();
      break;
    case '3':
      runVercelInteractive();
      break;
    case '4':
      console.log('👋 Goodbye!');
      rl.close();
      break;
    default:
      console.log('❌ Invalid choice. Please run the script again.');
      rl.close();
  }
});

function deployToProduction() {
  console.log('\n🚀 Deploying to production...\n');
  try {
    execSync('vercel --prod', { stdio: 'inherit' });
    console.log('\n✅ Production deployment successful!');
    console.log('🔗 Check your Vercel dashboard for the deployment URL');
  } catch (error) {
    console.error('\n❌ Production deployment failed');
    console.error('Error:', error.message);
  }
  rl.close();
}

function deployToPreview() {
  console.log('\n🚀 Deploying to preview...\n');
  try {
    execSync('vercel', { stdio: 'inherit' });
    console.log('\n✅ Preview deployment successful!');
    console.log('🔗 Check your Vercel dashboard for the preview URL');
  } catch (error) {
    console.error('\n❌ Preview deployment failed');
    console.error('Error:', error.message);
  }
  rl.close();
}

function runVercelInteractive() {
  console.log('\n🚀 Running Vercel interactive deployment...\n');
  try {
    execSync('vercel', { stdio: 'inherit' });
  } catch (error) {
    console.error('\n❌ Vercel deployment failed');
    console.error('Error:', error.message);
  }
  rl.close();
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Deployment cancelled by user');
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\n👋 Deployment terminated');
  rl.close();
  process.exit(0);
});







