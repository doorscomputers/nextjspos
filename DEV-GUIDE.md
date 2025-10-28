# 🚀 Clean Development Guide

## **Quick Start Commands**

### 🌟 **Recommended Daily Workflow**
```bash
# Start fresh each day
npm run dev:safe
```

### 🧹 **When You Encounter Issues**
```bash
# Check what's going on
npm run cleanup:check

# Safe cleanup (doesn't break anything)
npm run cleanup:safe

# Full cleanup (when things are really broken)
npm run cleanup
```

### ⚡ **All Available Commands**

| Command | What it does | When to use |
|---------|--------------|-------------|
| `npm run dev` | Normal development start | Daily use |
| `npm run dev:clean` | Cleans Next.js cache, then starts | When build seems slow |
| `npm run dev:full` | Full cache clean, then starts | When you have errors |
| `npm run dev:safe` | **🌟 RECOMMENDED** | **Best daily practice** |
| `npm run cleanup:check` | Shows environment status | When debugging |
| `npm run cleanup:safe` | Safe cleanup only | When having issues |
| `npm run cleanup` | Interactive cleanup | When you need full reset |

## **Best Practices**

### ✅ **Do This**
- Always stop dev server with `Ctrl+C` before closing terminal
- Use `npm run dev:safe` for daily development
- Check environment with `npm run cleanup:check` when unsure
- Clear browser cache occasionally (`Ctrl+Shift+R`)

### ❌ **Avoid This**
- Don't just close the terminal window
- Don't manually delete `.next` folder (use scripts)
- Don't ignore port conflict warnings
- Don't run multiple dev servers at once

### 🛠️ **Troubleshooting**

**Port 3000 is in use?**
```bash
# Find what's using it
netstat -ano | findstr :3000

# Kill the process (replace XXXX with actual PID)
taskkill /PID XXXX /F
```

**Weird build errors?**
```bash
# Start with safe cleanup
npm run dev:safe

# If still issues, use full cleanup
npm run cleanup
```

**Something is broken?**
1. Run `npm run cleanup:check` to see status
2. Try `npm run cleanup:safe`
3. If still broken, run `npm run cleanup` (interactive)
4. As last resort: `npm run dev:full`

## **Environment Status Colors**

The cleanup tool uses colors to help you understand what's happening:

- 🟢 **Green**: Everything is good
- 🟡 **Yellow**: Warning or action needed
- 🔴 **Red**: Problem detected
- 🔵 **Blue**: Information

## **Remember**

- These scripts are **SAFE** - they won't delete your code or database
- They only clean cache files and temporary build artifacts
- Your `node_modules` and source code are protected
- When in doubt, start with `npm run dev:safe`

Happy coding! 🎉