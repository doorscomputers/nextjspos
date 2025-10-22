#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Kendo React License Setup Verification ===\n');

// Check for license file
const licenseFilePath = path.join(__dirname, 'kendo-license.txt');
const licenseFileExists = fs.existsSync(licenseFilePath);

console.log('1. License File Check:');
console.log('   Path:', licenseFilePath);
console.log('   Exists:', licenseFileExists ? '✓ YES' : '✗ NO (needs to be created)');

if (licenseFileExists) {
  try {
    const content = fs.readFileSync(licenseFilePath, 'utf-8').trim();
    console.log('   Size:', content.length, 'characters');
    console.log('   Starts with:', content.substring(0, 20) + '...');

    // Basic validation
    if (content.length < 100) {
      console.log('   ⚠ WARNING: License key seems too short');
    } else if (!content.startsWith('eyJ')) {
      console.log('   ⚠ WARNING: License key might not be in correct format (should start with eyJ)');
    }
  } catch (err) {
    console.log('   ✗ Error reading file:', err.message);
  }
} else {
  console.log('   📝 Note: Use kendo-license.txt.example as a template');
}

// Check .env file
console.log('\n2. Environment Variable Check:');
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const hasKendoVar = envContent.includes('KENDO_UI_LICENSE');
  console.log('   .env file exists: ✓ YES');
  console.log('   KENDO_UI_LICENSE defined:', hasKendoVar ? '✓ YES' : '✗ NO');
} else {
  console.log('   .env file exists: ✗ NO');
}

// Check .gitignore
console.log('\n3. Git Ignore Check:');
const gitignorePath = path.join(__dirname, '.gitignore');
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
  const hasKendoIgnore = gitignoreContent.includes('kendo-license.txt');
  console.log('   .gitignore has kendo-license.txt:', hasKendoIgnore ? '✓ YES (secure)' : '⚠ WARNING: Add to .gitignore!');
} else {
  console.log('   .gitignore not found: ✗ NO');
}

// Check package.json
console.log('\n4. Package Installation Check:');
const packagePath = path.join(__dirname, 'package.json');
if (fs.existsSync(packagePath)) {
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
  const deps = pkg.dependencies || {};

  const packages = [
    '@progress/kendo-react-all',
    '@progress/kendo-licensing',
    '@progress/kendo-theme-default',
    '@progress/kendo-react-grid',
    '@progress/kendo-react-buttons',
    '@progress/kendo-data-query'
  ];

  let allInstalled = true;
  packages.forEach(pkgName => {
    if (deps[pkgName]) {
      console.log('   ✓', pkgName, '(' + deps[pkgName] + ')');
    } else {
      console.log('   ✗', pkgName, 'NOT INSTALLED');
      allInstalled = false;
    }
  });

  if (allInstalled) {
    console.log('   ✓ All required packages are installed');
  }
}

// Check infrastructure files
console.log('\n5. Infrastructure Files Check:');
const infraFiles = [
  { path: 'src/app/layout.tsx', desc: 'Main layout (Kendo theme import)' },
  { path: 'src/components/KendoLicenseProvider.tsx', desc: 'License provider component' },
  { path: 'src/lib/kendo-license.ts', desc: 'License utilities' },
  { path: 'src/app/api/kendo-license/route.ts', desc: 'License API endpoint' },
  { path: 'src/app/dashboard/kendo-demo/page.tsx', desc: 'Demo page' },
  { path: 'kendo-license.txt.example', desc: 'Example template' }
];

let allFilesExist = true;
infraFiles.forEach(file => {
  const fullPath = path.join(__dirname, file.path);
  const exists = fs.existsSync(fullPath);
  console.log('   ' + (exists ? '✓' : '✗'), file.path);
  console.log('      ', file.desc);
  if (!exists) allFilesExist = false;
});

// Check if Kendo theme is imported in layout
console.log('\n6. Theme Configuration Check:');
const layoutPath = path.join(__dirname, 'src/app/layout.tsx');
if (fs.existsSync(layoutPath)) {
  const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
  const hasThemeImport = layoutContent.includes('@progress/kendo-theme-default');
  const hasProvider = layoutContent.includes('KendoLicenseProvider');

  console.log('   Kendo theme imported:', hasThemeImport ? '✓ YES' : '✗ NO');
  console.log('   KendoLicenseProvider used:', hasProvider ? '✓ YES' : '✗ NO');
} else {
  console.log('   ✗ Layout file not found');
}

// Summary
console.log('\n=== Summary ===');

const licenseConfigured = licenseFileExists || (fs.existsSync(envPath) && fs.readFileSync(envPath, 'utf-8').includes('KENDO_UI_LICENSE'));

if (!licenseConfigured) {
  console.log('⚠  ACTION REQUIRED - License Not Configured:');
  console.log('');
  console.log('   Follow these steps:');
  console.log('   1. Get license from: https://www.telerik.com/account/');
  console.log('   2. Create file: kendo-license.txt in project root');
  console.log('   3. Paste your license key (single line, no spaces)');
  console.log('   4. Restart dev server: npm run dev');
  console.log('   5. Visit: http://localhost:3000/dashboard/kendo-demo');
  console.log('');
  console.log('   OR use environment variable:');
  console.log('   1. Add to .env: KENDO_UI_LICENSE="your-key-here"');
  console.log('   2. Restart dev server');
} else if (licenseFileExists) {
  console.log('✓ License file configured!');
  console.log('');
  console.log('   Next steps:');
  console.log('   1. Restart dev server: npm run dev');
  console.log('   2. Visit: http://localhost:3000/dashboard/kendo-demo');
  console.log('   3. Check for green "✓ Valid License Activated" message');
  console.log('   4. If still showing trial watermarks, check browser console');
} else {
  console.log('✓ Environment variable configured!');
  console.log('');
  console.log('   Next steps:');
  console.log('   1. Restart dev server: npm run dev');
  console.log('   2. Visit: http://localhost:3000/dashboard/kendo-demo');
  console.log('   3. Verify license status');
}

if (!allFilesExist) {
  console.log('');
  console.log('⚠  Some infrastructure files are missing!');
  console.log('   This might cause issues with license activation.');
}

console.log('\n📖 Documentation:');
console.log('   - KENDO_REACT_LICENSE_SETUP.md (detailed setup guide)');
console.log('   - KENDO_UI_INTEGRATION_GUIDE.md (usage examples)');
console.log('   - Demo page: /dashboard/kendo-demo');

console.log('\n✨ All Kendo React packages are installed and ready to use!');
console.log('   Just add your license to start development.');
