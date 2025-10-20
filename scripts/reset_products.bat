@echo off
echo ============================================
echo RESET ALL PRODUCTS - WARNING!
echo ============================================
echo.
echo This will permanently delete:
echo - All products
echo - All product variations
echo - All stock transactions
echo - All product history
echo - All audit trail data
echo.
echo Press Ctrl+C to cancel now, or
pause

echo.
echo Connecting to database and executing reset...
echo.

REM Read DATABASE_URL from .env file
for /f "tokens=1,2 delims==" %%a in ('type .env ^| findstr DATABASE_URL') do set DATABASE_URL=%%b

REM Execute the SQL script
psql "%DATABASE_URL%" -f scripts\reset_products.sql

echo.
echo ============================================
echo Done! Check the output above for results.
echo ============================================
pause
