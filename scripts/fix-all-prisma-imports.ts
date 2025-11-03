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

async function fixPrismaImports() {
  try {
    console.log('🔧 Fixing @/lib/prisma imports across all API routes...\n');

    const tsFiles = getAllTsFiles(srcDir);
    let totalFilesModified = 0;
    let totalReplacements = 0;

    // Pattern to match: from '@/lib/prisma' or from "@/lib/prisma"
    // BUT NOT '@/lib/prisma.simple' (which is correct)
    const prismaImportPattern = /from ['"]@\/lib\/prisma['"]/g;

    for (const filePath of tsFiles) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;

      // Skip if already using prisma.simple
      if (content.includes("from '@/lib/prisma.simple'") || content.includes('from "@/lib/prisma.simple"')) {
        continue;
      }

      // Check if file contains the incorrect import
      if (prismaImportPattern.test(content)) {
        // Reset regex index
        prismaImportPattern.lastIndex = 0;

        // Count occurrences
        const matches = content.match(prismaImportPattern);
        const occurrences = matches ? matches.length : 0;

        // Replace all occurrences
        content = content.replace(
          /from ['"]@\/lib\/prisma['"]/g,
          "from '@/lib/prisma.simple'"
        );

        // Write back to file
        fs.writeFileSync(filePath, content, 'utf-8');

        const relativePath = path.relative(srcDir, filePath);
        console.log(`   ✓ Fixed: ${relativePath} (${occurrences} import${occurrences > 1 ? 's' : ''})`);

        totalFilesModified++;
        totalReplacements += occurrences;
      }
    }

    console.log(`\n✅ Fixed incorrect @/lib/prisma imports\n`);
    console.log('📊 Summary:');
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files modified: ${totalFilesModified}`);
    console.log(`   Total imports fixed: ${totalReplacements}`);

    if (totalFilesModified === 0) {
      console.log(`\n✅ All files already use correct imports!`);
    } else {
      console.log(`\n⚠️  IMPORTANT: Run 'npm run build' to verify all fixes!`);
      console.log(`   Then commit and deploy to production.`);
      console.log(`\n💡 This should fix the 504 Gateway Timeout errors and improve dashboard load times.`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixPrismaImports();
