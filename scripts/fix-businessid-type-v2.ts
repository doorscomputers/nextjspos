import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');

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

async function fixBusinessIdTypes() {
  try {
    console.log('🔧 Fixing remaining businessId type conversions...\n');

    const tsFiles = getAllTsFiles(apiDir);
    let totalFilesModified = 0;
    let totalReplacements = 0;

    for (const filePath of tsFiles) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Normalize all variations to: parseInt(session.user.businessId)

      // Fix: parseInt(String(session.user.businessId)) → parseInt(session.user.businessId)
      content = content.replace(/parseInt\(String\(session\.user\.businessId\)\)/g, 'parseInt(session.user.businessId)');

      // Fix: Number(session.user.businessId) → parseInt(session.user.businessId)
      content = content.replace(/Number\(session\.user\.businessId\)/g, 'parseInt(session.user.businessId)');

      // Fix: parseInt(session.user.businessId as string) → parseInt(session.user.businessId)
      content = content.replace(/parseInt\(session\.user\.businessId as string\)/g, 'parseInt(session.user.businessId)');

      // Fix: parseInt(session.user.businessId.toString()) → parseInt(session.user.businessId)
      content = content.replace(/parseInt\(session\.user\.businessId\.toString\(\)\)/g, 'parseInt(session.user.businessId)');

      // Fix: parseInt(session.user.businessId?.toString() || '0') → parseInt(session.user.businessId)
      content = content.replace(/parseInt\(session\.user\.businessId\?\.toString\(\) \|\| '0'\)/g, 'parseInt(session.user.businessId)');

      // Fix: direct session.user.businessId in function calls
      content = content.replace(/initializeChartOfAccounts\(session\.user\.businessId\)/g, 'initializeChartOfAccounts(parseInt(session.user.businessId))');

      // Fix: session.user.businessId, in object literals (not already parseInt)
      // Look for patterns like: session.user.businessId, but not parseInt(session.user.businessId),
      content = content.replace(/([:\s])session\.user\.businessId,(?!\s*\/\/)/g, '$1parseInt(session.user.businessId),');

      // Fix: const businessIdRaw = session.user.businessId (assignment without parseInt)
      content = content.replace(/const\s+(\w+)\s*=\s*session\.user\.businessId(?!\))/g, 'const $1 = parseInt(session.user.businessId)');

      // Fix: comparison operators with raw businessId
      content = content.replace(/!==\s*session\.user\.businessId/g, '!== parseInt(session.user.businessId)');
      content = content.replace(/===\s*session\.user\.businessId/g, '=== parseInt(session.user.businessId)');

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        const relativePath = path.relative(apiDir, filePath);

        // Count replacements
        const linesDiff = originalContent.split('\n').length;
        const replacements = (originalContent.match(/session\.user\.businessId/g) || []).length -
                            (content.match(/session\.user\.businessId/g) || []).length;

        console.log(`   ✓ Fixed: ${relativePath}`);
        totalFilesModified++;
        totalReplacements += replacements;
      }
    }

    console.log(`\n✅ Fixed all remaining instances\n`);
    console.log('📊 Summary:');
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files modified: ${totalFilesModified}`);
    console.log(`   Patterns normalized: ${totalReplacements}`);
    console.log('\n💡 All businessId values now use: parseInt(session.user.businessId)');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixBusinessIdTypes();
