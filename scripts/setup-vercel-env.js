#!/usr/bin/env node

/**
 * UltimatePOS Modern - Vercel Environment Setup Script
 * This script helps set up environment variables for Vercel deployment
 */

const fs = require('fs');
const readline = require('readline');

console.log('🔧 UltimatePOS Modern - Vercel Environment Setup');
console.log('================================================\n');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Environment variables template
const envTemplate = {
  // Required variables
  DATABASE_URL: {
    description: 'PostgreSQL database connection string',
    example: 'postgresql://username:password@host:port/database',
    required: true
  },
  NEXTAUTH_URL: {
    description: 'Your Vercel app URL',
    example: 'https://your-app.vercel.app',
    required: true
  },
  NEXTAUTH_SECRET: {
    description: 'Random secret for NextAuth (generate with: openssl rand -base64 32)',
    example: 'your-secure-random-string',
    required: true
  },
  NEXT_PUBLIC_APP_NAME: {
    description: 'Application name',
    example: 'UltimatePOS Modern',
    required: true,
    default: 'UltimatePOS Modern'
  },
  NEXT_PUBLIC_APP_URL: {
    description: 'Public application URL',
    example: 'https://your-app.vercel.app',
    required: true
  },
  NODE_ENV: {
    description: 'Node environment',
    example: 'production',
    required: true,
    default: 'production'
  },
  SKIP_ENV_VALIDATION: {
    description: 'Skip environment validation during build',
    example: '1',
    required: true,
    default: '1'
  },
  
  // Optional variables
  EMAIL_SERVER_HOST: {
    description: 'SMTP server host (optional)',
    example: 'smtp.gmail.com',
    required: false
  },
  EMAIL_SERVER_PORT: {
    description: 'SMTP server port (optional)',
    example: '587',
    required: false
  },
  EMAIL_SERVER_USER: {
    description: 'SMTP username (optional)',
    example: 'your-email@gmail.com',
    required: false
  },
  EMAIL_SERVER_PASSWORD: {
    description: 'SMTP password (optional)',
    example: 'your-app-password',
    required: false
  },
  EMAIL_FROM: {
    description: 'From email address (optional)',
    example: 'noreply@yourdomain.com',
    required: false
  },
  OPENAI_API_KEY: {
    description: 'OpenAI API key (optional)',
    example: 'sk-...',
    required: false
  },
  TELEGRAM_BOT_TOKEN: {
    description: 'Telegram bot token (optional)',
    example: 'your-telegram-bot-token',
    required: false
  },
  TELEGRAM_CHAT_ID: {
    description: 'Telegram chat ID (optional)',
    example: 'your-telegram-chat-id',
    required: false
  },
  NEXT_PUBLIC_MAX_FILE_SIZE: {
    description: 'Maximum file upload size in bytes (optional)',
    example: '10485760',
    required: false,
    default: '10485760'
  }
};

async function setupEnvironment() {
  console.log('This script will help you set up environment variables for Vercel deployment.\n');
  console.log('You can either:');
  console.log('1. Generate a .env.local file for local testing');
  console.log('2. Generate a .env.production file with your values');
  console.log('3. Display the variables to copy to Vercel dashboard\n');

  const choice = await askQuestion('Choose an option (1-3): ');
  
  switch (choice) {
    case '1':
      await generateLocalEnv();
      break;
    case '2':
      await generateProductionEnv();
      break;
    case '3':
      displayVariables();
      break;
    default:
      console.log('❌ Invalid choice');
      rl.close();
      return;
  }
  
  rl.close();
}

async function generateLocalEnv() {
  console.log('\n🔧 Generating .env.local file...\n');
  
  const envContent = [];
  envContent.push('# Local Development Environment Variables');
  envContent.push('# Copy this file to .env.local and update the values\n');
  
  for (const [key, config] of Object.entries(envTemplate)) {
    if (config.required) {
      const value = await askQuestion(`${config.description} (${config.example}): `);
      envContent.push(`${key}="${value || config.default || ''}"`);
    } else {
      const value = await askQuestion(`${config.description} (${config.example}) [optional, press Enter to skip]: `);
      if (value) {
        envContent.push(`${key}="${value}"`);
      }
    }
  }
  
  fs.writeFileSync('.env.local', envContent.join('\n'));
  console.log('\n✅ .env.local file created successfully!');
  console.log('📝 Remember to update the values with your actual configuration.');
}

async function generateProductionEnv() {
  console.log('\n🔧 Generating .env.production file...\n');
  
  const envContent = [];
  envContent.push('# Production Environment Variables for Vercel');
  envContent.push('# Copy these to your Vercel environment variables\n');
  
  for (const [key, config] of Object.entries(envTemplate)) {
    if (config.required) {
      const value = await askQuestion(`${config.description} (${config.example}): `);
      envContent.push(`${key}="${value || config.default || ''}"`);
    } else {
      const value = await askQuestion(`${config.description} (${config.example}) [optional, press Enter to skip]: `);
      if (value) {
        envContent.push(`${key}="${value}"`);
      }
    }
  }
  
  fs.writeFileSync('.env.production', envContent.join('\n'));
  console.log('\n✅ .env.production file created successfully!');
  console.log('📝 Copy these variables to your Vercel dashboard:');
  console.log('   1. Go to your Vercel project dashboard');
  console.log('   2. Navigate to Settings → Environment Variables');
  console.log('   3. Add each variable from the .env.production file');
}

function displayVariables() {
  console.log('\n📋 Environment Variables for Vercel Dashboard:\n');
  console.log('Copy these to your Vercel project settings → Environment Variables:\n');
  
  for (const [key, config] of Object.entries(envTemplate)) {
    console.log(`${key}:`);
    console.log(`  Description: ${config.description}`);
    console.log(`  Example: ${config.example}`);
    if (config.default) {
      console.log(`  Default: ${config.default}`);
    }
    console.log(`  Required: ${config.required ? 'Yes' : 'No'}`);
    console.log('');
  }
  
  console.log('🔗 Vercel Dashboard: https://vercel.com/dashboard');
  console.log('📖 Guide: Check VERCEL_DEPLOYMENT_GUIDE.md for detailed instructions');
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n👋 Setup cancelled by user');
  rl.close();
  process.exit(0);
});

// Run the setup
setupEnvironment().catch(console.error);















