@echo off
echo Changing pagination defaults from 25 to 10...
echo.

powershell -Command "(Get-Content 'src\app\dashboard\accounts-payable\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\accounts-payable\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\customer-returns\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\customer-returns\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\payments\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\payments\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\post-dated-cheques\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\post-dated-cheques\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\products\branch-stock-pivot\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\products\branch-stock-pivot\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\products\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\products\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\products\stock\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\products\stock\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\purchases\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\purchases\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\sales\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\sales\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\supplier-returns\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\supplier-returns\page.tsx'"
powershell -Command "(Get-Content 'src\app\dashboard\transfers\page.tsx') -replace 'useState\(25\)', 'useState(10)' | Set-Content 'src\app\dashboard\transfers\page.tsx'"

echo.
echo Done! Changed pagination default from 25 to 10 in 11 files.
echo.
pause
