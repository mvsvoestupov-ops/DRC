@echo off
python "C:\IT\DRC\backend\scripts\modernize_title_slide.py" > "C:\IT\DRC\backend\scripts\output\modernize_run.log" 2>&1
echo EXIT_CODE=%ERRORLEVEL% >> "C:\IT\DRC\backend\scripts\output\modernize_run.log"
