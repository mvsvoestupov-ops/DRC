@echo off
cd /d "%~dp0"
python -m pip install python-docx -q
python "_build_spravka_docx.py"
if errorlevel 1 (
  echo.
  echo If python failed, try: py -3 -m pip install python-docx
  echo Then: py -3 "_build_spravka_docx.py"
  exit /b 1
)
echo.
echo Done: "%~dp0spravka-proekta.docx"
