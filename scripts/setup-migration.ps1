# Database Migration Setup Script (PowerShell)
# Prepares your environment for migrating to Supabase

$ErrorActionPreference = "Stop"

# Colors
function Write-ColorOutput($ForegroundColor, $Message) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    Write-Output $Message
    $host.UI.RawUI.ForegroundColor = $fc
}

Write-ColorOutput Cyan "========================================"
Write-ColorOutput Cyan "UltimatePOS Migration Setup"
Write-ColorOutput Cyan "========================================`n"

# Check if .env exists
if (-Not (Test-Path .env)) {
    Write-ColorOutput Red "✗ .env file not found"
    Write-ColorOutput Yellow "Creating .env from .env.example..."
    Copy-Item .env.example .env
    Write-ColorOutput Green "✓ .env file created"
}

# Check if Prisma is installed
Write-ColorOutput Blue "`nℹ Checking Prisma installation..."
$prismaInstalled = Get-Command prisma -ErrorAction SilentlyContinue
if (-Not $prismaInstalled) {
    Write-ColorOutput Yellow "⚠ Prisma not found, installing..."
    npm install prisma @prisma/client
    Write-ColorOutput Green "✓ Prisma installed"
} else {
    Write-ColorOutput Green "✓ Prisma is installed"
}

# Check if tsx is installed
Write-ColorOutput Blue "`nℹ Checking tsx installation..."
$tsxInstalled = Get-Command tsx -ErrorAction SilentlyContinue
if (-Not $tsxInstalled) {
    Write-ColorOutput Yellow "⚠ tsx not found, installing globally..."
    npm install -g tsx
    Write-ColorOutput Green "✓ tsx installed"
} else {
    Write-ColorOutput Green "✓ tsx is installed"
}

# Backup local database
Write-ColorOutput Blue "`nℹ Creating database backup..."
$backupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"

$backup = Read-Host "Do you want to backup your local database? (y/n)"
if ($backup -eq "y") {
    $dbName = Read-Host "Enter database name [ultimatepos_modern]"
    if ([string]::IsNullOrWhiteSpace($dbName)) { $dbName = "ultimatepos_modern" }

    $dbUser = Read-Host "Enter database user [postgres]"
    if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "postgres" }

    Write-ColorOutput Yellow "Creating backup: $backupFile"

    # Try PostgreSQL first
    $pgDumpCmd = Get-Command pg_dump -ErrorAction SilentlyContinue
    if ($pgDumpCmd) {
        try {
            & pg_dump -h localhost -U $dbUser -d $dbName | Out-File -Encoding UTF8 $backupFile
            Write-ColorOutput Green "✓ PostgreSQL backup created: $backupFile"
        } catch {
            Write-ColorOutput Yellow "⚠ PostgreSQL backup failed, trying MySQL..."
        }
    }

    # Try MySQL if PostgreSQL failed
    if (-Not (Test-Path $backupFile) -or (Get-Item $backupFile).Length -eq 0) {
        $mysqlDumpCmd = Get-Command mysqldump -ErrorAction SilentlyContinue
        if ($mysqlDumpCmd) {
            $dbPass = Read-Host "Enter MySQL password" -AsSecureString
            $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPass)
            $plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

            try {
                & mysqldump -u $dbUser -p$plainPass $dbName | Out-File -Encoding UTF8 $backupFile
                Write-ColorOutput Green "✓ MySQL backup created: $backupFile"
            } catch {
                Write-ColorOutput Red "✗ Backup failed"
            }
        }
    }
}

# Configure Supabase connection
Write-ColorOutput Blue "`nℹ Configuring Supabase connection..."
$hasSupabase = Read-Host "Do you have a Supabase project ready? (y/n)"

if ($hasSupabase -eq "y") {
    Write-ColorOutput Cyan "`nPlease enter your Supabase connection details:"
    Write-ColorOutput Yellow "You can find this in: Supabase Dashboard → Settings → Database`n"

    $projectRef = Read-Host "Supabase Project Reference (e.g., xyzabc123)"
    $supabasePass = Read-Host "Supabase Database Password" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($supabasePass)
    $plainPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

    # Create .env.migration file
    $envContent = @"
# Local Database (Source)
SOURCE_DATABASE_URL=postgresql://localhost:5432/ultimatepos_modern

# Supabase Database (Target)
TARGET_DATABASE_URL=postgresql://postgres:${plainPass}@db.${projectRef}.supabase.co:5432/postgres
SUPABASE_DATABASE_URL=postgresql://postgres:${plainPass}@db.${projectRef}.supabase.co:5432/postgres
"@

    $envContent | Out-File -Encoding UTF8 .env.migration
    Write-ColorOutput Green "✓ .env.migration file created"

    # Test Supabase connection
    Write-ColorOutput Blue "`nℹ Testing Supabase connection..."
    $targetUrl = "postgresql://postgres:${plainPass}@db.${projectRef}.supabase.co:5432/postgres"

    $psqlCmd = Get-Command psql -ErrorAction SilentlyContinue
    if ($psqlCmd) {
        try {
            $result = & psql $targetUrl -c "SELECT 1" 2>&1
            if ($LASTEXITCODE -eq 0) {
                Write-ColorOutput Green "✓ Supabase connection successful"
            } else {
                Write-ColorOutput Red "✗ Supabase connection failed"
                Write-ColorOutput Yellow "Please check your connection string and try again"
                exit 1
            }
        } catch {
            Write-ColorOutput Yellow "⚠ Could not test connection (psql not found)"
            Write-ColorOutput Yellow "Proceeding anyway..."
        }
    } else {
        Write-ColorOutput Yellow "⚠ psql not found, skipping connection test"
    }

    # Push Prisma schema to Supabase
    Write-ColorOutput Blue "`nℹ Deploying Prisma schema to Supabase..."
    $deploySchema = Read-Host "Do you want to deploy the schema now? (y/n)"

    if ($deploySchema -eq "y") {
        Write-ColorOutput Yellow "Deploying schema..."
        $env:DATABASE_URL = $targetUrl
        npx prisma db push --accept-data-loss
        Write-ColorOutput Green "✓ Schema deployed to Supabase"
    }
} else {
    Write-ColorOutput Yellow "`n⚠ Please create a Supabase project first:"
    Write-Output "  1. Go to https://supabase.com"
    Write-Output "  2. Create a new project"
    Write-Output "  3. Wait for project initialization (~2 minutes)"
    Write-Output "  4. Run this script again"
    exit 1
}

# Summary
Write-ColorOutput Cyan "`n========================================"
Write-ColorOutput Cyan "Setup Complete!"
Write-ColorOutput Cyan "========================================`n"

Write-ColorOutput Green "✓ Environment configured"
if (Test-Path $backupFile) {
    Write-ColorOutput Green "✓ Database backup created: $backupFile"
}
Write-ColorOutput Green "✓ Supabase connection tested"

Write-ColorOutput Cyan "`nNext Steps:"
Write-Output "  1. Review .env.migration file"
Write-Output "  2. Run migration:"
Write-ColorOutput Yellow "     npx tsx scripts/migrate-to-supabase.ts"
Write-Output "  3. Validate migration:"
Write-ColorOutput Yellow "     npx tsx scripts/validate-migration.ts"
Write-Output "  4. Update production .env with Supabase connection"

Write-ColorOutput Blue "`n📖 For detailed instructions, see: MIGRATION_GUIDE.md`n"
