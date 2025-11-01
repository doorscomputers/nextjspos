#!/usr/bin/env node

/**
 * Prisma Optimization Script
 * 
 * This script finds all Prisma include statements and replaces them with optimized select statements.
 * It also analyzes WHERE/ORDER patterns to generate CREATE INDEX statements.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const SRC_DIR = './src';
const OUTPUT_DIR = './optimization-results';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Track optimizations
const optimizations = [];
const wherePatterns = new Map();
const orderPatterns = new Map();

/**
 * Find all TypeScript files with Prisma queries
 */
function findPrismaFiles(dir) {
  const files = [];

  function traverse(currentDir) {
    const items = fs.readdirSync(currentDir);

    for (const item of items) {
      const fullPath = path.join(currentDir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        traverse(fullPath);
      } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('prisma.') && (content.includes('include:') || content.includes('findMany') || content.includes('findFirst'))) {
          files.push(fullPath);
        }
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Extract WHERE patterns from Prisma queries
 */
function extractWherePatterns(content) {
  const whereRegex = /where:\s*\{([^}]+)\}/gs;
  const matches = content.match(whereRegex);

  if (matches) {
    matches.forEach(match => {
      // Extract common patterns
      const businessIdMatch = match.match(/businessId\s*:\s*(\w+)/);
      const deletedAtMatch = match.match(/deletedAt\s*:\s*null/);
      const statusMatch = match.match(/status\s*:\s*\{([^}]+)\}/);
      const createdAtMatch = match.match(/createdAt\s*:\s*\{([^}]+)\}/);
      const locationIdMatch = match.match(/locationId\s*:\s*(\w+)/);

      const pattern = {
        businessId: !!businessIdMatch,
        deletedAt: !!deletedAtMatch,
        status: !!statusMatch,
        createdAt: !!createdAtMatch,
        locationId: !!locationIdMatch
      };

      const key = JSON.stringify(pattern);
      wherePatterns.set(key, (wherePatterns.get(key) || 0) + 1);
    });
  }
}

/**
 * Extract ORDER BY patterns from Prisma queries
 */
function extractOrderPatterns(content) {
  const orderByRegex = /orderBy:\s*\{([^}]+)\}/gs;
  const matches = content.match(orderByRegex);

  if (matches) {
    matches.forEach(match => {
      // Extract field names
      const fieldMatches = match.match(/(\w+)\s*:\s*['"`]?(\w+)['"`]?/g);
      if (fieldMatches) {
        fieldMatches.forEach(fieldMatch => {
          const [, field, direction] = fieldMatch.match(/(\w+)\s*:\s*['"`]?(\w+)['"`]?/);
          const key = `${field}:${direction}`;
          orderPatterns.set(key, (orderPatterns.get(key) || 0) + 1);
        });
      }
    });
  }
}

/**
 * Optimize include statements to select statements
 */
function optimizeIncludes(content, filePath) {
  let optimized = content;
  let changes = 0;

  // Pattern 1: Simple include with true
  const simpleIncludeRegex = /(\w+):\s*true/g;
  optimized = optimized.replace(simpleIncludeRegex, (match, field) => {
    changes++;
    return `${field}: { select: { id: true, name: true } }`;
  });

  // Pattern 2: Nested includes
  const nestedIncludeRegex = /include:\s*\{([^}]+)\}/gs;
  optimized = optimized.replace(nestedIncludeRegex, (match, includeContent) => {
    changes++;
    return `select: {${optimizeNestedIncludes(includeContent)}}`;
  });

  if (changes > 0) {
    optimizations.push({
      file: filePath,
      changes: changes,
      type: 'include-to-select'
    });
  }

  return optimized;
}

/**
 * Optimize nested include statements
 */
function optimizeNestedIncludes(content) {
  // This is a simplified version - in practice, you'd want more sophisticated parsing
  return content
    .replace(/(\w+):\s*true/g, '$1: { select: { id: true, name: true } }')
    .replace(/include:/g, 'select:');
}

/**
 * Generate CREATE INDEX statements based on patterns
 */
function generateIndexStatements() {
  const indexes = [];

  // Top WHERE patterns
  const topWherePatterns = Array.from(wherePatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  topWherePatterns.forEach(([pattern, count]) => {
    const parsed = JSON.parse(pattern);
    const conditions = [];

    if (parsed.businessId) conditions.push('businessId');
    if (parsed.deletedAt) conditions.push('deletedAt');
    if (parsed.status) conditions.push('status');
    if (parsed.createdAt) conditions.push('createdAt');
    if (parsed.locationId) conditions.push('locationId');

    if (conditions.length > 0) {
      indexes.push({
        table: 'products', // This would be determined by context
        columns: conditions,
        usage: count,
        statement: `CREATE INDEX idx_${conditions.join('_')} ON products (${conditions.join(', ')});`
      });
    }
  });

  // Top ORDER BY patterns
  const topOrderPatterns = Array.from(orderPatterns.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  topOrderPatterns.forEach(([pattern, count]) => {
    const [field, direction] = pattern.split(':');
    indexes.push({
      table: 'products', // This would be determined by context
      columns: [field],
      direction: direction,
      usage: count,
      statement: `CREATE INDEX idx_${field}_${direction} ON products (${field} ${direction.toUpperCase()});`
    });
  });

  return indexes;
}

/**
 * Main optimization process
 */
function main() {
  console.log('🔍 Finding Prisma files...');
  const files = findPrismaFiles(SRC_DIR);
  console.log(`Found ${files.length} files with Prisma queries`);

  console.log('📊 Analyzing patterns...');
  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    extractWherePatterns(content);
    extractOrderPatterns(content);
  });

  console.log('⚡ Optimizing include statements...');
  files.forEach(filePath => {
    const content = fs.readFileSync(filePath, 'utf8');
    const optimized = optimizeIncludes(content, filePath);

    if (optimized !== content) {
      const outputPath = path.join(OUTPUT_DIR, path.relative(SRC_DIR, filePath));
      const outputDir = path.dirname(outputPath);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, optimized);
    }
  });

  console.log('📝 Generating CREATE INDEX statements...');
  const indexes = generateIndexStatements();

  // Generate reports
  const report = {
    summary: {
      filesProcessed: files.length,
      optimizations: optimizations.length,
      totalChanges: optimizations.reduce((sum, opt) => sum + opt.changes, 0)
    },
    optimizations: optimizations,
    wherePatterns: Array.from(wherePatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    orderPatterns: Array.from(orderPatterns.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
    indexes: indexes
  };

  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'optimization-report.json'),
    JSON.stringify(report, null, 2)
  );

  // Generate SQL file
  const sqlContent = indexes.map(idx => idx.statement).join('\n');
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'create-indexes.sql'),
    sqlContent
  );

  console.log('✅ Optimization complete!');
  console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
  console.log(`📊 Processed ${files.length} files`);
  console.log(`⚡ Made ${optimizations.length} optimizations`);
  console.log(`🗂️ Generated ${indexes.length} index statements`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  findPrismaFiles,
  extractWherePatterns,
  extractOrderPatterns,
  optimizeIncludes,
  generateIndexStatements
};
