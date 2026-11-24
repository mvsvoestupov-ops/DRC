@echo off
chcp 65001 >nul
cd /d C:\IT\DRC
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
set "LOG=C:\IT\DRC\_tmp_orgs_result.txt"

echo === SERVER ORG QUERY (read-only, no remote writes) === > "%LOG%"
type C:\IT\DRC\_tmp_query_orgs.py | ssh -i "%SSH_KEY%" -p 22 -o StrictHostKeyChecking=accept-new root@201.34.149.65 "/opt/drc/backend/venv/bin/python -" >> "%LOG%" 2>&1
echo RC=%ERRORLEVEL% >> "%LOG%"
type "%LOG%"
