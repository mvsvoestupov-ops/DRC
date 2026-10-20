@echo off
cd /d "%~dp0.."
if not exist "venv\Scripts\python.exe" (
  echo Создайте venv и установите зависимости.
  exit /b 1
)
venv\Scripts\python.exe scripts\import_esco_rdf.py %*
exit /b %ERRORLEVEL%
