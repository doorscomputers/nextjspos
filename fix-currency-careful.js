const fs = require('fs');
const path = require('path');

// Function to recursively find all .tsx files in dashboard
function findTsxFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat && stat.isDirectory()) {
      results = results.concat(findTsxFiles(filePath));
    } else if (file.endsWith('.tsx')) {
      // Convert to relative path from project root
      const relativePath = filePath.replace(__dirname + path.sep, '').replace(/\\/g, '/');
      results.push(relativePath);
    }
  });

  return results;
}

// Get all .tsx files in dashboard
const dashboardDir = path.join(__dirname, 'src', 'app', 'dashboard');
const files = findTsxFiles(dashboardDir);

let totalReplacements = 0;
let fileCount = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileReplacements = 0;

  // Pattern 1: Template literals with $ for currency display
  // Match: `$${variable}` or `text $${variable}`
  // Capture the full expression to check context
  const pattern1 = /`([^`]*)\$\$\{([^}]+)\}/g;
  content = content.replace(pattern1, (match, prefix, expression) => {
    // Only replace if the expression contains currency-related methods or variables
    const isCurrency =
      expression.includes('toFixed') ||
      expression.includes('toLocaleString') ||
      expression.toLowerCase().includes('price') ||
      expression.toLowerCase().includes('cost') ||
      expression.toLowerCase().includes('amount') ||
      expression.toLowerCase().includes('total') ||
      expression.toLowerCase().includes('balance') ||
      expression.toLowerCase().includes('payment') ||
      prefix.toLowerCase().includes('cost') ||
      prefix.toLowerCase().includes('price') ||
      prefix.toLowerCase().includes('total') ||
      prefix.toLowerCase().includes('amount') ||
      prefix.toLowerCase().includes('balance');

    if (isCurrency) {
      fileReplacements++;
      return `\`${prefix}₱\${${expression}}`;
    }
    return match;
  });

  // Pattern 2: JSX currency display: >${ or >${
  // This is tricky - we want to replace $ before {variable} in JSX
  // Match: >${ where it's clearly currency display
  const pattern2 = />(\s*)\$(\s*)\{([^}]+)\}/g;
  content = content.replace(pattern2, (match, space1, space2, variable) => {
    // Check if variable looks like currency (has toFixed, toLocaleString, price, cost, amount, etc.)
    if (
      variable.includes('toFixed') ||
      variable.includes('toLocaleString') ||
      variable.toLowerCase().includes('price') ||
      variable.toLowerCase().includes('cost') ||
      variable.toLowerCase().includes('amount') ||
      variable.toLowerCase().includes('total') ||
      variable.toLowerCase().includes('value')
    ) {
      fileReplacements++;
      return `>${space1}₱${space2}{${variable}}`;
    }
    return match;
  });

  // Pattern 3: Simple >$ text< or >$</ patterns in JSX
  content = content.replace(/>\$</g, () => {
    fileReplacements++;
    return '>₱<';
  });

  content = content.replace(/>\$ </g, () => {
    fileReplacements++;
    return '>₱ <';
  });

  // Pattern 4: String literals with "$" for currency
  content = content.replace(/"(\s*)\$(\s*)"/g, (match, space1, space2) => {
    fileReplacements++;
    return `"${space1}₱${space2}"`;
  });

  content = content.replace(/'(\s*)\$(\s*)'/g, (match, space1, space2) => {
    fileReplacements++;
    return `'${space1}₱${space2}'`;
  });

  // Pattern 5: JSX text content with $ before {variable}
  // Match patterns like: >text ${ or >text $ {
  content = content.replace(/>([^<]*[^\s])\s*\$\s*\{([^}]+)\}/g, (match, prefix, variable) => {
    // Check if variable looks like currency
    const isCurrency =
      variable.includes('toFixed') ||
      variable.includes('toLocaleString') ||
      variable.toLowerCase().includes('price') ||
      variable.toLowerCase().includes('cost') ||
      variable.toLowerCase().includes('amount') ||
      variable.toLowerCase().includes('total') ||
      prefix.toLowerCase().includes('total') ||
      prefix.toLowerCase().includes('subtotal') ||
      prefix === '×' || prefix === 'x' || prefix === '*';

    if (isCurrency) {
      fileReplacements++;
      return `>${prefix} ₱{${variable}}`;
    }
    return match;
  });

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${file}: ${fileReplacements} replacements`);
    totalReplacements += fileReplacements;
    fileCount++;
  } else {
    console.log(`⏭️  ${file}: No changes needed`);
  }
});

console.log(`\n🎉 Completed! ${totalReplacements} replacements in ${fileCount} files.`);
