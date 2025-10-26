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

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${file}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let fileReplacements = 0;

  // CONSERVATIVE Pattern 1: Only replace $ in JSX when immediately followed by {number.toFixed} or {number.toLocaleString}
  // This ensures we only replace when there's clear number formatting
  content = content.replace(/>\$\{([^}]*\.(?:toFixed|toLocaleString)\([^)]*\))\}/g, (match, expression) => {
    fileReplacements++;
    return `>₱{${expression}}`;
  });

  // CONSERVATIVE Pattern 2: Template literals with $ ONLY when followed by currency formatting AND has currency context
  // Match: `Text with Total/Cost/Price/Amount: $${number.toFixed/toLocaleString}`
  content = content.replace(/`([^`]*(?:Total|Cost|Price|Amount|Balance|Payment|Subtotal)[^`]*?)\s*:\s*\$\$\{([^}]+\.(?:toFixed|toLocaleString)\([^)]*\))\}/gi, (match, prefix, expression) => {
    fileReplacements++;
    return `\`${prefix}: ₱\${${expression}}`;
  });

  // CONSERVATIVE Pattern 3: Simple >$</ or >$ </ in JSX (like in table cells showing just currency symbol)
  content = content.replace(/>\$<\//g, () => {
    fileReplacements++;
    return '>₱</';
  });

  content = content.replace(/>\$ <\//g, () => {
    fileReplacements++;
    return '>₱ </';
  });

  // CONSERVATIVE Pattern 4: String literals with just "$" (for labels/headers)
  content = content.replace(/(['"])(\s*)\$(\s*)\1/g, (match, quote, space1, space2) => {
    // Only replace standalone "$", not in URLs or other contexts
    if (!match.includes('/') && !match.includes('{')) {
      fileReplacements++;
      return `${quote}${space1}₱${space2}${quote}`;
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
console.log(`\nNOTE: This is a CONSERVATIVE replacement. Manual review may find additional currency symbols.`);
