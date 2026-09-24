@echo off
cd /d "%~dp0"
echo === Sending commit to GitHub ===
echo.
git log --oneline -1
echo.
git push origin main
echo.
echo === Done. If no errors above, Vercel will build automatically. ===
pause
