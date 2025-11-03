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

async function fixLocationIdTypes() {
  try {
    console.log('🔧 Fixing locationId type conversions...\n');

    const tsFiles = getAllTsFiles(apiDir);
    let totalFilesModified = 0;
    let totalReplacements = 0;

    for (const filePath of tsFiles) {
      let content = fs.readFileSync(filePath, 'utf-8');
      const originalContent = content;
      let fileReplacements = 0;

      // Pattern 1: searchParams.get('locationId') without conversion
      // Replace: const locationId = searchParams.get('locationId')
      // With: const locationId = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null
      const searchParamsPattern = /const\s+(\w+)\s*=\s*searchParams\.get\(['"]locationId['"]\)/g;
      const matches = content.match(searchParamsPattern);
      if (matches) {
        for (const match of matches) {
          // Extract variable name
          const varMatch = match.match(/const\s+(\w+)\s*=/);
          if (varMatch) {
            const varName = varMatch[1];
            const replacement = `const ${varName} = searchParams.get('locationId') ? parseInt(searchParams.get('locationId')!) : null`;
            content = content.replace(match, replacement);
            fileReplacements++;
          }
        }
      }

      // Pattern 2: session.user.locationIds (array) - needs to be mapped to integers
      // Only fix if not already using map(Number) or map(parseInt)
      if (content.includes('session.user.locationIds') &&
          !content.includes('session.user.locationIds?.map(') &&
          !content.includes('session.user.locationIds.map(')) {

        // Replace: locationIds: session.user.locationIds
        content = content.replace(
          /locationIds:\s*session\.user\.locationIds/g,
          'locationIds: session.user.locationIds?.map(id => parseInt(String(id)))'
        );

        // Replace: session.user.locationIds || []
        content = content.replace(
          /session\.user\.locationIds\s*\|\|\s*\[\]/g,
          '(session.user.locationIds?.map(id => parseInt(String(id))) || [])'
        );

        fileReplacements++;
      }

      // Pattern 3: body.locationId destructuring
      // We'll add a conversion after destructuring for safety
      // Look for patterns like: const { locationId } = body
      // And add: const locationIdInt = parseInt(String(locationId))
      // But we need to be careful not to break existing code

      // For now, let's just document these for manual review
      // They need case-by-case handling

      if (content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf-8');
        const relativePath = path.relative(apiDir, filePath);
        console.log(`   ✓ Fixed: ${relativePath} (${fileReplacements} patterns)`);
        totalFilesModified++;
        totalReplacements += fileReplacements;
      }
    }

    console.log(`\n✅ Fixed searchParams and session locationIds issues\n`);
    console.log('📊 Summary:');
    console.log(`   Total files scanned: ${tsFiles.length}`);
    console.log(`   Files modified: ${totalFilesModified}`);
    console.log(`   Patterns fixed: ${totalReplacements}`);

    console.log(`\n⚠️  IMPORTANT: body.locationId conversions need manual review!`);
    console.log(`   17 files use locationId from request body.`);
    console.log(`   These require case-by-case conversion based on context.`);
    console.log(`   Run check-locationid-usage.ts to see the full list.`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

fixLocationIdTypes();
