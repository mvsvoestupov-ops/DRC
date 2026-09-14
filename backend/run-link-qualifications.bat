@echo off
cd /d %~dp0
echo Relink all NARK qualifications + audit report...
call venv\Scripts\python.exe scripts\link_qualifications_to_standards.py
echo.
echo Report: scripts\output\qualification_links_audit.txt
pause
