@echo off
cd /d "%~dp0"
echo === Deploying to Vercel (production) ===
call vercel --prod
pause
