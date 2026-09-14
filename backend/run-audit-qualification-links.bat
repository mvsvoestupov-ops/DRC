@echo off
cd /d %~dp0
echo Audit qualification links (no changes)...
call venv\Scripts\python.exe scripts\link_qualifications_to_standards.py --audit-only
echo.
echo Report: scripts\output\qualification_links_audit.txt
pause
