import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, '..', 'src', 'app', 'api');

function getAllTsFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.ts')) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

async function fixBusinessIdTypeConversion() {
  try {
    console.log('🔧 Fixing businessId type conversions across all API routes...\n');

    const tsFiles = getAllTsFiles(srcDir);
    let totalFilesModified = 0;
    let totalReplacements = 0;

    // Pattern to match: const businessId = user.businessId (without parseInt)
    const businessIdPattern = /const businessId = user\.businessId(?!\s*\))/g;

    for (const filePath of tsFiles) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Skip if already properly converted
      if (content.includes('const businessId = parseInt(String(user.businessId))')) {
        continue;
      }

      // Check if file contains the incorrect pattern
      if (businessIdPattern.test(content)) {
        // Reset regex index
        businessIdPattern.lastIndex = 0;

        // Count occurrences
        const matches = content.match(businessIdPattern);
        const occurrences = matches ? matches.length : 0;

        // Replace all occurrences - need to handle line breaks properly
        content = content.replace(
          /const businessId = user\.businessId\s*$/gm,
          'const businessId = parseInt(String(user.businessId))'
        );

        // Also handle inline cases (not at end of line)
        content = content.replace(
          /const businessId = user\.businessId([;\n])/g,
          'const businessId = parseInt(String(user.businessId))$1'
        );

        // Write back to file
        fs.writeFileSync(filePath, content, 'utf-8');

        const relativePath = path.relative(srcDir, filePath);
        console.log(`   ✓ Fixed: ${relativePath} (${occurrences} conversion${occurrences > 1 ? 's' : ''})`);

        totalFilesModified++;
        totalReplacements += occurrences;
      }
    }

    console.log(`\n✅ Fixed businessId type conversions\n`);
    console.log('📊 Summary:');
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files modified: ${totalFilesModified}`);
    console.log(`   Total conversions fixed: ${totalReplacements}`);

    if (totalFilesModified === 0) {
      console.log(`\n✅ All files already use correct businessId type conversion!`);
    } else {
      console.log(`\n⚠️  IMPORTANT: Run 'npm run build' to verify all fixes!`);
      console.log(`   Then commit and deploy to production.`);
      console.log(`\n💡 This fixes Prisma type validation errors where businessId was passed as string instead of integer.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixBusinessIdTypeConversion();
