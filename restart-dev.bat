@echo off
echo ================================================
echo    DEV SERVER RESTART SCRIPT
echo ================================================
echo.

echo [1/2] Killing old Node.js dev servers...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
    echo ✓ Dev servers stopped
) else (
    echo - No dev servers running
)
echo.

echo [2/2] Starting dev server on port 3000...
echo.
echo ================================================
echo  DEV SERVER RUNNING - Performance logs enabled
echo ================================================
echo  Note: First page visit includes compilation time
echo  Subsequent visits show actual performance
echo ================================================
echo.
echo Open: http://localhost:3000
echo Press Ctrl+C to stop
echo.

call npm run dev
