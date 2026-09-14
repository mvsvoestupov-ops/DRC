@echo off
setlocal
cd /d "%~dp0"
echo === Построение индекса profstandarty на classinform.ru ===
if exist "venv\Scripts\python.exe" (
  venv\Scripts\python.exe -c "import sys; sys.path.insert(0,'.'); from app.classinform_parser import build_ps_index; build_ps_index(refresh=True); print('Готово.')"
) else (
  python -c "import sys; sys.path.insert(0,'.'); from app.classinform_parser import build_ps_index; build_ps_index(refresh=True); print('Готово.')"
)
pause
