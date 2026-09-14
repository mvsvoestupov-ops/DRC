@echo off
chcp 65001 >nul 2>&1
setlocal
cd /d "%~dp0"
echo === Импорт матрицы дескрипторов из Matrix_for_projekt.docx ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe scripts\import_level_matrix.py
) else (
  python scripts\import_level_matrix.py
)
echo.
pause
