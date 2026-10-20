@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM === конфигурация сервера (как в push-and-deploy.cmd) ===
set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "LOCAL_RDF=%~dp0ESCO\esco-v1.2.0.rdf"
set "REMOTE_RDF=%REMOTE_DIR%/ESCO/esco-v1.2.0.rdf"
REM ========================================================

REM Запускайте из cmd.exe:
REM   upload-esco-to-server.cmd           — пауза → scp RDF + импорт на сервере
REM   upload-esco-to-server.cmd /y        — без паузы
REM   upload-esco-to-server.cmd /upload   — только залить RDF
REM   upload-esco-to-server.cmd /import   — только импорт (RDF уже на сервере)

set "SKIP_PAUSE="
set "MODE=all"

if /I "%~1"=="/y" set "SKIP_PAUSE=1"
if /I "%~1"=="/upload" set "MODE=upload"
if /I "%~1"=="/import" set "MODE=import"
if /I "%~2"=="/y" set "SKIP_PAUSE=1"
if /I "%~1"=="/y" if /I "%~2"=="/upload" set "MODE=upload"
if /I "%~1"=="/y" if /I "%~2"=="/import" set "MODE=import"

where ssh >nul 2>&1
if errorlevel 1 (
  echo Ошибка: ssh не найден. Установите OpenSSH Client.
  exit /b 1
)
where scp >nul 2>&1
if errorlevel 1 (
  echo Ошибка: scp не найден. Установите OpenSSH Client.
  exit /b 1
)

if /I not "%MODE%"=="import" (
  if not exist "%LOCAL_RDF%" (
    echo Ошибка: нет локального RDF:
    echo   %LOCAL_RDF%
    exit /b 1
  )
)

if not exist "%SSH_KEY%" (
  echo Ошибка: SSH-ключ не найден:
  echo   %SSH_KEY%
  exit /b 1
)

set SSH_OPTS=-i %SSH_KEY% -p %SSH_PORT% -o StrictHostKeyChecking=accept-new

if defined SKIP_PAUSE goto :ready

echo.
echo Загрузка ESCO на сервер
echo   Хост:     %SSH_USER%@%SSH_HOST%:%SSH_PORT%
echo   Каталог:  %REMOTE_DIR%
echo   Ключ:     %SSH_KEY%
echo   Локально: %LOCAL_RDF%
echo   На сервере: %REMOTE_RDF%
echo   Режим:    %MODE%  ^(all = scp + import, upload = только scp, import = только импорт^)
echo.
echo Внимание: импорт RDF на VPS долгий ^(как локально^).
echo Серверная profstandart.db не заменяется целиком — пишутся только таблицы esco_*.
echo.
echo Enter = продолжить. Ctrl+C = отмена.
pause >nul

:ready
echo.

if /I "%MODE%"=="import" goto :import

echo == mkdir %REMOTE_DIR%/ESCO
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "mkdir -p '%REMOTE_DIR%/ESCO'"
if errorlevel 1 (
  echo Ошибка: ssh mkdir не прошёл.
  exit /b 1
)

echo == scp esco-v1.2.0.rdf → сервер
scp %SSH_OPTS% "%LOCAL_RDF%" %SSH_USER%@%SSH_HOST%:"%REMOTE_RDF%"
if errorlevel 1 (
  echo Ошибка: scp не прошёл.
  exit /b 1
)
echo RDF залит.

if /I "%MODE%"=="upload" (
  echo.
  echo Только загрузка готова. Импорт: upload-esco-to-server.cmd /import
  endlocal
  exit /b 0
)

:import
echo == импорт ESCO RDF в SQLite на сервере
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "cd '%REMOTE_DIR%/backend' && ./venv/bin/python -u scripts/import_esco_rdf.py --clear --path '../ESCO/esco-v1.2.0.rdf'"
if errorlevel 1 (
  echo Ошибка: импорт на сервере не прошёл.
  exit /b 1
)

echo == restart backend
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "systemctl restart drc-backend; systemctl --no-pager --lines=15 status drc-backend || true"
if errorlevel 1 (
  echo Предупреждение: restart/status вернул код ошибки — проверьте service вручную.
)

echo.
echo Готово. Проверка: https://drc.ao-nk.online — шаг 9.2, поиск ESCO должен быть source=local.
endlocal
exit /b 0
