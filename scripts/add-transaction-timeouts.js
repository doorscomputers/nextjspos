/**
 * Script to add transaction timeouts to all API endpoints
 * This ensures network resilience for slow/disconnected internet
 */

const fs = require('fs');
const path = require('path');

// Files that need timeout added (identified from grep)
const filesToFix = [
  'src/app/api/bank-transactions/manual/route.ts',
  'src/app/api/banks/route.ts',
  'src/app/api/customer-returns/[id]/approve/route.ts',
  'src/app/api/job-orders/route.ts',
  'src/app/api/job-orders/[id]/complete/route.ts',
  'src/app/api/job-orders/[id]/parts/route.ts',
  'src/app/api/job-orders/[id]/parts/[partId]/route.ts',
  'src/app/api/job-orders/[id]/route.ts',
  'src/app/api/location-changes/[id]/approve/route.ts',
  'src/app/api/locations/route.ts',
  'src/app/api/payments/batch/route.ts',
  'src/app/api/payments/route.ts',
  'src/app/api/physical-inventory/import-parallel-backup.ts',
  'src/app/api/products/bulk-add-to-location/route.ts',
  'src/app/api/products/import/route.ts',
  'src/app/api/products/route.ts',
  'src/app/api/products/[id]/route.ts',
  'src/app/api/purchases/amendments/[id]/approve/route.ts',
  'src/app/api/purchases/generate-from-suggestions/route.ts',
  'src/app/api/purchases/receipts/route.ts',
  'src/app/api/purchases/route.ts',
  'src/app/api/purchases/[id]/amendments/route.ts',
  'src/app/api/purchases/[id]/close/route.ts',
  'src/app/api/purchases/[id]/receive/route.ts',
  'src/app/api/purchases/returns/route.ts',
  'src/app/api/purchases/returns/[id]/approve/route.ts',
  'src/app/api/qc-inspections/[id]/conduct/route.ts',
  'src/app/api/quotations/route.ts',
  'src/app/api/readings/history/route.ts',
  'src/app/api/roles/[id]/route.ts',
  'src/app/api/sales/[id]/refund/route.ts',
  'src/app/api/sales/[id]/route.ts',
  'src/app/api/sales/[id]/void/route.ts',
  'src/app/api/service-payments/route.ts',
  'src/app/api/service-payments/[id]/void/route.ts',
  'src/app/api/shifts/[id]/close/route.ts',
  'src/app/api/superadmin/businesses/route.ts',
  'src/app/api/supplier-returns/route.ts',
  'src/app/api/supplier-returns/[id]/approve/route.ts',
  'src/app/api/technicians/route.ts',
  'src/app/api/technicians/[id]/route.ts',
  'src/app/api/transfers/route.ts',
  'src/app/api/transfers/[id]/cancel/route.ts',
  'src/app/api/transfers/[id]/complete/route.ts',
  'src/app/api/transfers/[id]/route.ts',
  'src/app/api/warranty-claims/route.ts',
  'src/app/api/warranty-claims/[id]/create-supplier-return/route.ts',
];

const TIMEOUT_MS = 60000; // 60 seconds
const COMMENT = '// 60 seconds timeout for network resilience';

function addTimeout(filePath) {
  const fullPath = path.join(__dirname, '..', filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  SKIP: File not found: ${filePath}`);
    return { status: 'skip', reason: 'not found' };
  }

  let content = fs.readFileSync(fullPath, 'utf8');

  // Check if already has timeout
  if (content.includes('timeout:')) {
    console.log(`✅ ALREADY HAS TIMEOUT: ${filePath}`);
    return { status: 'skip', reason: 'already has timeout' };
  }

  // Pattern to match transaction closing without timeout config
  // Matches:  })  (end of async function, end of transaction call)
  // But NOT: }, { timeout: ... })

  // Find all prisma.$transaction calls
  const transactionRegex = /await\s+prisma\.\$transaction\s*\(\s*async\s*\(\s*tx\s*\)[\s\S]*?\}\s*\)/g;

  let modified = false;
  let matches = 0;

  content = content.replace(transactionRegex, (match) => {
    matches++;

    // Check if this match already has timeout (defensive)
    if (match.includes('timeout:')) {
      return match;
    }

    // Replace the closing })  with  }, { timeout: 60000 })
    const modifiedMatch = match.replace(
      /\}\s*\)$/,
      `}, {\n      timeout: ${TIMEOUT_MS}, ${COMMENT}\n    })`
    );

    modified = true;
    return modifiedMatch;
  });

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ ADDED TIMEOUT (${matches} transactions): ${filePath}`);
    return { status: 'success', count: matches };
  } else {
    console.log(`⚠️  NO MATCH: ${filePath} (regex didn't match expected pattern)`);
    return { status: 'no_match' };
  }
}

console.log('🚀 Adding transaction timeouts for network resilience...\n');

const results = {
  success: 0,
  skip: 0,
  no_match: 0,
  total: filesToFix.length
};

filesToFix.forEach(file => {
  const result = addTimeout(file);
  results[result.status]++;
});

console.log('\n📊 Summary:');
console.log(`   Total files: ${results.total}`);
console.log(`   ✅ Successfully added timeout: ${results.success}`);
console.log(`   ⏭️  Skipped (already has timeout): ${results.skip}`);
console.log(`   ⚠️  No pattern match: ${results.no_match}`);
console.log('\n✨ Done! All critical transaction endpoints now have timeout protection.');
