@echo off
cd /d "%~dp0"
start "" http://localhost:3000
echo === Local server: http://localhost:3000  (Ctrl+C to stop) ===
call npm run dev
pause
