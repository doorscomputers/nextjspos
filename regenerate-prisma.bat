@echo off
echo Stopping Node processes...
taskkill /F /IM node.exe 2>nul

echo Waiting for processes to close...
timeout /t 2 /nobreak >nul

echo Cleaning Prisma client...
rmdir /s /q "node_modules\.prisma" 2>nul

echo Regenerating Prisma client...
call npx prisma generate

echo Done!
pause
