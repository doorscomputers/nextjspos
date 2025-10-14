# Clean Server Restart Script
# This script properly restarts the Next.js development server

Write-Host "🔄 Clean Server Restart Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Kill all Node.js processes
Write-Host "Step 1: Killing all Node.js processes..." -ForegroundColor Yellow
try {
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "✅ All Node.js processes killed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  No Node.js processes found or already stopped" -ForegroundColor Yellow
}
Write-Host ""

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Step 2: Delete .next directory
Write-Host "Step 2: Deleting .next directory..." -ForegroundColor Yellow
if (Test-Path ".next") {
    try {
        Remove-Item -Path ".next" -Recurse -Force
        Write-Host "✅ .next directory deleted" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to delete .next directory: $_" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "⚠️  .next directory not found (already deleted)" -ForegroundColor Yellow
}
Write-Host ""

# Step 3: Start the server
Write-Host "Step 3: Starting development server..." -ForegroundColor Yellow
Write-Host ""
Write-Host "🚀 Server is starting... Please wait for 'Ready' message" -ForegroundColor Cyan
Write-Host ""

npm run dev
