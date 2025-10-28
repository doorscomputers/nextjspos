#!/usr/bin/env node

/**
 * Safe Development Cleanup Utility
 *
 * USAGE:
 * node scripts/dev-cleanup.js          - Interactive cleanup
 * node scripts/dev-cleanup.js safe    - Safe cleanup only
 * node scripts/dev-cleanup.js full    - Full cleanup with confirmation
 * node scripts/dev-cleanup.js check   - Check environment status
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ANSI color codes for better UX
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkDirectoryExists(dir) {
  return fs.existsSync(dir);
}

function checkDirectorySize(dir) {
  try {
    const stats = fs.statSync(dir);
    if (stats.isDirectory()) {
      return getDirectorySize(dir);
    }
    return 0;
  } catch (error) {
    return 0;
  }
}

function getDirectorySize(dirPath) {
  let totalSize = 0;
  try {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      if (stats.isDirectory()) {
        totalSize += getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be accessed
  }
  return totalSize;
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function checkEnvironment() {
  log('\n🔍 Checking Development Environment', 'cyan');
  log('='.repeat(50), 'cyan');

  // Check .next directory
  const nextDir = path.join(process.cwd(), '.next');
  if (checkDirectoryExists(nextDir)) {
    const size = checkDirectorySize(nextDir);
    log(`📁 .next directory exists (${formatSize(size)})`, 'yellow');
  } else {
    log(`✅ No .next directory found`, 'green');
  }

  // Check node_modules/.cache
  const cacheDir = path.join(process.cwd(), 'node_modules', '.cache');
  if (checkDirectoryExists(cacheDir)) {
    const size = checkDirectorySize(cacheDir);
    log(`📁 node_modules/.cache exists (${formatSize(size)})`, 'yellow');
  } else {
    log(`✅ No cache directory found`, 'green');
  }

  // Check .env file
  const envFile = path.join(process.cwd(), '.env');
  if (checkDirectoryExists(envFile)) {
    log(`✅ .env file exists`, 'green');
  } else {
    log(`⚠️  .env file missing`, 'red');
  }

  // Check package.json
  const packageFile = path.join(process.cwd(), 'package.json');
  if (checkDirectoryExists(packageFile)) {
    log(`✅ package.json exists`, 'green');
  } else {
    log(`❌ package.json missing`, 'red');
  }

  log('='.repeat(50), 'cyan');
}

function safeCleanup() {
  log('\n🧹 Performing Safe Cleanup', 'green');
  log('='.repeat(50), 'green');

  try {
    // Use Next.js built-in clean command
    const { execSync } = require('child_process');
    log('🔧 Cleaning Next.js build cache...', 'yellow');
    try {
      execSync('npx next clean', { stdio: 'inherit', cwd: process.cwd() });
      log('✅ Next.js cache cleaned successfully', 'green');
    } catch (error) {
      log('⚠️  Next.js clean failed, trying manual cleanup...', 'yellow');
      // Manual cleanup as fallback
      const nextDir = path.join(process.cwd(), '.next');
      if (fs.existsSync(nextDir)) {
        fs.rmSync(nextDir, { recursive: true, force: true });
        log('✅ Manual .next cleanup successful', 'green');
      } else {
        log('✅ No .next directory to clean', 'green');
      }
    }

    // Clean npm cache
    log('🔧 Cleaning npm cache...', 'yellow');
    execSync('npm cache clean --force', { stdio: 'inherit' });
    log('✅ npm cache cleaned successfully', 'green');

  } catch (error) {
    log(`❌ Cleanup error: ${error.message}`, 'red');
  }

  log('='.repeat(50), 'green');
  log('✨ Safe cleanup completed!', 'green');
}

function fullCleanup() {
  log('\n🚨 FULL CLEANUP MODE', 'red');
  log('This will clean more aggressively. Make sure you have backups!', 'red');
  log('='.repeat(50), 'red');

  rl.question('Are you sure you want to proceed? (yes/no): ', (answer) => {
    if (answer.toLowerCase() === 'yes') {
      safeCleanup();
      log('\n🔄 Additional cleanup steps...', 'yellow');

      try {
        const { execSync } = require('child_process');

        // Clear any hanging node processes on port 3000
        log('🔧 Checking for processes on port 3000...', 'yellow');
        try {
          execSync('netstat -ano | findstr :3000', { stdio: 'pipe' });
          log('💡 Found processes on port 3000. You may need to manually stop them.', 'yellow');
          log('   Use: taskkill /PID [process_id] /F', 'yellow');
        } catch (error) {
          log('✅ No processes found on port 3000', 'green');
        }

      } catch (error) {
        log(`⚠️  Warning: ${error.message}`, 'yellow');
      }

      log('\n🎉 Full cleanup completed!', 'green');
      log('💡 Run: npm run dev to start fresh', 'cyan');
    } else {
      log('❌ Full cleanup cancelled', 'red');
    }
    rl.close();
  });
}

function interactiveMode() {
  log('\n🛠️  Development Cleanup Utility', 'cyan');
  log('Choose your cleanup level:', 'cyan');
  log('');
  log('1️⃣  Safe cleanup (recommended)', 'green');
  log('2️⃣  Full cleanup (aggressive)', 'yellow');
  log('3️⃣  Check environment status only', 'blue');
  log('4️⃣  Exit', 'red');
  log('');

  rl.question('Select an option (1-4): ', (answer) => {
    switch (answer.trim()) {
      case '1':
        safeCleanup();
        log('\n💡 Now run: npm run dev', 'cyan');
        rl.close();
        break;
      case '2':
        fullCleanup();
        break;
      case '3':
        checkEnvironment();
        rl.close();
        break;
      case '4':
        log('👋 Goodbye!', 'cyan');
        rl.close();
        break;
      default:
        log('❌ Invalid option. Please try again.', 'red');
        interactiveMode();
        break;
    }
  });
}

// Main execution
const command = process.argv[2];

switch (command) {
  case 'safe':
    checkEnvironment();
    safeCleanup();
    log('\n💡 Now run: npm run dev', 'cyan');
    break;
  case 'full':
    checkEnvironment();
    fullCleanup();
    break;
  case 'check':
    checkEnvironment();
    break;
  default:
    interactiveMode();
    break;
}