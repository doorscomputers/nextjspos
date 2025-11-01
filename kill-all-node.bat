@echo off
taskkill /F /IM node.exe
timeout /t 3
npm run dev
