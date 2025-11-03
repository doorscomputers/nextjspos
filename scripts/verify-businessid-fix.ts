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

async function verifyBusinessIdFix() {
  try {
    console.log('🔍 Verifying businessId type conversions...\n');

    const tsFiles = getAllTsFiles(apiDir);
    const problematicFiles: Array<{ file: string; lines: Array<{ lineNum: number; content: string }> }> = [];

    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const issues: Array<{ lineNum: number; content: string }> = [];

      lines.forEach((line, index) => {
        // Check if line contains session.user.businessId but NOT parseInt(session.user.businessId)
        if (
          line.includes('session.user.businessId') &&
          !line.includes('parseInt(session.user.businessId)') &&
          !line.includes('// ') && // Ignore comments
          !line.trim().startsWith('*') && // Ignore JSDoc comments
          !line.includes('session.user.businessId as number') // Ignore type assertions
        ) {
          issues.push({
            lineNum: index + 1,
            content: line.trim()
          });
        }
      });

      if (issues.length > 0) {
        problematicFiles.push({
          file: path.relative(apiDir, filePath),
          lines: issues
        });
      }
    }

    if (problematicFiles.length === 0) {
      console.log('✅ All files are correctly using parseInt(session.user.businessId)!\n');
      console.log('📊 Summary:');
      console.log(`   Total files scanned: ${tsFiles.length}`);
      console.log(`   Files with issues: 0`);
      console.log('\n💡 Safe to deploy to Vercel!');
    } else {
      console.log(`⚠️  Found ${problematicFiles.length} files that still need fixing:\n`);

      for (const file of problematicFiles) {
        console.log(`❌ ${file.file}`);
        for (const line of file.lines) {
          console.log(`   Line ${line.lineNum}: ${line.content}`);
        }
        console.log();
      }

      console.log('📊 Summary:');
      console.log(`   Total files scanned: ${tsFiles.length}`);
      console.log(`   Files with issues: ${problematicFiles.length}`);
      console.log(`   Total problematic lines: ${problematicFiles.reduce((sum, f) => sum + f.lines.length, 0)}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

verifyBusinessIdFix();
