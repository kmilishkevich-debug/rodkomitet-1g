@echo off
cd /d "%~dp0"
echo Downloading mascot scenes... > mascot-download-log.txt
curl.exe -sS -L -o "public\mascot\scene-start.png" "https://d8j0ntlcm91z4.cloudfront.net/user_3BP7iJ4uYIrLNxHrxF0QfcL2KS4/hf_20260918_074151_1f02f629-151f-46b5-a49a-08a96061e169.png" >> mascot-download-log.txt 2>&1
if errorlevel 1 (echo FAIL scene-start >> mascot-download-log.txt) else (echo OK scene-start >> mascot-download-log.txt)
curl.exe -sS -L -o "public\mascot\scene-grow.png" "https://d8j0ntlcm91z4.cloudfront.net/user_3BP7iJ4uYIrLNxHrxF0QfcL2KS4/hf_20260918_073313_c3b049b4-2dbe-4db2-b9b2-cbb3c5f8e5e0.png" >> mascot-download-log.txt 2>&1
if errorlevel 1 (echo FAIL scene-grow >> mascot-download-log.txt) else (echo OK scene-grow >> mascot-download-log.txt)
curl.exe -sS -L -o "public\mascot\scene-near.png" "https://d8j0ntlcm91z4.cloudfront.net/user_3BP7iJ4uYIrLNxHrxF0QfcL2KS4/hf_20260918_074151_9a13766b-aa29-42c2-a631-1789b04fb1e1.png" >> mascot-download-log.txt 2>&1
if errorlevel 1 (echo FAIL scene-near >> mascot-download-log.txt) else (echo OK scene-near >> mascot-download-log.txt)
curl.exe -sS -L -o "public\mascot\scene-done.png" "https://d8j0ntlcm91z4.cloudfront.net/user_3BP7iJ4uYIrLNxHrxF0QfcL2KS4/hf_20260918_074151_a2da7ed1-9e3e-4348-b575-e442b32cebe4.png" >> mascot-download-log.txt 2>&1
if errorlevel 1 (echo FAIL scene-done >> mascot-download-log.txt) else (echo OK scene-done >> mascot-download-log.txt)
curl.exe -sS -L -o "public\mascot\scene-compact.png" "https://d8j0ntlcm91z4.cloudfront.net/user_3BP7iJ4uYIrLNxHrxF0QfcL2KS4/hf_20260918_074151_57cf82e5-216c-4622-8279-dced7eead8d8.png" >> mascot-download-log.txt 2>&1
if errorlevel 1 (echo FAIL scene-compact >> mascot-download-log.txt) else (echo OK scene-compact >> mascot-download-log.txt)
dir /b public\mascot\scene-*.png >> mascot-download-log.txt 2>&1
echo DONE >> mascot-download-log.txt
