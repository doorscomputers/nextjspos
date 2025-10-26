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

// Currency context keywords that strongly indicate money values
const CURRENCY_KEYWORDS = [
  'Total Cost', 'Total Price', 'Total Amount', 'Subtotal', 'Grand Total',
  'Unit Price', 'Selling Price', 'Cost Price', 'Purchase Price',
  'Amount', 'Payment', 'Balance', 'Due', 'Paid',
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

  // Pattern 1: Remove $ when ₱ already exists
  // ₱$ -> ₱
  const before1 = content;
  content = content.replace(/₱\s*\$/g, () => {
    fileReplacements++;
    return '₱';
  });

  // Pattern 2: Template literals with EXPLICIT currency context
  // Only replace if the prefix contains currency keywords
  CURRENCY_KEYWORDS.forEach(keyword => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\`([^>\`]*${escapedKeyword}[^>]*?)\\s*:\\s*\\$\\$\\{([^}]+)\\}`, 'gi');

    content = content.replace(pattern, (match, prefix, expression) => {
      fileReplacements++;
      return `\`${prefix}: ₱\${${expression}}`;
    });
  });

  // Pattern 3: JSX table cells/spans with currency keywords followed by ${
  // Example: <span>Total: ${value}</span> or <td>Price: ${value}</td>
  CURRENCY_KEYWORDS.forEach(keyword => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`>${escapedKeyword}\\s*:\\s*\\$\\{([^}]+)\\}<`, 'gi');

    content = content.replace(pattern, (match, expression) => {
      fileReplacements++;
      return `>${keyword}: ₱{${expression}}<`;
    });
  });

  //  Pattern 4: doc.text with Total Cost/Price/Amount (PDF exports)
  CURRENCY_KEYWORDS.forEach(keyword => {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`doc\\.text\\(\`([^>]*${escapedKeyword}[^>]*?):\\s*\\$\\$\\{`, 'gi');

    content = content.replace(pattern, (match, prefix) => {
      fileReplacements++;
      return `doc.text(\`${prefix}: ₱\${`;
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
console.log(`\nThis script ONLY replaced $ in clear currency contexts with explicit keywords.`);
console.log(`Manual review recommended for additional currency symbols.`);
