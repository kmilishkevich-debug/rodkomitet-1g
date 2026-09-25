@echo off
cd /d "%~dp0"
git add . > git-log.txt 2>&1
git commit -m "update" >> git-log.txt 2>&1
git push >> git-log.txt 2>&1
echo === DONE === >> git-log.txt
exit
