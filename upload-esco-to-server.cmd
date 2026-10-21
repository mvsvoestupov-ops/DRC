@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

REM === Загрузка локального ESCO RDF на VPS (файл НЕ в git) ===
REM   upload-esco-to-server.cmd
REM   upload-esco-to-server.cmd /import
REM У scp порт = -P (заглавная), у ssh = -p
REM ===========================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "REMOTE_DIR=/opt/drc"
set "LOCAL_RDF=%~dp0ESCO\esco-v1.2.0.rdf"
set "REMOTE_RDF=%REMOTE_DIR%/ESCO/esco-v1.2.0.rdf"
set "DO_IMPORT="

if /I "%~1"=="/import" set "DO_IMPORT=1"

if not exist "%LOCAL_RDF%" (
  echo Ошибка: нет файла %LOCAL_RDF%
  echo Положите esco-v1.2.0.rdf в каталог ESCO\
  exit /b 1
)

set "SSH_KEY="
if exist "%USERPROFILE%\.ssh\id_ed25519_drc" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not defined SSH_KEY if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

REM ssh: -p порт; scp (OpenSSH Windows): -P порт (-p у scp = preserve times)
if defined SSH_KEY (
  echo SSH-ключ: %SSH_KEY%
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new
  set SCP_OPTS=-i "%SSH_KEY%" -P %SSH_PORT% -o StrictHostKeyChecking=accept-new
) else (
  echo SSH-ключ не найден в .ssh — пробую без -i ^(агент / пароль^)
  set SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new
  set SCP_OPTS=-P %SSH_PORT% -o StrictHostKeyChecking=accept-new
)

where scp >nul 2>&1
if errorlevel 1 (
  echo Ошибка: scp не найден. Установите OpenSSH Client.
  exit /b 1
)

echo.
echo == mkdir remote ESCO
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "mkdir -p %REMOTE_DIR%/ESCO"
if errorlevel 1 (
  echo Ошибка: ssh mkdir не удался.
  exit /b 1
)

echo == scp "%LOCAL_RDF%"
echo    -^> %SSH_USER%@%SSH_HOST%:%REMOTE_RDF%
scp %SCP_OPTS% "%LOCAL_RDF%" %SSH_USER%@%SSH_HOST%:%REMOTE_RDF%
if errorlevel 1 (
  echo Ошибка: scp не удался.
  exit /b 1
)

if defined DO_IMPORT (
  echo == import ESCO RDF on server
  ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd %REMOTE_DIR%/backend && ./venv/bin/python -u scripts/import_esco_rdf.py --path ../ESCO/esco-v1.2.0.rdf"
  if errorlevel 1 (
    echo Ошибка: импорт на сервере не удался.
    exit /b 1
  )
)

echo.
echo Готово: %REMOTE_RDF%
if not defined DO_IMPORT (
  echo Импорт в БД: upload-esco-to-server.cmd /import
)
endlocal
exit /b 0
