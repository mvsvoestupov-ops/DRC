@echo off
cd /d C:\IT\DRC\backend
if exist venv\Scripts\python.exe (
  venv\Scripts\python.exe -u scripts\repair_missing_tf_from_html.py > scripts\output\_repair_missing_tf_result.json 2>&1
) else (
  py -3 -u scripts\repair_missing_tf_from_html.py > scripts\output\_repair_missing_tf_result.json 2>&1
)
exit /b %ERRORLEVEL%
