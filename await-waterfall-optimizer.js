#!/usr/bin/env node

/**
 * Await Waterfall Optimizer
 * 
 * This script finds sequential await statements in dashboard components
 * and converts them to Promise.all for better performance.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const DASHBOARD_DIR = './src/app/dashboard';
const OUTPUT_DIR = './optimization-results/await-waterfalls';

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Find all TypeScript/TSX files in dashboard directory
 */
function findDashboardFiles(dir) {
    const files = [];

    function traverse(currentDir) {
        const items = fs.readdirSync(currentDir);

        for (const item of items) {
            const fullPath = path.join(currentDir, item);
            const stat = fs.statSync(fullPath);

            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                traverse(fullPath);
            } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
                files.push(fullPath);
            }
        }
    }

    traverse(dir);
    return files;
}

/**
 * Find sequential await patterns in code
 */
function findAwaitWaterfalls(content) {
    const patterns = [];

    // Pattern 1: Sequential variable assignments with await
    const sequentialAwaitRegex = /const\s+(\w+)\s*=\s*await\s+([^;]+);\s*\n\s*const\s+(\w+)\s*=\s*await\s+([^;]+);/g;
    let match;

    while ((match = sequentialAwaitRegex.exec(content)) !== null) {
        patterns.push({
            type: 'sequential-assignments',
            line: content.substring(0, match.index).split('\n').length,
            before: match[0],
            after: `const [${match[1]}, ${match[3]}] = await Promise.all([\n  ${match[2]},\n  ${match[4]}\n]);`,
            variables: [match[1], match[3]]
        });
    }

    // Pattern 2: Sequential function calls with await
    const sequentialCallsRegex = /await\s+([^;]+);\s*\n\s*await\s+([^;]+);/g;
    while ((match = sequentialCallsRegex.exec(content)) !== null) {
        patterns.push({
            type: 'sequential-calls',
            line: content.substring(0, match.index).split('\n').length,
            before: match[0],
            after: `await Promise.all([\n  ${match[1]},\n  ${match[2]}\n]);`,
            calls: [match[1], match[2]]
        });
    }

    // Pattern 3: Multiple await statements in a function
    const multipleAwaitRegex = /(async\s+function\s+\w+\([^)]*\)\s*\{[^}]*?)(await\s+[^;]+;)([^}]*?)(await\s+[^;]+;)([^}]*?\})/gs;
    while ((match = multipleAwaitRegex.exec(content)) !== null) {
        patterns.push({
            type: 'function-multiple-await',
            line: content.substring(0, match.index).split('\n').length,
            before: match[0],
            after: match[1] + `await Promise.all([\n  ${match[2].replace('await ', '')},\n  ${match[4].replace('await ', '')}\n]);` + match[3] + match[5],
            function: match[0].split('(')[0].split(' ').pop()
        });
    }

    return patterns;
}

/**
 * Optimize a file by converting await waterfalls to Promise.all
 */
function optimizeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const patterns = findAwaitWaterfalls(content);

    if (patterns.length === 0) {
        return { file: filePath, optimizations: [], optimized: false };
    }

    let optimizedContent = content;
    const optimizations = [];

    // Apply optimizations in reverse order to maintain line numbers
    patterns.reverse().forEach((pattern, index) => {
        const beforeLines = optimizedContent.substring(0, pattern.line - 1).split('\n');
        const afterLines = optimizedContent.substring(pattern.line - 1).split('\n');

        // Find the exact match in the content
        const lineContent = afterLines[0];
        if (lineContent.includes(pattern.before.split('\n')[0])) {
            optimizedContent = optimizedContent.replace(pattern.before, pattern.after);
            optimizations.push({
                type: pattern.type,
                line: pattern.line,
                before: pattern.before,
                after: pattern.after,
                variables: pattern.variables || pattern.calls || []
            });
        }
    });

    return {
        file: filePath,
        optimizations,
        optimized: optimizations.length > 0,
        content: optimizedContent
    };
}

/**
 * Generate optimization report
 */
function generateReport(results) {
    const report = {
        summary: {
            filesProcessed: results.length,
            filesOptimized: results.filter(r => r.optimized).length,
            totalOptimizations: results.reduce((sum, r) => sum + r.optimizations.length, 0)
        },
        optimizations: results.filter(r => r.optimized).map(r => ({
            file: r.file,
            optimizations: r.optimizations
        })),
        patterns: {
            'sequential-assignments': results.reduce((sum, r) => sum + r.optimizations.filter(o => o.type === 'sequential-assignments').length, 0),
            'sequential-calls': results.reduce((sum, r) => sum + r.optimizations.filter(o => o.type === 'sequential-calls').length, 0),
            'function-multiple-await': results.reduce((sum, r) => sum + r.optimizations.filter(o => o.type === 'function-multiple-await').length, 0)
        }
    };

    return report;
}

/**
 * Main optimization process
 */
function main() {
    console.log('🔍 Finding dashboard files...');
    const files = findDashboardFiles(DASHBOARD_DIR);
    console.log(`Found ${files.length} dashboard files`);

    console.log('⚡ Optimizing await waterfalls...');
    const results = files.map(filePath => {
        try {
            return optimizeFile(filePath);
        } catch (error) {
            console.error(`Error processing ${filePath}:`, error.message);
            return { file: filePath, optimizations: [], optimized: false, error: error.message };
        }
    });

    // Save optimized files
    results.forEach(result => {
        if (result.optimized && result.content) {
            const relativePath = path.relative(DASHBOARD_DIR, result.file);
            const outputPath = path.join(OUTPUT_DIR, relativePath);
            const outputDir = path.dirname(outputPath);

            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            fs.writeFileSync(outputPath, result.content);
        }
    });

    // Generate report
    const report = generateReport(results);

    fs.writeFileSync(
        path.join(OUTPUT_DIR, 'await-waterfall-report.json'),
        JSON.stringify(report, null, 2)
    );

    // Generate diff files
    results.forEach(result => {
        if (result.optimized) {
            const relativePath = path.relative(DASHBOARD_DIR, result.file);
            const diffPath = path.join(OUTPUT_DIR, relativePath + '.diff');

            const diff = result.optimizations.map(opt =>
                `--- Line ${opt.line}\n` +
                `- ${opt.before.replace(/\n/g, '\n- ')}\n` +
                `+ ${opt.after.replace(/\n/g, '\n+ ')}\n`
            ).join('\n');

            fs.writeFileSync(diffPath, diff);
        }
    });

    console.log('✅ Await waterfall optimization complete!');
    console.log(`📁 Results saved to: ${OUTPUT_DIR}`);
    console.log(`📊 Processed ${files.length} files`);
    console.log(`⚡ Optimized ${report.summary.filesOptimized} files`);
    console.log(`🔄 Made ${report.summary.totalOptimizations} optimizations`);
    console.log(`📈 Pattern breakdown:`, report.patterns);
}

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    findDashboardFiles,
    findAwaitWaterfalls,
    optimizeFile,
    generateReport
};
