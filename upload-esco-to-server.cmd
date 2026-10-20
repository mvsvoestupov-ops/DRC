@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

REM === Загрузка локального ESCO RDF на VPS (файл НЕ в git) ===
REM Запускайте из cmd.exe:
REM   upload-esco-to-server.cmd
REM   upload-esco-to-server.cmd /import   — ещё и импорт в SQLite на сервере
REM ===========================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
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

set "SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" (
  set "SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
  echo SSH-ключ: %SSH_KEY%
) else (
  echo.
  echo Ошибка: SSH-ключ не найден:
  echo   %SSH_KEY%
  echo.
  echo Создайте ключ или скопируйте существующий в этот путь,
  echo либо уберите проверку и используйте ssh-agent / пароль.
  echo Пробую ssh без -i ...
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

echo == scp %LOCAL_RDF%
echo    -^> %SSH_USER%@%SSH_HOST%:%REMOTE_RDF%
scp %SSH_OPTS% "%LOCAL_RDF%" %SSH_USER%@%SSH_HOST%:%REMOTE_RDF%
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
