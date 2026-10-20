@echo off
setlocal
cd /d "%~dp0.."
if not exist "venv\Scripts\python.exe" (
  echo [!] Не найден venv\Scripts\python.exe в %CD%
  echo     Запускайте так из корня репозитория:
  echo       backend\scripts\search_partner_mapping.cmd --list
  echo     или из backend:
  echo       scripts\search_partner_mapping.cmd --list
  exit /b 1
)
if "%~1"=="" (
  echo Использование:
  echo   scripts\search_partner_mapping.cmd --list
  echo   scripts\search_partner_mapping.cmd --competence-id 123 --dry-run
  echo   scripts\search_partner_mapping.cmd --competence-id 123 --systems KZ --apply
  echo.
  echo Вместо 123 подставьте числовой id компетенции из --list
  echo Найденное вставляется с источником и уверенностью (высокий/средний/низкий).
  exit /b 1
)
venv\Scripts\python.exe scripts\search_partner_mapping.py %*
exit /b %ERRORLEVEL%
