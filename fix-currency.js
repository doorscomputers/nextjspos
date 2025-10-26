const fs = require('fs');
const path = require('path');

// List of files to fix (from grep results)
const files = [
  'src/app/dashboard/reports/purchase-trends/page.tsx',
  'src/app/dashboard/accounting/income-statement/page.tsx',
  'src/app/dashboard/dashboard-v2/page.tsx',
  'src/app/dashboard/users/page.tsx',
  'src/app/dashboard/reports/purchases/trend-analysis/page.tsx',
  'src/app/dashboard/reports/purchases/supplier-performance/page.tsx',
  'src/app/dashboard/reports/purchases/item-summary/page.tsx',
  'src/app/dashboard/reports/products-suppliers/page.tsx',
  'src/app/dashboard/reports/attendance/page.tsx',
  'src/app/dashboard/transfers/[id]/page.tsx',
  'src/app/dashboard/pos/page.tsx',
  'src/app/dashboard/purchases/[id]/page.tsx',
  'src/app/dashboard/reports/unpaid-invoices/page.tsx',
  'src/app/dashboard/sales/[id]/payment/page.tsx',
  'src/app/dashboard/shifts/close/page.tsx',
  'src/app/dashboard/shifts/begin/page.tsx',
  'src/app/dashboard/reports/customer-payments/page.tsx',
  'src/app/dashboard/reports/void-refund-analysis/page.tsx',
  'src/app/dashboard/reports/sales-by-hour/page.tsx',
  'src/app/dashboard/reports/discount-analysis/page.tsx',
  'src/app/dashboard/reports/cash-in-out/page.tsx',
  'src/app/dashboard/sales/page.tsx',
  'src/app/dashboard/attendance/page.tsx',
  'src/app/dashboard/attendance/[id]/page.tsx',
  'src/app/dashboard/transfers/[id]/ExportTransfers/page.tsx',
  'src/app/dashboard/analytics-devextreme/page.tsx',
  'src/app/dashboard/sales/create/page.tsx',
  'src/app/dashboard/post-dated-cheques/page.tsx',
  'src/app/dashboard/payments/page.tsx',
  'src/app/dashboard/customer-returns/page.tsx',
  'src/app/dashboard/accounts-payable/page.tsx',
  'src/app/dashboard/reports/sales-per-item/page.tsx',
  'src/app/dashboard/reports/sales-per-cashier/page.tsx',
  'src/app/dashboard/reports/sales-journal/page.tsx',
  'src/app/dashboard/reports/profitability/page.tsx',
  'src/app/dashboard/reports/profit/page.tsx',
  'src/app/dashboard/reports/purchases/analytics/page.tsx',
  'src/app/dashboard/reports/purchases/cost-trend/page.tsx',
  'src/app/dashboard/reports/purchases/budget-vs-actual/page.tsx',
  'src/app/dashboard/purchases/create/page-old.tsx',
  'src/app/dashboard/customer-returns/[id]/page.tsx',
  'src/app/dashboard/labels/generate/page.tsx'
];

let totalReplacements = 0;
let filesModified = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Replace all dollar signs in currency contexts with Philippine Peso
    // Pattern 1: ${variable} in template literals
    content = content.replace(/\$\{/g, '₱{');

    // Pattern 2: "$" + variable or '$' + variable
    content = content.replace(/"?\$"?\s*\+/g, '"₱" +');
    content = content.replace(/'?\$'?\s*\+/g, "'₱' +");

    // Pattern 3: Backticks with $$ in formatters
    content = content.replace(/`\$\$/g, '`₱');

    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      const replacements = (originalContent.match(/\$/g) || []).length - (content.match(/\$/g) || []).length;
      console.log(`✅ ${file} - ${replacements} replacements`);
      totalReplacements += replacements;
      filesModified++;
    } else {
      console.log(`⏭️  ${file} - No $ signs found`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Files modified: ${filesModified}/$ {files.length}`);
console.log(`   Total $ → ₱ replacements: ${totalReplacements}`);
console.log(`\n✅ Currency conversion complete!`);
