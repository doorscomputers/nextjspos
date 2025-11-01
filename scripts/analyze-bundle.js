/**
 * Bundle Analyzer Script
 * Analyzes bundle size and identifies large dependencies
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

console.log('🔍 Starting bundle analysis...\n')

// Build the application with bundle analysis
console.log('📦 Building application...')
try {
  execSync('ANALYZE=true npm run build', { stdio: 'inherit' })
} catch (error) {
  console.error('❌ Build failed:', error.message)
  process.exit(1)
}

console.log('\n✅ Bundle analysis complete!')
console.log('📊 Check the .next/analyze directory for detailed reports')
