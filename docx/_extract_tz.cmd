@echo off
cd /d C:\IT\DRC\docx
if not exist "tz_international_harmonization.docx" (
  copy /Y "C:\СТАВРОПОЛЬ\Стратсессия № 3\ТЗ для международной гармонизации компетенции.docx" "C:\IT\DRC\docx\tz_international_harmonization.docx"
)
python _extract_tz.py
if errorlevel 1 py -3 _extract_tz.py
echo EXITCODE=%ERRORLEVEL%
if exist tz_international_harmonization.txt (
  echo TXT_OK
) else (
  echo TXT_MISSING
)
