@echo off
cd /d "%~dp0"
echo === RETRY === > git-log.txt
git config user.name "Kristina Milishkevich" >> git-log.txt 2>&1
git config user.email "k.milishkevich@gmail.com" >> git-log.txt 2>&1
git rm -r --cached . >/dev/null 2>&1
git add . >> git-log.txt 2>&1
git commit -m "Kassa klassa: Next.js port of prototype" >> git-log.txt 2>&1
git branch -M main >> git-log.txt 2>&1
git push -u origin main >> git-log.txt 2>&1
echo === DONE === >> git-log.txt
exit
