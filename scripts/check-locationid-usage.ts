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

interface LocationIdUsage {
  file: string;
  lines: Array<{
    lineNum: number;
    content: string;
    type: 'session' | 'body' | 'params' | 'other';
    hasParseInt: boolean;
  }>;
}

async function checkLocationIdUsage() {
  try {
    console.log('🔍 Analyzing locationId usage across all API routes...\n');

    const tsFiles = getAllTsFiles(apiDir);
    const filesWithLocationId: LocationIdUsage[] = [];

    const sessionPatterns = [
      /session\.user\.locationId/,
      /session\.locationId/,
    ];

    const bodyPatterns = [
      /locationId.*body/,
      /body.*locationId/,
      /req\.body\.locationId/,
      /JSON\.parse.*locationId/,
    ];

    for (const filePath of tsFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');
      const usages: LocationIdUsage['lines'] = [];

      lines.forEach((line, index) => {
        // Skip comments
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
          return;
        }

        // Check for locationId usage
        if (line.includes('locationId')) {
          let type: 'session' | 'body' | 'params' | 'other' = 'other';

          if (sessionPatterns.some(pattern => pattern.test(line))) {
            type = 'session';
          } else if (bodyPatterns.some(pattern => pattern.test(line))) {
            type = 'body';
          } else if (line.includes('params') || line.includes('searchParams')) {
            type = 'params';
          }

          const hasParseInt = line.includes('parseInt') || line.includes('Number(');

          usages.push({
            lineNum: index + 1,
            content: line.trim(),
            type,
            hasParseInt
          });
        }
      });

      if (usages.length > 0) {
        filesWithLocationId.push({
          file: path.relative(apiDir, filePath),
          lines: usages
        });
      }
    }

    console.log(`📊 Summary:\n`);
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files using locationId: ${filesWithLocationId.length}\n`);

    // Categorize issues
    const sessionWithoutParseInt: LocationIdUsage[] = [];
    const bodyWithoutParseInt: LocationIdUsage[] = [];
    const paramsWithoutParseInt: LocationIdUsage[] = [];

    for (const fileUsage of filesWithLocationId) {
      const sessionIssues = fileUsage.lines.filter(l => l.type === 'session' && !l.hasParseInt);
      const bodyIssues = fileUsage.lines.filter(l => l.type === 'body' && !l.hasParseInt);
      const paramsIssues = fileUsage.lines.filter(l => l.type === 'params' && !l.hasParseInt);

      if (sessionIssues.length > 0) {
        sessionWithoutParseInt.push({
          file: fileUsage.file,
          lines: sessionIssues
        });
      }

      if (bodyIssues.length > 0) {
        bodyWithoutParseInt.push({
          file: fileUsage.file,
          lines: bodyIssues
        });
      }

      if (paramsIssues.length > 0) {
        paramsWithoutParseInt.push({
          file: fileUsage.file,
          lines: paramsIssues
        });
      }
    }

    // Report session.user.locationId issues
    if (sessionWithoutParseInt.length > 0) {
      console.log(`⚠️  SESSION.USER.LOCATIONID WITHOUT PARSEINT: ${sessionWithoutParseInt.length} files\n`);
      for (const file of sessionWithoutParseInt) {
        console.log(`❌ ${file.file}`);
        for (const line of file.lines) {
          console.log(`   Line ${line.lineNum}: ${line.content}`);
        }
        console.log();
      }
    } else {
      console.log(`✅ All session.user.locationId uses are properly converted!\n`);
    }

    // Report body locationId issues
    if (bodyWithoutParseInt.length > 0) {
      console.log(`⚠️  BODY/REQUEST LOCATIONID WITHOUT PARSEINT: ${bodyWithoutParseInt.length} files\n`);
      for (const file of bodyWithoutParseInt) {
        console.log(`⚠️  ${file.file}`);
        for (const line of file.lines) {
          console.log(`   Line ${line.lineNum}: ${line.content}`);
        }
        console.log();
      }
    }

    // Report params locationId issues
    if (paramsWithoutParseInt.length > 0) {
      console.log(`⚠️  PARAMS LOCATIONID WITHOUT PARSEINT: ${paramsWithoutParseInt.length} files\n`);
      for (const file of paramsWithoutParseInt) {
        console.log(`⚠️  ${file.file}`);
        for (const line of file.lines) {
          console.log(`   Line ${line.lineNum}: ${line.content}`);
        }
        console.log();
      }
    }

    // Overall summary
    console.log(`\n📋 Overall Status:`);
    console.log(`   Session locationId issues: ${sessionWithoutParseInt.length} files`);
    console.log(`   Body locationId issues: ${bodyWithoutParseInt.length} files`);
    console.log(`   Params locationId issues: ${paramsWithoutParseInt.length} files`);

    const totalIssues = sessionWithoutParseInt.length + bodyWithoutParseInt.length + paramsWithoutParseInt.length;
    if (totalIssues === 0) {
      console.log(`\n✅ All locationId values are properly type-converted!`);
    } else {
      console.log(`\n⚠️  Total files needing fixes: ${totalIssues}`);
      console.log(`\n💡 Next steps:`);
      console.log(`   1. Create fix script for session.user.locationId (CRITICAL)`);
      console.log(`   2. Review body/params locationId conversions (case-by-case)`);
      console.log(`   3. Test inventory transactions after fixes`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkLocationIdUsage();
