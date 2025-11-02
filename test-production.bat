@echo off
echo ================================================
echo    PRODUCTION BUILD & TEST SCRIPT
echo ================================================
echo.

Remove-Item -Recurse -Force .next

echo [1/4] Killing old Node.js dev servers...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo ✓ Dev servers stopped
) else (
    echo - No dev servers running
)
echo.

echo [2/4] Cleaning old build cache...
if exist .next rmdir /s /q .next
echo ✓ Cache cleared
echo.

echo [3/4] Building production bundle...
echo This may take 2-3 minutes...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ BUILD FAILED!
    echo Check errors above and fix before running production.
    pause
    exit /b 1
)
echo.

echo ✓ Build successful!
echo.
echo [4/4] Starting production server on port 3000...
echo.
echo ================================================
echo  SERVER RUNNING - Performance logs enabled
echo ================================================
echo  🟢 Green   = Fast (^<500ms^)
echo  🟡 Yellow  = Medium (500ms-1s^)
echo  🟠 Orange  = Slow (1s-2s^)
echo  🔴 Red     = Very slow (^>2s^)
echo ================================================
echo.
echo Open: http://localhost:3000
echo Press Ctrl+C to stop
echo.

call npm start
