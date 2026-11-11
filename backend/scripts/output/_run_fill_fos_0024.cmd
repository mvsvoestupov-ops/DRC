@echo off
chcp 65001 >nul
cd /d C:\IT\DRC\backend
py -3 scripts\output\_fill_fos_0024.py
echo EXIT=%ERRORLEVEL%
type scripts\output\_fill_fos_0024.txt
