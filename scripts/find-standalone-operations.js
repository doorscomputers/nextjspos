/**
 * Find all database write operations NOT wrapped in transactions
 * This identifies potential data integrity risks
 */

const fs = require('fs');
const path = require('path');

const results = {
  create: [],
  update: [],
  delete: [],
  createMany: [],
  updateMany: [],
  deleteMany: [],
  upsert: [],
  approve: [],
};

function searchDirectory(dir, baseDir = dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, .next, etc.
      if (!['node_modules', '.next', 'dist', 'build'].includes(file)) {
        searchDirectory(filePath, baseDir);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      analyzeFile(filePath, baseDir);
    }
  }
}

function analyzeFile(filePath, baseDir) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relativePath = path.relative(baseDir, filePath);

  // Split into lines for context
  const lines = content.split('\n');

  // Check if file uses transactions at all
  const hasTransaction = content.includes('$transaction');

  // Find all prisma operations
  const operations = [
    { name: 'create', pattern: /await\s+(?:tx\.)?prisma\.\w+\.create\s*\(/g },
    { name: 'update', pattern: /await\s+(?:tx\.)?prisma\.\w+\.update\s*\(/g },
    { name: 'delete', pattern: /await\s+(?:tx\.)?prisma\.\w+\.delete\s*\(/g },
    { name: 'createMany', pattern: /await\s+(?:tx\.)?prisma\.\w+\.createMany\s*\(/g },
    { name: 'updateMany', pattern: /await\s+(?:tx\.)?prisma\.\w+\.updateMany\s*\(/g },
    { name: 'deleteMany', pattern: /await\s+(?:tx\.)?prisma\.\w+\.deleteMany\s*\(/g },
    { name: 'upsert', pattern: /await\s+(?:tx\.)?prisma\.\w+\.upsert\s*\(/g },
  ];

  for (const op of operations) {
    let match;
    while ((match = op.pattern.exec(content)) !== null) {
      const matchText = match[0];
      const position = match.index;

      // Get line number
      const lineNumber = content.substring(0, position).split('\n').length;
      const line = lines[lineNumber - 1];

      // Check if it's using tx (inside transaction)
      const isInTransaction = matchText.includes('tx.prisma') || matchText.includes('tx.');

      // Check if inside transaction block by looking at context
      const beforeMatch = content.substring(Math.max(0, position - 500), position);
      const isInTransactionBlock = beforeMatch.includes('$transaction') && beforeMatch.includes('async (tx)');

      if (!isInTransaction && !isInTransactionBlock) {
        results[op.name].push({
          file: relativePath,
          line: lineNumber,
          code: line.trim(),
          operation: matchText,
        });
      }
    }
  }

  // Find approve operations
  if (content.includes('approve') && (content.includes('.update') || content.includes('.create'))) {
    const approvePattern = /async\s+function\s+\w*approve\w*|export\s+async\s+function\s+POST.*approve/gi;
    let match;
    while ((match = approvePattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const hasTransactionInFunction = content.substring(match.index, match.index + 2000).includes('$transaction');

      if (!hasTransactionInFunction) {
        results.approve.push({
          file: relativePath,
          line: lineNumber,
          code: lines[lineNumber - 1]?.trim() || '',
        });
      }
    }
  }
}

// Search src/app/api directory
const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');

console.log('🔍 Searching for standalone database operations...\n');
console.log(`📁 Directory: ${apiDir}\n`);

searchDirectory(apiDir);

// Print results
console.log('═══════════════════════════════════════════════════════════════');
console.log('📊 STANDALONE DATABASE OPERATIONS (NOT IN TRANSACTIONS)');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalStandalone = 0;

for (const [operation, items] of Object.entries(results)) {
  if (items.length > 0) {
    totalStandalone += items.length;
    console.log(`\n🔸 ${operation.toUpperCase()} Operations (${items.length}):`);
    console.log('─'.repeat(70));

    // Group by file
    const byFile = {};
    items.forEach(item => {
      if (!byFile[item.file]) byFile[item.file] = [];
      byFile[item.file].push(item);
    });

    for (const [file, operations] of Object.entries(byFile)) {
      console.log(`\n📄 ${file}`);
      operations.forEach(op => {
        console.log(`   Line ${op.line}: ${op.code.substring(0, 80)}${op.code.length > 80 ? '...' : ''}`);
      });
    }
  }
}

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log(`📈 TOTAL STANDALONE OPERATIONS: ${totalStandalone}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Categorize by risk level
console.log('\n🚨 RISK ASSESSMENT:');
console.log('─'.repeat(70));

const criticalFiles = [
  'sales', 'purchases', 'transfers', 'inventory-corrections',
  'customer-returns', 'supplier-returns', 'payments'
];

const criticalOps = [];
const mediumOps = [];
const lowOps = [];

for (const [operation, items] of Object.entries(results)) {
  items.forEach(item => {
    const isCritical = criticalFiles.some(keyword => item.file.includes(keyword));
    const isApprove = item.file.includes('approve') || operation === 'approve';

    if (isCritical || isApprove) {
      criticalOps.push({ ...item, operation });
    } else if (operation.includes('Many') || operation === 'delete') {
      mediumOps.push({ ...item, operation });
    } else {
      lowOps.push({ ...item, operation });
    }
  });
}

console.log(`\n🔴 CRITICAL (Inventory/Financial): ${criticalOps.length} operations`);
if (criticalOps.length > 0) {
  criticalOps.slice(0, 10).forEach(op => {
    console.log(`   ⚠️  ${op.file}:${op.line} - ${op.operation}`);
  });
  if (criticalOps.length > 10) {
    console.log(`   ... and ${criticalOps.length - 10} more`);
  }
}

console.log(`\n🟡 MEDIUM (Bulk/Delete ops): ${mediumOps.length} operations`);
if (mediumOps.length > 0) {
  mediumOps.slice(0, 5).forEach(op => {
    console.log(`   ⚠️  ${op.file}:${op.line} - ${op.operation}`);
  });
  if (mediumOps.length > 5) {
    console.log(`   ... and ${mediumOps.length - 5} more`);
  }
}

console.log(`\n🟢 LOW (Simple CRUD): ${lowOps.length} operations`);

console.log('\n\n💡 RECOMMENDATIONS:');
console.log('─'.repeat(70));
console.log('1. CRITICAL operations should be wrapped in transactions immediately');
console.log('2. MEDIUM operations should be reviewed case-by-case');
console.log('3. LOW operations are acceptable if they are single, independent updates');
console.log('\n');

// Export detailed JSON for further analysis
const reportPath = path.join(__dirname, '..', 'standalone-operations-report.json');
fs.writeFileSync(reportPath, JSON.stringify({
  timestamp: new Date().toISOString(),
  total: totalStandalone,
  critical: criticalOps,
  medium: mediumOps,
  low: lowOps,
  byOperation: results,
}, null, 2));

console.log(`📝 Detailed report saved to: standalone-operations-report.json\n`);
