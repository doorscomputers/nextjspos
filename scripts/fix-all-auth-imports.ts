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

async function fixAuthImports() {
  try {
    console.log('🔧 Fixing @/lib/auth imports across all API routes...\n');

    const tsFiles = getAllTsFiles(srcDir);
    let totalFilesModified = 0;
    let totalReplacements = 0;

    // Pattern to match: from '@/lib/auth' or from "@/lib/auth"
    const authImportPattern = /from ['"]@\/lib\/auth['"]/g;

    for (const filePath of tsFiles) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Check if file contains the incorrect import
      if (authImportPattern.test(content)) {
        // Reset regex index
        authImportPattern.lastIndex = 0;

        // Count occurrences
        const matches = content.match(authImportPattern);
        const occurrences = matches ? matches.length : 0;

        // Replace all occurrences
        content = content.replace(
          /from ['"]@\/lib\/auth['"]/g,
          "from '@/lib/auth.simple'"
        );

        // Write back to file
        fs.writeFileSync(filePath, content, 'utf-8');

        const relativePath = path.relative(srcDir, filePath);
        console.log(`   ✓ Fixed: ${relativePath} (${occurrences} import${occurrences > 1 ? 's' : ''})`);

        totalFilesModified++;
        totalReplacements += occurrences;
      }
    }

    console.log(`\n✅ Fixed incorrect @/lib/auth imports\n`);
    console.log('📊 Summary:');
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files modified: ${totalFilesModified}`);
    console.log(`   Total imports fixed: ${totalReplacements}`);

    if (totalFilesModified === 0) {
      console.log(`\n✅ All files already use correct imports!`);
    } else {
      console.log(`\n⚠️  IMPORTANT: Run 'npm run build' to verify all fixes!`);
      console.log(`   Then commit and deploy to production.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixAuthImports();
