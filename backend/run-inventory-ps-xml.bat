@echo off
cd /d C:\IT\DRC\backend
venv\Scripts\python.exe scripts\inventory_ps_xml_tags.py
echo Exit code: %ERRORLEVEL%
pause
