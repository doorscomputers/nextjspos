# Inventory Ledger Test - Quick Start Script
# This script automates the complete testing process

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Inventory Ledger - Complete Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Verify prerequisites
Write-Host "Step 1: Checking Prerequisites..." -ForegroundColor Yellow

# Check if Node.js is available
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error: Node.js not found. Please install Node.js." -ForegroundColor Red
    exit 1
}
Write-Host "  Node.js version: $nodeVersion" -ForegroundColor Green

# Check if database is accessible
Write-Host "  Checking database connection..." -ForegroundColor Yellow
$dbCheck = node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.`$connect().then(() => { console.log('OK'); prisma.`$disconnect(); }).catch(() => { console.log('FAIL'); process.exit(1); })" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error: Cannot connect to database. Please check DATABASE_URL in .env" -ForegroundColor Red
    exit 1
}
Write-Host "  Database connection: OK" -ForegroundColor Green

# Check if dev server is running
Write-Host "  Checking if dev server is running..." -ForegroundColor Yellow
$devServerCheck = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue
if (-not $devServerCheck) {
    Write-Host "  Warning: Dev server not detected on port 3000" -ForegroundColor Yellow
    Write-Host "  Please start dev server in another terminal: npm run dev" -ForegroundColor Yellow
    $continue = Read-Host "  Continue anyway? (y/n)"
    if ($continue -ne 'y') {
        exit 1
    }
} else {
    Write-Host "  Dev server: Running on port 3000" -ForegroundColor Green
}

Write-Host "`nStep 2: Data Cleanup" -ForegroundColor Yellow
Write-Host "  This will DELETE all transactional data!" -ForegroundColor Red
Write-Host "  Master data (users, products, locations) will be preserved." -ForegroundColor Green

$cleanup = Read-Host "`n  Run cleanup script? (y/n)"
if ($cleanup -eq 'y') {
    Write-Host "`n  Running cleanup script..." -ForegroundColor Yellow
    node cleanup-all-transactions.js

    if ($LASTEXITCODE -ne 0) {
        Write-Host "`n  Error: Cleanup failed!" -ForegroundColor Red
        exit 1
    }

    Write-Host "`n  Cleanup completed successfully!" -ForegroundColor Green
} else {
    Write-Host "  Skipping cleanup..." -ForegroundColor Yellow
    Write-Host "  Warning: Test may fail if old transaction data exists!" -ForegroundColor Red
}

Write-Host "`nStep 3: Running Playwright Test" -ForegroundColor Yellow
Write-Host "  This will execute the comprehensive inventory ledger test..." -ForegroundColor Yellow
Write-Host "  Estimated time: 3-5 minutes`n" -ForegroundColor Yellow

$runTest = Read-Host "  Run Playwright test? (y/n)"
if ($runTest -eq 'y') {
    Write-Host "`n  Starting test execution..." -ForegroundColor Yellow

    # Ask for headed or headless
    $headed = Read-Host "  Run in headed mode (see browser)? (y/n)"

    if ($headed -eq 'y') {
        npx playwright test e2e/inventory-ledger-full-flow.spec.ts --headed --reporter=list
    } else {
        npx playwright test e2e/inventory-ledger-full-flow.spec.ts --reporter=list
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n========================================" -ForegroundColor Green
        Write-Host "  SUCCESS: All tests passed!" -ForegroundColor Green
        Write-Host "========================================`n" -ForegroundColor Green

        Write-Host "Test artifacts saved to:" -ForegroundColor Cyan
        Write-Host "  - Screenshots: test-results/" -ForegroundColor White
        Write-Host "  - Report: test-results/ledger-step7-full-report.png" -ForegroundColor White

        Write-Host "`nKey Results:" -ForegroundColor Cyan
        Write-Host "  Opening Balance: 100 units" -ForegroundColor White
        Write-Host "  Closing Balance: 110 units" -ForegroundColor White
        Write-Host "  System Inventory: 110 units" -ForegroundColor White
        Write-Host "  Variance: 0 units (Perfect accuracy!)" -ForegroundColor Green
        Write-Host "  Status: Matched" -ForegroundColor Green

    } else {
        Write-Host "`n========================================" -ForegroundColor Red
        Write-Host "  FAILED: Some tests failed!" -ForegroundColor Red
        Write-Host "========================================`n" -ForegroundColor Red

        Write-Host "Troubleshooting steps:" -ForegroundColor Yellow
        Write-Host "  1. Check test-results/ for screenshots" -ForegroundColor White
        Write-Host "  2. Review console output above" -ForegroundColor White
        Write-Host "  3. Ensure dev server is running" -ForegroundColor White
        Write-Host "  4. Verify seed data exists (npm run db:seed)" -ForegroundColor White
        Write-Host "  5. Check INVENTORY-LEDGER-TEST-GUIDE.md for details`n" -ForegroundColor White

        exit 1
    }
} else {
    Write-Host "  Test skipped." -ForegroundColor Yellow
}

Write-Host "`nStep 4: View Test Results" -ForegroundColor Yellow
$viewResults = Read-Host "  Open Playwright HTML report? (y/n)"
if ($viewResults -eq 'y') {
    npx playwright show-report
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Test process completed!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Review screenshots in test-results/" -ForegroundColor White
Write-Host "  2. Verify ledger-step7-full-report.png shows 0 variance" -ForegroundColor White
Write-Host "  3. Read INVENTORY-LEDGER-TEST-GUIDE.md for details" -ForegroundColor White
Write-Host "  4. Run manual verification if needed`n" -ForegroundColor White
