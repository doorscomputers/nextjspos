@echo off
REM Batch Script to Run Comprehensive POS Workflow Test
REM Location: C:\xampp\htdocs\ultimatepos-modern\run-comprehensive-pos-test.bat

echo ========================================
echo COMPREHENSIVE POS WORKFLOW TEST RUNNER
echo ========================================
echo.

echo Test Environment: PRODUCTION (https://pcinet.shop)
echo.

echo Test Users:
echo   - Jheiron (RFID: 1322311179) - Warehouse Manager @ Main Warehouse
echo   - JasminKateCashierMain (RFID: 3746350884) - Cashier @ Main Store
echo   - EricsonChanCashierTugue (RFID: 1322774315) - Cashier @ Tuguegarao
echo   - JojitKateCashierBambang (RFID: 1323982619) - Cashier @ Bambang
echo.

echo Test Flow:
echo   1. Purchase 3 products (40 pcs each) @ Main Warehouse
echo   2. Transfer products to 3 branches (10 pcs each)
echo   3. Reverse transfers (1 pc each back to warehouse)
echo   4. Sales transactions (4 sales per cashier)
echo   5. Inventory corrections (+2 pcs for 2 products)
echo   6. Additional purchases
echo   7. Exchange/Return feature check
echo.

echo ========================================
echo.

echo How would you like to run the test?
echo.
echo [1] Run with UI Mode (Recommended - Interactive)
echo [2] Run in Headed Mode (See browser actions)
echo [3] Run Normally (Headless, fastest)
echo [4] Show Test Report (if tests already ran)
echo [5] Exit
echo.

set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting Playwright UI Mode...
    echo You can step through tests, pause, and inspect elements.
    echo.
    npx playwright test e2e/comprehensive-pos-workflow.spec.ts --ui
) else if "%choice%"=="2" (
    echo.
    echo Starting test in HEADED mode (browser visible)...
    echo.
    npx playwright test e2e/comprehensive-pos-workflow.spec.ts --headed
) else if "%choice%"=="3" (
    echo.
    echo Starting test in HEADLESS mode (fastest)...
    echo.
    npx playwright test e2e/comprehensive-pos-workflow.spec.ts
) else if "%choice%"=="4" (
    echo.
    echo Opening Playwright Test Report...
    echo.
    npx playwright show-report
) else if "%choice%"=="5" (
    echo.
    echo Exiting...
    exit /b
) else (
    echo.
    echo Invalid choice. Running in UI mode by default...
    echo.
    npx playwright test e2e/comprehensive-pos-workflow.spec.ts --ui
)

echo.
echo ========================================
echo Test execution complete!
echo.
echo Next Steps:
echo 1. Review console output above for detailed results
echo 2. Check 'FINAL COMPREHENSIVE REPORT' section
echo 3. Compare expected cash with actual X-readings
echo.
echo Documentation:
echo - Full README: e2e\COMPREHENSIVE-POS-WORKFLOW-README.md
echo - Quick Guide: e2e\QUICK-START-GUIDE.md
echo.
echo View Test Report:
echo   npx playwright show-report
echo.
echo ========================================

pause
