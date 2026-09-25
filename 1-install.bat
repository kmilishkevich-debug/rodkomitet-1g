@echo off
cd /d "%~dp0"
echo === Installing dependencies (2-4 min) ===
call npm install
echo.
echo === Done! Now run 2-start-local.bat ===
pause
