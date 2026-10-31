@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0.."

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

if not exist "%SSH_KEY%" (
  echo SSH key not found in %%USERPROFILE%%\.ssh
  exit /b 1
)

set "OUTDIR=%~dp0output"
if not exist "%OUTDIR%" mkdir "%OUTDIR%"
set "OUT=%OUTDIR%\competence_32_server.json"
set "DUMP_PY=%OUTDIR%\dump_comp_32.py"
set "REMOTE_PY=/tmp/dump_comp_32.py"

echo == Upload dump script
echo key: %SSH_KEY%
scp -i "%SSH_KEY%" -P %SSH_PORT% -o StrictHostKeyChecking=accept-new "%DUMP_PY%" %SSH_USER%@%SSH_HOST%:%REMOTE_PY%
if errorlevel 1 (
  echo FAIL scp
  exit /b 1
)

echo == Dump competence 32 from server
ssh -i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new %SSH_USER%@%SSH_HOST% "python3 %REMOTE_PY%" > "%OUT%"
if errorlevel 1 (
  echo FAIL dump
  type "%OUT%"
  exit /b 1
)

echo Saved %OUT%
echo.
echo == Import into local DB
if exist "venv\Scripts\python.exe" (
  "venv\Scripts\python.exe" scripts\_import_competence_json.py "%OUT%"
) else (
  python scripts\_import_competence_json.py "%OUT%"
)
exit /b %ERRORLEVEL%
