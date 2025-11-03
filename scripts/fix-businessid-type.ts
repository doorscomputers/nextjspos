import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDir = path.join(__dirname, '..', 'src', 'app', 'api');

// Patterns to fix
const patterns = [
  {
    // Pattern 1: const businessId = session.user.businessId
    search: /const\s+businessId\s*=\s*session\.user\.businessId(?!\))/g,
    replace: 'const businessId = parseInt(session.user.businessId)',
    description: 'const businessId = session.user.businessId → parseInt()'
  },
  {
    // Pattern 2: const { businessId } = session.user
    search: /const\s*{\s*businessId\s*}\s*=\s*session\.user/g,
    replace: 'const businessId = parseInt(session.user.businessId)',
    description: 'const { businessId } = session.user → const businessId = parseInt()'
  },
  {
    // Pattern 3: businessId: session.user.businessId in object literals
    search: /businessId:\s*session\.user\.businessId(?!\))/g,
    replace: 'businessId: parseInt(session.user.businessId)',
    description: 'businessId: session.user.businessId → parseInt()'
  },
  {
    // Pattern 4: where: { businessId: session.user.businessId }
    search: /where:\s*{\s*businessId:\s*session\.user\.businessId(?!\))/g,
    replace: 'where: { businessId: parseInt(session.user.businessId)',
    description: 'where: { businessId: session.user.businessId } → parseInt()'
  }
];

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
    console.log('🔧 Fixing businessId type conversions across all API routes...\n');

    const tsFiles = getAllTsFiles(apiDir);
    console.log(`📂 Found ${tsFiles.length} TypeScript files in ${apiDir}\n`);

    let totalFilesModified = 0;
    let totalReplacements = 0;

    for (const filePath of tsFiles) {
      let content = fs.readFileSync(filePath, 'utf-8');
      let fileModified = false;
      let fileReplacements = 0;

      for (const pattern of patterns) {
        const matches = content.match(pattern.search);
        if (matches && matches.length > 0) {
          content = content.replace(pattern.search, pattern.replace);
          fileModified = true;
          fileReplacements += matches.length;
          totalReplacements += matches.length;
        }
      }

      if (fileModified) {
        fs.writeFileSync(filePath, content, 'utf-8');
        const relativePath = path.relative(apiDir, filePath);
        console.log(`   ✓ Fixed: ${relativePath} (${fileReplacements} replacements)`);
        totalFilesModified++;
      }
    }

    console.log(`\n✅ Fixed ${totalReplacements} instances across ${totalFilesModified} files\n`);
    console.log('📊 Summary:');
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files modified: ${totalFilesModified}`);
    console.log(`   Total replacements: ${totalReplacements}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Test Import Branch Stock locally');
    console.log('   2. Deploy to Vercel if tests pass');
    console.log('   3. Test on production');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixBusinessIdTypes();
