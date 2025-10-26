const fs = require('fs');
const path = require('path');

function findTsxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(findTsxFiles(filePath));
    } else if (file.endsWith('.tsx')) {
      const relativePath = filePath.replace(__dirname + path.sep, '').replace(/\\/g, '/');
      results.push(relativePath);
    }
  });

  return results;
}

const dashboardDir = path.join(__dirname, 'src', 'app', 'dashboard');
const files = findTsxFiles(dashboardDir);

let totalReplacements = 0;
let fileCount = 0;

// Currency context keywords (explicit keywords that indicate money)
const CURRENCY_KEYWORDS = [
  'Total Cost', 'Total Price', 'Total Amount', 'Total',
  'Subtotal', 'Grand Total',
  'Cost', 'Price', 'Amount', 'Unit Price', 'Selling Price',
  'Payment', 'Balance', 'Due', 'Paid',
  'Revenue', 'Sales', 'Income', 'Expense', 'Profit', 'Loss'
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileReplacements = 0;

  // Pattern 1: Template literals with currency keywords: `Total Cost: $${expr}` -> `Total Cost: ₱${expr}`
  // Only match when $ is NOT preceded by ₱
  CURRENCY_KEYWORDS.forEach(keyword => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match: `...keyword: $${expr}` but NOT `...keyword: ₱$${expr}`
    const pattern = new RegExp(`\`([^>\`]*${escapedKeyword}[^>]*?)\\s*:\\s*(?<!₱)\\$\\$\\{([^}]+)\\}`, 'gi');

    content = content.replace(pattern, (match, prefix, expression) => {
      fileReplacements++;
      return `\`${prefix}: ₱\${${expression}}`;
    });
  });

  // Pattern 2: doc.text with currency keywords (PDF exports)
  CURRENCY_KEYWORDS.forEach(keyword => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(doc\\.text\\(\`[^>\`]*${escapedKeyword}[^>]*?):\\s*(?<!₱)\\$\\$\\{`, 'gi');

    content = content.replace(pattern, (match, prefix) => {
      fileReplacements++;
      return `${prefix}: ₱\${`;
    });
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}: ${fileReplacements} replacements`);
    totalReplacements += fileReplacements;
    fileCount++;
  }
});

console.log(`\n🎉 Completed! ${totalReplacements} replacements in ${fileCount} files.`);
console.log(`\nThis script ONLY replaced $ with ₱ in clear currency contexts.`);
console.log(`Files that already have ₱ were left unchanged.`);
console.log(`\nNOTE: This is conservative. Many $ symbols may remain that require manual review.`);
