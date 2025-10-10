# PowerShell Commands Reference

**Note**: You're using PowerShell, not Command Prompt. Commands are different.

---

## Clear Next.js Cache

### ❌ Command Prompt (doesn't work in PowerShell):
```cmd
rmdir /s /q .next
```

### ✅ PowerShell (correct):
```powershell
Remove-Item -Recurse -Force .next
```

---

## Common Development Commands

### Stop Dev Server
```powershell
npx kill-port 3000
```

### Clear Cache and Restart
```powershell
# Stop server
npx kill-port 3000

# Delete .next folder (PowerShell)
Remove-Item -Recurse -Force .next

# Restart server
npm run dev
```

### Clear Everything (Full Clean)
```powershell
# Stop server
npx kill-port 3000

# Delete build artifacts
Remove-Item -Recurse -Force .next
Remove-Item -Recurse -Force node_modules\.cache

# Restart
npm run dev
```

---

## Prisma Commands

### Generate Prisma Client
```powershell
npx prisma generate
```

### Push Schema to Database
```powershell
npx prisma db push
```

### Open Prisma Studio
```powershell
npx prisma studio
```

### Full Migration Process
```powershell
# Stop server
npx kill-port 3000

# Generate client
npx prisma generate

# Push to database
npx prisma db push

# Restart server
npm run dev
```

---

## File Operations

### Delete Folder
```powershell
# Delete folder and all contents
Remove-Item -Recurse -Force folder_name

# Delete folder silently (ignore errors)
Remove-Item -Recurse -Force folder_name -ErrorAction SilentlyContinue
```

### Check if File/Folder Exists
```powershell
Test-Path .next
```

### List Files
```powershell
# List files in current directory
Get-ChildItem

# List files with details
Get-ChildItem | Format-Table

# List only folders
Get-ChildItem -Directory
```

---

## Process Management

### Kill Process by Port
```powershell
# Using npx kill-port (recommended)
npx kill-port 3000

# Using PowerShell native
Get-NetTCPConnection -LocalPort 3000 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Check Running Processes
```powershell
# Check if port 3000 is in use
Get-NetTCPConnection -LocalPort 3000

# List Node processes
Get-Process node
```

---

## Git Commands (same in PowerShell)

```powershell
git status
git add .
git commit -m "message"
git push
```

---

## NPM Commands (same in PowerShell)

```powershell
npm install
npm run dev
npm run build
npm start
```

---

## Quick Reference: PowerShell vs CMD

| Task | Command Prompt | PowerShell |
|------|---------------|------------|
| Delete folder | `rmdir /s /q folder` | `Remove-Item -Recurse -Force folder` |
| List files | `dir` | `Get-ChildItem` or `ls` |
| Copy file | `copy file1 file2` | `Copy-Item file1 file2` |
| Move file | `move file1 file2` | `Move-Item file1 file2` |
| Clear screen | `cls` | `Clear-Host` or `cls` |
| Current directory | `cd` | `Get-Location` or `pwd` |

---

## For Your Current Project

### Clear Cache and Restart (PowerShell)
```powershell
npx kill-port 3000
Remove-Item -Recurse -Force .next
npm run dev
```

### Run Prisma Migration (PowerShell)
```powershell
npx kill-port 3000
npx prisma generate
npx prisma db push
npm run dev
```

---

## Tips

1. **Use Tab Completion**: PowerShell has excellent tab completion. Start typing and press Tab.

2. **Use Aliases**: PowerShell supports many CMD aliases:
   - `ls` works (alias for Get-ChildItem)
   - `cd` works (alias for Set-Location)
   - `cls` works (alias for Clear-Host)

3. **Get Help**: Use `Get-Help` for any command:
   ```powershell
   Get-Help Remove-Item
   Get-Help Remove-Item -Examples
   ```

4. **Error Handling**: Add `-ErrorAction SilentlyContinue` to ignore errors:
   ```powershell
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
   ```

---

**You're using PowerShell, so use the PowerShell commands listed above!**
