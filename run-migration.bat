@echo off
REM Network Resilience Database Migration Script
REM This batch file runs the migration SQL on PostgreSQL

echo Starting database migration...
echo.

REM Set PostgreSQL paths
set PSQL_PATH="C:\Program Files\PostgreSQL\18\bin\psql.exe"
set PG_DUMP_PATH="C:\Program Files\PostgreSQL\18\bin\pg_dump.exe"

REM Database connection details
set DB_USER=postgres
set DB_HOST=localhost
set DB_PORT=5432
set DB_NAME=ultimatepos_modern

REM Backup first
echo Step 1: Creating backup...
%PG_DUMP_PATH% -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -f backup_%date:~-4,4%%date:~-10,2%%date:~-7,2%.sql
if errorlevel 1 (
    echo ERROR: Backup failed!
    pause
    exit /b 1
)
echo Backup created successfully!
echo.

REM Run migration
echo Step 2: Running migration SQL...
%PSQL_PATH% -U %DB_USER% -h %DB_HOST% -p %DB_PORT% -d %DB_NAME% -f prisma\migrations\001_add_network_resilience.sql
if errorlevel 1 (
    echo ERROR: Migration failed!
    echo Please check the error messages above.
    pause
    exit /b 1
)

echo.
echo ======================================
echo Migration completed successfully!
echo ======================================
echo.
echo Next steps:
echo 1. Verify tables created (idempotency_keys, invoice_sequences, etc.)
echo 2. Let Claude know the migration succeeded
echo 3. Continue with code updates
echo.
pause
