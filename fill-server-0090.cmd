@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"

REM ============================================================
REM  Заполнить на сервере RUS-PK-0090 случайными данными до шага 7
REM  Статус остаётся «проект», wizard_step=8 (МТО).
REM
REM  Запуск из cmd.exe:
REM    C:\IT\DRC\fill-server-0090.cmd
REM ============================================================

set "SSH_HOST=201.34.149.65"
set "SSH_PORT=22"
set "SSH_USER=root"
set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519_drc"
set "REMOTE_DIR=/opt/drc"
set "PUBLIC_CODE=RUS-PK-0090"
set "LOCAL_PY=%~dp0backend\scripts\output\_fill_server_0090.py"
set "REMOTE_PY=/tmp/_fill_server_0090.py"
set "LOG=%~dp0backend\scripts\output\_fill_server_0090.txt"

if not exist "%LOCAL_PY%" (
  echo Ошибка: нет файла %LOCAL_PY%
  exit /b 1
)

where ssh >nul 2>&1
if errorlevel 1 (
  echo Ошибка: ssh не найден. Установите OpenSSH Client.
  exit /b 1
)

if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_ed25519" set "SSH_KEY=%USERPROFILE%\.ssh\id_ed25519"
if not exist "%SSH_KEY%" if exist "%USERPROFILE%\.ssh\id_rsa" set "SSH_KEY=%USERPROFILE%\.ssh\id_rsa"

set "SSH_OPTS=-p %SSH_PORT% -o StrictHostKeyChecking=accept-new"
if exist "%SSH_KEY%" (
  set SSH_OPTS=-i "%SSH_KEY%" -p %SSH_PORT% -o StrictHostKeyChecking=accept-new
  echo SSH-ключ: %SSH_KEY%
) else (
  echo Ключ не найден — пробую ssh без -i ^(пароль / агент^)
)

echo.
echo Сервер:  %SSH_USER%@%SSH_HOST%:%SSH_PORT%
echo Код:     %PUBLIC_CODE%
echo Скрипт:  %LOCAL_PY%
echo.
echo Enter = загрузить и выполнить на сервере. Ctrl+C = отмена.
pause >nul

echo.
echo == upload script
type "%LOCAL_PY%" | ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "tr -d '\r' > %REMOTE_PY%"
if errorlevel 1 (
  echo Ошибка загрузки скрипта по SSH.
  exit /b 1
)

echo == run on server
ssh %SSH_OPTS% %SSH_USER%@%SSH_HOST% "export DRC_BACKEND=%REMOTE_DIR%/backend DRC_PUBLIC_CODE=%PUBLIC_CODE%; cd %REMOTE_DIR%/backend && if [ -x venv/bin/python ]; then venv/bin/python %REMOTE_PY%; else python3 %REMOTE_PY%; fi" > "%LOG%" 2>&1
set "RC=%ERRORLEVEL%"

echo.
echo ---- результат ----
type "%LOG%"
echo -------------------
echo Лог: %LOG%
if not "%RC%"=="0" (
  echo Код выхода: %RC%
  exit /b %RC%
)

echo.
echo Готово. Откройте edit_url из лога, шаг 7, кнопка «Направить на экспертизу».
endlocal
exit /b 0
