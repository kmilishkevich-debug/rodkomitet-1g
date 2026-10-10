@echo off
cd /d "%~dp0"
echo Installing libraries (jszip)...
call npm install
echo.
echo DONE! Now you can close this window and run 5-push.bat
pause
