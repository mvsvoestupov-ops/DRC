@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\backend
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
set "LOG=scripts\output\_ping_deepseek.txt"

echo === LOCAL === > "%LOG%"
if exist venv\Scripts\python.exe (
  venv\Scripts\python.exe scripts\output\_ping_deepseek.py >> "%LOG%" 2>&1
) else (
  python scripts\output\_ping_deepseek.py >> "%LOG%" 2>&1
)
echo LOCAL_RC=%ERRORLEVEL% >> "%LOG%"

echo. >> "%LOG%"
echo === SERVER === >> "%LOG%"
type scripts\output\_ping_deepseek.py | ssh -i "%SSH_KEY%" -p 22 -o StrictHostKeyChecking=accept-new root@201.34.149.65 "tr -d '\r' > /tmp/_ping_deepseek.py && cd /opt/drc/backend && DRC_BACKEND=/opt/drc/backend ./venv/bin/python /tmp/_ping_deepseek.py" >> "%LOG%" 2>&1
echo SERVER_RC=%ERRORLEVEL% >> "%LOG%"
type "%LOG%"
