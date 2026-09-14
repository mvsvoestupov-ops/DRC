@echo off
cd /d C:\IT\DRC\docx
python _extract.py
dir /b
echo EXITCODE=%ERRORLEVEL%
