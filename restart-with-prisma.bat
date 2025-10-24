@echo off
echo ============================================
echo    Restarting Dev Server with Prisma Fix
echo ============================================
echo.

echo [1/5] Stopping all Node processes...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel% equ 0 (
    echo      ✓ Node processes stopped
) else (
    echo      - No Node processes running
)

echo.
echo [2/5] Waiting for file locks to release...
timeout /t 3 /nobreak >nul
echo      ✓ Done waiting

echo.
echo [3/5] Cleaning Prisma client files...
if exist "node_modules\.prisma" (
    rmdir /s /q "node_modules\.prisma" >nul 2>&1
    echo      ✓ Prisma client cleaned
) else (
    echo      - Already clean
)

echo.
echo [4/5] Regenerating Prisma client...
call npx prisma generate
if %errorlevel% equ 0 (
    echo      ✓ Prisma client generated successfully
) else (
    echo      ✗ Error generating Prisma client
    pause
    exit /b 1
)

echo.
echo [5/5] Starting development server...
echo.
echo ============================================
echo      Server is starting...
echo      Press Ctrl+C to stop
echo ============================================
echo.

call npm run dev
