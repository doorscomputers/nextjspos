#!/usr/bin/env node

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const TEST_TYPES = {
  smoke: 'Smoke Tests',
  performance: 'Performance Tests',
  accessibility: 'Accessibility Tests',
  all: 'All Tests'
}

function runTests(type = 'all') {
  console.log(`🚀 Running ${TEST_TYPES[type]}...`)
  
  try {
    let command = 'npx playwright test'
    
    if (type !== 'all') {
      command += ` --grep @${type}`
    }
    
    execSync(command, { stdio: 'inherit' })
    console.log(`✅ ${TEST_TYPES[type]} completed successfully!`)
  } catch (error) {
    console.error(`❌ ${TEST_TYPES[type]} failed:`, error.message)
    process.exit(1)
  }
}

function generateReport() {
  console.log('📊 Generating test report...')
  
  try {
    execSync('npx playwright show-report', { stdio: 'inherit' })
  } catch (error) {
    console.error('Failed to generate report:', error.message)
  }
}

// Main execution
const testType = process.argv[2] || 'all'

if (testType === 'report') {
  generateReport()
} else if (TEST_TYPES[testType]) {
  runTests(testType)
} else {
  console.log('Usage: node test-runner.js [smoke|performance|accessibility|all|report]')
  process.exit(1)
}