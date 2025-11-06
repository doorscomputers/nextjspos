# PowerShell Script to Run Comprehensive POS Workflow Test
# Location: C:\xampp\htdocs\ultimatepos-modern\run-comprehensive-pos-test.ps1

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "COMPREHENSIVE POS WORKFLOW TEST RUNNER" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Test Environment: " -NoNewline
Write-Host "PRODUCTION (https://pcinet.shop)" -ForegroundColor Yellow
Write-Host ""

Write-Host "Test Users:" -ForegroundColor Green
Write-Host "  - Jheiron (RFID: 1322311179) - Warehouse Manager @ Main Warehouse"
Write-Host "  - JasminKateCashierMain (RFID: 3746350884) - Cashier @ Main Store"
Write-Host "  - EricsonChanCashierTugue (RFID: 1322774315) - Cashier @ Tuguegarao"
Write-Host "  - JojitKateCashierBambang (RFID: 1323982619) - Cashier @ Bambang"
Write-Host ""

Write-Host "Test Flow:" -ForegroundColor Green
Write-Host "  1. Purchase 3 products (40 pcs each) @ Main Warehouse"
Write-Host "  2. Transfer products to 3 branches (10 pcs each)"
Write-Host "  3. Reverse transfers (1 pc each back to warehouse)"
Write-Host "  4. Sales transactions (4 sales per cashier)"
Write-Host "  5. Inventory corrections (+2 pcs for 2 products)"
Write-Host "  6. Additional purchases"
Write-Host "  7. Exchange/Return feature check"
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "How would you like to run the test?" -ForegroundColor Yellow
Write-Host ""
Write-Host "[1] Run with UI Mode (Recommended - Interactive)" -ForegroundColor Green
Write-Host "[2] Run in Headed Mode (See browser actions)"
Write-Host "[3] Run Normally (Headless, fastest)"
Write-Host "[4] Run Specific Test Group"
Write-Host "[5] Show Test Report (if tests already ran)"
Write-Host "[6] Exit"
Write-Host ""

$choice = Read-Host "Enter your choice (1-6)"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "Starting Playwright UI Mode..." -ForegroundColor Green
        Write-Host "You can step through tests, pause, and inspect elements." -ForegroundColor Cyan
        Write-Host ""
        npx playwright test e2e/comprehensive-pos-workflow.spec.ts --ui
    }
    "2" {
        Write-Host ""
        Write-Host "Starting test in HEADED mode (browser visible)..." -ForegroundColor Green
        Write-Host ""
        npx playwright test e2e/comprehensive-pos-workflow.spec.ts --headed
    }
    "3" {
        Write-Host ""
        Write-Host "Starting test in HEADLESS mode (fastest)..." -ForegroundColor Green
        Write-Host ""
        npx playwright test e2e/comprehensive-pos-workflow.spec.ts
    }
    "4" {
        Write-Host ""
        Write-Host "Which test group?" -ForegroundColor Yellow
        Write-Host "[1] PURCHASES"
        Write-Host "[2] TRANSFERS"
        Write-Host "[3] REVERSE TRANSFERS"
        Write-Host "[4] SALES"
        Write-Host "[5] INVENTORY CORRECTIONS"
        Write-Host "[6] EXCHANGE/RETURN"
        Write-Host ""
        $group = Read-Host "Enter choice (1-6)"

        $testGroup = switch ($group) {
            "1" { "PURCHASES" }
            "2" { "TRANSFERS - Warehouse Distributes" }
            "3" { "REVERSE TRANSFERS" }
            "4" { "SALES" }
            "5" { "INVENTORY CORRECTIONS" }
            "6" { "EXCHANGE/RETURN" }
            default { "PURCHASES" }
        }

        Write-Host ""
        Write-Host "Running test group: $testGroup" -ForegroundColor Green
        Write-Host ""
        npx playwright test e2e/comprehensive-pos-workflow.spec.ts -g "$testGroup"
    }
    "5" {
        Write-Host ""
        Write-Host "Opening Playwright Test Report..." -ForegroundColor Green
        Write-Host ""
        npx playwright show-report
    }
    "6" {
        Write-Host ""
        Write-Host "Exiting..." -ForegroundColor Yellow
        exit
    }
    default {
        Write-Host ""
        Write-Host "Invalid choice. Running in UI mode by default..." -ForegroundColor Yellow
        Write-Host ""
        npx playwright test e2e/comprehensive-pos-workflow.spec.ts --ui
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test execution complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review console output above for detailed results"
Write-Host "2. Check 'FINAL COMPREHENSIVE REPORT' section"
Write-Host "3. Compare expected cash with actual X-readings:"
Write-Host "   - Login to each location"
Write-Host "   - Generate X-Reading"
Write-Host "   - Compare cash amounts"
Write-Host ""
Write-Host "Documentation:" -ForegroundColor Yellow
Write-Host "- Full README: e2e/COMPREHENSIVE-POS-WORKFLOW-README.md"
Write-Host "- Quick Guide: e2e/QUICK-START-GUIDE.md"
Write-Host ""
Write-Host "View Test Report:" -ForegroundColor Yellow
Write-Host "  npx playwright show-report"
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
